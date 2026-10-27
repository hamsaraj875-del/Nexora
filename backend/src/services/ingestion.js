import crypto from 'crypto';
import { Case } from '../models/Case.js';
import { CaseAction } from '../models/CaseAction.js';
import { Bureau } from '../models/Bureau.js';
import { SlaRule } from '../models/SlaRule.js';
import { normalizeCategory, normalizeStatus, normalizeDate } from './normalizer.js';
import { matchInstitution } from './matcher.js';
import { checkInstitutionOverlap } from './overlap.js';

/**
 * Generate a unique, collision-safe Case ID.
 * Format: AICTE-<SOURCE>-<YEAR>-<HEX6>
 * Verifies uniqueness against MongoDB to guarantee zero collisions.
 */
export const generateCaseId = async (sourceSystem = 'AICTE') => {
  const cleanSource = (sourceSystem || 'AICTE')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4) || 'AICT';
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidateId = `AICTE-${cleanSource}-${year}-${randomSuffix}`;
    const exists = await Case.exists({ caseId: candidateId });
    if (!exists) return candidateId;
  }

  // Fallback with timestamp base36
  return `AICTE-${cleanSource}-${year}-${Date.now().toString(36).toUpperCase()}`;
};

/**
 * Ingest an array of case items idempotently.
 * - Captures previous bureau/status before updating.
 * - Prevents duplicates via unique (sourceSystem, sourceCaseRef) index check.
 * - Re-importing identical records increments skipped count without duplicating.
 * - Validates required fields and reports actionable errors for bad dates/missing fields.
 */
export const ingestCases = async (rawCases, uploadedBy = null) => {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;
  let failedCount = 0;
  const errors = [];
  const processedInstitutions = new Set();

  // Cache bureaus
  const bureaus = await Bureau.find();
  const bureauByCode = new Map(bureaus.map((b) => [b.code.toUpperCase(), b]));
  const defaultBureau = bureaus[0] || null;

  // Cache SLA rules
  const slaRules = await SlaRule.find();
  const slaByCategory = new Map(slaRules.map((r) => [r.category, r]));

  for (let i = 0; i < rawCases.length; i++) {
    const item = rawCases[i];
    const rowNum = i + 1;
    const ref = item.sourceCaseRef || `ROW-${rowNum}`;

    try {
      // 1. Validate required fields
      if (!item.rawInstitutionName || !item.rawInstitutionName.trim()) {
        failedCount++;
        errors.push({
          row: rowNum,
          reference: ref,
          reason: 'Validation Error: Institution name is required.',
        });
        continue;
      }

      if (!item.description || !item.description.trim()) {
        failedCount++;
        errors.push({
          row: rowNum,
          reference: ref,
          reason: 'Validation Error: Complaint description is required.',
        });
        continue;
      }

      // 2. Validate and normalize dates, categories, statuses
      let receivedDate;
      try {
        receivedDate = normalizeDate(item.receivedDate, false);
      } catch (dateErr) {
        failedCount++;
        errors.push({
          row: rowNum,
          reference: ref,
          reason: `Date Validation Error: ${dateErr.message}`,
        });
        continue;
      }

      const category = normalizeCategory(item.category);
      const status = normalizeStatus(item.status);
      const cleanSourceSystem = (item.sourceSystem || 'MANUAL').trim().toUpperCase();

      // 3. Institution matching
      const matchResult = await matchInstitution({
        aictePermanentId: item.aictePermanentId,
        rawInstitutionName: item.rawInstitutionName,
        rawCity: item.rawCity,
        rawDistrict: item.rawDistrict,
        rawState: item.rawState,
        rawPincode: item.rawPincode,
      });

      if (matchResult.matchStatus === 'unmatched') {
        unmatchedCount++;
      }

      // SLA expected disposal calculation
      const sla = slaByCategory.get(category) || { daysToDispose: 30 };
      const expectedDisposalDate = new Date(receivedDate.getTime() + sla.daysToDispose * 24 * 60 * 60 * 1000);

      // Determine bureau
      let bureau = bureauByCode.get(cleanSourceSystem);
      if (!bureau) bureau = defaultBureau;

      // 4. Check if case already exists by sourceSystem + sourceCaseRef
      let existingCase = null;
      if (item.sourceCaseRef) {
        existingCase = await Case.findOne({
          sourceSystem: cleanSourceSystem,
          sourceCaseRef: item.sourceCaseRef,
        });
      }

      if (existingCase) {
        // Capture previous values BEFORE applying updates
        const prevStatus = existingCase.status;
        const prevBureauId = existingCase.currentBureau ? existingCase.currentBureau.toString() : null;
        const targetBureauId = bureau ? bureau._id.toString() : null;
        const bureauChanged = Boolean(targetBureauId && prevBureauId !== targetBureauId);
        const statusChanged = Boolean(status && prevStatus !== status);

        // Check if anything meaningful changed to ensure idempotency
        const categoryChanged = category && existingCase.category !== category;
        const descChanged = item.description && existingCase.description !== item.description;

        if (!statusChanged && !bureauChanged && !categoryChanged && !descChanged) {
          skippedCount++;
          if (existingCase.institution) {
            processedInstitutions.add(existingCase.institution.toString());
          }
          continue;
        }

        // Apply non-destructive updates
        if (status) existingCase.status = status;
        if (bureau) existingCase.currentBureau = bureau._id;
        if (category) existingCase.category = category;
        if (item.description) existingCase.description = item.description;

        // Only update institution if new match is confirmed (never silently overwrite with unmatched/review)
        if (matchResult.matchStatus === 'matched' && matchResult.institution) {
          existingCase.institution = matchResult.institution._id;
          existingCase.matchStatus = 'matched';
          existingCase.matchScore = matchResult.matchScore;
        }

        if (item.lastActionText) {
          existingCase.lastActionText = item.lastActionText;
          existingCase.lastActionDate = new Date();
        }

        await existingCase.save();

        // Record audit trail with accurate before and after bureaus
        if (statusChanged || bureauChanged) {
          await CaseAction.create({
            case: existingCase._id,
            actionType: bureauChanged ? 'transferred' : 'action_taken',
            fromBureau: bureauChanged && prevBureauId ? prevBureauId : undefined,
            toBureau: bureauChanged && targetBureauId ? targetBureauId : undefined,
            fromStatus: prevStatus,
            toStatus: status,
            performedBy: uploadedBy || undefined,
            remarks: bureauChanged
              ? `Bureau changed from ${prevBureauId || 'unassigned'} to ${bureau?.name || 'new bureau'} during data ingestion.`
              : `Status updated to ${status} via data sync.`,
            timestamp: new Date(),
          });
        }

        updatedCount++;
        if (existingCase.institution) {
          processedInstitutions.add(existingCase.institution.toString());
        }
      } else {
        // Create new case with unique collision-safe ID
        const caseId = await generateCaseId(cleanSourceSystem);
        const newCase = await Case.create({
          caseId,
          sourceSystem: cleanSourceSystem,
          sourceCaseRef: item.sourceCaseRef || caseId,
          institution: matchResult.matchStatus === 'matched' && matchResult.institution ? matchResult.institution._id : undefined,
          rawInstitutionName: item.rawInstitutionName.trim(),
          rawAddress: item.rawAddress || '',
          rawCity: item.rawCity || '',
          rawState: item.rawState || '',
          rawPincode: item.rawPincode || '',
          matchStatus: matchResult.matchStatus,
          matchScore: matchResult.matchScore,
          category,
          description: item.description.trim(),
          complainantType: item.complainantType || 'Complainant',
          receivedDate,
          status,
          currentBureau: bureau ? bureau._id : undefined,
          lastActionText: item.lastActionText || 'Case ingested into central monitoring',
          lastActionDate: new Date(),
          nextActionText: 'Awaiting bureau review/allocation',
          expectedDisposalDate,
        });

        // Audit action for initial ingestion
        await CaseAction.create({
          case: newCase._id,
          actionType: 'received',
          toBureau: bureau ? bureau._id : undefined,
          performedBy: uploadedBy || undefined,
          remarks: `Initial ingestion from ${cleanSourceSystem}. Match status: ${matchResult.matchStatus} (${matchResult.matchScore}%).`,
          timestamp: new Date(),
        });

        createdCount++;
        if (newCase.institution) {
          processedInstitutions.add(newCase.institution.toString());
        }
      }
    } catch (err) {
      failedCount++;
      errors.push({
        row: rowNum,
        reference: ref,
        reason: err.message,
      });
    }
  }

  // Recalculate overlap candidates for all affected institutions
  for (const instId of processedInstitutions) {
    try {
      await checkInstitutionOverlap(instId);
    } catch (overlapErr) {
      console.warn(`[Overlap] Error recalculating overlap for ${instId}:`, overlapErr.message);
    }
  }

  return {
    total: rawCases.length,
    inserted: createdCount,
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    unmatched: unmatchedCount,
    failed: failedCount,
    errors,
  };
};

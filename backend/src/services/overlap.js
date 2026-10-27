import { Case } from '../models/Case.js';
import { OverlapGroup } from '../models/OverlapGroup.js';
import { Bureau } from '../models/Bureau.js';
import { Alert } from '../models/Alert.js';
import { createOrUpdateAlert } from './alerts.js';

const OPEN_STATUSES = ['pending', 'under_process', 'needs_info', 'transferred', 'escalated'];

const REGULATORY_KEYWORDS = [
  'show-cause',
  'show cause',
  'inspection',
  'withdrawal',
  'penal',
  'derecognition',
  'affiliation cancelled',
  'legal notice',
  'fir',
  'fraud',
  'forgery',
  'fake',
  'capitation',
  'unapproved',
  'de-recognition',
  'disaffiliation',
  'ombudsman',
];

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'by',
  'as', 'from', 'this', 'that', 'it', 'or', 'are', 'was', 'be', 'has', 'have', 'been', 'case',
  'complaint', 'regarding', 'about', 'student', 'students', 'college', 'institute', 'institution'
]);

/**
 * Tokenize and normalize description for overlap keyword matching
 */
const extractTokens = (text = '') => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
};

const hasRegulatoryKeyword = (text = '') => {
  const lower = text.toLowerCase();
  return REGULATORY_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Compare two cases from different bureaus to determine relationship type.
 * Returns { overlapType: 'duplicate_complaint' | 'coordination_required' | 'different_complaints', score, reason }
 */
export const evaluateCasePair = (c1, c2) => {
  const text1 = `${c1.category || ''} ${c1.description || ''} ${c1.lastActionText || ''}`.toLowerCase();
  const text2 = `${c2.category || ''} ${c2.description || ''} ${c2.lastActionText || ''}`.toLowerCase();

  const b1Name = c1.currentBureau?.name || c1.sourceSystem || 'Bureau 1';
  const b2Name = c2.currentBureau?.name || c2.sourceSystem || 'Bureau 2';

  const tokens1 = new Set(extractTokens(text1));
  const tokens2 = new Set(extractTokens(text2));

  let commonTokens = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) commonTokens++;
  }
  const unionSize = new Set([...tokens1, ...tokens2]).size || 1;
  const jaccard = commonTokens / unionSize;

  const sameCategory = c1.category && c2.category && c1.category.toLowerCase() === c2.category.toLowerCase();

  const date1 = new Date(c1.receivedDate || c1.createdAt || Date.now());
  const date2 = new Date(c2.receivedDate || c2.createdAt || Date.now());
  const diffDays = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));

  const c1Reg = hasRegulatoryKeyword(text1);
  const c2Reg = hasRegulatoryKeyword(text2);

  // 1. Potential Duplicate Complaint Check:
  // Same category + meaningful token overlap + filed within 120 days
  if (sameCategory && (jaccard >= 0.25 || commonTokens >= 4) && diffDays <= 120) {
    return {
      overlapType: 'duplicate_complaint',
      score: Math.min(98, Math.round(75 + jaccard * 40)),
      reason: `Potential duplicate complaint: Identical category (${c1.category}) with matching complaint details filed across ${b1Name} and ${b2Name} within ${Math.round(diffDays)} days.`,
    };
  }

  // 2. Related Cases Requiring Coordination:
  // Regulatory action in one bureau alongside grievance in another OR related issues
  if (c1Reg || c2Reg) {
    const regBureau = c1Reg ? b1Name : b2Name;
    const otherBureau = c1Reg ? b2Name : b1Name;
    const otherCat = c1Reg ? c2.category : c1.category;
    return {
      overlapType: 'coordination_required',
      score: 82,
      reason: `Cross-bureau coordination required: Active regulatory action in ${regBureau} coincides with ${otherCat} inquiry in ${otherBureau}. Joint review required to prevent contradictory directives.`,
    };
  }

  // Related categories:
  const relatedCategories = [
    ['Fee Issues', 'Admission Irregularities'],
    ['Infrastructure', 'Faculty Shortage'],
    ['Harassment', 'Regulatory Compliance'],
  ];
  const isRelatedCat = relatedCategories.some(
    ([a, b]) =>
      (c1.category === a && c2.category === b) ||
      (c1.category === b && c2.category === a)
  );

  if (isRelatedCat || jaccard >= 0.18 || commonTokens >= 3) {
    return {
      overlapType: 'coordination_required',
      score: 70,
      reason: `Related institutional issues across ${b1Name} (${c1.category}) and ${b2Name} (${c2.category}) concerning the same campus.`,
    };
  }

  // 3. Different complaints concerning the same institution
  return {
    overlapType: 'different_complaints',
    score: 30,
    reason: `Different complaints concerning the same institution: Independent matters in ${b1Name} (${c1.category}) and ${b2Name} (${c2.category}) without issue overlap.`,
  };
};

/**
 * Checks overlap status for an institution and creates/updates/closes OverlapGroup.
 * - Respects previous dismissals to avoid duplicate repeated alerts.
 * - Distinguishes between duplicate complaints, coordination required, and separate complaints.
 */
export const checkInstitutionOverlap = async (institutionId) => {
  if (!institutionId) return null;

  // 1. Collect all open cases for the institution
  const openCases = await Case.find({
    institution: institutionId,
    status: { $in: OPEN_STATUSES },
  })
    .populate('currentBureau')
    .populate('assignedOfficer', 'name email');

  // Group by distinct bureau ID
  const bureauMap = new Map();
  for (const c of openCases) {
    if (c.currentBureau) {
      const bId = c.currentBureau._id.toString();
      if (!bureauMap.has(bId)) {
        bureauMap.set(bId, []);
      }
      bureauMap.get(bId).push(c);
    }
  }

  const distinctBureausCount = bureauMap.size;

  // Check if an existing open or resolved OverlapGroup exists
  let group = await OverlapGroup.findOne({
    institution: institutionId,
    status: 'open',
  });

  const previouslyDismissedGroup = await OverlapGroup.findOne({
    institution: institutionId,
    status: 'dismissed',
  }).sort({ updatedAt: -1 });

  const dismissedPairsSet = new Set(previouslyDismissedGroup?.dismissedCasePairs || []);

  // If cases belong to 2 or more different bureaus/cells:
  if (distinctBureausCount >= 2) {
    const candidatePairs = [];
    let hasDuplicate = false;
    let hasCoordination = false;
    let maxSeverity = 'low';

    // Evaluate all cross-bureau pairs
    const bureauList = Array.from(bureauMap.entries());
    for (let i = 0; i < bureauList.length; i++) {
      for (let j = i + 1; j < bureauList.length; j++) {
        const casesA = bureauList[i][1];
        const casesB = bureauList[j][1];

        for (const c1 of casesA) {
          for (const c2 of casesB) {
            const pairKey = [c1._id.toString(), c2._id.toString()].sort().join(':');
            const evalResult = evaluateCasePair(c1, c2);

            // Skip pairs that were explicitly reviewed and dismissed
            if (dismissedPairsSet.has(pairKey)) {
              continue;
            }

            if (evalResult.overlapType === 'duplicate_complaint') {
              hasDuplicate = true;
              maxSeverity = 'high';
              candidatePairs.push({
                caseA: c1._id,
                caseB: c2._id,
                overlapType: evalResult.overlapType,
                score: evalResult.score,
                reason: evalResult.reason,
              });
            } else if (evalResult.overlapType === 'coordination_required') {
              hasCoordination = true;
              if (maxSeverity !== 'high') maxSeverity = 'medium';
              candidatePairs.push({
                caseA: c1._id,
                caseB: c2._id,
                overlapType: evalResult.overlapType,
                score: evalResult.score,
                reason: evalResult.reason,
              });
            }
          }
        }
      }
    }

    // If there are NO candidate pairs requiring coordination or flagged as duplicates
    // (i.e. all open cases are different unrelated complaints, or previously dismissed):
    if (candidatePairs.length === 0) {
      if (group) {
        group.status = 'coordinated';
        group.resolutionRemarks = 'All concurrent cases reviewed as separate complaints or resolved.';
        group.resolvedAt = new Date();
        await group.save();
        await Alert.updateMany({ overlapGroup: group._id, resolvedAt: { $exists: false } }, { resolvedAt: new Date() });
      }
      return null;
    }

    // Determine primary overlap type and synthesis reason
    const primaryType = hasDuplicate ? 'duplicate_complaint' : 'coordination_required';
    const topReason = candidatePairs[0]?.reason ||
      `Cross-bureau coordination required across ${distinctBureausCount} bureaus for concurrent cases.`;

    const caseIds = openCases.map((c) => c._id);

    if (!group) {
      group = await OverlapGroup.create({
        institution: institutionId,
        cases: caseIds,
        status: 'open',
        severity: maxSeverity,
        overlapType: primaryType,
        reason: topReason,
        candidatePairs,
      });
    } else {
      group.cases = caseIds;
      group.severity = maxSeverity;
      group.overlapType = primaryType;
      group.reason = topReason;
      group.candidatePairs = candidatePairs;
      await group.save();
    }

    // Raise/update Alert with explainable reason
    await createOrUpdateAlert({
      alertType: 'overlap',
      institutionId,
      overlapGroupId: group._id,
      message: `[${primaryType === 'duplicate_complaint' ? 'Duplicate Alert' : 'Coordination Alert'}] ${topReason}`,
      severity: maxSeverity,
      targetRoles: ['senior_management', 'super_admin', 'bureau_officer'],
    });

    return group;
  } else {
    // If cases no longer span multiple bureaus, auto-resolve the group and its alert
    if (group) {
      group.status = 'coordinated';
      group.resolutionRemarks = 'Automatically resolved: Active cases no longer span multiple bureaus.';
      group.resolvedAt = new Date();
      await group.save();
      await Alert.updateMany({ overlapGroup: group._id, resolvedAt: { $exists: false } }, { resolvedAt: new Date() });
    }
    return null;
  }
};

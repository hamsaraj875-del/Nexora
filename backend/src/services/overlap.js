
import { Case } from '../models/Case.js';
import { OverlapGroup } from '../models/OverlapGroup.js';
import { createOrUpdateAlert } from './alerts.js';
const explanationJobsInFlight = new Set();
import { getOrGenerateOverlapExplanation } from './overlapExplanation.js';

const scheduleOverlapExplanations = (group, candidatePairs, openCases) => {
  for (const pair of candidatePairs) {
    const caseIds = [
      pair.caseA.toString(),
      pair.caseB.toString(),
    ].sort();

    const jobKey = `${group._id}:${caseIds.join(':')}`;

    if (explanationJobsInFlight.has(jobKey)) continue;

    explanationJobsInFlight.add(jobKey);
    setImmediate(async () => {
      try {
        const caseA = openCases.find(
          (item) => item._id.toString() === pair.caseA.toString()
        );

        const caseB = openCases.find(
          (item) => item._id.toString() === pair.caseB.toString()
        );

        if (!caseA || !caseB) {
          throw new Error('Could not find both complaint records.');
        }

        await getOrGenerateOverlapExplanation({
          overlapGroupId: group._id,
          caseA,
          caseB,
          evidence: pair.evidence,
          heuristicScore: pair.score,
          overlapType: pair.overlapType,
        });

        console.log(
          `[OVERLAP AI] Explanation processed for pair ${caseIds.join(' / ')}`
        );
      } catch (error) {
        console.error(
          `[OVERLAP AI] Explanation generation failed for ${jobKey}:`,
          error.message
        );
      } finally {
        explanationJobsInFlight.delete(jobKey);
      }
    });
  }
};

const OPEN_STATUSES = [
  'pending',
  'under_process',
  'needs_info',
  'transferred',
  'escalated',
];

// Only meaningful regulatory signals.
// Generic words such as "inspection" are deliberately excluded.
const REGULATORY_KEYWORDS = [
  'show-cause',
  'show cause',
  'withdrawal',
  'penalty',
  'penal action',
  'derecognition',
  'de-recognition',
  'affiliation cancelled',
  'legal notice',
  'fir',
  'fraud',
  'forgery',
  'fake',
  'capitation',
  'unapproved',
  'disaffiliation',
  'ombudsman',
  'regulatory inspection',
  'inspection order',
  'inspection notice',
];

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to',
  'for', 'of', 'with', 'by', 'as', 'from', 'this', 'that', 'it',
  'or', 'are', 'was', 'be', 'has', 'have', 'been', 'case',
  'complaint', 'regarding', 'about', 'student', 'students',
  'college', 'institute', 'institution', 'matter', 'relates',
  'requested', 'requests', 'submitted', 'received', 'reported',
  'beyond', 'approved', 'schedule', 'formal', 'institutional',
  'severe', 'records', 'initiated', 'enquiry', 'inquiry',
  'concerns', 'raised', 'complainant', 'issue', 'issues',
  'administration', 'department'
]);

// Remove the generated institution-name suffix before comparing descriptions.
const normalizeDescription = (description = '', caseItem = {}) => {
  let text = String(description)
    .replace(/\bthe matter relates to\b[\s\S]*$/i, '');

  const institutionNames = [
    caseItem.rawInstitutionName,
    caseItem.institution?.name
  ].filter(Boolean);

  for (const name of institutionNames) {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'gi'), ' ');
  }

  return text
    .replace(/\b(grievance registered under alternate institution name spelling)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTokens = (text = '') => {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(
      (token) => token.length > 2 && !STOPWORDS.has(token)
    );
};

const getRegulatoryKeywords = (text = '') => {
  const lower = String(text).toLowerCase();

  return REGULATORY_KEYWORDS.filter((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'i');

    return pattern.test(lower);
  });
};

const getValidDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateDifferenceDays = (dateA, dateB) => {
  if (!dateA || !dateB) return null;

  return Math.abs(
    (dateA.getTime() - dateB.getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

const getDescriptionSimilarity = (
  descriptionA = '',
  descriptionB = ''
) => {
  const tokensA = new Set(extractTokens(descriptionA));
  const tokensB = new Set(extractTokens(descriptionB));

  const commonTokens = [...tokensA].filter(token =>
    tokensB.has(token)
  );

  const unionSize = new Set([...tokensA, ...tokensB]).size;

  return {
    similarity: unionSize === 0
      ? 0
      : Math.round((commonTokens.length / unionSize) * 100),
    commonTokens,
    tokenCountA: tokensA.size,
    tokenCountB: tokensB.size
  };
};

/**
 * Compare two cases from different bureaus.
 *
 * score:
 * Existing heuristic score. It is NOT a probability.
 *
 * descriptionSimilarity:
 * Jaccard similarity calculated from complaint descriptions only,
 * excluding generated institution-name suffixes and boilerplate.
 */
export const evaluateCasePair = (c1, c2) => {
  const descriptionA = normalizeDescription(c1.description || '', c1);
  const descriptionB = normalizeDescription(c2.description || '', c2);

  const b1Name =
    c1.currentBureau?.name || c1.sourceSystem || 'Bureau 1';

  const b2Name =
    c2.currentBureau?.name || c2.sourceSystem || 'Bureau 2';

  const tokensA = new Set(extractTokens(descriptionA));
  const tokensB = new Set(extractTokens(descriptionB));

  const commonTokens = [...tokensA].filter(token =>
    tokensB.has(token)
  );

  const unionSize = new Set([...tokensA, ...tokensB]).size || 1;
  const jaccard = commonTokens.length / unionSize;

  const descriptionResult = getDescriptionSimilarity(
    descriptionA,
    descriptionB
  );

  const categoryA = String(c1.category || '').toLowerCase();
  const categoryB = String(c2.category || '').toLowerCase();

  const sameCategory =
    Boolean(categoryA) && categoryA === categoryB;

  const date1 = getValidDate(c1.receivedDate || c1.createdAt);
  const date2 = getValidDate(c2.receivedDate || c2.createdAt);
  const diffDays = getDateDifferenceDays(date1, date2);

  const regulatoryKeywordsA = getRegulatoryKeywords(descriptionA);
  const regulatoryKeywordsB = getRegulatoryKeywords(descriptionB);

  const evidence = {
    commonDescriptionTokens: descriptionResult.commonTokens,
    descriptionTokenCountA: descriptionResult.tokenCountA,
    descriptionTokenCountB: descriptionResult.tokenCountB,
    categoryMatch: sameCategory,
    dateDifferenceDays:
      diffDays === null ? null : Math.round(diffDays * 100) / 100,
    regulatoryKeywordsA,
    regulatoryKeywordsB
  };

  const result = (overlapType, score, reason) => ({
    overlapType,
    score,
    descriptionSimilarity: descriptionResult.similarity,
    evidence,
    reason
  });

  const issueSignals = {
    fee: /\b(fee|fees|capitation|surcharge|tuition|refund|payment|collection|quota|development)\b/i,
    admission: /\b(admission|admissions|intake|capacity|seat|seats|enrolment|enrollment|quota|capitation)\b/i,
    infrastructure: /\b(laboratory|equipment|workshop|facility|facilities|infrastructure|practical)\b/i,
    faculty: /\b(faculty|professor|professors|teacher|teachers|staff|teaching)\b/i,
    harassment: /\b(harassment|discrimination|bullying|assault|misconduct)\b/i,
    regulatory: /\b(show.?cause|penalty|derecognition|disaffiliation|fraud|forgery|legal notice|ombudsman)\b/i
  };

  const signalsA = Object.entries(issueSignals)
    .filter(([, pattern]) => pattern.test(descriptionA))
    .map(([name]) => name);

  const signalsB = Object.entries(issueSignals)
    .filter(([, pattern]) => pattern.test(descriptionB))
    .map(([name]) => name);

  const sharedSignals = signalsA.filter(signal =>
    signalsB.includes(signal)
  );

  // Potential duplicate complaint
  if (
   sameCategory &&
(
  commonTokens.length >= 3 ||
  (
    categoryA === 'admission irregularities' &&
    commonTokens.length >= 2
  )
) &&
jaccard >= 0.20 &&
diffDays !== null &&
diffDays <= 120
  ) {
    return result(
      'duplicate_complaint',
      Math.min(98, Math.round(75 + jaccard * 40)),
      `Potential duplicate complaint: matching issue details in ${b1Name} and ${b2Name}, filed within ${Math.round(diffDays)} days. Human verification is required.`
    );
  }

  const relatedCategories = [
    ['fee issues', 'admission irregularities'],
    ['infrastructure', 'faculty shortage'],
    ['harassment', 'regulatory compliance']
  ];

  const relatedCategoryPair = relatedCategories.some(([a, b]) =>
    (categoryA === a && categoryB === b) ||
    (categoryA === b && categoryB === a)
  );

  const meaningfulSharedTokens = commonTokens.filter(token =>
    token.length >= 4
  );

  const hasTextEvidence = meaningfulSharedTokens.length >= 2;
  const hasSharedDomainEvidence = sharedSignals.length > 0;

  const regulatoryEvidenceOnBoth =
    regulatoryKeywordsA.length > 0 &&
    regulatoryKeywordsB.length > 0;

  if (
    (relatedCategoryPair && (hasTextEvidence || hasSharedDomainEvidence)) ||
    (sameCategory && hasTextEvidence && jaccard >= 0.12) ||
    (hasSharedDomainEvidence && regulatoryEvidenceOnBoth)
  ) {
    return result(
      'coordination_required',
      70,
      `Potentially related institutional issues across ${b1Name} (${c1.category}) and ${b2Name} (${c2.category}). Shared issue evidence: ${[...new Set([...meaningfulSharedTokens, ...sharedSignals])].join(', ')}. Human review is required.`
    );
  }

  return result(
    'different_complaints',
    30,
    `Different complaints concerning the same institution: insufficient shared issue evidence between ${b1Name} (${c1.category}) and ${b2Name} (${c2.category}).`
  );
};

/**
 * Checks overlap status for an institution and updates its OverlapGroup.
 * Automated evaluation never impersonates an authorised officer's decision.
 */
export const checkInstitutionOverlap = async (institutionId) => {
  if (!institutionId) return null;

  // 1. Collect all open cases for the institution.
  const openCases = await Case.find({
    institution: institutionId,
    status: { $in: OPEN_STATUSES },
  })
    .populate('currentBureau')
    .populate('assignedOfficer', 'name email');

  // 2. Group cases by bureau.
  const bureauMap = new Map();

  for (const caseItem of openCases) {
    if (!caseItem.currentBureau) continue;

    const bureauId = caseItem.currentBureau._id.toString();

    if (!bureauMap.has(bureauId)) {
      bureauMap.set(bureauId, []);
    }

    bureauMap.get(bureauId).push(caseItem);
  }

  const distinctBureausCount = bureauMap.size;

  // 3. Find an existing open group.
  let group = await OverlapGroup.findOne({
    institution: institutionId,
    status: 'open',
  });

  const previouslyDismissedGroup = await OverlapGroup.findOne({
    institution: institutionId,
    status: 'dismissed',
  }).sort({ updatedAt: -1 });

  const dismissedPairsSet = new Set(
    previouslyDismissedGroup?.dismissedCasePairs || []
  );

  // 4. Evaluate cross-bureau cases.
  if (distinctBureausCount >= 2) {
    const candidatePairs = [];

    let hasDuplicate = false;
    let maxSeverity = 'low';

    const bureauList = Array.from(bureauMap.entries());

    for (let i = 0; i < bureauList.length; i++) {
      for (let j = i + 1; j < bureauList.length; j++) {
        const casesA = bureauList[i][1];
        const casesB = bureauList[j][1];

        for (const c1 of casesA) {
          for (const c2 of casesB) {
            const pairKey = [
              c1._id.toString(),
              c2._id.toString(),
            ].sort().join(':');

            // Skip explicitly dismissed pairs.
            if (dismissedPairsSet.has(pairKey)) continue;

            const evalResult = evaluateCasePair(c1, c2);

            if (evalResult.overlapType === 'duplicate_complaint') {
              hasDuplicate = true;
              maxSeverity = 'high';

              candidatePairs.push({
                caseA: c1._id,
                caseB: c2._id,
                overlapType: evalResult.overlapType,
                score: evalResult.score,
                reason: evalResult.reason,
                descriptionSimilarity:
                  evalResult.descriptionSimilarity,
                evidence: evalResult.evidence,
              });
            } else if (
              evalResult.overlapType === 'coordination_required'
            ) {
              if (maxSeverity !== 'high') {
                maxSeverity = 'medium';
              }

              candidatePairs.push({
                caseA: c1._id,
                caseB: c2._id,
                overlapType: evalResult.overlapType,
                score: evalResult.score,
                reason: evalResult.reason,
                descriptionSimilarity:
                  evalResult.descriptionSimilarity,
                evidence: evalResult.evidence,
              });
            }
          }
        }
      }
    }

    // 5. No qualifying candidate pairs remain.
    // Keep the group open for authorised human review.
    if (candidatePairs.length === 0) {
      if (group) {
        const evaluatedAt = new Date();

        group.cases = openCases.map((caseItem) => caseItem._id);
        group.candidatePairs = [];
        group.severity = 'low';
        group.overlapType = 'different_complaints';
        group.reason =
          'System re-evaluation found no qualifying overlap pairs. ' +
          'The complaints remain available for authorised officer review.';

        group.systemEvaluation = {
          outcome: 'no_candidates',
          evaluatedAt,
          remarks:
            'No candidate pairs currently meet the overlap detection criteria. ' +
            'No human resolution has been recorded.',
        };

        await group.save();

        await createOrUpdateAlert({
          alertType: 'overlap',
          institutionId,
          overlapGroupId: group._id,
          message:
            '[Re-evaluation] No qualifying overlap pairs currently detected. ' +
            'Authorised officer review is still required.',
          severity: 'low',
          targetRoles: [
            'senior_management',
            'super_admin',
            'bureau_officer',
          ],
        });
      }

      return null;
    }

    // 6. Determine the primary overlap type.
    const primaryType = hasDuplicate
      ? 'duplicate_complaint'
      : 'coordination_required';

    const topReason =
      candidatePairs[0]?.reason ||
      `Cross-bureau coordination required across ${distinctBureausCount} bureaus for concurrent cases.`;

    const caseIds = openCases.map((caseItem) => caseItem._id);
    const evaluatedAt = new Date();

    // 7. Create or update the overlap group.
    if (!group) {
      group = await OverlapGroup.create({
        institution: institutionId,
        cases: caseIds,
        status: 'open',
        severity: maxSeverity,
        overlapType: primaryType,
        reason: topReason,
        candidatePairs,
        systemEvaluation: {
          outcome: 'candidates_found',
          evaluatedAt,
          remarks:
            'Qualifying cross-bureau candidate pairs were detected. Human review is required.',
        },
      });
    } else {
      group.cases = caseIds;
      group.severity = maxSeverity;
      group.overlapType = primaryType;
      group.reason = topReason;
      group.candidatePairs = candidatePairs;
      group.systemEvaluation = {
        outcome: 'candidates_found',
        evaluatedAt,
        remarks:
          'Qualifying cross-bureau candidate pairs were detected. Human review is required.',
      };

      await group.save();
    }

    // 8. Create or update the overlap alert.
    await createOrUpdateAlert({
      alertType: 'overlap',
      institutionId,
      overlapGroupId: group._id,
      message: `[${
        primaryType === 'duplicate_complaint'
          ? 'Duplicate Alert'
          : 'Coordination Alert'
      }] ${topReason}`,
      severity: maxSeverity,
      targetRoles: [
        'senior_management',
        'super_admin',
        'bureau_officer',
      ],
    });
    // 9. Generate AI explanations asynchronously.
    // Existing heuristic detection remains unchanged.
    scheduleOverlapExplanations(group, candidatePairs, openCases);
    return group;
  }

  // 9. Fewer than two bureaus currently have open cases.
  // Record the system observation without resolving the group.
  if (group) {
    const evaluatedAt = new Date();

    group.cases = openCases.map((caseItem) => caseItem._id);
    group.candidatePairs = [];
    group.systemEvaluation = {
      outcome: 'no_cross_bureau_cases',
      evaluatedAt,
      remarks:
        'Fewer than two bureaus currently have open cases for this institution. ' +
        'The system has not recorded a human resolution.',
    };

    await group.save();

    await createOrUpdateAlert({
      alertType: 'overlap',
      institutionId,
      overlapGroupId: group._id,
      message:
        '[Re-evaluation] Active cases no longer span multiple bureaus. ' +
        'The overlap group remains open pending authorised officer review.',
      severity: 'low',
      targetRoles: [
        'senior_management',
        'super_admin',
        'bureau_officer',
      ],
    });
  }

  return null;
};

import { generateOverlapExplanation } from './overlapAI.js';

import {
  findStoredExplanation,
  saveOverlapExplanation,
} from './overlapExplanationStore.js';

export const getOrGenerateOverlapExplanation = async ({
  overlapGroupId,
  caseA,
  caseB,
  evidence,
  heuristicScore,
  overlapType,
}) => {
  if (!overlapGroupId || !caseA?._id || !caseB?._id) {
    throw new Error('Overlap group and both case IDs are required.');
  }

  // Reuse an explanation if the underlying evidence has not changed.
  const existing = await findStoredExplanation({
    overlapGroupId,
    caseA,
    caseB,
    evidence,
  });

  if (existing) {
    return existing;
  }

  // Generate a new explanation only when necessary.
  const aiAnalysis = await generateOverlapExplanation({
    caseA,
    caseB,
    evidence,
    heuristicScore,
    overlapType,
  });

  // Persist the explanation in MongoDB.
  return saveOverlapExplanation({
    overlapGroupId,
    caseA,
    caseB,
    evidence,
    aiAnalysis,
    model: aiAnalysis.model,
  });
};
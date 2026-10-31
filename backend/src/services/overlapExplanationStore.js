
import crypto from 'crypto';
import { OverlapExplanation } from '../models/OverlapExplanation.js';

const PROMPT_VERSION = 'v1';

const createFingerprint = (caseA, caseB, evidence) => {
  const input = JSON.stringify({
    caseA: {
      category: caseA.category,
      description: caseA.description,
      receivedDate: caseA.receivedDate,
      sourceSystem: caseA.sourceSystem,
    },
    caseB: {
      category: caseB.category,
      description: caseB.description,
      receivedDate: caseB.receivedDate,
      sourceSystem: caseB.sourceSystem,
    },
    evidence,
    promptVersion: PROMPT_VERSION,
  });

  return crypto.createHash('sha256').update(input).digest('hex');
};

export const findStoredExplanation = async ({
  overlapGroupId,
  caseA,
  caseB,
  evidence,
}) => {
  const [firstCase, secondCase] = [caseA, caseB].sort((a, b) =>
  a._id.toString().localeCompare(b._id.toString())
);

const fingerprint = createFingerprint(firstCase, secondCase, evidence);

  const ids = [caseA._id.toString(), caseB._id.toString()].sort();

  return OverlapExplanation.findOne({
    overlapGroup: overlapGroupId,
    caseA: ids[0],
    caseB: ids[1],
    inputFingerprint: fingerprint,
  });
};

export const saveOverlapExplanation = async ({
  overlapGroupId,
  caseA,
  caseB,
  evidence,
  aiAnalysis,
  model,
}) => {
  const [firstCase, secondCase] = [caseA, caseB].sort((a, b) =>
  a._id.toString().localeCompare(b._id.toString())
);

const fingerprint = createFingerprint(firstCase, secondCase, evidence);

  const ids = [caseA._id.toString(), caseB._id.toString()].sort();

  return OverlapExplanation.findOneAndUpdate(
    {
      overlapGroup: overlapGroupId,
      caseA: ids[0],
      caseB: ids[1],
    },
    {
      $set: {
        aiAnalysis,
        model,
        inputFingerprint: fingerprint,
        promptVersion: PROMPT_VERSION,
        generatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );
};

import mongoose from 'mongoose';

const OverlapExplanationSchema = new mongoose.Schema(
  {
    overlapGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OverlapGroup',
      required: true,
      index: true,
    },

    caseA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
    },

    caseB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
    },

    aiAnalysis: {
      relationshipType: {
        type: String,
        required: true,
      },
      commonIssue: {
        type: String,
        required: true,
      },
      supportingEvidence: [{ type: String }],
      keyDifferences: [{ type: String }],
      coordinationRationale: {
        type: String,
        required: true,
      },
      uncertainty: {
        type: String,
        required: true,
      },
    },

    model: { type: String, required: true },
    promptVersion: { type: String, default: 'v1' },
    inputFingerprint: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

OverlapExplanationSchema.index(
  { overlapGroup: 1, caseA: 1, caseB: 1 },
  { unique: true }
);

export const OverlapExplanation = mongoose.model(
  'OverlapExplanation',
  OverlapExplanationSchema
);
import mongoose from 'mongoose';

const CandidatePairSchema = new mongoose.Schema(
  {
    caseA: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    caseB: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    overlapType: { type: String },
    score: { type: Number },
    reason: { type: String },

    // Calculated only from complaint descriptions, not category or action text.
    descriptionSimilarity: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Explainable evidence used during pair evaluation.
    evidence: {
      commonDescriptionTokens: [{ type: String }],
      descriptionTokenCountA: { type: Number, default: 0 },
      descriptionTokenCountB: { type: Number, default: 0 },
      categoryMatch: { type: Boolean, default: false },
      dateDifferenceDays: { type: Number, default: null },
      regulatoryKeywordsA: [{ type: String }],
      regulatoryKeywordsB: [{ type: String }],
    },
  },
  { _id: false }
);

const OverlapGroupSchema = new mongoose.Schema(
  {
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true,
    },
    cases: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Case' }],
    status: {
      type: String,
      enum: ['open', 'coordinated', 'dismissed'],
      default: 'open',
      index: true,
    },
    severity: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
      index: true,
    },
    overlapType: {
      type: String,
      enum: [
        'duplicate_complaint',
        'coordination_required',
        'different_complaints',
      ],
      default: 'coordination_required',
      index: true,
    },
    reason: { type: String },
    candidatePairs: [CandidatePairSchema],
    dismissedCasePairs: [{ type: String }],
    confirmedLinks: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'CaseLink' },
    ],
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
        resolutionRemarks: { type: String },
    resolvedAt: { type: Date },

    // System evaluation is separate from human officer resolution.
    systemEvaluation: {
      outcome: {
        type: String,
        enum: [
          'candidates_found',
          'no_candidates',
          'no_cross_bureau_cases',
        ],
        default: null,
      },
      evaluatedAt: { type: Date, default: null },
      remarks: { type: String, default: null },
    },
  },
  { timestamps: true }
);

export const OverlapGroup = mongoose.model(
  'OverlapGroup',
  OverlapGroupSchema
);
import mongoose from 'mongoose';

const OverlapGroupSchema = new mongoose.Schema(
  {
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
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
      enum: ['duplicate_complaint', 'coordination_required', 'different_complaints'],
      default: 'coordination_required',
      index: true,
    },
    reason: { type: String },
    candidatePairs: [
      {
        caseA: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
        caseB: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
        overlapType: { type: String },
        score: { type: Number },
        reason: { type: String },
      },
    ],
    dismissedCasePairs: [{ type: String }], // Array of sorted caseIdA:caseIdB strings
    confirmedLinks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CaseLink' }],
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolutionRemarks: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export const OverlapGroup = mongoose.model('OverlapGroup', OverlapGroupSchema);

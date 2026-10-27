import mongoose from 'mongoose';

const CaseSchema = new mongoose.Schema(
  {
    caseId: { type: String, required: true, unique: true, index: true },
    sourceSystem: { type: String, required: true },
    sourceCaseRef: { type: String, required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', index: true },
    rawInstitutionName: { type: String, required: true },
    rawAddress: { type: String },
    rawCity: { type: String },
    rawState: { type: String },
    rawPincode: { type: String },
    matchStatus: {
      type: String,
      enum: ['matched', 'review', 'unmatched'],
      default: 'unmatched',
      index: true,
    },
    matchScore: { type: Number, default: 0 },
    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    complainantType: { type: String, default: 'Student' },
    receivedDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'under_process', 'needs_info', 'transferred', 'escalated', 'disposed', 'rejected'],
      default: 'pending',
      index: true,
    },
    currentBureau: { type: mongoose.Schema.Types.ObjectId, ref: 'Bureau', required: false, index: true },
    assignedOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    evidenceFiles: [{ name: { type: String }, url: { type: String } }],
    lastActionText: { type: String, default: 'Case registered' },
    lastActionDate: { type: Date, default: Date.now },
    nextActionText: { type: String, default: 'Initial review required' },
    expectedDisposalDate: { type: Date, required: true, index: true },
    disposedDate: { type: Date },
  },
  { timestamps: true }
);

// Compound index per SPEC section 6
CaseSchema.index({
  institution: 1,
  status: 1,
  currentBureau: 1,
  expectedDisposalDate: 1,
  receivedDate: 1,
});

// Unique compound index for sourceSystem + sourceCaseRef to guarantee idempotency and prevent duplicates
CaseSchema.index(
  { sourceSystem: 1, sourceCaseRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceSystem: { $exists: true, $type: 'string', $ne: '' },
      sourceCaseRef: { $exists: true, $type: 'string', $ne: '' },
    },
  }
);

export const Case = mongoose.model('Case', CaseSchema);

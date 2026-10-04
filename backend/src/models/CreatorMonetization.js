const mongoose = require('mongoose');

const creatorMonetizationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['not_eligible', 'eligible', 'active', 'locked', 'under_review', 'terminated'],
    default: 'not_eligible',
  },
  activatedAt: { type: Date, default: null },
  consecutiveFailMonths: { type: Number, default: 0 },
  qualifyingMonths: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  withdrawnTotal: { type: Number, default: 0 },
  lockReason: { type: String, default: '' },
  reviewReason: { type: String, default: '' },
  withdrawalHold: { type: Boolean, default: false },
  withdrawalHoldReason: { type: String, default: '' },
  payoutProfile: {
    legalName: { type: String, default: '' },
    method: { type: String, enum: ['bank', 'upi', ''], default: '' },
    bankAccountName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankBranch: { type: String, default: '' },
    bankCity: { type: String, default: '' },
    bankState: { type: String, default: '' },
    upiId: { type: String, default: '' },
    taxId: { type: String, default: '' },
  },
  verificationStatus: {
    type: String,
    enum: ['none', 'pending', 'verified', 'rejected'],
    default: 'none',
  },
  verificationNote: { type: String, default: '' },
  verificationSubmittedAt: { type: Date, default: null },
  programNotices: [{
    message: { type: String, required: true },
    at: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

creatorMonetizationSchema.index({ status: 1 });
creatorMonetizationSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('CreatorMonetization', creatorMonetizationSchema);

const mongoose = require('mongoose');

const creatorWithdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: { type: Number, required: true },
  method: {
    type: String,
    enum: ['bank', 'upi'],
    required: true,
  },
  status: {
    type: String,
    enum: ['requested', 'on_hold', 'processing', 'paid', 'rejected'],
    default: 'requested',
  },
  holdReason: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  payoutReference: { type: String, default: '' },
  destinationSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    default: null,
  },
  processedAt: { type: Date, default: null },
}, { timestamps: true });

creatorWithdrawalSchema.index({ user: 1, createdAt: -1 });
creatorWithdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CreatorWithdrawal', creatorWithdrawalSchema);

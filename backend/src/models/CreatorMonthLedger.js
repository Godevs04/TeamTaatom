const mongoose = require('mongoose');

const creatorMonthLedgerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  monthKey: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  followers: { type: Number, default: 0 },
  eligibleVideos: { type: Number, default: 0 },
  monthlyViews: { type: Number, default: 0 },
  eligibleViews: { type: Number, default: 0 },
  earningViews: { type: Number, default: 0 },
  manualAdjustment: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
  ratePerThousand: { type: Number, default: 0 },
  passed: { type: Boolean, default: null },
  settlement: {
    type: String,
    enum: ['pending', 'settled'],
    default: 'pending',
  },
  settledAt: { type: Date, default: null },
}, { timestamps: true });

creatorMonthLedgerSchema.index({ user: 1, monthKey: 1 }, { unique: true });
creatorMonthLedgerSchema.index({ settlement: 1, monthKey: 1 });

module.exports = mongoose.model('CreatorMonthLedger', creatorMonthLedgerSchema);

const mongoose = require('mongoose');

const creatorEarningAdjustmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    default: null,
  },
  monthKey: { type: String, default: '' },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
  },
  eligibleViewsDelta: { type: Number, default: 0 },
  amountDelta: { type: Number, default: 0 },
  target: {
    type: String,
    enum: ['pending', 'available', 'views'],
    default: 'available',
  },
  reason: { type: String, required: true },
  pendingAfter: { type: Number, default: 0 },
  availableAfter: { type: Number, default: 0 },
}, { timestamps: true });

creatorEarningAdjustmentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('CreatorEarningAdjustment', creatorEarningAdjustmentSchema);

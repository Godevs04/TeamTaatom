const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

/**
 * Payout Model — Tracks monthly payouts to Connect page creators
 *
 * Commission structure (from BSD-Subscription):
 *   Domestic (India):
 *     Cashfree fee: ~2%
 *     Taatom commission: 15% of (payment - gateway fee)
 *     GST on commission: 18% of commission
 *     Creator gets: remaining
 *
 *   International:
 *     Cashfree fee: ~3.5% + FX ~1-2%
 *     Taatom commission: 15%
 *     GST on commission: 18%
 *     Wise transfer fee: ~1%
 *     Creator gets: remaining
 */

const PayoutSchema = new Schema({
  // Who receives the payout
  creatorId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Which Connect page this payout is for
  connectPageId: {
    type: Types.ObjectId,
    ref: 'ConnectPage',
    required: true,
    index: true
  },
  // Payout period
  periodMonth: {
    type: Number, // 1-12
    required: true
  },
  periodYear: {
    type: Number,
    required: true
  },
  // Gross subscription revenue (total collected from subscribers)
  grossAmount: {
    type: Number,
    required: true,
    default: 0
  },
  // Fee breakdown
  gatewayFee: {
    type: Number,
    default: 0
  },
  gatewayFeePercent: {
    type: Number,
    default: 2  // 2% domestic, 3.5% international
  },
  fxCharge: {
    type: Number,
    default: 0  // Only for international
  },
  // After gateway fees
  netAfterGateway: {
    type: Number,
    default: 0
  },
  // Taatom commission (15% of netAfterGateway)
  commissionPercent: {
    type: Number,
    default: 15
  },
  commissionAmount: {
    type: Number,
    default: 0
  },
  // GST on commission (18%)
  gstPercent: {
    type: Number,
    default: 18
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  // Total Taatom keeps (commission - GST portion that goes to govt)
  taatoKeeps: {
    type: Number,
    default: 0
  },
  // Wise fee (international only, ~1%)
  wiseFee: {
    type: Number,
    default: 0
  },
  wiseFeePercent: {
    type: Number,
    default: 0 // 1% for international, 0 for domestic
  },
  // Final amount creator receives
  creatorPayout: {
    type: Number,
    default: 0
  },
  // Payout method
  payoutMethod: {
    type: String,
    enum: ['cashfree_bank', 'cashfree_upi', 'wise'],
    default: 'cashfree_bank'
  },
  isInternational: {
    type: Boolean,
    default: false
  },
  // Currency
  currency: {
    type: String,
    default: 'INR'
  },
  // Number of active subscribers in this period
  subscriberCount: {
    type: Number,
    default: 0
  },
  // Payout status
  status: {
    type: String,
    enum: ['calculated', 'pending', 'processing', 'completed', 'failed'],
    default: 'calculated'
  },
  // Cashfree payout reference
  cashfreePayoutId: {
    type: String,
    default: null
  },
  // Wise transfer reference (international)
  wiseTransferId: {
    type: String,
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// One payout per creator per page per month
PayoutSchema.index(
  { creatorId: 1, connectPageId: 1, periodYear: 1, periodMonth: 1 },
  { unique: true, name: 'creator_page_period' }
);

PayoutSchema.index({ status: 1, periodYear: 1, periodMonth: 1 });

module.exports = mongoose.model('Payout', PayoutSchema);

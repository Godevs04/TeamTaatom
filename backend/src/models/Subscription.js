const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const SubscriptionSchema = new Schema({
  // Who is subscribing
  userId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Which Connect page they subscribe to
  connectPageId: {
    type: Types.ObjectId,
    ref: 'ConnectPage',
    required: true,
    index: true
  },
  // Connect page owner (for quick lookups / payout calculations)
  creatorId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Cashfree references
  cashfreePlanId: {
    type: String,
    default: null
  },
  cashfreeSubscriptionId: {
    type: String,
    default: null
  },
  // Cashfree subscription_session_id (sub_session_…) — distinct from a regular
  // order payment_session_id. Renamed in migration 008 from `cashfreePaymentSessionId`.
  cashfreeSubscriptionSessionId: {
    type: String,
    default: null
  },
  // Subscription details
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  // Status from Cashfree webhook events
  // INITIALIZED → ACTIVE → COMPLETED / CANCELLED / ON_HOLD
  status: {
    type: String,
    enum: ['initialized', 'active', 'on_hold', 'cancelled', 'completed', 'expired'],
    default: 'initialized'
  },
  // Dates
  activatedAt: {
    type: Date,
    default: null
  },
  currentPeriodStart: {
    type: Date,
    default: null
  },
  currentPeriodEnd: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  // Set when the page owner has been notified that this subscription went active.
  // Used to make owner-notification idempotent across the webhook and the
  // fallback Cashfree poll, which can both flip a sub to `active`.
  ownerNotifiedAt: {
    type: Date,
    default: null
  },
  // Payment history (updated via webhooks)
  payments: [{
    cashfreePaymentId: String,
    amount: Number,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending']
    },
    paidAt: Date,
    failureReason: String
  }]
}, {
  timestamps: true
});

// Compound index: one active subscription per user per page
SubscriptionSchema.index(
  { userId: 1, connectPageId: 1, status: 1 },
  { name: 'user_page_status' }
);

// For webhook lookups
SubscriptionSchema.index({ cashfreeSubscriptionId: 1 });

// For creator dashboard / payout queries
SubscriptionSchema.index({ creatorId: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);

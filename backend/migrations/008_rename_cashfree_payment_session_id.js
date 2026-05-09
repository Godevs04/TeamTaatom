/**
 * Rename Subscription.cashfreePaymentSessionId → cashfreeSubscriptionSessionId.
 *
 * The original field name was misleading: Cashfree's `/pg/subscriptions` endpoint
 * returns a `subscription_session_id` (prefixed `sub_session_…`), not a regular
 * order `payment_session_id`. The mismatch contributed to a real bug where the
 * mobile client tried to open the value at `/pg/view/sessions/{id}` (which is
 * only valid for order payment sessions) and got "endpoint or method is not valid".
 *
 * Idempotent: $rename only acts on docs that still have the old field; safe to re-run.
 */

module.exports = {
  async up(db) {
    const result = await db.collection('subscriptions').updateMany(
      { cashfreePaymentSessionId: { $exists: true } },
      { $rename: { cashfreePaymentSessionId: 'cashfreeSubscriptionSessionId' } }
    );
    return { matched: result.matchedCount, modified: result.modifiedCount };
  },

  async down(db) {
    const result = await db.collection('subscriptions').updateMany(
      { cashfreeSubscriptionSessionId: { $exists: true } },
      { $rename: { cashfreeSubscriptionSessionId: 'cashfreePaymentSessionId' } }
    );
    return { matched: result.matchedCount, modified: result.modifiedCount };
  },
};

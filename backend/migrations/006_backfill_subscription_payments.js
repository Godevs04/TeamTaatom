/**
 * Backfill Subscription.payments for active subscriptions that have no
 * successful payment recorded.
 *
 * Why this exists:
 *   The webhook handler for SUBSCRIPTION_ACTIVE / SUBSCRIPTION_STATUS_CHANGE
 *   set status to 'active' but never pushed a payment into the payments array.
 *   Only the separate SUBSCRIPTION_PAYMENT_SUCCESS webhook event did that —
 *   and if that event was missed (sandbox, network issues, out-of-order
 *   delivery), active subscriptions ended up with an empty payments array.
 *
 *   The controller has been fixed so all activation paths now record an
 *   initial payment. This migration repairs existing rows so the SuperAdmin
 *   "Payments" and "Last Paid" columns show correct data immediately.
 *
 * What this does:
 *   For every Subscription where status is 'active' and the payments array
 *   has no entry with status: 'success':
 *     1. Push a synthetic payment record using the subscription's amount
 *        and activatedAt (or createdAt) as the payment date.
 *
 * Safe to re-run: idempotent. Only touches rows with zero successful payments.
 */

module.exports = {
  async up(db) {
    const subscriptions = db.collection('subscriptions');

    // Find active subscriptions that have no successful payment
    const cursor = subscriptions.find({
      status: 'active',
      $or: [
        { payments: { $size: 0 } },
        { payments: { $exists: false } },
        // Also catch arrays where all entries are non-success (e.g. only 'failed')
        { 'payments.status': { $not: { $eq: 'success' } } },
      ],
    });

    let scanned = 0;
    let fixed = 0;

    while (await cursor.hasNext()) {
      const sub = await cursor.next();
      scanned += 1;

      // Double-check: skip if there's already a success payment
      const hasSuccess = (sub.payments || []).some(p => p.status === 'success');
      if (hasSuccess) continue;

      const paidAt = sub.activatedAt || sub.createdAt || new Date();

      await subscriptions.updateOne(
        { _id: sub._id },
        {
          $push: {
            payments: {
              cashfreePaymentId: `migration_backfill_${sub._id}`,
              amount: sub.amount || 0,
              status: 'success',
              paidAt: paidAt,
            },
          },
        }
      );
      fixed += 1;
    }

    console.log(`[006] Backfill subscription payments: scanned=${scanned}, fixed=${fixed}`);
  },

  async down(db) {
    const subscriptions = db.collection('subscriptions');

    // Remove only the synthetic payment entries added by this migration
    await subscriptions.updateMany(
      { 'payments.cashfreePaymentId': /^migration_backfill_/ },
      {
        $pull: {
          payments: { cashfreePaymentId: /^migration_backfill_/ },
        },
      }
    );

    console.log('[006] Rolled back: removed migration_backfill_ payment entries');
  },
};

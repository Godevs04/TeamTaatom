/**
 * Backfill Subscription.payments (v2) — broader query.
 *
 * Migration 006 used a complex $or query that may have missed some rows.
 * This one simply fetches ALL active subscriptions and checks each one
 * in code. Safe to re-run: skips rows that already have a success payment.
 */

module.exports = {
  async up(db) {
    const subscriptions = db.collection('subscriptions');

    // Fetch ALL active subscriptions — check payments in code
    const cursor = subscriptions.find({ status: 'active' });

    let scanned = 0;
    let fixed = 0;
    let alreadyOk = 0;

    while (await cursor.hasNext()) {
      const sub = await cursor.next();
      scanned += 1;

      const payments = sub.payments || [];
      const hasSuccess = payments.some(p => p.status === 'success');

      if (hasSuccess) {
        alreadyOk += 1;
        continue;
      }

      const paidAt = sub.activatedAt || sub.createdAt || new Date();

      await subscriptions.updateOne(
        { _id: sub._id },
        {
          $push: {
            payments: {
              cashfreePaymentId: `migration_backfill_v2_${sub._id}`,
              amount: sub.amount || 0,
              status: 'success',
              paidAt: paidAt,
            },
          },
        }
      );
      fixed += 1;
    }

    console.log(`[007] Backfill subscription payments v2: scanned=${scanned}, fixed=${fixed}, alreadyOk=${alreadyOk}`);
  },

  async down(db) {
    const subscriptions = db.collection('subscriptions');

    await subscriptions.updateMany(
      { 'payments.cashfreePaymentId': /^migration_backfill_v2_/ },
      {
        $pull: {
          payments: { cashfreePaymentId: /^migration_backfill_v2_/ },
        },
      }
    );

    console.log('[007] Rolled back: removed migration_backfill_v2_ payment entries');
  },
};

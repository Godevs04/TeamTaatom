const Subscription = require('../models/Subscription');
const cashfreeService = require('../services/cashfreeService');
const { notifyOwnerOfSubscription } = require('../controllers/subscriptionController');
const logger = require('../utils/logger');

// Poll every 10 minutes for subscriptions stuck in `initialized`.
// The webhook is the primary source of truth, but it can be missed
// (sandbox, network drop, callback URL misconfigured). Without a
// proactive poll, a paid subscription stays `initialized` forever
// until the subscriber happens to open the status screen.
const POLL_INTERVAL_MS = 10 * 60 * 1000;

// Only poll subscriptions older than 5 minutes — newer ones are still
// in the user's checkout window and the webhook is likely arriving.
const STALE_AFTER_MS = 5 * 60 * 1000;

const pollStaleSubscriptions = async () => {
  if (!cashfreeService.isCashfreeConfigured()) {
    return;
  }

  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const stale = await Subscription.find({
      status: 'initialized',
      cashfreeSubscriptionId: { $ne: null },
      createdAt: { $lt: cutoff },
    }).limit(50);

    if (stale.length === 0) return;

    for (const subscription of stale) {
      try {
        const cfSub = await cashfreeService.getSubscription(subscription.cashfreeSubscriptionId);
        const cfStatus = String(
          cfSub?.subscription_status ?? cfSub?.subscription?.subscription_status ?? cfSub?.status ?? '',
        ).toLowerCase();

        if (cfStatus === 'active') {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          subscription.status = 'active';
          subscription.activatedAt = subscription.activatedAt || now;
          subscription.currentPeriodStart = now;
          subscription.currentPeriodEnd = periodEnd;

          const hasSuccessPayment = subscription.payments.some(p => p.status === 'success');
          if (!hasSuccessPayment) {
            subscription.payments.push({
              cashfreePaymentId: `cron_${subscription.cashfreeSubscriptionId}`,
              amount: subscription.amount,
              status: 'success',
              paidAt: now,
            });
          }
          await subscription.save();
          logger.info(`Stale-init poll: synced subscription ${subscription._id} → active`);
          await notifyOwnerOfSubscription(subscription);
        } else if (cfStatus === 'cancelled' || cfStatus === 'canceled') {
          subscription.status = 'cancelled';
          subscription.cancelledAt = new Date();
          await subscription.save();
          logger.info(`Stale-init poll: synced subscription ${subscription._id} → cancelled`);
        } else if (cfStatus === 'completed') {
          subscription.status = 'completed';
          await subscription.save();
        }
      } catch (err) {
        logger.warn(`Stale-init poll failed for subscription ${subscription._id}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('Stale subscription poll job failed:', err);
  }
};

const startStaleSubscriptionPollJob = () => {
  setInterval(pollStaleSubscriptions, POLL_INTERVAL_MS);
  logger.info('Stale subscription poll job started (runs every 10 minutes)');
};

module.exports = { startStaleSubscriptionPollJob, pollStaleSubscriptions };

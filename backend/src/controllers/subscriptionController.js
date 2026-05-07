const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const ConnectPage = require('../models/ConnectPage');
const User = require('../models/User');
const cashfreeService = require('../services/cashfreeService');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');

/** Cashfree return URL: HTTPS for web checkout, deep link for native apps. */
function buildSubscriptionReturnUrl(req, connectPageId) {
  const platform = (req.get('x-platform') || '').toLowerCase();
  const webBase = (process.env.WEB_FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (platform === 'web' && webBase) {
    // Do not use `{subscription_status}` — PG subscription flow often leaves macros literal.
    // Web client detects `subscription_return=1` and refetches subscription status.
    return `${webBase}/connect/page/${connectPageId}?subscription_return=1`;
  }
  return `${process.env.APP_DEEP_LINK_BASE || 'taatom://'}connect/page/${connectPageId}?subscription_status={subscription_status}`;
}

function isCashfreeNotConfiguredError(error) {
  return (
    error instanceof cashfreeService.CashfreeNotConfiguredError ||
    error?.code === 'CASHFREE_NOT_CONFIGURED'
  );
}

// ─────────────────────────────────────────────
// Create Subscription (initiate payment)
// POST /api/v1/connect/subscribe
// ──���──────────────────────────────────────────

const createSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { connectPageId } = req.body;

    if (!connectPageId || !mongoose.Types.ObjectId.isValid(connectPageId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Valid connectPageId is required');
    }

    // Fetch the Connect page
    const page = await ConnectPage.findById(connectPageId);
    if (!page || page.status !== 'active') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    // Cannot subscribe to own page
    if (page.userId.toString() === userId.toString()) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'You cannot subscribe to your own page');
    }

    // Must have subscription feature enabled and an approved price
    if (!page.features.subscription) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'This page does not have subscriptions enabled');
    }
    if (!page.subscriptionPrice || page.subscriptionPrice < 100) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'This page has not set a subscription price');
    }
    if (page.subscriptionApproval?.status !== 'approved') {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Subscription pricing is pending admin approval');
    }

    // Check for existing active subscription
    const existingSub = await Subscription.findOne({
      userId,
      connectPageId,
      status: { $in: ['initialized', 'active'] }
    });
    if (existingSub && existingSub.status === 'active') {
      return sendError(res, 'RESOURCE_ALREADY_EXISTS', 'You already have an active subscription to this page');
    }

    // If there's an initialized but not completed subscription, reuse it or clean up
    if (existingSub && existingSub.status === 'initialized') {
      // Clean up stale initialized subscription (older than 30 minutes)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (existingSub.createdAt < thirtyMinAgo) {
        existingSub.status = 'expired';
        await existingSub.save();
      } else {
        // Return the existing session if still fresh
        return sendSuccess(res, 200, 'Existing subscription session found', {
          subscriptionId: existingSub._id,
          cashfreeSubscriptionId: existingSub.cashfreeSubscriptionId,
          paymentSessionId: existingSub.cashfreePaymentSessionId,
          amount: existingSub.amount,
        });
      }
    }

    // Fetch user details for Cashfree
    const user = await User.findById(userId).select('username email phone fullName');
    if (!user) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'User not found');
    }

    // Ensure Cashfree plan exists for this page.
    // Cashfree caps plan_name at 40 chars; cashfreeService truncates defensively,
    // but we use a short suffix so the displayed name stays readable for typical page names.
    const planId = `taatom_connect_${connectPageId}`;
    let plan = await cashfreeService.getPlan(planId);
    if (!plan) {
      plan = await cashfreeService.createPlan({
        planId,
        planName: `${page.name} (Monthly)`,
        amount: page.subscriptionPrice,
      });
    }

    // Generate unique subscription ID
    const timestamp = Date.now();
    const cashfreeSubId = `sub_${userId}_${connectPageId}_${timestamp}`;

    const returnUrl = buildSubscriptionReturnUrl(req, connectPageId);

    // Create subscription on Cashfree
    const cashfreeResult = await cashfreeService.createSubscription({
      subscriptionId: cashfreeSubId,
      planId,
      authorizationAmount: page.subscriptionPrice,
      customer: {
        id: userId.toString(),
        email: user.email || `${user.username}@taatom.app`,
        phone: user.phone || '9999999999',
        name: user.fullName || user.username,
      },
      returnUrl,
    });

    // Save subscription in our DB
    const subscription = new Subscription({
      userId,
      connectPageId,
      creatorId: page.userId,
      cashfreePlanId: planId,
      cashfreeSubscriptionId: cashfreeResult.subscriptionId,
      cashfreePaymentSessionId: cashfreeResult.paymentSessionId,
      amount: page.subscriptionPrice,
      currency: page.subscriptionCurrency || 'INR',
      status: 'initialized',
    });
    await subscription.save();

    return sendSuccess(res, 201, 'Subscription session created', {
      subscriptionId: subscription._id,
      cashfreeSubscriptionId: cashfreeResult.subscriptionId,
      paymentSessionId: cashfreeResult.paymentSessionId,
      amount: page.subscriptionPrice,
      currency: page.subscriptionCurrency || 'INR',
    });
  } catch (error) {
    if (isCashfreeNotConfiguredError(error)) {
      logger.warn('Subscribe skipped: Cashfree not configured:', error.message);
      return sendError(res, 'SERVER_UNAVAILABLE', error.message);
    }
    logger.error('Error creating subscription:', error);
    const hint =
      typeof error?.message === 'string' && error.message.length > 0 && error.message.length < 280
        ? error.message
        : 'Failed to create subscription';
    return sendError(res, 'SERVER_ERROR', hint);
  }
};

// ──────────────────────��──────────────────────
// Check subscription status
// GET /api/v1/connect/subscription/status/:connectPageId
// ─────────────────────────────────────────────

const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { connectPageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(connectPageId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid page ID');
    }

    const subscription = await Subscription.findOne({
      userId,
      connectPageId,
      status: { $in: ['active', 'initialized'] }
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return sendSuccess(res, 200, 'No active subscription', {
        isSubscribed: false,
        subscription: null,
      });
    }

    // ── Fallback: if still initialized, poll Cashfree directly ──
    // The webhook may not have arrived (sandbox, network issues, etc.).
    // Check Cashfree for the real status and sync our DB if it changed.
    if (
      subscription.status === 'initialized' &&
      subscription.cashfreeSubscriptionId &&
      cashfreeService.isCashfreeConfigured()
    ) {
      try {
        const cfSub = await cashfreeService.getSubscription(subscription.cashfreeSubscriptionId);
        const cfStatus = (cfSub?.subscription_status || cfSub?.status || '').toLowerCase();

        if (cfStatus === 'active') {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          subscription.status = 'active';
          subscription.activatedAt = subscription.activatedAt || now;
          subscription.currentPeriodStart = now;
          subscription.currentPeriodEnd = periodEnd;

          // Record initial payment if none exists — the webhook may have been missed
          const hasSuccessPayment = subscription.payments.some(p => p.status === 'success');
          if (!hasSuccessPayment) {
            subscription.payments.push({
              cashfreePaymentId: `fallback_${subscription.cashfreeSubscriptionId}`,
              amount: subscription.amount,
              status: 'success',
              paidAt: now,
            });
          }
          await subscription.save();
          logger.info(`Fallback: synced subscription ${subscription._id} to active from Cashfree`);
        } else if (cfStatus === 'cancelled' || cfStatus === 'canceled') {
          subscription.status = 'cancelled';
          subscription.cancelledAt = new Date();
          await subscription.save();
          logger.info(`Fallback: synced subscription ${subscription._id} to cancelled from Cashfree`);
        } else if (cfStatus === 'completed') {
          subscription.status = 'completed';
          await subscription.save();
          logger.info(`Fallback: synced subscription ${subscription._id} to completed from Cashfree`);
        }
        // For other statuses (e.g. 'initialized' on Cashfree side too), do nothing.
      } catch (fallbackErr) {
        // Don't block the response if Cashfree poll fails — just log and continue.
        logger.warn('Fallback Cashfree status check failed:', fallbackErr.message);
      }
    }

    return sendSuccess(res, 200, 'Subscription status fetched', {
      isSubscribed: subscription.status === 'active',
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        amount: subscription.amount,
        activatedAt: subscription.activatedAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    logger.error('Error fetching subscription status:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch subscription status');
  }
};

// ─────────────────────────────────────────────
// Cancel subscription
// POST /api/v1/connect/subscription/cancel
// ─────────────────────────────────────────────

const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subscriptionId } = req.body;

    if (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Valid subscriptionId is required');
    }

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId,
      status: 'active',
    });

    if (!subscription) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Active subscription not found');
    }

    // Cancel on Cashfree
    await cashfreeService.cancelSubscription(subscription.cashfreeSubscriptionId);

    // Update local status
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    return sendSuccess(res, 200, 'Subscription cancelled successfully', {
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        cancelledAt: subscription.cancelledAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    if (isCashfreeNotConfiguredError(error)) {
      logger.warn('Cancel subscription skipped: Cashfree not configured:', error.message);
      return sendError(res, 'SERVER_UNAVAILABLE', error.message);
    }
    logger.error('Error cancelling subscription:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to cancel subscription');
  }
};

// ─────────────────────────────────────────────
// Get my subscriptions (all pages I subscribe to)
// GET /api/v1/connect/my-subscriptions
// ��──────────────────────────────────────��─────

const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user._id;
    const subscriptions = await Subscription.find({
      userId,
      status: { $in: ['active', 'initialized'] }
    })
      .populate('connectPageId', 'name profileImage')
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, 200, 'Subscriptions fetched', { subscriptions });
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch subscriptions');
  }
};

// ─────────────────────────────────────────────
// Get subscribers for a Connect page (owner only)
// GET /api/v1/connect/page/:pageId/subscribers
// ─���───────��───────────────────────────────────

const getPageSubscribers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(pageId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid page ID');
    }

    const page = await ConnectPage.findById(pageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the owner can view subscribers');
    }

    // Optional status filter via query param (default: all)
    const statusFilter = req.query.status;
    const query = { connectPageId: pageId };
    if (statusFilter && statusFilter !== 'all') {
      query.status = statusFilter;
    }

    const subscribers = await Subscription.find(query)
      .populate('userId', 'username fullName profilePic')
      .sort({ activatedAt: -1, createdAt: -1 })
      .lean();

    // Always compute stats across all statuses for the filter counts
    const allSubs = statusFilter && statusFilter !== 'all'
      ? await Subscription.find({ connectPageId: pageId }).lean()
      : subscribers;

    const stats = {
      total: allSubs.length,
      active: allSubs.filter(s => s.status === 'active').length,
      initialized: allSubs.filter(s => s.status === 'initialized').length,
      cancelled: allSubs.filter(s => s.status === 'cancelled').length,
      expired: allSubs.filter(s => s.status === 'expired').length,
    };

    const activeRevenue = allSubs
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    return sendSuccess(res, 200, 'Subscribers fetched', {
      subscribers,
      totalActiveSubscribers: stats.active,
      monthlyRevenue: activeRevenue,
      stats,
    });
  } catch (error) {
    logger.error('Error fetching subscribers:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch subscribers');
  }
};

// ───────���─────────────────────────────────────
// Cashfree Webhook Handler
// POST /api/v1/connect/subscription/webhook
// ──────────────────��──────────────────────────

const handleWebhook = async (req, res) => {
  try {
    // Verify webhook signature. Both headers MUST be present and the
    // signature MUST validate, otherwise we reject. Previously this gate
    // was `if (timestamp && signature) { … verify }` which silently let
    // through any request that omitted either header — an attacker could
    // POST `{ type: 'SUBSCRIPTION_ACTIVE', data: { subscription: { ... } } }`
    // without headers and force subscription-state changes.
    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    const rawBody = req.rawBody;

    if (!timestamp || !signature) {
      logger.warn('Cashfree webhook rejected: missing timestamp/signature headers', {
        hasTimestamp: !!timestamp,
        hasSignature: !!signature,
        ip: req.ip
      });
      return res.status(400).json({ error: 'Missing signature' });
    }
    if (!rawBody) {
      // rawBody is captured by the express.json verify hook (see app.js).
      // If it's missing, parsing changed the byte stream and verification
      // can't succeed — fail closed rather than try to re-stringify.
      logger.warn('Cashfree webhook rejected: rawBody unavailable', { ip: req.ip });
      return res.status(400).json({ error: 'Bad request' });
    }
    const isValid = cashfreeService.verifyWebhookSignature(rawBody, timestamp, signature);
    if (!isValid) {
      logger.warn('Invalid Cashfree webhook signature', { ip: req.ip });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;
    const eventType = event.type || event.event;
    const data = event.data || event;

    logger.info(`Cashfree webhook received: ${eventType}`, { subscriptionId: data?.subscription?.subscription_id });

    const cashfreeSubId = data?.subscription?.subscription_id || data?.subscription_id;
    if (!cashfreeSubId) {
      logger.warn('Webhook missing subscription_id');
      return res.status(200).json({ received: true });
    }

    const subscription = await Subscription.findOne({ cashfreeSubscriptionId: cashfreeSubId });
    if (!subscription) {
      logger.warn(`Subscription not found for Cashfree ID: ${cashfreeSubId}`);
      return res.status(200).json({ received: true });
    }

    switch (eventType) {
      case 'SUBSCRIPTION_STATUS_CHANGE':
      case 'SUBSCRIPTION_ACTIVE': {
        const newStatus = data?.subscription?.subscription_status?.toLowerCase();
        if (newStatus === 'active') {
          const now = new Date();
          subscription.status = 'active';
          subscription.activatedAt = subscription.activatedAt || now;
          subscription.currentPeriodStart = now;
          // Set period end to 1 month from now
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          subscription.currentPeriodEnd = periodEnd;

          // Record initial payment if none exists yet — the SUBSCRIPTION_PAYMENT_SUCCESS
          // event may arrive later or not at all (sandbox, network issues), so we record
          // the first payment here to avoid 0-payment active subscriptions.
          const hasSuccessPayment = subscription.payments.some(p => p.status === 'success');
          if (!hasSuccessPayment) {
            const payment = data?.payment || {};
            subscription.payments.push({
              cashfreePaymentId: payment?.cf_payment_id || payment?.payment_id || `activation_${subscription.cashfreeSubscriptionId}`,
              amount: payment?.payment_amount || subscription.amount,
              status: 'success',
              paidAt: now,
            });
          }
        } else if (newStatus === 'cancelled' || newStatus === 'canceled') {
          subscription.status = 'cancelled';
          subscription.cancelledAt = new Date();
        } else if (newStatus === 'completed') {
          subscription.status = 'completed';
        } else if (newStatus === 'on_hold') {
          subscription.status = 'on_hold';
        }
        await subscription.save();
        break;
      }

      case 'SUBSCRIPTION_PAYMENT_SUCCESS': {
        const payment = data?.payment || data;
        subscription.payments.push({
          cashfreePaymentId: payment?.cf_payment_id || payment?.payment_id,
          amount: payment?.payment_amount || subscription.amount,
          status: 'success',
          paidAt: new Date(),
        });
        // Renew period on each successful payment
        subscription.currentPeriodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        subscription.currentPeriodEnd = periodEnd;
        await subscription.save();
        break;
      }

      case 'SUBSCRIPTION_PAYMENT_FAILURE': {
        const failedPayment = data?.payment || data;
        subscription.payments.push({
          cashfreePaymentId: failedPayment?.cf_payment_id || failedPayment?.payment_id,
          amount: failedPayment?.payment_amount || subscription.amount,
          status: 'failed',
          paidAt: new Date(),
          failureReason: failedPayment?.payment_message || 'Payment failed',
        });
        await subscription.save();
        break;
      }

      case 'SUBSCRIPTION_CANCELLED':
      case 'SUBSCRIPTION_CANCELED': {
        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        await subscription.save();
        break;
      }

      default:
        logger.info(`Unhandled webhook event type: ${eventType}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing Cashfree webhook:', error);
    // Always return 200 to Cashfree to prevent retries on our processing errors
    return res.status(200).json({ received: true });
  }
};

// ─────────────────────────────────────────────
// Payout Preview (for info icon)
// GET /api/v1/connect/subscription/payout-preview/:connectPageId
// ─────────────────────────────────────────────

const { calculatePayoutBreakdown, FEES } = require('../jobs/payoutCalculation');

const getPayoutPreview = async (req, res) => {
  try {
    const { connectPageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(connectPageId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid page ID');
    }

    const page = await ConnectPage.findById(connectPageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Page not found');
    }

    const { getCurrencyConfig } = require('../utils/currencyConfig');
    const currency = page.subscriptionCurrency || 'INR';
    const currencyConfig = getCurrencyConfig(currency);
    const price = page.subscriptionPrice || page.subscriptionApproval?.requestedPrice || 0;
    if (price < currencyConfig.minPrice) {
      return sendSuccess(res, 200, 'No price set', { preview: null });
    }

    const isInternational = page.creatorPayoutInfo?.isInternational || false;
    const breakdown = calculatePayoutBreakdown(price, isInternational);

    return sendSuccess(res, 200, 'Payout preview', {
      preview: {
        ...breakdown,
        currency,
        currencySymbol: currencyConfig.symbol,
        isInternational,
        feeStructure: isInternational ? FEES.international : FEES.domestic,
        note: isInternational
          ? 'International payouts are processed via Wise. Additional ~1% Wise transfer fee applies.'
          : 'Domestic payouts are processed via Cashfree to your bank account or UPI.',
      },
    });
  } catch (error) {
    logger.error('Error fetching payout preview:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch payout preview');
  }
};

// ─────────────────────────────────────────────
// Dev-only: simulate webhook events without ngrok
// POST /api/v1/connect/subscription/_dev/manual-activate
// POST /api/v1/connect/subscription/_dev/manual-cancel
//
// Both refuse to run when NODE_ENV === 'production'. Useful when the local
// backend isn't reachable from Cashfree (no public tunnel) and you just
// want to flip a `status: initialized` row to `active` (or vice versa)
// to exercise the rest of the code paths.
// ─────────────────────────────────────────────

const refuseInProduction = (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Dev-only endpoint is disabled in production');
    return true;
  }
  return false;
};

const findOwnedSubscription = async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId || !mongoose.Types.ObjectId.isValid(subscriptionId)) {
    sendError(res, 'VALIDATION_FAILED', 'Valid subscriptionId is required');
    return null;
  }
  // Match the caller's userId so devs can only flip their own test rows.
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    userId: req.user._id,
  });
  if (!subscription) {
    sendError(res, 'RESOURCE_NOT_FOUND', 'Subscription not found for this user');
    return null;
  }
  return subscription;
};

const devManualActivate = async (req, res) => {
  if (refuseInProduction(req, res)) return;
  try {
    const subscription = await findOwnedSubscription(req, res);
    if (!subscription) return;

    // Mirror the SUBSCRIPTION_ACTIVE branch of handleWebhook exactly.
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    subscription.status = 'active';
    subscription.activatedAt = subscription.activatedAt || now;
    subscription.currentPeriodStart = now;
    subscription.currentPeriodEnd = periodEnd;

    // Record initial payment if none exists
    const hasSuccessPayment = subscription.payments.some(p => p.status === 'success');
    if (!hasSuccessPayment) {
      subscription.payments.push({
        cashfreePaymentId: `dev_manual_${subscription._id}`,
        amount: subscription.amount,
        status: 'success',
        paidAt: now,
      });
    }
    await subscription.save();

    logger.info(`[DEV] Manually activated subscription ${subscription._id}`);
    return sendSuccess(res, 200, 'Subscription activated (dev)', {
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        activatedAt: subscription.activatedAt,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    logger.error('Error in devManualActivate:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to activate subscription');
  }
};

const devManualCancel = async (req, res) => {
  if (refuseInProduction(req, res)) return;
  try {
    const subscription = await findOwnedSubscription(req, res);
    if (!subscription) return;

    // Mirror the cancelled branch of the SUBSCRIPTION_STATUS_CHANGE handler.
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();

    logger.info(`[DEV] Manually cancelled subscription ${subscription._id}`);
    return sendSuccess(res, 200, 'Subscription cancelled (dev)', {
      subscription: {
        _id: subscription._id,
        status: subscription.status,
        cancelledAt: subscription.cancelledAt,
      },
    });
  } catch (error) {
    logger.error('Error in devManualCancel:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to cancel subscription');
  }
};

module.exports = {
  createSubscription,
  getSubscriptionStatus,
  cancelSubscription,
  getMySubscriptions,
  getPageSubscribers,
  handleWebhook,
  getPayoutPreview,
  // Dev-only — registered behind a NODE_ENV guard inside the handlers.
  devManualActivate,
  devManualCancel,
};

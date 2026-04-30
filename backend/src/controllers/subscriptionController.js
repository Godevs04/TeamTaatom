const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const ConnectPage = require('../models/ConnectPage');
const User = require('../models/User');
const cashfreeService = require('../services/cashfreeService');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');

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

    // Ensure Cashfree plan exists for this page
    const planId = `taatom_connect_${connectPageId}`;
    let plan = await cashfreeService.getPlan(planId);
    if (!plan) {
      plan = await cashfreeService.createPlan({
        planId,
        planName: `${page.name} Monthly Subscription`,
        amount: page.subscriptionPrice,
      });
    }

    // Generate unique subscription ID
    const timestamp = Date.now();
    const cashfreeSubId = `sub_${userId}_${connectPageId}_${timestamp}`;

    // Determine return URL (deep link back to app)
    const returnUrl = `${process.env.APP_DEEP_LINK_BASE || 'taatom://'}connect/page/${connectPageId}?subscription_status={subscription_status}`;

    // Create subscription on Cashfree
    const cashfreeResult = await cashfreeService.createSubscription({
      subscriptionId: cashfreeSubId,
      planId,
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
    logger.error('Error creating subscription:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create subscription');
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

    const subscribers = await Subscription.find({
      connectPageId: pageId,
      status: 'active',
    })
      .populate('userId', 'username fullName profilePic')
      .sort({ activatedAt: -1 })
      .lean();

    const totalRevenue = subscribers.reduce((sum, s) => sum + (s.amount || 0), 0);

    return sendSuccess(res, 200, 'Subscribers fetched', {
      subscribers,
      totalActiveSubscribers: subscribers.length,
      monthlyRevenue: totalRevenue,
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
    // Verify webhook signature
    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (timestamp && signature) {
      const isValid = cashfreeService.verifyWebhookSignature(rawBody, timestamp, signature);
      if (!isValid) {
        logger.warn('Invalid Cashfree webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
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
          subscription.status = 'active';
          subscription.activatedAt = subscription.activatedAt || new Date();
          subscription.currentPeriodStart = new Date();
          // Set period end to 1 month from now
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          subscription.currentPeriodEnd = periodEnd;
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

module.exports = {
  createSubscription,
  getSubscriptionStatus,
  cancelSubscription,
  getMySubscriptions,
  getPageSubscribers,
  handleWebhook,
  getPayoutPreview,
};

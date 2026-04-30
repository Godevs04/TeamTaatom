const Subscription = require('../models/Subscription');
const ConnectPage = require('../models/ConnectPage');
const Payout = require('../models/Payout');
const logger = require('../utils/logger');

/**
 * Monthly Payout Calculation Job
 *
 * Commission structure (from BSD-Subscription.md):
 *
 * DOMESTIC (India):
 *   User pays ₹100
 *   → Cashfree fee (~2%) = ₹2
 *   → Remaining = ₹98
 *   → Taatom commission (15%) = ₹14.70
 *   → GST on commission (18%) = ₹2.65
 *   → Taatom keeps ≈ ₹12.05
 *   → Creator gets ≈ ₹83.30
 *
 * INTERNATIONAL:
 *   User pays ₹100 equivalent
 *   → Cashfree fee (~3.5%) = ₹3.50
 *   → FX charge (~1.5%) = ₹1.50
 *   → Remaining ≈ ₹95
 *   → Taatom commission (15%) = ₹14.25
 *   → GST on commission (18%) = ₹2.57
 *   → Wise fee (~1%) on creator payout = ₹0.80
 *   → Creator gets ≈ ₹77.38
 */

// Fee percentages
const FEES = {
  domestic: {
    gatewayFeePercent: 2,
    fxChargePercent: 0,
    commissionPercent: 15,
    gstPercent: 18,
    wiseFeePercent: 0,
  },
  international: {
    gatewayFeePercent: 3.5,
    fxChargePercent: 1.5,
    commissionPercent: 15,
    gstPercent: 18,
    wiseFeePercent: 1,
  },
};

/**
 * Calculate payout breakdown for a given gross amount
 * @param {number} grossAmount - Total collected from subscribers
 * @param {boolean} isInternational - Whether creator is outside India
 * @returns {Object} Detailed breakdown
 */
const calculatePayoutBreakdown = (grossAmount, isInternational = false) => {
  const fees = isInternational ? FEES.international : FEES.domestic;

  const gatewayFee = (grossAmount * fees.gatewayFeePercent) / 100;
  const fxCharge = (grossAmount * fees.fxChargePercent) / 100;
  const netAfterGateway = grossAmount - gatewayFee - fxCharge;

  const commissionAmount = (netAfterGateway * fees.commissionPercent) / 100;
  const gstAmount = (commissionAmount * fees.gstPercent) / 100;
  const taatoKeeps = commissionAmount - gstAmount; // Taatom's actual net

  const preWisePayout = netAfterGateway - commissionAmount;
  const wiseFee = isInternational ? (preWisePayout * fees.wiseFeePercent) / 100 : 0;
  const creatorPayout = preWisePayout - wiseFee;

  return {
    grossAmount: round(grossAmount),
    gatewayFee: round(gatewayFee),
    gatewayFeePercent: fees.gatewayFeePercent,
    fxCharge: round(fxCharge),
    netAfterGateway: round(netAfterGateway),
    commissionPercent: fees.commissionPercent,
    commissionAmount: round(commissionAmount),
    gstPercent: fees.gstPercent,
    gstAmount: round(gstAmount),
    taatoKeeps: round(taatoKeeps),
    wiseFee: round(wiseFee),
    wiseFeePercent: fees.wiseFeePercent,
    creatorPayout: round(creatorPayout),
  };
};

const round = (n) => Math.round(n * 100) / 100;

/**
 * Run monthly payout calculation for all active subscriptions.
 * Should be triggered on the last day of each month or 1st of next month.
 */
const calculateMonthlyPayouts = async () => {
  const now = new Date();
  const periodMonth = now.getMonth() + 1; // 1-12
  const periodYear = now.getFullYear();

  logger.info(`Starting monthly payout calculation for ${periodMonth}/${periodYear}`);

  try {
    // Get all pages with active subscriptions
    const activeSubs = await Subscription.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: { connectPageId: '$connectPageId', creatorId: '$creatorId' },
          totalAmount: { $sum: '$amount' },
          subscriberCount: { $sum: 1 },
        },
      },
    ]);

    let created = 0;
    let skipped = 0;

    for (const sub of activeSubs) {
      const { connectPageId, creatorId } = sub._id;

      // Check if payout already calculated for this period
      const existing = await Payout.findOne({
        creatorId,
        connectPageId,
        periodMonth,
        periodYear,
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Get Connect page for creator info
      const page = await ConnectPage.findById(connectPageId).lean();
      const isInternational = page?.creatorPayoutInfo?.isInternational || false;

      // Calculate breakdown
      const breakdown = calculatePayoutBreakdown(sub.totalAmount, isInternational);

      // Create payout record
      const payout = new Payout({
        creatorId,
        connectPageId,
        periodMonth,
        periodYear,
        ...breakdown,
        isInternational,
        subscriberCount: sub.subscriberCount,
        payoutMethod: isInternational ? 'wise' : (page?.creatorPayoutInfo?.upiId ? 'cashfree_upi' : 'cashfree_bank'),
        currency: page?.subscriptionCurrency || (isInternational ? (page?.creatorPayoutInfo?.wiseCurrency || 'USD') : 'INR'),
        status: 'calculated',
      });

      await payout.save();
      created++;
    }

    logger.info(`Payout calculation complete: ${created} created, ${skipped} skipped (already calculated)`);
    return { created, skipped };
  } catch (error) {
    logger.error('Error in monthly payout calculation:', error);
    throw error;
  }
};

// Export for use in scheduled jobs and for preview calculations
module.exports = {
  calculateMonthlyPayouts,
  calculatePayoutBreakdown,
  FEES,
};

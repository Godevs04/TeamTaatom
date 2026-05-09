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
 *   → Taatom commission (20%) = ₹19.60
 *   → GST on commission (18%) = ₹3.53
 *   → Taatom keeps ≈ ₹16.07
 *   → Creator gets ≈ ₹78.40
 *
 * INTERNATIONAL:
 *   User pays ₹100 equivalent
 *   → Cashfree fee (~3.5%) = ₹3.50
 *   → FX charge (~1.5%) = ₹1.50
 *   → Remaining ≈ ₹95
 *   → Taatom commission (20%) = ₹19.00
 *   → GST on commission (18%) = ₹3.42
 *   → Wise fee (~1%) on creator payout = ₹0.76
 *   → Creator gets ≈ ₹75.24
 */

function parsePercentEnv(name, defaultVal, min = 0, max = 100) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultVal;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.min(max, Math.max(min, n));
}

// Fee percentages (override via TAATOM_* env — defaults match product fee sheet)
const FEES = {
  domestic: {
    gatewayFeePercent: parsePercentEnv('TAATOM_GATEWAY_FEE_DOMESTIC_PERCENT', 2),
    fxChargePercent: 0,
    commissionPercent: parsePercentEnv('TAATOM_COMMISSION_PERCENT', 20),
    gstPercent: parsePercentEnv('TAATOM_GST_ON_COMMISSION_PERCENT', 18),
    wiseFeePercent: 0,
  },
  international: {
    gatewayFeePercent: parsePercentEnv('TAATOM_GATEWAY_FEE_INTL_PERCENT', 3.5),
    fxChargePercent: parsePercentEnv('TAATOM_FX_CHARGE_PERCENT', 1.5),
    commissionPercent: parsePercentEnv('TAATOM_COMMISSION_PERCENT', 20),
    gstPercent: parsePercentEnv('TAATOM_GST_ON_COMMISSION_PERCENT', 18),
    wiseFeePercent: parsePercentEnv('TAATOM_WISE_TRANSFER_FEE_PERCENT', 1),
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

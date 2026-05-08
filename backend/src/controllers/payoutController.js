const mongoose = require('mongoose');
const Payout = require('../models/Payout');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');

/**
 * POST /api/v1/superadmin/payouts/:id/mark-paid
 * Manual completion path. All payouts to creators are sent manually
 * (bank/UPI/Wise) and recorded here.
 * Body: { reference, notes?, paidAt? }
 */
const markPayoutPaid = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid payout id');
    }

    const reference = String(req.body?.reference || '').trim();
    if (!reference) {
      return sendError(res, 'VALIDATION_FAILED', 'reference is required');
    }
    const notes = String(req.body?.notes || '').trim();
    const paidAtRaw = req.body?.paidAt;
    const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid paidAt');
    }

    const payout = await Payout.findById(id);
    if (!payout) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Payout not found');
    }
    if (payout.status === 'completed') {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Payout is already completed');
    }

    payout.status = 'completed';
    payout.payoutReference = reference.slice(0, 100);
    if (notes) payout.notes = notes.slice(0, 500);
    payout.processedBy = req.superAdmin?._id || null;
    payout.processedAt = paidAt;
    payout.failureReason = '';
    if (payout.payoutMethod === 'wise') {
      payout.wiseTransferId = reference.slice(0, 100);
    }
    await payout.save();

    return sendSuccess(res, 200, 'Payout marked as paid', {
      payoutId: payout._id,
      status: payout.status,
      payoutReference: payout.payoutReference,
    });
  } catch (error) {
    logger.error('markPayoutPaid error:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Failed to mark payout');
  }
};

/**
 * GET /api/v1/connect/my-payouts
 * Creator-facing list of their own payouts, across all their Connect pages.
 * Query: ?page=N&limit=N&status=
 */
const getMyPayouts = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return sendError(res, 'AUTH_REQUIRED', 'Not authenticated');

    const pageNum = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
    const skip = (pageNum - 1) * limit;

    const filter = { creatorId: userId };
    if (req.query.status) filter.status = String(req.query.status);

    const [payouts, total, summary] = await Promise.all([
      Payout.find(filter)
        .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('connectPageId', 'name category')
        .lean(),
      Payout.countDocuments(filter),
      Payout.aggregate([
        { $match: { creatorId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalEarned: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$creatorPayout', 0] },
            },
            totalPending: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['calculated', 'processing']] },
                  '$creatorPayout',
                  0,
                ],
              },
            },
            payoutCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    return sendSuccess(res, 200, 'Payouts fetched', {
      payouts: payouts.map((p) => ({
        _id: p._id,
        periodMonth: p.periodMonth,
        periodYear: p.periodYear,
        pageId: p.connectPageId?._id || p.connectPageId,
        pageName: p.connectPageId?.name || '',
        pageCategory: p.connectPageId?.category || '',
        currency: p.currency || 'INR',
        isInternational: !!p.isInternational,
        // Full breakdown
        grossAmount: p.grossAmount,
        gatewayFee: p.gatewayFee,
        gatewayFeePercent: p.gatewayFeePercent,
        fxCharge: p.fxCharge,
        netAfterGateway: p.netAfterGateway,
        commissionPercent: p.commissionPercent,
        commissionAmount: p.commissionAmount,
        gstPercent: p.gstPercent,
        gstAmount: p.gstAmount,
        wiseFee: p.wiseFee,
        wiseFeePercent: p.wiseFeePercent,
        creatorPayout: p.creatorPayout,
        subscriberCount: p.subscriberCount,
        // State
        status: p.status,
        payoutMethod: p.payoutMethod,
        payoutReference: p.payoutReference || '',
        processedAt: p.processedAt,
        failureReason: p.failureReason || '',
        createdAt: p.createdAt,
      })),
      summary: summary[0] || { totalEarned: 0, totalPending: 0, payoutCount: 0 },
      pagination: {
        page: pageNum,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('getMyPayouts error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch payouts');
  }
};

module.exports = {
  markPayoutPaid,
  getMyPayouts,
};

const mongoose = require('mongoose');
const Payout = require('../models/Payout');
const cashfreePayoutService = require('../services/cashfreePayoutService');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');

const beneficiaryIdFor = (creatorUserId) => `bene_${String(creatorUserId)}`;
const transferIdFor = (payoutId) => `payout_${String(payoutId)}`;

const isCashfreeMethod = (method) => method === 'cashfree_bank' || method === 'cashfree_upi';

/**
 * POST /api/v1/superadmin/payouts/:id/process
 * Push a domestic payout via Cashfree Payouts API.
 * For Wise/international payouts, returns a guidance error directing the
 * admin to use mark-paid instead — the route is intentionally not a no-op
 * so admins don't accidentally believe Wise was triggered.
 */
const processPayout = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid payout id');
    }

    const payout = await Payout.findById(id).populate('connectPageId').lean(false);
    if (!payout) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Payout not found');
    }

    if (payout.status !== 'calculated' && payout.status !== 'failed') {
      return sendError(
        res,
        'BUSINESS_INVALID_OPERATION',
        `Payout cannot be processed (status: ${payout.status})`
      );
    }

    // Wise / international goes through mark-as-paid manual flow.
    if (payout.payoutMethod === 'wise' || payout.isInternational) {
      return sendError(
        res,
        'BUSINESS_INVALID_OPERATION',
        'International (Wise) payouts must be sent manually and recorded via "Mark as Paid".'
      );
    }

    if (!isCashfreeMethod(payout.payoutMethod)) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', `Unsupported payout method: ${payout.payoutMethod}`);
    }

    if (!cashfreePayoutService.isPayoutConfigured()) {
      return sendError(
        res,
        'SERVER_ERROR',
        'Cashfree Payouts is not configured on this server.'
      );
    }

    const page = payout.connectPageId;
    const payoutInfo = page?.creatorPayoutInfo || {};

    // Build beneficiary instrument from page payout info.
    let bank;
    if (payout.payoutMethod === 'cashfree_upi') {
      if (!payoutInfo.upiId) {
        return sendError(res, 'VALIDATION_FAILED', 'Creator has no UPI id on file.');
      }
      bank = { vpa: payoutInfo.upiId };
    } else {
      if (!payoutInfo.bankAccountNumber || !payoutInfo.bankIfsc) {
        return sendError(res, 'VALIDATION_FAILED', 'Creator has no bank account on file.');
      }
      bank = {
        accountNumber: payoutInfo.bankAccountNumber,
        ifsc: payoutInfo.bankIfsc,
      };
    }

    // Load creator User for contact details (email/phone for beneficiary).
    const User = require('../models/User');
    const creator = await User.findById(payout.creatorId).select('fullName email phone username').lean();
    if (!creator) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Creator user not found');
    }

    const beneId = beneficiaryIdFor(payout.creatorId);
    const transferId = transferIdFor(payout._id);

    // Step 1 — ensure beneficiary exists. createBeneficiary treats duplicate as success.
    try {
      await cashfreePayoutService.createBeneficiary({
        beneId,
        name: payoutInfo.bankAccountName || creator.fullName || creator.username || 'Creator',
        email: creator.email || '',
        phone: creator.phone || '',
        bank,
      });
    } catch (err) {
      logger.error('Beneficiary registration failed:', err.message);
      return sendError(res, 'SERVER_ERROR', `Beneficiary registration failed: ${err.message}`);
    }

    // Step 2 — request transfer. Idempotent on transferId.
    let transferResult;
    try {
      transferResult = await cashfreePayoutService.requestTransfer({
        transferId,
        beneId,
        amount: payout.creatorPayout,
        remarks: `Taatom payout ${payout.periodMonth}/${payout.periodYear}`,
      });
    } catch (err) {
      logger.error('Transfer request failed:', err.message);
      payout.status = 'failed';
      payout.failureReason = err.message;
      payout.processedBy = req.superAdmin?._id || null;
      payout.processedAt = new Date();
      await payout.save();
      return sendError(res, 'SERVER_ERROR', `Transfer failed: ${err.message}`);
    }

    // Cashfree returns transfer_status; map to our internal state.
    const cfStatus = transferResult?.transfer_status || transferResult?.data?.transfer_status;
    const mapped = cashfreePayoutService.mapTransferStatus(cfStatus) || 'processing';

    payout.cashfreeBeneficiaryId = beneId;
    payout.cashfreePayoutId = transferId;
    payout.status = mapped;
    payout.processedBy = req.superAdmin?._id || null;
    payout.processedAt = new Date();
    payout.failureReason = '';
    await payout.save();

    return sendSuccess(res, 200, 'Payout initiated', {
      payoutId: payout._id,
      status: payout.status,
      cashfreePayoutId: transferId,
      cashfreeStatus: cfStatus,
    });
  } catch (error) {
    logger.error('processPayout error:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Failed to process payout');
  }
};

/**
 * POST /api/v1/superadmin/payouts/:id/mark-paid
 * Manual completion path for Wise (international) or admin override.
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
 * POST /api/v1/superadmin/payouts/:id/refresh-status
 * Pull current transfer status from Cashfree (fallback for missed webhooks).
 */
const refreshPayoutStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid payout id');
    }

    const payout = await Payout.findById(id);
    if (!payout) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Payout not found');
    }
    if (!payout.cashfreePayoutId) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'No Cashfree transfer to refresh');
    }
    if (!cashfreePayoutService.isPayoutConfigured()) {
      return sendError(res, 'SERVER_ERROR', 'Cashfree Payouts is not configured');
    }

    const result = await cashfreePayoutService.getTransferStatus(payout.cashfreePayoutId);
    if (!result) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Transfer not found at Cashfree');
    }

    const cfStatus = result?.transfer_status || result?.data?.transfer_status;
    const mapped = cashfreePayoutService.mapTransferStatus(cfStatus);
    if (mapped && mapped !== payout.status) {
      payout.status = mapped;
      if (mapped === 'completed') {
        payout.processedAt = payout.processedAt || new Date();
        payout.failureReason = '';
      } else if (mapped === 'failed') {
        payout.failureReason = result?.status_description || result?.transfer_status_description || 'Transfer failed';
      }
      await payout.save();
    }

    return sendSuccess(res, 200, 'Status refreshed', {
      payoutId: payout._id,
      status: payout.status,
      cashfreeStatus: cfStatus,
    });
  } catch (error) {
    logger.error('refreshPayoutStatus error:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Failed to refresh status');
  }
};

/**
 * POST /api/v1/connect/payout/webhook
 * Cashfree Payouts webhook receiver (no auth — Cashfree calls this).
 */
const handlePayoutWebhook = async (req, res) => {
  try {
    const timestamp = req.headers['x-webhook-timestamp'];
    const signature = req.headers['x-webhook-signature'];
    const rawBody = req.rawBody;

    if (!timestamp || !signature) {
      logger.warn('Cashfree Payout webhook rejected: missing signature headers', { ip: req.ip });
      return res.status(400).json({ error: 'Missing signature' });
    }
    if (!rawBody) {
      logger.warn('Cashfree Payout webhook rejected: rawBody unavailable', { ip: req.ip });
      return res.status(400).json({ error: 'Bad request' });
    }
    if (!cashfreePayoutService.verifyWebhookSignature(rawBody, timestamp, signature)) {
      logger.warn('Invalid Cashfree Payout webhook signature', { ip: req.ip });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body || {};
    const data = event.data || event;
    const transfer = data?.transfer || data;
    const transferId = transfer?.transfer_id || data?.transfer_id;
    const cfStatus = transfer?.transfer_status || data?.transfer_status;

    logger.info('Cashfree Payout webhook received', { type: event.type, transferId, cfStatus });

    if (!transferId) {
      return res.status(200).json({ received: true });
    }

    const payout = await Payout.findOne({ cashfreePayoutId: transferId });
    if (!payout) {
      logger.warn(`Payout not found for transfer_id: ${transferId}`);
      return res.status(200).json({ received: true });
    }

    const mapped = cashfreePayoutService.mapTransferStatus(cfStatus);
    if (mapped && mapped !== payout.status) {
      payout.status = mapped;
      if (mapped === 'completed') {
        payout.processedAt = payout.processedAt || new Date();
        payout.failureReason = '';
      } else if (mapped === 'failed') {
        payout.failureReason = transfer?.status_description || transfer?.failure_reason || 'Transfer failed';
      }
      await payout.save();
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Error processing Cashfree Payout webhook:', error);
    // Always 200 so Cashfree doesn't retry our internal errors.
    return res.status(200).json({ received: true });
  }
};

module.exports = {
  processPayout,
  markPayoutPaid,
  refreshPayoutStatus,
  handlePayoutWebhook,
};

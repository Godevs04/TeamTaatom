const service = require('../services/creatorMonetizationService');

const userIdFrom = (req) => req.user._id || req.user.id;

const send = (res, payload) => res.json({ success: true, ...payload });

const fail = (res, error, fallback) => {
  const status = error.statusCode || 500;
  if (status >= 500) {
    const logger = require('../utils/logger');
    logger.error(fallback, error);
  }
  return res.status(status).json({
    success: false,
    message: status >= 500 ? fallback : error.message,
  });
};

const getDashboard = async (req, res) => {
  try {
    const dashboard = await service.getDashboard(userIdFrom(req));
    return send(res, { dashboard });
  } catch (error) {
    return fail(res, error, 'Could not load the creator dashboard.');
  }
};

const activate = async (req, res) => {
  try {
    const dashboard = await service.activate(userIdFrom(req));
    return send(res, { dashboard });
  } catch (error) {
    return fail(res, error, 'Could not activate monetization.');
  }
};

const savePayoutProfile = async (req, res) => {
  try {
    const dashboard = await service.savePayoutProfile(userIdFrom(req), req.body || {});
    return send(res, { dashboard });
  } catch (error) {
    return fail(res, error, 'Could not save payout details.');
  }
};

const submitVerification = async (req, res) => {
  try {
    const dashboard = await service.submitVerification(userIdFrom(req));
    return send(res, { dashboard });
  } catch (error) {
    return fail(res, error, 'Could not submit verification.');
  }
};

const requestWithdrawal = async (req, res) => {
  try {
    const dashboard = await service.requestWithdrawal(userIdFrom(req), req.body || {});
    return send(res, { dashboard });
  } catch (error) {
    return fail(res, error, 'Could not request the withdrawal.');
  }
};

const listWithdrawals = async (req, res) => {
  try {
    const withdrawals = await service.listWithdrawals(userIdFrom(req));
    return send(res, { withdrawals });
  } catch (error) {
    return fail(res, error, 'Could not load withdrawals.');
  }
};

module.exports = {
  getDashboard,
  activate,
  savePayoutProfile,
  submitVerification,
  requestWithdrawal,
  listWithdrawals,
};

const service = require('../services/creatorMonetizationService');

const actorId = (req) => req.superAdmin?._id || null;

const send = (res, payload) => res.json({ success: true, data: payload });

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

const getSettings = async (req, res) => {
  try {
    const settings = await service.getSettings();
    return send(res, settings);
  } catch (error) {
    return fail(res, error, 'Could not load program settings.');
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await service.updateSettings(req.body || {}, actorId(req));
    return send(res, settings);
  } catch (error) {
    return fail(res, error, 'Could not save program settings.');
  }
};

const listCreators = async (req, res) => {
  try {
    const result = await service.adminListCreators({
      status: req.query.status || '',
      q: req.query.q || '',
      page: Number(req.query.page) || 1,
      limit: Math.min(50, Number(req.query.limit) || 20),
    });
    return send(res, result);
  } catch (error) {
    return fail(res, error, 'Could not load creators.');
  }
};

const getCreator = async (req, res) => {
  try {
    const result = await service.adminGetCreator(req.params.userId);
    return send(res, result);
  } catch (error) {
    return fail(res, error, 'Could not load this creator.');
  }
};

const setStatus = async (req, res) => {
  try {
    const result = await service.adminSetStatus({
      userId: req.params.userId,
      status: req.body?.status,
      reason: req.body?.reason,
      reverseAvailable: !!req.body?.reverseAvailable,
      actorId: actorId(req),
    });
    return send(res, result);
  } catch (error) {
    return fail(res, error, 'Could not update creator status.');
  }
};

const setHold = async (req, res) => {
  try {
    const result = await service.adminSetHold({
      userId: req.params.userId,
      hold: !!req.body?.hold,
      reason: req.body?.reason,
      actorId: actorId(req),
    });
    return send(res, result);
  } catch (error) {
    return fail(res, error, 'Could not update the withdrawal hold.');
  }
};

const searchVideos = async (req, res) => {
  try {
    const videos = await service.adminSearchVideos({
      q: req.query.q || '',
      page: Number(req.query.page) || 1,
      limit: Math.min(50, Number(req.query.limit) || 20),
    });
    return send(res, { videos });
  } catch (error) {
    return fail(res, error, 'Could not search videos.');
  }
};

const setVideoEligibility = async (req, res) => {
  try {
    const video = await service.adminSetVideoEligibility({
      postId: req.params.postId,
      eligible: !!req.body?.eligible,
      reason: req.body?.reason,
      voidExisting: !!req.body?.voidExisting,
      actorId: actorId(req),
    });
    return send(res, video);
  } catch (error) {
    return fail(res, error, 'Could not update video eligibility.');
  }
};

const listVerifications = async (req, res) => {
  try {
    const verifications = await service.adminListVerifications();
    return send(res, { verifications });
  } catch (error) {
    return fail(res, error, 'Could not load verifications.');
  }
};

const reviewVerification = async (req, res) => {
  try {
    const result = await service.adminReviewVerification({
      userId: req.params.userId,
      status: req.body?.status,
      note: req.body?.note,
    });
    return send(res, result);
  } catch (error) {
    return fail(res, error, 'Could not update verification.');
  }
};

const listWithdrawals = async (req, res) => {
  try {
    const withdrawals = await service.adminListWithdrawals({ status: req.query.status || '' });
    return send(res, { withdrawals });
  } catch (error) {
    return fail(res, error, 'Could not load withdrawals.');
  }
};

const withdrawalAction = async (req, res) => {
  try {
    const withdrawal = await service.adminWithdrawalAction({
      withdrawalId: req.params.id,
      action: req.body?.action,
      reason: req.body?.reason,
      payoutReference: req.body?.payoutReference,
      actorId: actorId(req),
    });
    return send(res, withdrawal);
  } catch (error) {
    return fail(res, error, 'Could not update the withdrawal.');
  }
};

const adjust = async (req, res) => {
  try {
    const result = await service.adminAdjust({
      userId: req.body?.userId,
      monthKey: req.body?.monthKey,
      eligibleViewsDelta: req.body?.eligibleViewsDelta,
      amountDelta: req.body?.amountDelta,
      target: req.body?.target || 'available',
      reason: req.body?.reason,
      actorId: actorId(req),
    });
    return send(res, result);
  } catch (error) {
    return fail(res, error, 'Could not adjust earnings.');
  }
};

const listAdjustments = async (req, res) => {
  try {
    const adjustments = await service.adminListAdjustments();
    return send(res, { adjustments });
  } catch (error) {
    return fail(res, error, 'Could not load adjustments.');
  }
};

module.exports = {
  getSettings,
  updateSettings,
  listCreators,
  getCreator,
  setStatus,
  setHold,
  searchVideos,
  setVideoEligibility,
  listVerifications,
  reviewVerification,
  listWithdrawals,
  withdrawalAction,
  adjust,
  listAdjustments,
};

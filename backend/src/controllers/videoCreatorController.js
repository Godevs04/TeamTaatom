const User = require('../models/User');
const VideoCreatorRequest = require('../models/VideoCreatorRequest');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { escapeRegex } = require('../utils/regexEscape');

function statusPayload(user, latestRequest = null) {
  return {
    status: user.videoCreatorStatus || 'none',
    requestedAt: user.videoCreatorRequestedAt || null,
    reviewedAt: user.videoCreatorReviewedAt || null,
    reviewNote: user.videoCreatorReviewNote || '',
    canUpload: user.videoCreatorStatus === 'approved',
    latestRequest: latestRequest
      ? {
          _id: latestRequest._id,
          status: latestRequest.status,
          message: latestRequest.message,
          createdAt: latestRequest.createdAt,
          reviewedAt: latestRequest.reviewedAt,
          reviewNote: latestRequest.reviewNote,
        }
      : null,
  };
}

/** GET /api/v1/video-creator/status */
async function getCreatorStatus(req, res) {
  try {
    const user = await User.findById(req.user._id).select(
      'videoCreatorStatus videoCreatorRequestedAt videoCreatorReviewedAt videoCreatorReviewNote'
    );
    if (!user) return sendError(res, 'RES_3001', 'User not found');
    const latestRequest = await VideoCreatorRequest.findOne({ user: user._id })
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, 200, 'Creator status', statusPayload(user, latestRequest));
  } catch (error) {
    logger.error('getCreatorStatus error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch creator status');
  }
}

/** POST /api/v1/video-creator/request */
async function requestCreatorAccess(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, 'RES_3001', 'User not found');

    if (user.videoCreatorStatus === 'approved') {
      return sendSuccess(res, 200, 'Already approved', statusPayload(user));
    }
    if (user.videoCreatorStatus === 'pending') {
      const existing = await VideoCreatorRequest.findOne({
        user: user._id,
        status: 'pending',
      })
        .sort({ createdAt: -1 })
        .lean();
      return sendSuccess(res, 200, 'Request already pending', statusPayload(user, existing));
    }

    const message = (req.body?.message || '').toString().trim().slice(0, 500);
    const request = await VideoCreatorRequest.create({
      user: user._id,
      message,
      status: 'pending',
    });

    user.videoCreatorStatus = 'pending';
    user.videoCreatorRequestedAt = new Date();
    user.videoCreatorReviewedAt = null;
    user.videoCreatorReviewNote = '';
    await user.save();

    return sendSuccess(res, 201, 'Creator request submitted', statusPayload(user, request));
  } catch (error) {
    logger.error('requestCreatorAccess error:', error);
    return sendError(res, 'SRV_6001', 'Failed to submit creator request');
  }
}

/** GET /api/v1/superadmin/video-creators */
async function listCreatorRequestsAdmin(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const status = (req.query.status || 'pending').trim();
    const q = (req.query.q || req.query.search || '').trim();

    const match = {};
    if (status && status !== 'all') {
      match.status = status;
    }
    if (q) {
      const users = await User.find({
        $or: [
          { username: { $regex: escapeRegex(q), $options: 'i' } },
          { fullName: { $regex: escapeRegex(q), $options: 'i' } },
          { email: { $regex: escapeRegex(q), $options: 'i' } },
        ],
      })
        .select('_id')
        .lean();
      match.user = { $in: users.map((u) => u._id) };
    }

    const [rows, total] = await Promise.all([
      VideoCreatorRequest.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username fullName email profilePic videoCreatorStatus')
        .populate('reviewedBy', 'email')
        .lean(),
      VideoCreatorRequest.countDocuments(match),
    ]);

    return sendSuccess(res, 200, 'Creator requests fetched', {
      requests: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    logger.error('listCreatorRequestsAdmin error:', error);
    return sendError(res, 'SRV_6001', 'Failed to list creator requests');
  }
}

/** POST /api/v1/superadmin/video-creators/:id/approve */
async function approveCreatorRequest(req, res) {
  try {
    const request = await VideoCreatorRequest.findById(req.params.id);
    if (!request) return sendError(res, 'RES_3001', 'Request not found');
    if (request.status !== 'pending') {
      return sendError(res, 'BIZ_7001', 'Request is not pending');
    }

    const note = (req.body?.note || req.body?.reviewNote || '').toString().trim().slice(0, 500);
    request.status = 'approved';
    request.reviewedBy = req.superAdmin?._id || null;
    request.reviewedAt = new Date();
    request.reviewNote = note;
    await request.save();

    await User.updateOne(
      { _id: request.user },
      {
        $set: {
          videoCreatorStatus: 'approved',
          videoCreatorReviewedAt: new Date(),
          videoCreatorReviewNote: note,
        },
      }
    );

    // Reject other pending requests for same user
    await VideoCreatorRequest.updateMany(
      { user: request.user, status: 'pending', _id: { $ne: request._id } },
      {
        $set: {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewNote: 'Superseded by approval',
          reviewedBy: req.superAdmin?._id || null,
        },
      }
    );

    const populated = await VideoCreatorRequest.findById(request._id)
      .populate('user', 'username fullName email profilePic videoCreatorStatus')
      .lean();

    return sendSuccess(res, 200, 'Creator approved', { request: populated });
  } catch (error) {
    logger.error('approveCreatorRequest error:', error);
    return sendError(res, 'SRV_6001', 'Failed to approve creator');
  }
}

/** POST /api/v1/superadmin/video-creators/:id/reject */
async function rejectCreatorRequest(req, res) {
  try {
    const request = await VideoCreatorRequest.findById(req.params.id);
    if (!request) return sendError(res, 'RES_3001', 'Request not found');
    if (request.status !== 'pending') {
      return sendError(res, 'BIZ_7001', 'Request is not pending');
    }

    const note = (req.body?.note || req.body?.reviewNote || req.body?.reason || '')
      .toString()
      .trim()
      .slice(0, 500);
    request.status = 'rejected';
    request.reviewedBy = req.superAdmin?._id || null;
    request.reviewedAt = new Date();
    request.reviewNote = note || 'Not approved';
    await request.save();

    await User.updateOne(
      { _id: request.user },
      {
        $set: {
          videoCreatorStatus: 'rejected',
          videoCreatorReviewedAt: new Date(),
          videoCreatorReviewNote: request.reviewNote,
        },
      }
    );

    const populated = await VideoCreatorRequest.findById(request._id)
      .populate('user', 'username fullName email profilePic videoCreatorStatus')
      .lean();

    return sendSuccess(res, 200, 'Creator rejected', { request: populated });
  } catch (error) {
    logger.error('rejectCreatorRequest error:', error);
    return sendError(res, 'SRV_6001', 'Failed to reject creator');
  }
}

module.exports = {
  getCreatorStatus,
  requestCreatorAccess,
  listCreatorRequestsAdmin,
  approveCreatorRequest,
  rejectCreatorRequest,
  statusPayload,
};

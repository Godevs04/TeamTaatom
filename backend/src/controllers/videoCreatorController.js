const User = require('../models/User');
const VideoCreatorRequest = require('../models/VideoCreatorRequest');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { escapeRegex } = require('../utils/regexEscape');
const {
  APPLICATION_FIELDS,
  validateCreatorApplication,
  labelFor,
} = require('../constants/videoCreatorApplication');

function serializeRequest(request) {
  if (!request) return null;
  const app = request.application || {};
  return {
    _id: request._id,
    status: request.status,
    message: request.message,
    application: app,
    applicationSummary: {
      contentNiche: labelFor('contentNiche', app.contentNiche) || app.contentNiche || '',
      experienceLevel: labelFor('experienceLevel', app.experienceLevel) || app.experienceLevel || '',
      postingFrequency:
        labelFor('postingFrequency', app.postingFrequency) || app.postingFrequency || '',
      audienceRegions: app.audienceRegions || '',
      sampleLinks: app.sampleLinks || '',
      equipment: app.equipment || '',
      whyTaatom: app.whyTaatom || '',
      contentNicheOther: app.contentNicheOther || '',
      guidelinesAccepted: !!app.guidelinesAccepted,
    },
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    reviewedAt: request.reviewedAt,
    reviewNote: request.reviewNote || '',
    rejectionReason: request.rejectionReason || '',
    reviewedBy: request.reviewedBy,
    auditLog: request.auditLog || [],
    user: request.user,
  };
}

function statusPayload(user, latestRequest = null) {
  return {
    status: user.videoCreatorStatus || 'none',
    requestedAt: user.videoCreatorRequestedAt || null,
    reviewedAt: user.videoCreatorReviewedAt || null,
    reviewNote: user.videoCreatorReviewNote || '',
    rejectionReason:
      latestRequest?.status === 'rejected'
        ? latestRequest.rejectionReason || latestRequest.reviewNote || ''
        : user.videoCreatorStatus === 'rejected'
          ? user.videoCreatorReviewNote || ''
          : '',
    canUpload: user.videoCreatorStatus === 'approved',
    canReapply:
      !user.videoCreatorStatus ||
      user.videoCreatorStatus === 'none' ||
      user.videoCreatorStatus === 'rejected',
    applicationFields: APPLICATION_FIELDS,
    latestRequest: serializeRequest(latestRequest),
  };
}

function adminActor(req) {
  const admin = req.superAdmin;
  return {
    actorType: 'superadmin',
    actorId: admin?._id || null,
    actorLabel: admin?.email || admin?.username || admin?.name || 'SuperAdmin',
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

/** GET /api/v1/video-creator/application-form */
async function getApplicationForm(req, res) {
  try {
    return sendSuccess(res, 200, 'Application form', {
      fields: APPLICATION_FIELDS,
    });
  } catch (error) {
    logger.error('getApplicationForm error:', error);
    return sendError(res, 'SRV_6001', 'Failed to load application form');
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

    const validated = validateCreatorApplication(req.body || {});
    if (!validated.ok) {
      return sendError(res, 'VAL_2001', validated.message);
    }

    const request = await VideoCreatorRequest.create({
      user: user._id,
      message: validated.message,
      application: validated.application,
      status: 'pending',
      auditLog: [
        {
          action: 'submitted',
          actorType: 'user',
          actorId: user._id,
          actorLabel: user.email || user.username || String(user._id),
          note: 'Creator application submitted',
          meta: {
            contentNiche: validated.application.contentNiche,
            experienceLevel: validated.application.experienceLevel,
            postingFrequency: validated.application.postingFrequency,
          },
          at: new Date(),
        },
      ],
    });

    user.videoCreatorStatus = 'pending';
    user.videoCreatorRequestedAt = new Date();
    user.videoCreatorReviewedAt = null;
    user.videoCreatorReviewNote = '';
    await user.save();

    logger.info('Video creator application submitted', {
      userId: String(user._id),
      requestId: String(request._id),
      niche: validated.application.contentNiche,
      experience: validated.application.experienceLevel,
    });

    return sendSuccess(res, 201, 'Creator request submitted', statusPayload(user, request.toObject()));
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
        .populate(
          'user',
          'username fullName email profilePic videoCreatorStatus createdAt phone'
        )
        .populate('reviewedBy', 'email username name')
        .lean(),
      VideoCreatorRequest.countDocuments(match),
    ]);

    return sendSuccess(res, 200, 'Creator requests fetched', {
      requests: rows.map(serializeRequest),
      fields: APPLICATION_FIELDS,
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

/** GET /api/v1/superadmin/video-creators/:id */
async function getCreatorRequestAdmin(req, res) {
  try {
    const row = await VideoCreatorRequest.findById(req.params.id)
      .populate(
        'user',
        'username fullName email profilePic videoCreatorStatus createdAt phone'
      )
      .populate('reviewedBy', 'email username name')
      .lean();
    if (!row) return sendError(res, 'RES_3001', 'Request not found');
    return sendSuccess(res, 200, 'Creator request detail', {
      request: serializeRequest(row),
      fields: APPLICATION_FIELDS,
    });
  } catch (error) {
    logger.error('getCreatorRequestAdmin error:', error);
    return sendError(res, 'SRV_6001', 'Failed to load creator request');
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

    const note = (req.body?.note || req.body?.reviewNote || '').toString().trim().slice(0, 1000);
    const actor = adminActor(req);
    const now = new Date();

    request.status = 'approved';
    request.reviewedBy = actor.actorId;
    request.reviewedAt = now;
    request.reviewNote = note;
    request.rejectionReason = '';
    request.auditLog = request.auditLog || [];
    request.auditLog.push({
      action: 'approved',
      ...actor,
      note: note || 'Approved',
      at: now,
    });
    await request.save();

    await User.updateOne(
      { _id: request.user },
      {
        $set: {
          videoCreatorStatus: 'approved',
          videoCreatorReviewedAt: now,
          videoCreatorReviewNote: note,
        },
      }
    );

    await VideoCreatorRequest.updateMany(
      { user: request.user, status: 'pending', _id: { $ne: request._id } },
      {
        $set: {
          status: 'rejected',
          reviewedAt: now,
          reviewNote: 'Superseded by approval',
          rejectionReason: 'Superseded by approval of another request',
          reviewedBy: actor.actorId,
        },
        $push: {
          auditLog: {
            action: 'rejected',
            ...actor,
            note: 'Superseded by approval',
            at: now,
          },
        },
      }
    );

    logger.info('Video creator approved', {
      requestId: String(request._id),
      userId: String(request.user),
      admin: actor.actorLabel,
      note,
    });

    const populated = await VideoCreatorRequest.findById(request._id)
      .populate('user', 'username fullName email profilePic videoCreatorStatus createdAt phone')
      .populate('reviewedBy', 'email username name')
      .lean();

    return sendSuccess(res, 200, 'Creator approved', { request: serializeRequest(populated) });
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

    const reason = (req.body?.reason || req.body?.note || req.body?.reviewNote || '')
      .toString()
      .trim()
      .slice(0, 1000);

    if (reason.length < 5) {
      return sendError(
        res,
        'VAL_2002',
        'A rejection reason is required (at least 5 characters). The applicant will see this.'
      );
    }

    const actor = adminActor(req);
    const now = new Date();

    request.status = 'rejected';
    request.reviewedBy = actor.actorId;
    request.reviewedAt = now;
    request.rejectionReason = reason;
    request.reviewNote = reason;
    request.auditLog = request.auditLog || [];
    request.auditLog.push({
      action: 'rejected',
      ...actor,
      note: reason,
      at: now,
    });
    await request.save();

    await User.updateOne(
      { _id: request.user },
      {
        $set: {
          videoCreatorStatus: 'rejected',
          videoCreatorReviewedAt: now,
          videoCreatorReviewNote: reason,
        },
      }
    );

    logger.info('Video creator rejected', {
      requestId: String(request._id),
      userId: String(request.user),
      admin: actor.actorLabel,
      reason,
    });

    const populated = await VideoCreatorRequest.findById(request._id)
      .populate('user', 'username fullName email profilePic videoCreatorStatus createdAt phone')
      .populate('reviewedBy', 'email username name')
      .lean();

    return sendSuccess(res, 200, 'Creator rejected', { request: serializeRequest(populated) });
  } catch (error) {
    logger.error('rejectCreatorRequest error:', error);
    return sendError(res, 'SRV_6001', 'Failed to reject creator');
  }
}

module.exports = {
  getCreatorStatus,
  getApplicationForm,
  requestCreatorAccess,
  listCreatorRequestsAdmin,
  getCreatorRequestAdmin,
  approveCreatorRequest,
  rejectCreatorRequest,
  statusPayload,
};

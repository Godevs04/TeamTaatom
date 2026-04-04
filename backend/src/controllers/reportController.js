const Report = require('../models/Report');
const Post = require('../models/Post');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');

const AUTO_FLAG_REPORT_THRESHOLD = 3;

// @desc    Report user or content (Apple Guideline 1.2 - UGC)
// @route   POST /api/v1/reports
// @access  Private
const createReport = async (req, res) => {
  try {
    const { type, reportedUserId, postId, reason } = req.body;
    const reporterId = req.user._id;

    if (!reportedUserId) {
      return sendError(res, 'VAL_2001', 'reportedUserId is required');
    }
    if (!type || !['inappropriate_content', 'spam', 'harassment', 'abuse', 'fake_account', 'user', 'other'].includes(type)) {
      return sendError(res, 'VAL_2001', 'Valid type is required');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 1) {
      return sendError(res, 'VAL_2001', 'Reason is required');
    }
    if (reason.length > 500) {
      return sendError(res, 'VAL_2001', 'Reason cannot exceed 500 characters');
    }

    if (reporterId.toString() === reportedUserId) {
      return sendError(res, 'VAL_2001', 'You cannot report yourself');
    }

    // Prevent duplicate reports (same user + same target within 24h) - self-report spam abuse
    const recentReport = await Report.findOne({
      reportedBy: reporterId,
      reportedUser: reportedUserId,
      ...(postId && { reportedContent: postId }),
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (recentReport) {
      return sendError(res, 'VAL_2001', 'You have already reported this. Our team will review it.');
    }

    const reportData = {
      type,
      reportedBy: reporterId,
      reportedUser: reportedUserId,
      reason: reason.trim(),
    };

    if (postId) {
      reportData.reportedContent = postId;
    }

    const report = new Report(reportData);
    await report.save();

    // Auto-flag content when report count >= threshold (Part 4 - Moderation)
    if (postId) {
      const reportCount = await Report.countDocuments({
        reportedContent: postId,
        status: { $in: ['pending', 'under_review'] }
      });
      if (reportCount >= AUTO_FLAG_REPORT_THRESHOLD) {
        await Post.findByIdAndUpdate(postId, { status: 'flagged' });
        logger.info(`Post ${postId} auto-flagged after ${reportCount} reports`);
      }
    }

    return sendSuccess(res, 201, 'Report submitted. Our team will review it.', { reportId: report._id });
  } catch (error) {
    logger.error('Create report error:', error);
    return sendError(res, 'SRV_6001', 'Error submitting report');
  }
};

module.exports = { createReport };

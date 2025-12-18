const TripVisit = require('../models/TripVisit');
const User = require('../models/User');
const Post = require('../models/Post');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Static Taatom Official system user ID (must exist in DB for chat system)
const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID || '000000000000000000000001';

/**
 * Admin TripScore Verification Controller
 * Handles admin review of pending TripScore verifications
 */

// @desc    Get pending reviews
// @route   GET /admin/tripscore/review/pending
// @access  Private (SuperAdmin)
const getPendingReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query for pending reviews
    // Include both explicitly pending reviews AND unverified/manual locations that should be reviewed
    // EXCLUDE already approved/rejected records
    const query = {
      isActive: true,
      verificationStatus: { $nin: ['approved', 'rejected'] }, // Exclude already processed
      $or: [
        // Explicitly pending reviews (new records)
        { verificationStatus: 'pending_review' },
        // Backward compatibility: Records that should be pending but aren't marked yet
        {
          $and: [
            { verificationStatus: { $ne: 'pending_review' } }, // Not already pending
            {
              $or: [
                { trustLevel: 'unverified' },
                { source: 'manual_only' },
                { source: 'gallery_no_exif' },
                { $and: [{ lat: 0 }, { lng: 0 }] }
              ]
            }
          ]
        }
      ]
    };

    // Debug: Log query and counts for diagnosis
    const totalPending = await TripVisit.countDocuments({ verificationStatus: 'pending_review', isActive: true });
    const totalUnverified = await TripVisit.countDocuments({ trustLevel: 'unverified', isActive: true });
    const totalManual = await TripVisit.countDocuments({ source: 'manual_only', isActive: true });
    const totalZeroCoords = await TripVisit.countDocuments({ lat: 0, lng: 0, isActive: true });
    const totalActive = await TripVisit.countDocuments({ isActive: true });
    
    logger.info('[Admin Debug] Pending reviews query:', {
      query: JSON.stringify(query),
      counts: {
        total_active: totalActive,
        pending_review: totalPending,
        unverified: totalUnverified,
        manual_only: totalManual,
        zero_coords: totalZeroCoords
      }
    });

    // Get pending reviews with populated user and post data
    let pendingVisits = [];
    try {
      pendingVisits = await TripVisit.find(query)
        .populate('user', 'fullName username email profilePic')
        .populate('post', 'caption imageUrl images createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
    } catch (queryError) {
      logger.error('[Admin Debug] Query error:', queryError);
      // Fallback: Try simpler query
      pendingVisits = await TripVisit.find({
        isActive: true,
        $or: [
          { verificationStatus: 'pending_review' },
          { trustLevel: 'unverified' },
          { source: 'manual_only' },
          { source: 'gallery_no_exif' }
        ]
      })
        .populate('user', 'fullName username email profilePic')
        .populate('post', 'caption imageUrl images createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
    }

    const total = await TripVisit.countDocuments(query).catch(() => {
      // Fallback count
      return TripVisit.countDocuments({
        isActive: true,
        $or: [
          { verificationStatus: 'pending_review' },
          { trustLevel: 'unverified' },
          { source: 'manual_only' },
          { source: 'gallery_no_exif' }
        ]
      });
    });

    logger.info('[Admin Debug] Found pending reviews:', {
      total,
      returned: pendingVisits.length,
      sample: pendingVisits.slice(0, 3).map(v => ({
        id: v._id?.toString(),
        verificationStatus: v.verificationStatus,
        trustLevel: v.trustLevel,
        source: v.source,
        lat: v.lat,
        lng: v.lng,
        hasUser: !!v.user,
        hasPost: !!v.post
      }))
    });

    // Format response
    const reviews = pendingVisits.map(visit => {
      // Determine verification reason if not set (backward compatibility)
      let verificationReason = visit.verificationReason;
      if (!verificationReason) {
        if (visit.lat === 0 && visit.lng === 0) {
          verificationReason = 'manual_location';
        } else if (visit.source === 'manual_only') {
          verificationReason = 'manual_location';
        } else if (visit.source === 'gallery_no_exif') {
          verificationReason = 'no_exif';
        } else if (visit.trustLevel === 'suspicious') {
          verificationReason = 'suspicious_pattern';
        } else {
          verificationReason = 'no_exif'; // Default fallback
        }
      }

      return {
        _id: visit._id,
        user: visit.user ? {
          _id: visit.user._id,
          fullName: visit.user.fullName,
          username: visit.user.username,
          email: visit.user.email,
          profilePic: visit.user.profilePic
        } : null,
        post: visit.post ? {
          _id: visit.post._id,
          caption: visit.post.caption,
          imageUrl: visit.post.imageUrl,
          images: visit.post.images,
          createdAt: visit.post.createdAt
        } : null,
        location: {
          address: visit.address,
          city: visit.city,
          country: visit.country,
          continent: visit.continent,
          coordinates: {
            latitude: visit.lat,
            longitude: visit.lng
          }
        },
        source: visit.source,
        verificationReason: verificationReason,
        uploadedAt: visit.uploadedAt,
        createdAt: visit.createdAt
      };
    });

    return sendSuccess(res, 200, 'Pending reviews fetched successfully', {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get pending reviews error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch pending reviews');
  }
};

// @desc    Approve TripVisit
// @route   POST /admin/tripscore/review/:tripVisitId/approve
// @access  Private (SuperAdmin)
const approveTripVisit = async (req, res) => {
  try {
    const { tripVisitId } = req.params;
    const adminId = req.superAdmin?._id || req.user?._id; // Support both SuperAdmin and regular admin

    if (!mongoose.Types.ObjectId.isValid(tripVisitId)) {
      return sendError(res, 'VAL_2001', 'Invalid TripVisit ID');
    }

    const tripVisit = await TripVisit.findById(tripVisitId);

    if (!tripVisit) {
      return sendError(res, 'RES_3001', 'TripVisit not found');
    }

    // Check if already processed
    if (tripVisit.verificationStatus === 'approved') {
      return sendError(res, 'VAL_2001', 'TripVisit has already been approved');
    }
    
    if (tripVisit.verificationStatus === 'rejected') {
      return sendError(res, 'VAL_2001', 'TripVisit has already been rejected');
    }

    // Allow approval of pending reviews OR backward-compatible unverified/manual locations
    const isPendingReview = tripVisit.verificationStatus === 'pending_review';
    const isBackwardCompatible = 
      tripVisit.verificationStatus === 'auto_verified' &&
      (tripVisit.trustLevel === 'unverified' || 
       tripVisit.source === 'manual_only' || 
       tripVisit.source === 'gallery_no_exif' ||
       (tripVisit.lat === 0 && tripVisit.lng === 0));

    if (!isPendingReview && !isBackwardCompatible) {
      return sendError(res, 'VAL_2001', 'TripVisit is not pending review');
    }

    // Update verification status
    tripVisit.verificationStatus = 'approved';
    tripVisit.reviewedBy = adminId;
    tripVisit.reviewedAt = new Date();
    await tripVisit.save();

    logger.info(`TripVisit ${tripVisitId} approved by admin ${adminId}`);

    // Send notification to user (fire-and-forget)
    sendApprovalNotification(tripVisit.user, tripVisit).catch(err => {
      logger.error('Failed to send approval notification:', err);
    });

    return sendSuccess(res, 200, 'TripVisit approved successfully', {
      tripVisit: {
        _id: tripVisit._id,
        verificationStatus: tripVisit.verificationStatus,
        reviewedBy: tripVisit.reviewedBy,
        reviewedAt: tripVisit.reviewedAt
      }
    });
  } catch (error) {
    logger.error('Approve TripVisit error:', error);
    return sendError(res, 'SRV_6001', 'Failed to approve TripVisit');
  }
};

// @desc    Reject TripVisit
// @route   POST /admin/tripscore/review/:tripVisitId/reject
// @access  Private (SuperAdmin)
const rejectTripVisit = async (req, res) => {
  try {
    const { tripVisitId } = req.params;
    const adminId = req.superAdmin?._id || req.user?._id; // Support both SuperAdmin and regular admin

    if (!mongoose.Types.ObjectId.isValid(tripVisitId)) {
      return sendError(res, 'VAL_2001', 'Invalid TripVisit ID');
    }

    const tripVisit = await TripVisit.findById(tripVisitId);

    if (!tripVisit) {
      return sendError(res, 'RES_3001', 'TripVisit not found');
    }

    // Check if already processed
    if (tripVisit.verificationStatus === 'approved') {
      return sendError(res, 'VAL_2001', 'TripVisit has already been approved');
    }
    
    if (tripVisit.verificationStatus === 'rejected') {
      return sendError(res, 'VAL_2001', 'TripVisit has already been rejected');
    }

    // Allow rejection of pending reviews OR backward-compatible unverified/manual locations
    const isPendingReview = tripVisit.verificationStatus === 'pending_review';
    const isBackwardCompatible = 
      tripVisit.verificationStatus === 'auto_verified' &&
      (tripVisit.trustLevel === 'unverified' || 
       tripVisit.source === 'manual_only' || 
       tripVisit.source === 'gallery_no_exif' ||
       (tripVisit.lat === 0 && tripVisit.lng === 0));

    if (!isPendingReview && !isBackwardCompatible) {
      return sendError(res, 'VAL_2001', 'TripVisit is not pending review');
    }

    // Update verification status
    tripVisit.verificationStatus = 'rejected';
    tripVisit.reviewedBy = adminId;
    tripVisit.reviewedAt = new Date();
    await tripVisit.save();

    logger.info(`TripVisit ${tripVisitId} rejected by admin ${adminId}`);

    // Send notification to user (fire-and-forget)
    sendRejectionNotification(tripVisit.user, tripVisit).catch(err => {
      logger.error('Failed to send rejection notification:', err);
    });

    return sendSuccess(res, 200, 'TripVisit rejected successfully', {
      tripVisit: {
        _id: tripVisit._id,
        verificationStatus: tripVisit.verificationStatus,
        reviewedBy: tripVisit.reviewedBy,
        reviewedAt: tripVisit.reviewedAt
      }
    });
  } catch (error) {
    logger.error('Reject TripVisit error:', error);
    return sendError(res, 'SRV_6001', 'Failed to reject TripVisit');
  }
};

/**
 * Send approval notification via chat
 * Fire-and-forget, does not block the approval process
 */
const sendApprovalNotification = async (userId, tripVisit) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Get city and country from tripVisit
    const city = tripVisit.city || tripVisit.address?.split(',')[0] || 'this location';
    const country = tripVisit.country || '';

    const message = `✅ Your trip to ${city}${country ? `, ${country}` : ''} has been verified!\nYour TripScore has been updated 🌍`;

    // Send via chat service (reuse existing chat API)
    await sendChatMessage(userId, message);
  } catch (error) {
    logger.error('Error sending approval notification:', error);
  }
};

/**
 * Send rejection notification via chat
 * Fire-and-forget, does not block the rejection process
 */
const sendRejectionNotification = async (userId, tripVisit) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const message = `⚠️ We couldn't verify this post due to missing location proof.\nYou can upload another photo from the same trip or capture directly using Taatom camera.`;

    // Send via chat service (reuse existing chat API)
    await sendChatMessage(userId, message);
  } catch (error) {
    logger.error('Error sending rejection notification:', error);
  }
};

/**
 * Send chat message from TAATOM_OFFICIAL user
 * Uses existing chat controller API
 */
const sendChatMessage = async (recipientUserId, text) => {
  try {
    // Get or create TAATOM_OFFICIAL system user
    let officialUser = await User.findById(TAATOM_OFFICIAL_USER_ID) ||
                       await User.findOne({ email: 'official@taatom.com' }) || 
                       await User.findOne({ username: 'taatom_official' });
    
    if (!officialUser) {
      // Create TAATOM_OFFICIAL system user if it doesn't exist
      try {
        officialUser = await User.create({
          _id: new mongoose.Types.ObjectId(TAATOM_OFFICIAL_USER_ID),
          email: 'official@taatom.com',
          username: 'taatom_official',
          fullName: 'Taatom Official',
          password: require('crypto').randomBytes(32).toString('hex'), // Random password, never used
          isVerified: true,
          isActive: true,
          isSystem: true // Mark as system user
        });
        logger.info('Created TAATOM_OFFICIAL system user for notifications');
      } catch (createError) {
        // If user already exists (race condition), fetch it
        if (createError.code === 11000) {
          officialUser = await User.findById(TAATOM_OFFICIAL_USER_ID) ||
                         await User.findOne({ email: 'official@taatom.com' }) ||
                         await User.findOne({ username: 'taatom_official' });
        }
        if (!officialUser) {
          logger.error('Failed to create/find TAATOM_OFFICIAL user:', createError);
          return; // Skip notification if user creation fails
        }
      }
    }
    
    // Ensure user has verified status for UI display
    if (!officialUser.isVerified) {
      officialUser.isVerified = true;
      await officialUser.save();
    }

    // Use chat controller to send message
    const Chat = require('../models/Chat');
    let chat = await Chat.findOne({ 
      participants: { $all: [officialUser._id, recipientUserId] } 
    });

    if (!chat) {
      chat = await Chat.create({ 
        participants: [officialUser._id, recipientUserId], 
        messages: [] 
      });
    }

    // Add message
    const message = {
      sender: officialUser._id,
      text,
      timestamp: new Date(),
      seen: false
    };

    chat.messages.push(message);
    await chat.save();

    // Emit socket event if available
    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        nsp.to(`user:${recipientUserId}`).emit('message:new', { 
          chatId: chat._id, 
          message: {
            ...message,
            _id: chat.messages[chat.messages.length - 1]._id
          }
        });
      }
    } catch (socketError) {
      logger.debug('Socket not available for chat notification:', socketError);
    }

    logger.debug(`Chat notification sent to user ${recipientUserId}`);
  } catch (error) {
    logger.error('Error sending chat message:', error);
    throw error;
  }
};

module.exports = {
  getPendingReviews,
  approveTripVisit,
  rejectTripVisit
};


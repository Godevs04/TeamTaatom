const TripVisit = require('../models/TripVisit');
const User = require('../models/User');
const Post = require('../models/Post');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { generateSignedUrl, generateSignedUrls } = require('../services/mediaService');
const { 
  getOrCreateSupportConversation, 
  sendSystemMessage,
  getSupportChatByTripVisit
} = require('../services/adminSupportChatService');
const { getIO } = require('../socket');

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
        .populate('user', 'fullName username email profilePic profilePicStorageKey')
        .populate('post', 'caption imageUrl images createdAt storageKey storageKeys type')
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
        .populate('user', 'fullName username email profilePic profilePicStorageKey')
        .populate('post', 'caption imageUrl images createdAt storageKey storageKeys type')
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

    // Format response and generate signed URLs for images
    const reviews = await Promise.all(pendingVisits.map(async (visit) => {
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

      // Generate signed URLs for user profile picture
      let profilePicUrl = null;
      if (visit.user?.profilePicStorageKey) {
        try {
          profilePicUrl = await generateSignedUrl(visit.user.profilePicStorageKey, 'PROFILE');
        } catch (error) {
          logger.warn('Failed to generate profile pic URL:', error);
          profilePicUrl = visit.user.profilePic || null;
        }
      } else {
        profilePicUrl = visit.user?.profilePic || null;
      }

      // Generate signed URLs for post images
      let postImages = [];
      let postImageUrl = null;
      if (visit.post) {
        if (visit.post.storageKeys && visit.post.storageKeys.length > 0) {
          try {
            const imageUrls = await generateSignedUrls(visit.post.storageKeys, 'IMAGE');
            postImages = imageUrls;
            postImageUrl = imageUrls[0] || null;
          } catch (error) {
            logger.warn('Failed to generate image URLs from storageKeys:', error);
            postImages = visit.post.images || [];
            postImageUrl = visit.post.imageUrl || null;
          }
        } else if (visit.post.storageKey) {
          try {
            postImageUrl = await generateSignedUrl(visit.post.storageKey, 'IMAGE');
            postImages = [postImageUrl];
          } catch (error) {
            logger.warn('Failed to generate image URL from storageKey:', error);
            postImages = visit.post.images || [];
            postImageUrl = visit.post.imageUrl || null;
          }
        } else {
          // Legacy: use existing imageUrl/images
          postImages = visit.post.images || [];
          postImageUrl = visit.post.imageUrl || null;
        }
      }

      return {
        _id: visit._id,
        user: visit.user ? {
          _id: visit.user._id,
          fullName: visit.user.fullName,
          username: visit.user.username,
          email: visit.user.email,
          profilePic: profilePicUrl
        } : null,
        post: visit.post ? {
          _id: visit.post._id,
          caption: visit.post.caption,
          imageUrl: postImageUrl,
          images: postImages,
          createdAt: visit.post.createdAt,
          type: visit.post.type
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
    }));

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

    // Update support conversation status to 'resolved' if exists
    try {
      const supportChat = await getSupportChatByTripVisit(tripVisitId);
      if (supportChat) {
        supportChat.status = 'resolved';
        await supportChat.save();
        logger.debug(`Updated support conversation status to resolved for TripVisit ${tripVisitId}`);
      }
    } catch (chatError) {
      logger.debug('Could not update conversation status:', chatError.message);
      // Non-blocking, continue
    }

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

    // Update support conversation status to 'resolved' if exists
    try {
      const supportChat = await getSupportChatByTripVisit(tripVisitId);
      if (supportChat) {
        supportChat.status = 'resolved';
        await supportChat.save();
        logger.debug(`Updated support conversation status to resolved for TripVisit ${tripVisitId}`);
      }
    } catch (chatError) {
      logger.debug('Could not update conversation status:', chatError.message);
      // Non-blocking, continue
    }

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
 * Send approval notification via support chat
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

    // Get or create support conversation
    const convo = await getOrCreateSupportConversation({
      userId: userId.toString(),
      reason: 'trip_verification',
      refId: tripVisit._id.toString()
    });

    // Send system message
    await sendSystemMessage({
      conversationId: convo._id.toString(),
      messageText: message
    });

    // Emit socket event
    try {
      const io = getIO();
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        const lastMessage = convo.messages[convo.messages.length - 1];
        nsp.to(`user:${userId}`).emit('message:new', { 
          chatId: convo._id, 
          message: lastMessage
        });
        nsp.to(`user:${userId}`).emit('chat:update', { 
          chatId: convo._id, 
          lastMessage: message, 
          timestamp: lastMessage.timestamp 
        });
      }
    } catch (socketError) {
      logger.debug('Socket not available for approval notification:', socketError);
    }
  } catch (error) {
    logger.error('Error sending approval notification:', error);
  }
};

/**
 * Send rejection notification via support chat
 * Fire-and-forget, does not block the rejection process
 */
const sendRejectionNotification = async (userId, tripVisit) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const message = `⚠️ We couldn't verify this post due to missing or unclear location proof.\nYou may upload another photo or capture directly using Taatom camera.`;

    // Get or create support conversation
    const convo = await getOrCreateSupportConversation({
      userId: userId.toString(),
      reason: 'trip_verification',
      refId: tripVisit._id.toString()
    });

    // Send system message
    await sendSystemMessage({
      conversationId: convo._id.toString(),
      messageText: message
    });

    // Emit socket event
    try {
      const io = getIO();
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        const lastMessage = convo.messages[convo.messages.length - 1];
        nsp.to(`user:${userId}`).emit('message:new', { 
          chatId: convo._id, 
          message: lastMessage
        });
        nsp.to(`user:${userId}`).emit('chat:update', { 
          chatId: convo._id, 
          lastMessage: message, 
          timestamp: lastMessage.timestamp 
        });
      }
    } catch (socketError) {
      logger.debug('Socket not available for rejection notification:', socketError);
    }
  } catch (error) {
    logger.error('Error sending rejection notification:', error);
  }
};


// @desc    Update TripVisit details
// @route   PATCH /admin/tripscore/review/:tripVisitId
// @access  Private (SuperAdmin)
const updateTripVisit = async (req, res) => {
  try {
    const { tripVisitId } = req.params;
    const adminId = req.superAdmin?._id || req.user?._id;
    const { country, continent, address, city, verificationReason, lat, lng } = req.body;

    if (!mongoose.Types.ObjectId.isValid(tripVisitId)) {
      return sendError(res, 'VAL_2001', 'Invalid TripVisit ID');
    }

    const tripVisit = await TripVisit.findById(tripVisitId);

    if (!tripVisit) {
      return sendError(res, 'RES_3001', 'TripVisit not found');
    }

    // Update fields if provided
    if (country !== undefined) {
      tripVisit.country = country;
    }
    if (continent !== undefined) {
      // Validate continent
      const validContinents = ['ASIA', 'AFRICA', 'NORTH AMERICA', 'SOUTH AMERICA', 'AUSTRALIA', 'EUROPE', 'ANTARCTICA', 'Unknown'];
      if (validContinents.includes(continent.toUpperCase())) {
        tripVisit.continent = continent.toUpperCase();
      } else {
        return sendError(res, 'VAL_2001', 'Invalid continent');
      }
    }
    if (address !== undefined) {
      tripVisit.address = address;
    }
    if (city !== undefined) {
      tripVisit.city = city;
    }
    if (verificationReason !== undefined) {
      // Validate verification reason
      const validReasons = ['no_exif', 'manual_location', 'suspicious_pattern', 'photo_requires_review', 'gallery_exif_requires_review', 'photo_from_camera_requires_review', 'requires_admin_review'];
      if (validReasons.includes(verificationReason)) {
        tripVisit.verificationReason = verificationReason;
      } else {
        return sendError(res, 'VAL_2001', 'Invalid verification reason');
      }
    }
    if (lat !== undefined && lng !== undefined) {
      tripVisit.lat = parseFloat(lat);
      tripVisit.lng = parseFloat(lng);
    }

    // Track who updated it
    tripVisit.reviewedBy = adminId;
    tripVisit.reviewedAt = new Date();

    await tripVisit.save();

    logger.info(`TripVisit ${tripVisitId} updated by admin ${adminId}`);

    return sendSuccess(res, 200, 'TripVisit updated successfully', {
      tripVisit: {
        _id: tripVisit._id,
        country: tripVisit.country,
        continent: tripVisit.continent,
        address: tripVisit.address,
        city: tripVisit.city,
        verificationReason: tripVisit.verificationReason,
        lat: tripVisit.lat,
        lng: tripVisit.lng,
        reviewedBy: tripVisit.reviewedBy,
        reviewedAt: tripVisit.reviewedAt
      }
    });
  } catch (error) {
    logger.error('Update TripVisit error:', error);
    return sendError(res, 'SRV_6001', 'Failed to update TripVisit');
  }
};

// @desc    Get support chat for a TripVisit
// @route   GET /admin/tripscore/:tripVisitId/support-chat
// @access  Private (SuperAdmin)
const getTripVisitSupportChat = async (req, res) => {
  try {
    const { tripVisitId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(tripVisitId)) {
      return sendError(res, 'VAL_2001', 'Invalid TripVisit ID');
    }

    const tripVisit = await TripVisit.findById(tripVisitId).select('user').lean();

    if (!tripVisit) {
      return sendError(res, 'RES_3001', 'TripVisit not found');
    }

    // Find existing conversation linked to this TripVisit
    let conversation = await getSupportChatByTripVisit(tripVisitId);

    // If no conversation exists, create one
    if (!conversation) {
      conversation = await getOrCreateSupportConversation({
        userId: tripVisit.user.toString(),
        reason: 'trip_verification',
        refId: tripVisitId
      });
    }

    return sendSuccess(res, 200, 'Support chat retrieved successfully', {
      conversationId: conversation._id.toString(),
      userId: tripVisit.user.toString(),
      tripVisitId: tripVisitId
    });
  } catch (error) {
    logger.error('Get TripVisit support chat error:', error);
    return sendError(res, 'SRV_6001', 'Failed to get support chat');
  }
};

module.exports = {
  getPendingReviews,
  approveTripVisit,
  rejectTripVisit,
  updateTripVisit,
  getTripVisitSupportChat
};


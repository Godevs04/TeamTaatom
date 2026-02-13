const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { buildMediaKey, uploadObject, deleteObject } = require('../services/storage');
const { generateSignedUrl } = require('../services/mediaService');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');
const { getFollowers } = require('../utils/socketBus');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { cacheWrapper, CacheKeys, CACHE_TTL, deleteCache, deleteCacheByPattern } = require('../utils/cache');
const Activity = require('../models/Activity');
const TripVisit = require('../models/TripVisit');
const { TRUSTED_TRUST_LEVELS, VERIFIED_STATUSES } = require('../config/tripScoreConfig');
const { sendNotificationToUser } = require('../utils/sendNotification');
const { TAATOM_OFFICIAL_USER_ID, TAATOM_OFFICIAL_USER } = require('../constants/taatomOfficial');

// @desc    Get user profile
// @route   GET /profile/:id
// @access  Public
const getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
    }

    // Ensure Taatom Official user exists with correct profile picture
    if (id === TAATOM_OFFICIAL_USER_ID) {
      try {
        const existingUser = await User.findById(TAATOM_OFFICIAL_USER_ID);
        if (!existingUser) {
          // Create Taatom Official user if it doesn't exist
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash('system_user_no_login', 10);
          const officialUser = new User({
            _id: new mongoose.Types.ObjectId(TAATOM_OFFICIAL_USER_ID),
            username: TAATOM_OFFICIAL_USER.username,
            fullName: TAATOM_OFFICIAL_USER.fullName,
            email: `taatom_official@taatom.com`,
            password: hashedPassword,
            isVerified: true,
            isActive: true,
            bio: 'Official Taatom support account',
            profilePic: TAATOM_OFFICIAL_USER.profilePic
          });
          await officialUser.save();
          logger.info('Taatom Official user created from profile request');
        } else if (!existingUser.profilePic || existingUser.profilePic !== TAATOM_OFFICIAL_USER.profilePic) {
          // Update profile picture if missing or different
          existingUser.profilePic = TAATOM_OFFICIAL_USER.profilePic;
          await existingUser.save();
          logger.info('Taatom Official user profile picture updated from profile request');
        }
      } catch (error) {
        // Log but don't fail - profile will still be returned with constant profilePic
        logger.debug('Error ensuring Taatom Official user:', error.message);
      }
    }

    // Cache key
    const cacheKey = CacheKeys.user(id);

    // Use cache wrapper with optimized query using aggregation to avoid N+1
    const user = await cacheWrapper(cacheKey, async () => {
      // Use aggregation pipeline to efficiently fetch user with followers/following
      const users = await User.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },
        {
          $lookup: {
            from: 'users',
            localField: 'followers',
            foreignField: '_id',
            as: 'followers',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'following',
            foreignField: '_id',
            as: 'following',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1 } }
            ]
          }
        },
        {
          $project: {
            password: 0,
            otp: 0,
            otpExpires: 0
          }
        }
      ]);
      return users[0] || null;
    }, CACHE_TTL.USER_PROFILE);

    // Backend Defensive Guards: Guard against null/missing profile data
    if (!user) {
      logger.warn(`Profile not found for userId: ${id}`);
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    // Apple Guideline 1.2: Blocked users cannot view each other's profiles
    if (req.user && req.user._id.toString() !== id) {
      const currentUserId = req.user._id.toString();
      const targetUserDoc = await User.findById(id).select('blockedUsers').lean();
      const currentUserDoc = await User.findById(currentUserId).select('blockedUsers').lean();
      const targetBlockedIds = (targetUserDoc?.blockedUsers || []).map(b => (typeof b === 'object' && b?._id ? b._id.toString() : b.toString()));
      const currentBlockedIds = (currentUserDoc?.blockedUsers || []).map(b => (typeof b === 'object' && b?._id ? b._id.toString() : b.toString()));
      if (targetBlockedIds.includes(currentUserId) || currentBlockedIds.includes(id)) {
        return sendError(res, 'AUTH_1006', 'You cannot view this profile');
      }
    }
    
    // Defensive: Ensure user has required fields
    if (!user._id || !user.fullName) {
      logger.error(`Invalid user data structure for userId: ${id}`, { hasId: !!user._id, hasFullName: !!user.fullName });
      return sendError(res, 'ERR_5001', 'Invalid user data');
    }

    // Get user's posts count and locations (optimized query)
    const posts = await Post.find({ user: id, isActive: true })
      .select('location createdAt likes')
      .lean()
      .limit(1000); // Limit for performance

    // Extract unique locations for the map (only posts with valid coordinates)
    const locations = posts
      .filter(post => post.location && post.location.coordinates && 
               (post.location.coordinates.latitude !== 0 || post.location.coordinates.longitude !== 0))
      .map(post => ({
        latitude: post.location.coordinates.latitude,
        longitude: post.location.coordinates.longitude,
        address: post.location.address,
        date: post.createdAt
      }));

    // Calculate TripScore v2.1 based on TripVisit (unique, verified visits)
    // Only TripVisits with verificationStatus in ['auto_verified','approved'] contribute to TripScore.
    // Pending/rejected visits are excluded from scoring.
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES }
    })
    .select('lat lng continent country address uploadedAt')
    .lean()
    .limit(1000); // Limit for performance

    // Group visits by continent/country for TripScore v2
    // TripScore v2 counts unique places visited, not raw post count
    const tripScoreData = {
      totalScore: 0,
      continents: {},
      countries: {},
      areas: []
    };

    // Helper function to round coordinates for grouping (same tolerance as deduplication: 0.01 degrees ≈ 1.1km)
    // This ensures multiple posts at the same location are grouped together
    const roundCoordinate = (coord, precision = 2) => {
      // Round to 2 decimal places (≈ 1.1km precision)
      return Math.round(coord * 100) / 100;
    };
    
    const getLocationKey = (lat, lng) => {
      // Use rounded coordinates to group nearby locations together
      return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
    };

    // Helper function to normalize continent name to standard format (same as getTripScoreContinents)
    const normalizeContinentName = (continent) => {
      if (!continent) return 'UNKNOWN';
      const normalized = continent.toUpperCase().trim();
      // Map common variations to standard names
      const continentMap = {
        'ASIA': 'ASIA',
        'AFRICA': 'AFRICA',
        'NORTH AMERICA': 'NORTH AMERICA',
        'SOUTH AMERICA': 'SOUTH AMERICA',
        'AUSTRALIA': 'AUSTRALIA',
        'EUROPE': 'EUROPE',
        'ANTARCTICA': 'ANTARCTICA',
        'OCEANIA': 'AUSTRALIA', // Map Oceania to Australia
        'AMERICA': 'NORTH AMERICA', // Default America to North America
      };
      return continentMap[normalized] || normalized;
    };

    // Track unique locations (deduplicate by rounded lat/lng to match deduplication tolerance)
    const uniqueLocations = new Set();

    // Process visits to calculate TripScore (unique places only)
    trustedVisits.forEach(visit => {
      // Skip visits with invalid coordinates
      if (!visit.lat || !visit.lng || visit.lat === 0 || visit.lng === 0 || 
          isNaN(visit.lat) || isNaN(visit.lng)) {
        return;
      }

      // Use rounded coordinates to group nearby locations (same as deduplication logic)
      const locationKey = getLocationKey(visit.lat, visit.lng);
      
      // Only count each unique location once (groups nearby locations together)
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.add(locationKey);
        
        // Normalize continent name to ensure consistent matching
        const continentKey = normalizeContinentName(visit.continent);

        // Add to continent score (unique locations only)
        if (!tripScoreData.continents[continentKey]) {
          tripScoreData.continents[continentKey] = 0;
        }
        tripScoreData.continents[continentKey] += 1;

        // Add to total score (unique places visited)
        tripScoreData.totalScore += 1;

        // Add to areas list
        tripScoreData.areas.push({
          address: visit.address || 'Unknown Location',
          continent: continentKey,
          likes: 0, // Likes are post-specific, not visit-specific
          date: visit.uploadedAt
        });
      }
    });

    // Check if current user is following this profile
    const isFollowing = req.user && user.followers ? 
      user.followers.some(follower => {
        const followerId = typeof follower === 'object' && follower._id ? follower._id.toString() : follower.toString();
        return followerId === req.user._id.toString();
      }) : 
      false;

    // Check if current user has sent a follow request
    const hasSentFollowRequest = req.user && user.followRequests ? 
      user.followRequests.some(req => req.user.toString() === req.user._id.toString() && req.status === 'pending') :
      false;

    // Check if current user has received a follow request from this user
    const hasReceivedFollowRequest = req.user && user.sentFollowRequests ? 
      user.sentFollowRequests.some(req => req.user.toString() === id && req.status === 'pending') :
      false;

    // Determine profile visibility based on settings
    const profileVisibility = user.settings?.privacy?.profileVisibility || 'public';
    const isOwnProfile = req.user ? req.user._id.toString() === id : false;
    
    let canViewProfile = false;
    let canViewPosts = false;
    let canViewLocations = false;
    let followRequestSent = false;

    if (isOwnProfile) {
      // User can always see their own profile
      canViewProfile = true;
      canViewPosts = true;
      canViewLocations = true;
    } else {
      switch (profileVisibility) {
        case 'public':
          // Public: Anyone can view profile as if they're followed
          canViewProfile = true;
          canViewPosts = true;
          canViewLocations = true;
          break;
          
        case 'followers':
          // Followers Only: Only followers can see details
          canViewProfile = true;
          canViewPosts = isFollowing;
          canViewLocations = isFollowing;
          break;
          
        case 'private':
          // Private (Require Approval): Only approved followers can see details
          canViewProfile = true;
          canViewPosts = isFollowing;
          canViewLocations = isFollowing;
          followRequestSent = hasSentFollowRequest;
          break;
          
        default:
          // Default to public behavior
          canViewProfile = true;
          canViewPosts = true;
          canViewLocations = true;
      }
    }

    // Always return tripScore structure (even if 0) so frontend can display it
    // Only hide tripScore if user can't view profile
    const tripScore = canViewProfile ? tripScoreData : null;

    // user is already a lean object, so we can spread it directly
    // Calculate followers/following counts (they are populated objects)
    const followersCount = user.followers ? 
      user.followers.filter((follower) => {
        const followerId = typeof follower === 'object' && follower._id ? follower._id.toString() : follower.toString();
        return followerId !== id.toString();
      }).length : 0;
    
    const followingCount = user.following ? 
      user.following.filter((following) => {
        const followingId = typeof following === 'object' && following._id ? following._id.toString() : following.toString();
        return followingId !== id.toString();
      }).length : 0;

    // Generate signed URL for profile picture dynamically
    let profilePicUrl = null;
    
    // Special handling for Taatom Official user - always use the constant profile picture
    const isTaatomOfficial = user._id.toString() === TAATOM_OFFICIAL_USER_ID;
    
    if (isTaatomOfficial) {
      // For Taatom Official, always use the constant profile picture
      profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      
      // Also ensure it's saved to the database (async, don't block response)
      if (!user.profilePic || user.profilePic !== TAATOM_OFFICIAL_USER.profilePic) {
        User.findByIdAndUpdate(TAATOM_OFFICIAL_USER_ID, { 
          profilePic: TAATOM_OFFICIAL_USER.profilePic 
        }).catch(err => logger.debug('Failed to update Taatom Official profilePic:', err));
      }
    } else if (user.profilePicStorageKey) {
      try {
        profilePicUrl = await generateSignedUrl(user.profilePicStorageKey, 'PROFILE');
      } catch (error) {
        logger.warn('Failed to generate profile picture URL:', { 
          userId: user._id, 
          error: error.message 
        });
        // Fallback to legacy URL if available
        profilePicUrl = user.profilePic || null;
      }
    } else if (user.profilePic) {
      // Legacy: use existing profilePic if no storage key
      profilePicUrl = user.profilePic;
    }

    const profile = {
      ...user,
      profilePic: profilePicUrl, // Dynamically generated URL
      postsCount: posts.length,
      followersCount,
      followingCount,
      locations: canViewLocations ? locations : [],
      tripScore: tripScore,
      isFollowing,
      isOwnProfile,
      canViewProfile,
      canViewPosts,
      canViewLocations,
      followRequestSent,
      profileVisibility,
      hasReceivedFollowRequest,
      // Only include email if user has enabled showEmail setting
      email: user.settings?.privacy?.showEmail ? user.email : undefined,
      // Include bio for all users
      bio: user.bio || ''
    };

    return sendSuccess(res, 200, 'Profile fetched successfully', { profile });

  } catch (error) {
    logger.error('Get profile error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching profile');
  }
};

// @desc    Update user profile
// @route   PUT /profile/:id
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is updating their own profile
    if (req.user._id.toString() !== id) {
      return sendError(res, 'AUTH_1006', 'You can only update your own profile');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }

    // Backend Defensive Guards: Validate userId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`Invalid userId format in updateProfile: ${id}`);
      return sendError(res, 'VAL_2001', 'Invalid user ID format');
    }
    
    const user = await User.findById(id);
    if (!user) {
      logger.warn(`User not found in updateProfile: ${id}`);
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    const { fullName, bio } = req.body;
    let profilePicUrl = user.profilePic;
    let profilePicStorageKey = user.profilePicStorageKey; // Track storage key separately

    // Handle profile picture upload
    if (req.file) {
      try {
        // Delete old profile picture if it exists (try storage key first, then legacy Cloudinary)
        if (user.profilePic) {
          // Try to extract storage key from URL or use legacy Cloudinary deletion
          const oldKey = user.profilePicStorageKey || user.profilePic.split('/').pop();
          if (oldKey) {
            await deleteObject(oldKey).catch(async (err) => {
              logger.debug('Storage delete failed, trying Cloudinary:', err);
              // Fallback to Cloudinary delete for legacy images
              await deleteImage(`taatom/profiles/${oldKey.split('.')[0]}`).catch(deleteErr => 
                logger.error('Error deleting old profile picture:', deleteErr)
              );
            });
          }
        }

        // Upload new profile picture to Sevalla Object Storage
        const extension = req.file.originalname.split('.').pop() || 'jpg';
        profilePicStorageKey = buildMediaKey({
          type: 'profile',
          userId: user._id.toString(),
          filename: req.file.originalname,
          extension
        });

        await uploadObject(req.file.buffer, profilePicStorageKey, req.file.mimetype);
        logger.debug('Profile picture uploaded successfully:', { profilePicStorageKey });
        
        // Generate signed URL for response (NOT stored in DB)
        profilePicUrl = await generateSignedUrl(profilePicStorageKey, 'PROFILE');
      } catch (uploadError) {
        logger.error('Profile picture upload error:', uploadError);
        logger.error('Upload error details:', {
          message: uploadError.message,
          code: uploadError.code,
          name: uploadError.name,
          stack: uploadError.stack
        });
        return sendError(res, 'FILE_4004', uploadError.message || 'Error uploading profile picture');
      }
    }

    // Update user
    const updateData = {
      ...(fullName && { fullName }),
      ...(bio !== undefined && { bio }),
      ...(profilePicUrl !== user.profilePic && { profilePic: profilePicUrl })
    };
    
    // Add profilePicStorageKey if it was set during upload
    if (profilePicStorageKey && profilePicStorageKey !== user.profilePicStorageKey) {
      updateData.profilePicStorageKey = profilePicStorageKey;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpires').lean();

    // Invalidate cache (non-blocking - don't fail if cache fails)
    try {
      await deleteCache(CacheKeys.user(id));
      await deleteCacheByPattern('search:*').catch(err => 
        logger.warn('Failed to delete cache pattern:', err)
      );
    } catch (cacheError) {
      logger.warn('Cache invalidation failed (non-critical):', cacheError);
      // Continue execution - cache failure shouldn't block profile update
    }

    // Emit socket events (non-blocking - don't fail if socket fails)
    try {
      const io = getIO();
      if (io) {
        const nsp = io.of('/app');
        const followers = await getFollowers(id).catch(err => {
          logger.warn('Failed to get followers for socket event:', err);
          return [];
        });
        const audience = [id, ...followers];
        nsp.emitInvalidateProfile(id);
        nsp.emitInvalidateFeed(audience);
        nsp.emitEvent('profile:updated', audience, { userId: id });
      }
    } catch (socketError) {
      logger.warn('Socket event emission failed (non-critical):', socketError);
      // Continue execution - socket failure shouldn't block profile update
    }

    return sendSuccess(res, 200, 'Profile updated successfully', {
      user: updatedUser
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    logger.error('Update profile error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      userId: req.params.id,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      hasFile: !!req.file
    });
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors || {}).map(err => err.message);
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors });
    }
    
    if (error.name === 'CastError' || error.message?.includes('Cast to ObjectId')) {
      return sendError(res, 'RES_3001', 'Invalid user ID format');
    }
    
    if (error.message?.includes('duplicate key') || error.code === 11000) {
      return sendError(res, 'VAL_2001', 'A user with this information already exists');
    }
    
    if (error.message?.includes('storage') || error.message?.includes('upload')) {
      return sendError(res, 'FILE_4004', error.message || 'Error uploading profile picture');
    }
    
    // Return generic error with more context in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Error updating profile: ${error.message}` 
      : 'Error updating profile';
    
    return sendError(res, 'SRV_6001', errorMessage);
  }
};

// @desc    Follow/unfollow user or send follow request
// @route   POST /profile/:id/follow
// @access  Private
const toggleFollow = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    // Backend Defensive Guards: Validate userId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`Invalid userId format in toggleFollow: ${id}`);
      return sendError(res, 'VAL_2001', 'Invalid user ID format');
    }

    if (currentUserId.toString() === id) {
      return sendError(res, 'BIZ_7001', 'You cannot follow yourself');
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      logger.warn(`Target user not found in toggleFollow: ${id}`);
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    // Defensive: Guard against missing current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      logger.error(`Current user not found in toggleFollow: ${currentUserId}`);
      return sendError(res, 'AUTH_1001', 'Authentication error');
    }
    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      // Unfollow - remove from both users
      currentUser.following.pull(id);
      targetUser.followers.pull(currentUserId);
      
      // Remove any pending follow requests
      currentUser.sentFollowRequests = currentUser.sentFollowRequests.filter(
        req => req.user.toString() !== id
      );
      targetUser.followRequests = targetUser.followRequests.filter(
        req => req.user.toString() !== currentUserId.toString()
      );

      await Promise.all([currentUser.save(), targetUser.save()]);

      return sendSuccess(res, 200, 'User unfollowed', {
        isFollowing: false,
        followersCount: targetUser.followers.filter(followerId => followerId.toString() !== id.toString()).length,
        followingCount: currentUser.following.filter(followingId => followingId.toString() !== currentUserId.toString()).length,
        followRequestSent: false
      });
    } else {
      // Check if target user requires follow approval
      const requiresApproval = targetUser.settings.privacy.requireFollowApproval;
      
      if (requiresApproval) {
        // Check if follow request already exists (check both sides)
        const existingSentRequest = currentUser.sentFollowRequests.find(
          req => req.user.toString() === id && req.status === 'pending'
        );
        
        const existingReceivedRequest = targetUser.followRequests.find(
          req => req.user.toString() === currentUserId.toString() && req.status === 'pending'
        );
        
        if (existingSentRequest || existingReceivedRequest) {
          return sendError(res, 'BIZ_7002', 'Follow request already pending');
        }

        // Send follow request
        const followRequest = {
          user: currentUserId, // Store the requester's ID (who sent the request)
          status: 'pending',
          requestedAt: new Date()
        };

        const sentRequest = {
          user: id, // Store the target user's ID (who will receive the request)
          status: 'pending',
          requestedAt: new Date()
        };

        // Remove any existing duplicate requests before adding new one
        currentUser.sentFollowRequests = currentUser.sentFollowRequests.filter(
          req => !(req.user.toString() === id && req.status === 'pending')
        );
        targetUser.followRequests = targetUser.followRequests.filter(
          req => !(req.user.toString() === currentUserId.toString() && req.status === 'pending')
        );

        currentUser.sentFollowRequests.push(sentRequest);
        targetUser.followRequests.push(followRequest);

        await Promise.all([currentUser.save(), targetUser.save()]);

        // Send notification to target user
        const io = getIO();
        if (io && targetUser.expoPushToken && targetUser.settings.notifications.followRequestNotifications) {
          const nsp = io.of('/app');
          nsp.emit('notification', {
            userId: id,
            type: 'follow_request',
            title: 'New Follow Request',
            message: `${currentUser.fullName} wants to follow you`,
            data: {
              requesterId: currentUserId.toString(),
              requesterName: currentUser.fullName,
              requesterProfilePic: currentUser.profilePic
            }
          });
        }

        // Create notification in database
        await Notification.createNotification({
          type: 'follow_request',
          fromUser: currentUserId,
          toUser: id,
          metadata: {
            requesterName: currentUser.fullName,
            requesterProfilePic: currentUser.profilePic,
            requestId: currentUserId.toString() // Use current user ID as request identifier
          }
        });

        // Send push notification
        await sendNotificationToUser({
          userId: id.toString(),
          title: 'New Follow Request',
          body: `${currentUser.fullName} wants to follow you`,
          data: {
            type: 'follow_request',
            fromUserId: currentUserId.toString(), // Frontend expects fromUserId (the requester)
            entityId: currentUserId.toString(), // Keep for backward compatibility
            senderId: currentUserId.toString() // Keep for backward compatibility
          }
        }).catch(err => logger.error('Error sending push notification for follow request:', err));

        return sendSuccess(res, 200, 'Follow request sent', {
          isFollowing: false,
          followersCount: targetUser.followers.filter(followerId => followerId.toString() !== id.toString()).length,
          followingCount: currentUser.following.filter(followingId => followingId.toString() !== currentUserId.toString()).length,
          followRequestSent: true
        });
      } else {
        // Direct follow (no approval required)
        currentUser.following.push(id);
        targetUser.followers.push(currentUserId);

        await Promise.all([currentUser.save(), targetUser.save()]);

        // Create activity (respect user's privacy settings)
        const user = await User.findById(currentUserId).select('settings.privacy.shareActivity').lean();
        const shareActivity = user?.settings?.privacy?.shareActivity !== false; // Default to true if not set
        Activity.createActivity({
          user: currentUserId,
          type: 'user_followed',
          targetUser: id,
          isPublic: shareActivity
        }).catch(err => logger.error('Error creating activity:', err));

        // Send notification to target user
        const io = getIO();
        if (io && targetUser.expoPushToken && targetUser.settings.notifications.followsNotifications) {
          const nsp = io.of('/app');
          nsp.emit('notification', {
            userId: id,
            type: 'follow',
            title: 'New Follower',
            message: `${currentUser.fullName} started following you`,
            data: {
              followerId: currentUserId.toString(),
              followerName: currentUser.fullName,
              followerProfilePic: currentUser.profilePic
            }
          });
        }

        // Create notification in database
        await Notification.createNotification({
          type: 'follow',
          fromUser: currentUserId,
          toUser: id,
          metadata: {
            followerName: currentUser.fullName,
            followerProfilePic: currentUser.profilePic
          }
        });

        // Send push notification
        await sendNotificationToUser({
          userId: id.toString(),
          title: 'New Follower',
          body: `${currentUser.fullName} started following you`,
          data: {
            type: 'follow',
            fromUserId: currentUserId.toString(), // Frontend expects fromUserId (the person who followed)
            entityId: currentUserId.toString(), // Keep for backward compatibility
            senderId: currentUserId.toString() // Keep for backward compatibility
          }
        }).catch(err => logger.error('Error sending push notification for follow:', err));

        return sendSuccess(res, 200, 'User followed', {
          isFollowing: true,
          followersCount: targetUser.followers.filter(followerId => followerId.toString() !== id.toString()).length,
          followingCount: currentUser.following.filter(followingId => followingId.toString() !== currentUserId.toString()).length,
          followRequestSent: false
        });
      }
    }

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(id);
      const audience = [id, ...followers, currentUserId.toString()];
      nsp.emitInvalidateProfile(id);
      nsp.emitInvalidateFeed(audience);
      nsp.emitEvent('follow:updated', audience, { userId: id });
    }
  } catch (error) {
    logger.error('Toggle follow error:', error);
    return sendError(res, 'SRV_6001', 'Error updating follow status');
  }
};

// @desc    Search users
// @route   GET /profile/search
// @access  Public
const searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return sendError(res, 'VAL_2001', 'Search query must be at least 2 characters long');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Cache search results
    const cacheKey = CacheKeys.search(q, 'users');
    
    const result = await cacheWrapper(cacheKey, async () => {
      const originalQuery = q.trim();
      const searchQuery = originalQuery.toLowerCase(); // Username is stored in lowercase
      const currentUserId = req.user?._id?.toString();
      
      // Escape special regex characters in search query
      const escapeRegex = (str) => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      const escapedQuery = escapeRegex(searchQuery);
      
      logger.debug('Search users - query processing:', {
        originalQuery,
        searchQuery,
        escapedQuery,
        currentUserId
      });
      
      // Build base query - exclude current user
      const baseMatch = {
        isVerified: true
      };
      
      if (currentUserId) {
        baseMatch._id = { $ne: new mongoose.Types.ObjectId(currentUserId) };
      }
      
      // Build match query - prioritize username search
      // Username is stored in lowercase, so we search in lowercase
      // Username is required in schema, so we don't need $exists check
      const matchQuery = {
        ...baseMatch,
        $or: [
          // Username search (prioritized) - username is stored in lowercase
          { 
            username: { 
              $regex: escapedQuery, 
              $options: 'i' 
            } 
          },
          // FullName fallback
          { 
            fullName: { 
              $exists: true,
              $ne: null,
              $regex: escapedQuery, 
              $options: 'i' 
            } 
          }
        ]
      };
      
      logger.debug('Search users - match query:', JSON.stringify(matchQuery, null, 2));
      
      // Use aggregation to prioritize username matches, then fallback to fullName
      const users = await User.aggregate([
        {
          $match: matchQuery
        },
        {
          $addFields: {
            // Score: username exact match = 4, username starts with = 3, username contains = 2, fullName = 1
            matchScore: {
              $cond: [
                // Check if username exists and matches exactly (username is already lowercase)
                {
                  $and: [
                    { $ne: ['$username', null] },
                    { $ne: ['$username', ''] },
                    { $eq: ['$username', searchQuery] } // Direct comparison since username is lowercase
                  ]
                },
                4, // Exact username match - highest priority
                {
                  $cond: [
                    // Username starts with query
                    {
                      $and: [
                        { $ne: ['$username', null] },
                        { $ne: ['$username', ''] },
                        { $regexMatch: { input: '$username', regex: `^${escapedQuery}`, options: 'i' } }
                      ]
                    },
                    3, // Username starts with query
                    {
                      $cond: [
                        // Username contains query
                        {
                          $and: [
                            { $ne: ['$username', null] },
                            { $ne: ['$username', ''] },
                            { $regexMatch: { input: '$username', regex: escapedQuery, options: 'i' } }
                          ]
                        },
                        2, // Username contains query
                        1  // Only fullName match
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        {
          $sort: { matchScore: -1, createdAt: -1 } // Sort by match score (username matches first), then by creation date
        },
        {
          $project: {
            username: 1,
            fullName: 1,
            email: 1,
            profilePic: 1,
            profilePicStorageKey: 1,
            followers: 1,
            following: 1,
            totalLikes: 1,
            matchScore: 1
          }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);

      // Get total count for pagination (excluding current user)
      // Use same match query for consistency
      const totalUsers = await User.countDocuments(matchQuery);
      
      // Debug logging
      logger.debug('User search query:', {
        searchQuery,
        escapedQuery,
        matchQuery,
        usersFound: users.length,
        totalUsers
      });

      // Remove matchScore from final results (keep profilePicStorageKey for URL generation outside cache)
      const cleanedUsers = users.map(user => {
        const { matchScore, ...userWithoutScore } = user;
        return userWithoutScore;
      });

      return { users: cleanedUsers, totalUsers };
    }, CACHE_TTL.SEARCH_RESULTS);

    const { users, totalUsers } = result;

    // Debug: Log first user to check if profilePicStorageKey is present
    if (users.length > 0) {
      const firstUser = users[0];
      logger.info('First user from search (before URL generation):', {
        userId: firstUser._id?.toString(),
        username: firstUser.username,
        fullName: firstUser.fullName,
        hasProfilePicStorageKey: !!firstUser.profilePicStorageKey,
        hasProfilePic: !!firstUser.profilePic,
        profilePicStorageKey: firstUser.profilePicStorageKey ? firstUser.profilePicStorageKey.substring(0, 50) + '...' : 'MISSING',
        profilePic: firstUser.profilePic ? firstUser.profilePic.substring(0, 50) + '...' : 'MISSING',
        allKeys: Object.keys(firstUser)
      });
    }

    // Generate signed URLs for profile pictures AFTER cache (fresh URLs each time)
    // Same pattern as getPosts - generate fresh signed URLs for each request
    const usersWithProfilePics = await Promise.all(users.map(async (user) => {
      // Store original profilePic as fallback (same pattern as getPosts)
      const originalProfilePic = user.profilePic;
      
      // Generate signed URL for profile picture (exact same pattern as getPosts line 234-249)
      if (user.profilePicStorageKey) {
        try {
          user.profilePic = await generateSignedUrl(user.profilePicStorageKey, 'PROFILE');
          logger.debug('Generated profile picture URL for search result:', {
            userId: user._id?.toString(),
            username: user.username,
            hasUrl: !!user.profilePic
          });
        } catch (error) {
          logger.warn('Failed to generate profile picture URL for search result:', { 
            userId: user._id?.toString(),
            username: user.username,
            storageKey: user.profilePicStorageKey,
            error: error.message 
          });
          // Fallback to legacy URL if available (same as getPosts)
          user.profilePic = originalProfilePic || null;
        }
      } else if (user.profilePic) {
        // Legacy: use existing profilePic if no storage key (same as getPosts line 246-249)
        // Keep the existing profilePic value
        logger.debug('Using legacy profilePic for search result:', {
          userId: user._id?.toString(),
          username: user.username
        });
      }
      // Note: If no profilePicStorageKey and no profilePic, profilePic remains null/undefined
      // This matches getPosts behavior
      
      // Remove profilePicStorageKey from response (not needed by frontend)
      delete user.profilePicStorageKey;
      
      return user;
    }));

    const currentUserId = req.user?._id?.toString();
    const usersWithFollowStatus = usersWithProfilePics.map(user => ({
      ...user,
      _id: user._id?.toString() || user._id,
      // Keep profilePic as is (can be null/undefined/string - frontend handles it)
      // Don't convert null to empty string - let frontend handle fallback
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0,
      isFollowing: currentUserId && user.followers 
        ? user.followers.some(follower => follower.toString() === currentUserId)
        : false
    }));

    return sendSuccess(res, 200, 'Users found successfully', {
      users: usersWithFollowStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        hasNextPage: skip + parseInt(limit) < totalUsers,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Search users error:', error);
    return sendError(res, 'SRV_6001', 'Error searching users');
  }
};

// @desc    Get followers list
// @route   GET /profile/:id/followers
// @access  Public
const getFollowersList = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // First get the user to check if it exists and get total count
    const user = await User.findById(id).select('followers');
    if (!user) return sendError(res, 'RES_3001', 'User does not exist');
    
    const totalFollowers = user.followers.filter(followerId => followerId.toString() !== id.toString()).length;
    
    // Get paginated followers IDs (exclude self)
    const paginatedFollowersIds = user.followers
      .filter(followerId => followerId.toString() !== id.toString())
      .slice(skip, skip + limit);
    
    // Populate the paginated followers users
    const followers = await User.find({ _id: { $in: paginatedFollowersIds } })
      .select('fullName profilePic profilePicStorageKey email followers following totalLikes isVerified');
    
    const currentUserId = req.user ? req.user._id.toString() : null;
    
    // Generate signed URLs for profile pictures
    const followersWithStatus = await Promise.all(followers.map(async (f) => {
      let profilePicUrl = null;
      
      // Special handling for Taatom Official user
      const isTaatomOfficial = f._id.toString() === TAATOM_OFFICIAL_USER_ID;
      if (isTaatomOfficial) {
        profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      } else if (f.profilePicStorageKey) {
        // Generate signed URL for profile picture
        try {
          profilePicUrl = await generateSignedUrl(f.profilePicStorageKey, 'PROFILE');
        } catch (error) {
          logger.warn('Failed to generate profile picture URL for follower:', { 
            userId: f._id, 
            error: error.message 
          });
          // Fallback to legacy URL if available
          profilePicUrl = f.profilePic || null;
        }
      } else if (f.profilePic) {
        // Legacy: use existing profilePic if no storage key
        profilePicUrl = f.profilePic;
      }
      
      const isFollowing = currentUserId ? f.followers.map(String).includes(currentUserId) : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: profilePicUrl,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followers,
        following: f.following,
        isFollowing,
      };
    }));
    
    return sendSuccess(res, 200, 'Followers fetched successfully', {
      users: followersWithStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowers / limit),
        totalUsers: totalFollowers,
        hasNextPage: skip + limit < totalFollowers,
        limit
      }
    });
  } catch (error) {
    logger.error('Get followers list error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching followers list');
  }
};

// @desc    Get following list
// @route   GET /profile/:id/following
// @access  Public
const getFollowingList = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // First get the user to check if it exists and get total count
    const user = await User.findById(id).select('following');
    if (!user) return sendError(res, 'RES_3001', 'User does not exist');
    
    const totalFollowing = user.following.filter(followingId => followingId.toString() !== id.toString()).length;
    
    // Get paginated following IDs (exclude self)
    const paginatedFollowingIds = user.following
      .filter(followingId => followingId.toString() !== id.toString())
      .slice(skip, skip + limit);
    
    // Populate the paginated following users
    const following = await User.find({ _id: { $in: paginatedFollowingIds } })
      .select('fullName profilePic profilePicStorageKey email followers following totalLikes isVerified');
    
    const currentUserId = req.user ? req.user._id.toString() : null;
    
    // Generate signed URLs for profile pictures
    const followingWithStatus = await Promise.all(following.map(async (f) => {
      let profilePicUrl = null;
      
      // Special handling for Taatom Official user
      const isTaatomOfficial = f._id.toString() === TAATOM_OFFICIAL_USER_ID;
      if (isTaatomOfficial) {
        profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      } else if (f.profilePicStorageKey) {
        // Generate signed URL for profile picture
        try {
          profilePicUrl = await generateSignedUrl(f.profilePicStorageKey, 'PROFILE');
        } catch (error) {
          logger.warn('Failed to generate profile picture URL for following user:', { 
            userId: f._id, 
            error: error.message 
          });
          // Fallback to legacy URL if available
          profilePicUrl = f.profilePic || null;
        }
      } else if (f.profilePic) {
        // Legacy: use existing profilePic if no storage key
        profilePicUrl = f.profilePic;
      }
      
      const isFollowing = currentUserId ? f.followers.map(String).includes(currentUserId) : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: profilePicUrl,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followers,
        following: f.following,
        isFollowing,
      };
    }));
    
    return sendSuccess(res, 200, 'Following fetched successfully', {
      users: followingWithStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowing / limit),
        totalUsers: totalFollowing,
        hasNextPage: skip + limit < totalFollowing,
        limit
      }
    });
  } catch (error) {
    logger.error('Get following list error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching following list');
  }
};

// @desc    Get follow requests
// @route   GET /profile/follow-requests
// @access  Private
const getFollowRequests = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const user = await User.findById(currentUserId)
      .populate('followRequests.user', 'fullName profilePic email')
      .select('followRequests');

    // Clean up duplicate requests, self-requests, and incorrect requests before returning
    const uniqueRequests = [];
    const seenUsers = new Set();
    let needsUpdate = false;
    
    for (const request of user.followRequests) {
      // Skip requests where the user ID matches the current user ID (incorrect data)
      if (request.user._id.toString() === currentUserId.toString()) {
        logger.debug('🧹 Removing incorrect follow request with self ID in getFollowRequests');
        needsUpdate = true;
        continue;
      }
      
      if (request.status === 'pending' && 
          !seenUsers.has(request.user._id.toString()) &&
          request.user._id.toString() !== currentUserId.toString()) {
        seenUsers.add(request.user._id.toString());
        uniqueRequests.push(request);
      }
    }
    
    // Update the user's followRequests array to remove duplicates and incorrect requests
    if (needsUpdate || uniqueRequests.length !== user.followRequests.length) {
      user.followRequests = uniqueRequests;
      await user.save();
      logger.debug(`🧹 Cleaned up follow requests in getFollowRequests: ${user.followRequests.length} -> ${uniqueRequests.length}`);
    }

    return sendSuccess(res, 200, 'Follow requests fetched successfully', {
      followRequests: uniqueRequests.map(req => ({
        _id: req._id,
        user: req.user,
        requestedAt: req.requestedAt
      }))
    });
  } catch (error) {
    logger.error('Get follow requests error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching follow requests');
  }
};

// @desc    Approve follow request
// @route   POST /profile/follow-requests/:requestId/approve
// @access  Private
const approveFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    logger.debug('=== APPROVE FOLLOW REQUEST DEBUG ===');
    logger.debug('Request ID from params:', requestId);
    logger.debug('Current User ID:', currentUserId);
    logger.debug('Request ID type:', typeof requestId);
    logger.debug('Current User ID type:', typeof currentUserId);

    let user = await User.findById(currentUserId);
    if (!user) {
      logger.debug('❌ User not found');
      return sendError(res, 'RES_3001', 'Current user not found');
    }

    logger.debug('✅ User found:', user.fullName);
    logger.debug('Total follow requests:', user.followRequests.length);
    logger.debug('Follow requests details:');
    user.followRequests.forEach((req, index) => {
      logger.debug(`  [${index}] User ID: ${req.user}, Status: ${req.status}, RequestedAt: ${req.requestedAt}`);
    });

    // Check if requester is already a follower (idempotency - allow re-approval)
    const isAlreadyFollower = user.followers.some(followerId => 
      followerId.toString() === requestId.toString()
    );

    // Find the follow request by requester ID (since requestId is actually the requester's user ID)
    const request = user.followRequests.find(req => 
      req.user.toString() === requestId
    );
    
    logger.debug('Searching for request with:');
    logger.debug('  - requestId:', requestId);
    logger.debug('  - requestId type:', typeof requestId);
    logger.debug('  - isAlreadyFollower:', isAlreadyFollower);
    logger.debug('Found request:', request ? 'Yes' : 'No');
    
    if (request) {
      logger.debug('Request details:', {
        user: request.user.toString(),
        userType: typeof request.user,
        status: request.status,
        requestedAt: request.requestedAt
      });
    } else {
      logger.debug('❌ No request found for user:', requestId);
      logger.debug('Available request user IDs:', user.followRequests.map(req => ({
        id: req.user.toString(),
        type: typeof req.user,
        status: req.status
      })));
    }

    // If already approved or already a follower, return success (idempotent operation)
    if (isAlreadyFollower || (request && request.status === 'approved')) {
      logger.debug('✅ Request already processed - returning success (idempotent)');
      return sendSuccess(res, 200, 'Follow request already approved', {
        followersCount: user.followers.length,
        alreadyProcessed: true
      });
    }

    // If request not found and not already a follower, return error
    if (!request || request.status !== 'pending') {
      logger.debug('❌ No pending request found for user:', requestId);
      return sendError(res, 'RES_3001', 'Follow request not found or already processed');
    }

    const requesterId = request.user;
    logger.debug('Requester ID:', requesterId);
    let requester = await User.findById(requesterId);
    logger.debug('Found requester:', requester ? `Yes (${requester.fullName})` : 'No');

    if (!requester) {
      logger.debug('❌ Requester not found');
      return sendError(res, 'RES_3001', 'The user who sent the follow request no longer exists');
    }

    // Check if user is trying to approve their own request
    if (requesterId.toString() === currentUserId.toString()) {
      logger.debug('❌ Self-approval attempt');
      return sendError(res, 'BIZ_7001', 'You cannot approve your own follow request');
    }

    // Add to followers/following (prevent duplicates)
    if (!user.followers.some(followerId => followerId.toString() === requesterId.toString())) {
      user.followers.push(requesterId);
    }
    if (!requester.following.some(followingId => followingId.toString() === currentUserId.toString())) {
      requester.following.push(currentUserId);
    }

    // Update request status
    request.status = 'approved';
    
    // Update requester's sent request status
    const sentRequest = requester.sentFollowRequests.find(
      req => req.user.toString() === currentUserId.toString()
    );
    if (sentRequest) {
      sentRequest.status = 'approved';
    }

    // Save with retry logic to handle version conflicts
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await Promise.all([user.save(), requester.save()]);
        logger.debug('Successfully saved user and requester');
        break;
      } catch (error) {
        if (error.name === 'VersionError' && retryCount < maxRetries - 1) {
          logger.debug(`Version conflict, retrying... (${retryCount + 1}/${maxRetries})`);
          // Reload the documents to get the latest version
          const freshUser = await User.findById(currentUserId);
          const freshRequester = await User.findById(requesterId);
          
          // Re-apply the changes (check for duplicates first)
          if (!freshUser.followers.some(followerId => followerId.toString() === requesterId.toString())) {
            freshUser.followers.push(requesterId);
          }
          if (!freshRequester.following.some(followingId => followingId.toString() === currentUserId.toString())) {
            freshRequester.following.push(currentUserId);
          }
          
          // Find the request by requester ID (not by _id)
          const freshRequest = freshUser.followRequests.find(req => 
            req.user.toString() === requestId.toString()
          );
          if (freshRequest && freshRequest.status === 'pending') {
            freshRequest.status = 'approved';
          }
          
          const freshSentRequest = freshRequester.sentFollowRequests.find(
            req => req.user.toString() === currentUserId.toString()
          );
          if (freshSentRequest && freshSentRequest.status === 'pending') {
            freshSentRequest.status = 'approved';
          }
          
          user = freshUser;
          requester = freshRequester;
          retryCount++;
        } else {
          throw error;
        }
      }
    }

        // Send notification to requester
        const io = getIO();
        if (io && requester.expoPushToken && requester.settings?.notifications?.followApprovalNotifications) {
          const nsp = io.of('/app');
          nsp.emit('notification', {
            userId: requesterId.toString(),
            type: 'follow_approved',
            title: 'Follow Request Approved',
            message: `${user.fullName} approved your follow request`,
            data: {
              approvedBy: currentUserId.toString(),
              approvedByName: user.fullName,
              approvedByProfilePic: user.profilePic
            }
          });
        }

        // Create notification in database
        try {
          await Notification.createNotification({
            type: 'follow_approved',
            fromUser: currentUserId,
            toUser: requesterId,
            metadata: {
              approvedByName: user.fullName,
              approvedByProfilePic: user.profilePic
            }
          });

          // Send push notification
          await sendNotificationToUser({
            userId: requesterId.toString(),
            title: 'Follow Request Approved',
            body: `${user.fullName} approved your follow request`,
            data: {
              type: 'follow_approved',
              fromUserId: currentUserId.toString(), // Frontend expects fromUserId (the approver)
              entityId: currentUserId.toString(), // Keep for backward compatibility
              senderId: currentUserId.toString() // Keep for backward compatibility
            }
          }).catch(err => logger.error('Error sending push notification for follow approval:', err));
        } catch (notificationError) {
          logger.error('Error creating follow approval notification:', notificationError);
          // Don't fail the entire request if notification creation fails
        }

    return sendSuccess(res, 200, 'Follow request approved', {
      followersCount: user.followers.length
    });
  } catch (error) {
    logger.error('Approve follow request error:', error);
    logger.error('Error stack:', error.stack);
    return sendError(res, 'SRV_6001', 'Error approving follow request');
  }
};

// @desc    Reject follow request
// @route   POST /profile/follow-requests/:requestId/reject
// @access  Private
const rejectFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    const user = await User.findById(currentUserId);
    
    // Find the follow request by requester ID (since requestId is actually the requester's user ID)
    const request = user.followRequests.find(req => 
      req.user.toString() === requestId && req.status === 'pending'
    );

    if (!request) {
      return sendError(res, 'RES_3001', 'Follow request not found or already processed');
    }

    const requesterId = request.user;
    const requester = await User.findById(requesterId);

    if (!requester) {
      return sendError(res, 'RES_3001', 'The user who sent the follow request no longer exists');
    }

    // Update request status
    request.status = 'rejected';
    
    // Update requester's sent request status
    const sentRequest = requester.sentFollowRequests.find(
      req => req.user.toString() === currentUserId.toString()
    );
    if (sentRequest) {
      sentRequest.status = 'rejected';
    }

    await Promise.all([user.save(), requester.save()]);

    return sendSuccess(res, 200, 'Follow request rejected');
  } catch (error) {
    logger.error('Reject follow request error:', error);
    return sendError(res, 'SRV_6001', 'Error rejecting follow request');
  }
};

// Helper function to calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

// Helper function to get continent from coordinates
const getContinentFromCoordinates = (latitude, longitude) => {
  // Simplified logic for continent detection based on coordinates
  if (latitude >= -10 && latitude <= 80 && longitude >= 25 && longitude <= 180) return 'Asia';
  if (latitude >= 35 && latitude <= 70 && longitude >= -10 && longitude <= 40) return 'Europe';
  if (latitude >= 5 && latitude <= 85 && longitude >= -170 && longitude <= -50) return 'North America';
  if (latitude >= -60 && latitude <= 15 && longitude >= -85 && longitude <= -30) return 'South America';
  if (latitude >= -40 && latitude <= 40 && longitude >= -20 && longitude <= 50) return 'Africa';
  if (latitude >= -50 && latitude <= -10 && longitude >= 110 && longitude <= 180) return 'Australia';
  if (latitude <= -60) return 'Antarctica';
  return 'Unknown';
};

// @desc    Get TripScore continents breakdown
// @route   GET /profile/:id/tripscore/continents
// @access  Public
const getTripScoreContinents = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
    }

    // Get verified visits (TripScore v2.1 - unique places only)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES }
    })
    .select('lat lng continent country address takenAt uploadedAt')
    .sort({ takenAt: 1, uploadedAt: 1 }) // Sort chronologically for distance calculation
    .lean()
    .limit(1000);

    // Helper function to round coordinates for grouping (same tolerance as deduplication: 0.01 degrees ≈ 1.1km)
    const roundCoordinate = (coord, precision = 2) => {
      return Math.round(coord * 100) / 100;
    };
    
    const getLocationKey = (lat, lng) => {
      return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
    };

    // Calculate continent scores and distances based on unique visits
    const continentScores = {};
    const continentLocations = {}; // Store unique locations per continent for distance calculation
    const uniqueLocationKeys = new Set(); // Track unique locations globally
    let totalScore = 0;

    // Helper function to normalize continent name to standard format
    const normalizeContinentName = (continent) => {
      if (!continent) return 'UNKNOWN';
      const normalized = continent.toUpperCase().trim();
      // Map common variations to standard names
      const continentMap = {
        'ASIA': 'ASIA',
        'AFRICA': 'AFRICA',
        'NORTH AMERICA': 'NORTH AMERICA',
        'SOUTH AMERICA': 'SOUTH AMERICA',
        'AUSTRALIA': 'AUSTRALIA',
        'EUROPE': 'EUROPE',
        'ANTARCTICA': 'ANTARCTICA',
        'OCEANIA': 'AUSTRALIA', // Map Oceania to Australia
        'AMERICA': 'NORTH AMERICA', // Default America to North America
      };
      return continentMap[normalized] || normalized;
    };

    trustedVisits.forEach(visit => {
      // Skip visits with invalid coordinates
      if (!visit.lat || !visit.lng || visit.lat === 0 || visit.lng === 0 || 
          isNaN(visit.lat) || isNaN(visit.lng)) {
        return;
      }

      // Use rounded coordinates to group nearby locations (same as deduplication logic)
      const locationKey = getLocationKey(visit.lat, visit.lng);
      
      // Only count each unique location once (TripScore v2 deduplication with tolerance)
      if (!uniqueLocationKeys.has(locationKey)) {
        uniqueLocationKeys.add(locationKey);
        
        // Normalize continent name to ensure consistent matching
        const continentKey = normalizeContinentName(visit.continent);
        
        // Initialize continent scores and location arrays if needed
        if (!continentScores[continentKey]) {
          continentScores[continentKey] = 0;
          continentLocations[continentKey] = [];
        }
        
        // Count unique places visited
        continentScores[continentKey] += 1;
        totalScore += 1;
        
        // Store location for distance calculation per continent
        continentLocations[continentKey].push({
          latitude: visit.lat,
          longitude: visit.lng,
          createdAt: visit.takenAt || visit.uploadedAt
        });
      }
    });

    // Calculate distances per continent
    const continentDistances = {};
    Object.keys(continentLocations).forEach(continentKey => {
      const locations = continentLocations[continentKey];
      let totalDistance = 0;
      
      // Sort locations by date
      locations.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Calculate distance between consecutive locations
      for (let i = 1; i < locations.length; i++) {
        const distance = calculateDistance(
          locations[i - 1].latitude,
          locations[i - 1].longitude,
          locations[i].latitude,
          locations[i].longitude
        );
        totalDistance += distance;
      }
      
      continentDistances[continentKey] = totalDistance;
    });

    // Format response like the screenshot
    const continents = [
      { name: 'ASIA', score: continentScores['ASIA'] || 0, distance: Math.round(continentDistances['ASIA'] || 0) },
      { name: 'AFRICA', score: continentScores['AFRICA'] || 0, distance: Math.round(continentDistances['AFRICA'] || 0) },
      { name: 'NORTH AMERICA', score: continentScores['NORTH AMERICA'] || 0, distance: Math.round(continentDistances['NORTH AMERICA'] || 0) },
      { name: 'SOUTH AMERICA', score: continentScores['SOUTH AMERICA'] || 0, distance: Math.round(continentDistances['SOUTH AMERICA'] || 0) },
      { name: 'AUSTRALIA', score: continentScores['AUSTRALIA'] || 0, distance: Math.round(continentDistances['AUSTRALIA'] || 0) },
      { name: 'EUROPE', score: continentScores['EUROPE'] || 0, distance: Math.round(continentDistances['EUROPE'] || 0) },
      { name: 'ANTARCTICA', score: continentScores['ANTARCTICA'] || 0, distance: Math.round(continentDistances['ANTARCTICA'] || 0) }
    ];

    // CRITICAL: Recalculate totalScore as sum of all continent scores to ensure consistency
    // This ensures totalScore always equals the sum of individual continent scores
    const calculatedTotalScore = continents.reduce((sum, continent) => sum + continent.score, 0);
    
    // Check for any locations in unmapped continents (like UNKNOWN) that aren't in the formatted list
    const unmappedScore = Object.keys(continentScores).reduce((sum, key) => {
      const isMapped = continents.some(c => c.name === key);
      return isMapped ? sum : sum + (continentScores[key] || 0);
    }, 0);
    
    // Log warning if there's a mismatch (for debugging)
    if (calculatedTotalScore !== totalScore) {
      logger.warn(`TripScore mismatch detected: calculatedTotal=${calculatedTotalScore}, originalTotal=${totalScore}, unmapped=${unmappedScore}. Using calculated total.`);
    }

    return sendSuccess(res, 200, 'TripScore continents fetched successfully', {
      totalScore: calculatedTotalScore, // Use calculated total to ensure consistency
      continents
    });

  } catch (error) {
    logger.error('Get TripScore continents error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching TripScore continents');
  }
};

// @desc    Get TripScore countries for a continent
// @route   GET /profile/:id/tripscore/continents/:continent/countries
// @access  Public
const getTripScoreCountries = async (req, res) => {
  try {
    const { id, continent } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
    }

    // URL decode continent name in case it has spaces or special characters
    const continentName = decodeURIComponent(continent).toUpperCase();
    
    // Get verified visits for this continent (TripScore v2.1 - unique places only)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES },
      // IMPORTANT: Use case-insensitive match for continent to handle values like 'Asia' vs 'ASIA'
      // This keeps TripScore consistent between the overall continents view and per-continent view
      continent: { $regex: new RegExp(`^${continentName}$`, 'i') }
    })
    .select('lat lng country address')
    .lean();

    // Helper function to round coordinates for grouping (same tolerance as deduplication: 0.01 degrees ≈ 1.1km)
    const roundCoordinate = (coord, precision = 2) => {
      return Math.round(coord * 100) / 100;
    };
    
    const getLocationKey = (lat, lng) => {
      return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
    };

    // Filter visits by continent and calculate country scores based on unique places
    const countryScores = {};
    const uniqueLocationKeys = new Set(); // Track unique locations

    trustedVisits.forEach(visit => {
      // Skip visits with invalid coordinates
      if (typeof visit.lat !== 'number' || typeof visit.lng !== 'number' || 
          isNaN(visit.lat) || isNaN(visit.lng)) {
        logger.warn('Skipping visit with invalid coordinates:', visit);
        return;
      }
      
      // Use rounded coordinates to group nearby locations (same as deduplication logic)
      const locationKey = getLocationKey(visit.lat, visit.lng);
      
      // Only count each unique location once (groups nearby locations together)
      if (!uniqueLocationKeys.has(locationKey)) {
        uniqueLocationKeys.add(locationKey);
        
        // CRITICAL: Normalize country name to prevent duplicates
        // Maps regions/states to parent countries (e.g., "England" -> "United Kingdom")
        const rawCountry = visit.country || 'Unknown';
        const normalizedCountry = normalizeCountryName(rawCountry);
        
        // Count unique places visited using normalized country name
        if (!countryScores[normalizedCountry]) {
          countryScores[normalizedCountry] = 0;
        }
        countryScores[normalizedCountry] += 1;
      }
    });

    // CRITICAL: Derive continentScore from countryScores to guarantee consistency
    const continentScore = Object.values(countryScores).reduce(
      (sum, value) => sum + (typeof value === 'number' ? value : 0),
      0
    );

    // Get countries for this continent
    const predefinedCountries = getCountriesForContinent(continentName);
    
    // Ensure predefinedCountries is an array (handle edge cases)
    const safePredefinedCountries = Array.isArray(predefinedCountries) ? predefinedCountries : [];
    
    // Combine predefined countries with detected countries (including Unknown)
    // Always include all predefined countries, even if they have 0 visits
    const allCountriesSet = new Set([
      ...safePredefinedCountries,
      ...Object.keys(countryScores)
    ]);
    
    // Create country list with all countries, sorted alphabetically
    const countryList = Array.from(allCountriesSet)
      .map(country => ({
        name: country,
        score: countryScores[country] || 0,
        visited: countryScores[country] > 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

    return sendSuccess(res, 200, 'TripScore countries fetched successfully', {
      continent: continentName,
      continentScore,
      countries: countryList
    });

  } catch (error) {
    logger.error('Get TripScore countries error:', error);
    logger.error('Error details:', {
      userId: req.params.id,
      continent: req.params.continent,
      errorMessage: error.message,
      errorStack: error.stack
    });
    return sendError(res, 'SRV_6001', 'Error fetching TripScore countries');
  }
};

// @desc    Get TripScore country details
// @route   GET /profile/:id/tripscore/countries/:country
// @access  Public
const getTripScoreCountryDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { country } = req.params;

    const { generateSignedUrl } = require('../services/mediaService');

    // CRITICAL: Normalize country name for query (e.g., "England" -> "United Kingdom")
    // This ensures we find all locations even if stored with different country names
    const normalizedCountryParam = normalizeCountryName(country);
    
    // Get verified visits for this country (TripScore v2.1 - unique places only)
    // Search for both normalized and original country names to handle legacy data
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES },
      $or: [
        { country: { $regex: new RegExp(`^${country}$`, 'i') } }, // Original country name
        { country: { $regex: new RegExp(`^${normalizedCountryParam}$`, 'i') } } // Normalized country name
      ]
    })
    .select('lat lng address takenAt uploadedAt post contentType spotType travelInfo')
    .populate('post', 'caption imageUrl images storageKey storageKeys type videoUrl spotType travelInfo')
    .sort({ takenAt: 1, uploadedAt: 1 }) // Sort chronologically for distance calculation
    .lean();

    // Helper function to round coordinates for grouping (same tolerance as deduplication: 0.01 degrees ≈ 1.1km)
    const roundCoordinate = (coord, precision = 2) => {
      return Math.round(coord * 100) / 100;
    };
    
    const getLocationKey = (lat, lng) => {
      return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
    };

    // Filter visits by country and calculate locations (unique places only)
    const locations = [];
    const uniqueLocations = new Set(); // Track unique locations
    let countryScore = 0;
    let totalDistance = 0;
    let previousLocation = null;

    for (const visit of trustedVisits) {
      // Skip visits with invalid coordinates
      if (typeof visit.lat !== 'number' || typeof visit.lng !== 'number' || 
          isNaN(visit.lat) || isNaN(visit.lng)) {
        logger.warn('Skipping visit with invalid coordinates:', visit._id);
        continue;
      }

      // Use rounded coordinates to group nearby locations (same as deduplication logic)
      const locationKey = getLocationKey(visit.lat, visit.lng);
      
      // Only count/show each unique location once (groups nearby locations together)
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.add(locationKey);
        
        // Count unique places visited
        countryScore += 1;
        
        // Get image URL from post (user-uploaded image)
        let imageUrl = null;
        let postType = null;
        
        try {
          if (visit.post) {
            postType = visit.post.type || (visit.contentType === 'short' ? 'short' : 'photo');
            
            // For photos: use imageUrl or first image from images array
            if (postType === 'photo') {
              if (visit.post.storageKey) {
                // Generate signed URL for single image (with error handling)
                try {
                  imageUrl = await generateSignedUrl(visit.post.storageKey, 'IMAGE');
                } catch (err) {
                  logger.warn('Failed to generate signed URL for storageKey:', err);
                  // Fall through to next option
                }
              }
              if (!imageUrl && visit.post.storageKeys && visit.post.storageKeys.length > 0) {
                // Generate signed URL for first image in array (with error handling)
                try {
                  imageUrl = await generateSignedUrl(visit.post.storageKeys[0], 'IMAGE');
                } catch (err) {
                  logger.warn('Failed to generate signed URL for storageKeys[0]:', err);
                  // Fall through to next option
                }
              }
              if (!imageUrl && visit.post.imageUrl) {
                // Fallback to existing imageUrl (if already signed)
                imageUrl = visit.post.imageUrl;
              } else if (!imageUrl && visit.post.images && visit.post.images.length > 0) {
                // Fallback to first image in images array
                imageUrl = visit.post.images[0];
              }
            } 
            // For shorts/videos: use thumbnail if available, otherwise use video storage key
            else if (postType === 'short' || visit.post.videoUrl) {
              // Priority 1: Check if imageUrl exists (might be thumbnail for shorts)
              if (visit.post.imageUrl) {
                imageUrl = visit.post.imageUrl;
              } 
              // Priority 2: Check if there's a thumbnail in images array (first image might be thumbnail)
              else if (visit.post.images && visit.post.images.length > 0) {
                imageUrl = visit.post.images[0];
              }
              // Priority 3: Generate signed URL from storage key (video file, frontend can extract thumbnail)
              else if (visit.post.storageKey) {
                try {
                  imageUrl = await generateSignedUrl(visit.post.storageKey, 'VIDEO');
                } catch (err) {
                  logger.warn('Failed to generate signed URL for video storageKey:', err);
                  // Fall through to next option
                }
              }
              if (!imageUrl && visit.post.storageKeys && visit.post.storageKeys.length > 0) {
                try {
                  imageUrl = await generateSignedUrl(visit.post.storageKeys[0], 'VIDEO');
                } catch (err) {
                  logger.warn('Failed to generate signed URL for video storageKeys[0]:', err);
                  // Fall through to next option
                }
              }
              // Priority 4: Fallback to videoUrl
              if (!imageUrl && visit.post.videoUrl) {
                imageUrl = visit.post.videoUrl;
              }
            }
          }
        } catch (err) {
          // Log error but continue processing - don't skip this location
          logger.warn('Error processing post image for visit:', visit._id, err);
        }
        
        // Get spotType and travelInfo from TripVisit (copied from post) or post directly
        const spotType = visit.spotType || visit.post?.spotType || 'General';
        const travelInfo = visit.travelInfo || visit.post?.travelInfo || 'Drivable';
        
        // Get the date - prefer takenAt (when photo was taken) over uploadedAt (when uploaded)
        // Convert to ISO string for consistent frontend parsing
        const visitDate = visit.takenAt || visit.uploadedAt;
        const dateString = visitDate ? (visitDate instanceof Date ? visitDate.toISOString() : new Date(visitDate).toISOString()) : new Date().toISOString();
        
        locations.push({
          name: visit.address || 'Unknown Location',
          score: 1, // Each unique location counts as 1
          date: dateString, // ISO date string for consistent parsing
          caption: visit.post?.caption || '', // Post caption
          category: { 
            fromYou: travelInfo, // From post dropdown
            typeOfSpot: spotType // From post dropdown
          },
          imageUrl: imageUrl, // User-uploaded image or video thumbnail
          postType: postType, // 'photo' or 'short'
          coordinates: {
            latitude: visit.lat,
            longitude: visit.lng
          }
        });

        // Calculate distance if there's a previous location
        if (previousLocation) {
          const distance = calculateDistance(
            previousLocation.latitude,
            previousLocation.longitude,
            visit.lat,
            visit.lng
          );
          totalDistance += distance;
        }

        // Update previous location
        previousLocation = {
          latitude: visit.lat,
          longitude: visit.lng
        };
      }
    }

    return sendSuccess(res, 200, 'TripScore country details fetched successfully', {
      country,
      countryScore,
      countryDistance: Math.round(totalDistance),
      locations: locations.sort((a, b) => new Date(b.date) - new Date(a.date))
    });

  } catch (error) {
    logger.error('Get TripScore country details error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching TripScore country details');
  }
};

// @desc    Get TripScore locations for a country
// @route   GET /profile/:id/tripscore/countries/:country/locations
// @access  Public
const getTripScoreLocations = async (req, res) => {
  try {
    const { id, country } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
    }

    const { generateSignedUrl } = require('../services/mediaService');

    // CRITICAL: Normalize country name for query (e.g., "England" -> "United Kingdom")
    // This ensures we find all locations even if stored with different country names
    const normalizedCountryParam = normalizeCountryName(country);
    
    // Get verified visits for this country (TripScore v2.1 - unique places only)
    // Search for both normalized and original country names to handle legacy data
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES },
      $or: [
        { country: { $regex: new RegExp(`^${country}$`, 'i') } }, // Original country name
        { country: { $regex: new RegExp(`^${normalizedCountryParam}$`, 'i') } } // Normalized country name
      ]
    })
    .select('lat lng address takenAt uploadedAt post contentType')
    .populate('post', 'imageUrl images storageKey storageKeys type videoUrl')
    .lean();

    // Helper function to round coordinates for grouping (same tolerance as deduplication: 0.01 degrees ≈ 1.1km)
    const roundCoordinate = (coord, precision = 2) => {
      return Math.round(coord * 100) / 100;
    };
    
    const getLocationKey = (lat, lng) => {
      return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
    };

    // Filter visits by country (unique places only)
    const locations = [];
    const uniqueLocations = new Set();
    let countryScore = 0;

    for (const visit of trustedVisits) {
      // Use rounded coordinates to group nearby locations (same as deduplication logic)
      const locationKey = getLocationKey(visit.lat, visit.lng);
      
      // Only count/show each unique location once (groups nearby locations together)
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.add(locationKey);
        
        // Count unique places visited
        countryScore += 1;
        
        // Get image URL from post (user-uploaded image)
        let imageUrl = null;
        let postType = null;
        
        if (visit.post) {
          postType = visit.post.type || (visit.contentType === 'short' ? 'short' : 'photo');
          
          // For photos: use imageUrl or first image from images array
          if (postType === 'photo') {
            if (visit.post.storageKey) {
              // Generate signed URL for single image
              imageUrl = await generateSignedUrl(visit.post.storageKey, 'IMAGE');
            } else if (visit.post.storageKeys && visit.post.storageKeys.length > 0) {
              // Generate signed URL for first image in array
              imageUrl = await generateSignedUrl(visit.post.storageKeys[0], 'IMAGE');
            } else if (visit.post.imageUrl) {
              // Fallback to existing imageUrl (if already signed)
              imageUrl = visit.post.imageUrl;
            } else if (visit.post.images && visit.post.images.length > 0) {
              // Fallback to first image in images array
              imageUrl = visit.post.images[0];
            }
          } 
          // For shorts/videos: use thumbnail if available, otherwise use video storage key
          else if (postType === 'short' || visit.post.videoUrl) {
            // Priority 1: Check if imageUrl exists (might be thumbnail for shorts)
            if (visit.post.imageUrl) {
              imageUrl = visit.post.imageUrl;
            } 
            // Priority 2: Check if there's a thumbnail in images array (first image might be thumbnail)
            else if (visit.post.images && visit.post.images.length > 0) {
              imageUrl = visit.post.images[0];
            }
            // Priority 3: Generate signed URL from storage key (video file, frontend can extract thumbnail)
            else if (visit.post.storageKey) {
              imageUrl = await generateSignedUrl(visit.post.storageKey, 'VIDEO');
            } else if (visit.post.storageKeys && visit.post.storageKeys.length > 0) {
              imageUrl = await generateSignedUrl(visit.post.storageKeys[0], 'VIDEO');
            } 
            // Priority 4: Fallback to videoUrl
            else if (visit.post.videoUrl) {
              imageUrl = visit.post.videoUrl;
            }
          }
        }
        
        // Get spotType and travelInfo from TripVisit (copied from post) or post directly
        const spotType = visit.spotType || visit.post?.spotType || 'General';
        const travelInfo = visit.travelInfo || visit.post?.travelInfo || 'Drivable';
        
        // Get the date - prefer takenAt (when photo was taken) over uploadedAt (when uploaded)
        // Convert to ISO string for consistent frontend parsing
        const visitDate = visit.takenAt || visit.uploadedAt;
        const dateString = visitDate ? (visitDate instanceof Date ? visitDate.toISOString() : new Date(visitDate).toISOString()) : new Date().toISOString();
        
        locations.push({
          name: visit.address || 'Unknown Location',
          score: 1, // Each unique location counts as 1
          date: dateString, // ISO date string for consistent parsing
          caption: visit.post?.caption || '', // Post caption
          category: { 
            fromYou: travelInfo, // From post dropdown
            typeOfSpot: spotType // From post dropdown
          },
          imageUrl: imageUrl, // User-uploaded image or video thumbnail
          postType: postType, // 'photo' or 'short'
          coordinates: {
            latitude: visit.lat,
            longitude: visit.lng
          }
        });
      }
    }

    return sendSuccess(res, 200, 'TripScore locations fetched successfully', {
      country,
      countryScore,
      locations: locations.sort((a, b) => b.score - a.score)
    });

  } catch (error) {
    logger.error('Get TripScore locations error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching TripScore locations');
  }
};

// @desc    Get user's travel map data (locations, stats) - Returns verified trip locations
// @route   GET /profile/:id/travel-map
// @access  Public
const getTravelMapData = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
    }

    // Get verified TripVisits (only verified trip locations)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      verificationStatus: { $in: VERIFIED_STATUSES },
      lat: { $exists: true, $ne: null, $ne: 0 },
      lng: { $exists: true, $ne: null, $ne: 0 }
    })
    .select('lat lng address takenAt uploadedAt')
    .sort({ takenAt: 1, uploadedAt: 1 }) // Sort chronologically
    .lean()
    .limit(1000); // Limit for performance

    // Helper function to round coordinates for grouping (same tolerance as deduplication: 0.01 degrees ≈ 1.1km)
    const roundCoordinate = (coord, precision = 2) => {
      return Math.round(coord * 100) / 100;
    };
    
    const getLocationKey = (lat, lng) => {
      return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
    };

    // Extract unique verified locations for the map (numbered points)
    const uniqueLocations = new Map();
    const locations = [];
    let locationCounter = 1;

    trustedVisits.forEach(visit => {
      if (!visit.lat || !visit.lng || visit.lat === 0 || visit.lng === 0) {
        return; // Skip invalid coordinates
      }

      const locationKey = getLocationKey(visit.lat, visit.lng);
      
      // Only add unique locations (deduplicate nearby locations)
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.set(locationKey, locationCounter);
        
        const visitDate = visit.takenAt || visit.uploadedAt || new Date();
        
        locations.push({
          number: locationCounter,
          latitude: visit.lat,
          longitude: visit.lng,
          address: visit.address || 'Unknown Location',
          date: visitDate
        });
        
        locationCounter++;
      }
    });

    // Calculate statistics
    const totalLocations = locations.length;
    const firstVisit = trustedVisits.length > 0 ? (trustedVisits[0].takenAt || trustedVisits[0].uploadedAt) : null;
    const totalDays = firstVisit ? Math.ceil((Date.now() - new Date(firstVisit).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    // Calculate approximate distance traveled (simplified calculation)
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];
      
      // Haversine formula for distance calculation
      const R = 6371; // Earth's radius in kilometers
      const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
      const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      totalDistance += distance;
    }

    return sendSuccess(res, 200, 'Travel map data fetched successfully', {
      locations,
      statistics: {
        totalLocations,
        totalDistance: Math.round(totalDistance),
        totalDays
      }
    });

  } catch (error) {
    logger.error('Get travel map data error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching travel map data');
  }
};

// Helper function to determine continent from location
const getContinentFromLocation = (address) => {
  if (!address) return 'Unknown';
  
  const addressLower = address.toLowerCase();
  
  if (addressLower.includes('asia') || addressLower.includes('india') || 
      addressLower.includes('china') || addressLower.includes('japan') || 
      addressLower.includes('thailand') || addressLower.includes('singapore') ||
      addressLower.includes('malaysia') || addressLower.includes('indonesia')) {
    return 'Asia';
  } else if (addressLower.includes('europe') || addressLower.includes('france') || 
             addressLower.includes('germany') || addressLower.includes('italy') || 
             addressLower.includes('spain') || addressLower.includes('uk') ||
             addressLower.includes('england') || addressLower.includes('london')) {
    return 'Europe';
  } else if (addressLower.includes('north america') || addressLower.includes('united states') || 
             addressLower.includes('usa') || addressLower.includes('canada') || 
             addressLower.includes('mexico') || addressLower.includes('new york') ||
             addressLower.includes('california') || addressLower.includes('texas')) {
    return 'North America';
  } else if (addressLower.includes('south america') || addressLower.includes('brazil') || 
             addressLower.includes('argentina') || addressLower.includes('chile') ||
             addressLower.includes('peru') || addressLower.includes('colombia')) {
    return 'South America';
  } else if (addressLower.includes('africa') || addressLower.includes('egypt') || 
             addressLower.includes('south africa') || addressLower.includes('nigeria') ||
             addressLower.includes('kenya') || addressLower.includes('morocco')) {
    return 'Africa';
  } else if (addressLower.includes('australia') || addressLower.includes('new zealand') || 
             addressLower.includes('fiji') || addressLower.includes('papua') ||
             addressLower.includes('samoa') || addressLower.includes('tonga')) {
    return 'Australia';
  } else if (addressLower.includes('antarctica')) {
    return 'Antarctica';
  }
  
  return 'Unknown';
};

// Helper function to determine country from location
const getCountryFromLocation = (address) => {
  if (!address) return 'Unknown';
  
  const addressLower = address.toLowerCase();
  
  // Australia region countries
  if (addressLower.includes('australia')) return 'Australia';
  if (addressLower.includes('new zealand')) return 'New Zealand';
  if (addressLower.includes('fiji')) return 'Fiji';
  if (addressLower.includes('papua new guinea')) return 'Papua New Guinea';
  if (addressLower.includes('solomon islands')) return 'Solomon Islands';
  if (addressLower.includes('vanuatu')) return 'Vanuatu';
  if (addressLower.includes('micronesia')) return 'Federated States of Micronesia';
  if (addressLower.includes('kiribati')) return 'Kiribati';
  if (addressLower.includes('marshall islands')) return 'Marshall Islands';
  if (addressLower.includes('nauru')) return 'Nauru';
  if (addressLower.includes('palau')) return 'Palau';
  if (addressLower.includes('samoa')) return 'Samoa';
  if (addressLower.includes('tonga')) return 'Tonga';
  if (addressLower.includes('tuvalu')) return 'Tuvalu';
  
  // Asia countries
  if (addressLower.includes('india')) return 'India';
  if (addressLower.includes('china')) return 'China';
  if (addressLower.includes('japan')) return 'Japan';
  if (addressLower.includes('thailand')) return 'Thailand';
  if (addressLower.includes('singapore')) return 'Singapore';
  if (addressLower.includes('malaysia')) return 'Malaysia';
  if (addressLower.includes('indonesia')) return 'Indonesia';
  
  // Europe countries
  if (addressLower.includes('france')) return 'France';
  if (addressLower.includes('germany')) return 'Germany';
  if (addressLower.includes('italy')) return 'Italy';
  if (addressLower.includes('spain')) return 'Spain';
  if (addressLower.includes('united kingdom') || addressLower.includes('uk') || addressLower.includes('england')) return 'United Kingdom';
  
  // North America countries
  if (addressLower.includes('united states') || addressLower.includes('usa')) return 'United States';
  if (addressLower.includes('canada')) return 'Canada';
  if (addressLower.includes('mexico')) return 'Mexico';
  
  // South America countries
  if (addressLower.includes('brazil')) return 'Brazil';
  if (addressLower.includes('argentina')) return 'Argentina';
  if (addressLower.includes('chile')) return 'Chile';
  if (addressLower.includes('peru')) return 'Peru';
  if (addressLower.includes('colombia')) return 'Colombia';
  
  // Africa countries
  if (addressLower.includes('egypt')) return 'Egypt';
  if (addressLower.includes('south africa')) return 'South Africa';
  if (addressLower.includes('nigeria')) return 'Nigeria';
  if (addressLower.includes('kenya')) return 'Kenya';
  if (addressLower.includes('morocco')) return 'Morocco';
  
  return 'Unknown';
};

// Helper function to normalize country names - maps regions/states to parent countries
// This prevents duplicates like "England" and "United Kingdom" or US states and "United States"
const normalizeCountryName = (country) => {
  if (!country || typeof country !== 'string') return country || 'Unknown';
  
  const countryLower = country.toLowerCase().trim();
  
  // United Kingdom regions -> United Kingdom
  if (countryLower === 'england' || countryLower === 'scotland' || 
      countryLower === 'wales' || countryLower === 'northern ireland' ||
      countryLower === 'great britain' || countryLower === 'britain') {
    return 'United Kingdom';
  }
  
  // United States states and territories -> United States
  // Common US state patterns (50 states + DC + territories)
  const usStates = [
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
    'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
    'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
    'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
    'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
    'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
    'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
    'wisconsin', 'wyoming', 'district of columbia', 'washington dc', 'dc',
    'puerto rico', 'guam', 'american samoa', 'us virgin islands', 'northern mariana islands'
  ];
  
  if (usStates.includes(countryLower)) {
    return 'United States';
  }
  
  // Check if country contains US state names (e.g., "California, United States")
  for (const state of usStates) {
    if (countryLower.includes(state)) {
      return 'United States';
    }
  }
  
  // Canada provinces -> Canada
  const canadaProvinces = [
    'ontario', 'quebec', 'nova scotia', 'new brunswick', 'manitoba', 'british columbia',
    'prince edward island', 'saskatchewan', 'alberta', 'newfoundland and labrador',
    'northwest territories', 'yukon', 'nunavut'
  ];
  
  if (canadaProvinces.includes(countryLower)) {
    return 'Canada';
  }
  
  // Australia states/territories -> Australia
  const australiaStates = [
    'new south wales', 'victoria', 'queensland', 'western australia', 'south australia',
    'tasmania', 'northern territory', 'australian capital territory', 'act'
  ];
  
  if (australiaStates.includes(countryLower)) {
    return 'Australia';
  }
  
  // China regions/provinces -> China
  if (countryLower.includes('china') || countryLower.includes('taiwan') || 
      countryLower.includes('hong kong') || countryLower.includes('macau')) {
    return 'China';
  }
  
  // India states -> India (keep India as is since states are usually not stored as country)
  // But handle common variations
  if (countryLower === 'india' || countryLower === 'bharat') {
    return 'India';
  }
  
  // Keep original if no normalization needed
  return country;
};

// Helper function to get countries for a continent
// Comprehensive list of all countries organized by continent
const getCountriesForContinent = (continent) => {
  const countryMap = {
    'AUSTRALIA': [
      'Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Solomon Islands',
      'Vanuatu', 'Federated States of Micronesia', 'Kiribati', 'Marshall Islands',
      'Nauru', 'Palau', 'Samoa', 'Tonga', 'Tuvalu', 'Cook Islands', 'French Polynesia',
      'New Caledonia', 'Niue', 'Pitcairn Islands', 'Tokelau', 'Wallis and Futuna',
      'American Samoa', 'Guam', 'Northern Mariana Islands', 'Wake Island'
    ],
    'ASIA': [
      'India', 'China', 'Japan', 'Thailand', 'Singapore', 'Malaysia', 'Indonesia',
      'South Korea', 'Vietnam', 'Philippines', 'Bangladesh', 'Pakistan', 'Sri Lanka',
      'Myanmar', 'Cambodia', 'Laos', 'Nepal', 'Bhutan', 'Maldives', 'Afghanistan',
      'Iran', 'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon', 'Oman', 'Qatar',
      'Saudi Arabia', 'Syria', 'Turkey', 'United Arab Emirates', 'Yemen', 'Kazakhstan',
      'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan', 'Mongolia', 'North Korea',
      'Taiwan', 'Hong Kong', 'Macau', 'Brunei', 'East Timor', 'Armenia', 'Azerbaijan',
      'Bahrain', 'Georgia', 'Palestine'
    ],
    'EUROPE': [
      'France', 'Germany', 'Italy', 'Spain', 'United Kingdom', 'Netherlands',
      'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Russia', 'Austria',
      'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Estonia',
      'Greece', 'Hungary', 'Ireland', 'Latvia', 'Lithuania', 'Luxembourg',
      'Malta', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Switzerland',
      'Ukraine', 'Belarus', 'Moldova', 'Albania', 'Bosnia and Herzegovina',
      'Montenegro', 'North Macedonia', 'Serbia', 'Iceland', 'Liechtenstein',
      'Monaco', 'San Marino', 'Vatican City', 'Andorra', 'Faroe Islands',
      'Gibraltar', 'Guernsey', 'Isle of Man', 'Jersey', 'Svalbard and Jan Mayen'
    ],
    'NORTH AMERICA': [
      'United States', 'Canada', 'Mexico', 'Guatemala', 'Cuba', 'Jamaica',
      'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago',
      'Barbados', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines',
      'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Dominica', 'Belize',
      'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama',
      'Bahamas', 'Greenland', 'Bermuda', 'Cayman Islands', 'Turks and Caicos Islands',
      'Aruba', 'Bonaire', 'Curaçao', 'Sint Maarten', 'Anguilla', 'British Virgin Islands',
      'US Virgin Islands', 'Montserrat', 'Saint Martin', 'Saint Barthélemy',
      'Guadeloupe', 'Martinique', 'Sint Eustatius', 'Saba'
    ],
    'SOUTH AMERICA': [
      'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Venezuela', 'Ecuador',
      'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname', 'French Guiana',
      'Falkland Islands', 'South Georgia and the South Sandwich Islands'
    ],
    'AFRICA': [
      'Egypt', 'South Africa', 'Nigeria', 'Kenya', 'Morocco', 'Ethiopia', 'Ghana',
      'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
      'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros',
      'Democratic Republic of the Congo', 'Republic of the Congo', 'Djibouti',
      'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Gabon', 'Gambia', 'Guinea',
      'Guinea-Bissau', 'Ivory Coast', 'Lesotho', 'Liberia', 'Libya', 'Madagascar',
      'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Mozambique', 'Namibia',
      'Niger', 'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles',
      'Sierra Leone', 'Somalia', 'Sudan', 'South Sudan', 'Tanzania', 'Togo',
      'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe', 'Western Sahara', 'Mayotte',
      'Réunion', 'Saint Helena', 'Ascension Island', 'Tristan da Cunha'
    ],
    'ANTARCTICA': [
      'Antarctica', 'Bouvet Island', 'French Southern Territories', 'Heard Island and McDonald Islands'
    ]
  };
  
  return countryMap[continent] || [];
};

// Helper function to determine location category
const getLocationCategory = (caption, address) => {
  if (!caption) return { fromYou: 'Unknown', typeOfSpot: 'Unknown' };
  
  const captionLower = caption.toLowerCase();
  const addressLower = address.toLowerCase();
  
  // Determine "FROM YOU" category
  let fromYou = 'Drivable';
  if (captionLower.includes('hiking') || captionLower.includes('trek') || 
      captionLower.includes('walk') || captionLower.includes('trail') ||
      addressLower.includes('mountain') || addressLower.includes('peak')) {
    fromYou = 'Hiking';
  } else if (captionLower.includes('boat') || captionLower.includes('ship') || 
             captionLower.includes('cruise') || captionLower.includes('ferry') ||
             addressLower.includes('island') || addressLower.includes('beach')) {
    fromYou = 'Water Transport';
  } else if (captionLower.includes('flight') || captionLower.includes('plane') || 
             captionLower.includes('airport') || captionLower.includes('fly')) {
    fromYou = 'Flight';
  } else if (captionLower.includes('train') || captionLower.includes('railway') || 
             captionLower.includes('station')) {
    fromYou = 'Train';
  }
  
  // Determine "TYPE OF SPOT" category
  let typeOfSpot = 'General';
  if (captionLower.includes('beach') || captionLower.includes('coast') || 
      captionLower.includes('ocean') || captionLower.includes('sea')) {
    typeOfSpot = 'Beach';
  } else if (captionLower.includes('mountain') || captionLower.includes('peak') || 
             captionLower.includes('hill') || captionLower.includes('summit')) {
    typeOfSpot = 'Mountain';
  } else if (captionLower.includes('city') || captionLower.includes('urban') || 
             captionLower.includes('downtown') || captionLower.includes('metropolitan')) {
    typeOfSpot = 'City';
  } else if (captionLower.includes('forest') || captionLower.includes('jungle') || 
             captionLower.includes('park') || captionLower.includes('nature')) {
    typeOfSpot = 'Natural spots';
  } else if (captionLower.includes('temple') || captionLower.includes('church') || 
             captionLower.includes('mosque') || captionLower.includes('religious')) {
    typeOfSpot = 'Religious';
  } else if (captionLower.includes('museum') || captionLower.includes('gallery') || 
             captionLower.includes('art') || captionLower.includes('cultural')) {
    typeOfSpot = 'Cultural';
  }
  
  return { fromYou, typeOfSpot };
};

// @desc    Block or unblock a user
// @route   POST /profile/:id/block
// @access  Private
const toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === id) {
      return sendError(res, 'BIZ_7001', 'You cannot block yourself');
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    const currentUser = await User.findById(currentUserId);
    const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.includes(id);

    if (isBlocked) {
      // Unblock user
      currentUser.blockedUsers.pull(id);
      await currentUser.save();

      return sendSuccess(res, 200, 'User unblocked successfully', { isBlocked: false });
    } else {
      // Block user
      if (!currentUser.blockedUsers) {
        currentUser.blockedUsers = [];
      }
      currentUser.blockedUsers.push(id);
      
      // Remove from following/followers if exists
      currentUser.following.pull(id);
      currentUser.followers.pull(id);
      targetUser.following.pull(currentUserId);
      targetUser.followers.pull(currentUserId);
      
      // Remove follow requests
      currentUser.followRequests = currentUser.followRequests.filter(
        req => req.user.toString() !== id
      );
      currentUser.sentFollowRequests = currentUser.sentFollowRequests.filter(
        req => req.user.toString() !== id
      );
      targetUser.followRequests = targetUser.followRequests.filter(
        req => req.user.toString() !== currentUserId.toString()
      );
      targetUser.sentFollowRequests = targetUser.sentFollowRequests.filter(
        req => req.user.toString() !== currentUserId.toString()
      );

      await Promise.all([currentUser.save(), targetUser.save()]);

      return sendSuccess(res, 200, 'User blocked successfully', { isBlocked: true });
    }
  } catch (error) {
    logger.error('Toggle block error:', error);
    return sendError(res, 'SRV_6001', 'Error updating block status');
  }
};

// @desc    Check if user is blocked
// @route   GET /profile/:id/block-status
// @access  Private
const getBlockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    const currentUser = await User.findById(currentUserId);
    const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.includes(id);

    return sendSuccess(res, 200, 'Block status fetched successfully', { isBlocked });
  } catch (error) {
    logger.error('Get block status error:', error);
    return sendError(res, 'SRV_6001', 'Error checking block status');
  }
};

// @desc    Get suggested users for onboarding
// @route   GET /profile/suggested-users
// @access  Private
const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const limit = parseInt(req.query.limit) || 6;

    // Get users that:
    // 1. Are not the current user
    // 2. Are not already being followed
    // 3. For onboarding, show verified users first, then others
    const currentUser = await User.findById(userId).select('following');
    const followingIds = currentUser.following.map(f => f.toString());
    followingIds.push(userId);

    // For onboarding, show popular/active users even if they don't have posts yet
    // Priority: verified users > users with posts > users with followers > new users
    const suggestedUsers = await User.find({
      _id: { $nin: followingIds },
      isActive: true,
      isVerified: true, // Show verified users first for better quality
    })
      .select('username fullName profilePic bio followers isVerified createdAt')
      .limit(limit * 2) // Get more to filter later
      .sort({ 
        isVerified: -1, // Verified users first
        followers: -1, // Then by follower count
        createdAt: -1 // Then by newest
      })
      .lean();

    // If we don't have enough verified users, get more (including unverified)
    if (suggestedUsers.length < limit) {
      const additionalUsers = await User.find({
        _id: { $nin: [...followingIds, ...suggestedUsers.map(u => u._id.toString())] },
        isActive: true,
      })
        .select('username fullName profilePic bio followers isVerified createdAt')
        .limit(limit * 2 - suggestedUsers.length)
        .sort({ 
          followers: -1,
          createdAt: -1
        })
        .lean();
      
      suggestedUsers.push(...additionalUsers);
    }

    // Get post counts for each user
    const usersWithPostCounts = await Promise.all(
      suggestedUsers.map(async (user) => {
        const postCount = await Post.countDocuments({ 
          user: user._id, 
          isActive: true 
        });
        return {
          ...user,
          postsCount: postCount,
          followersCount: user.followers?.length || 0,
        };
      })
    );

    // Sort by priority: verified > has posts > has followers > new
    const sortedUsers = usersWithPostCounts.sort((a, b) => {
      // Verified users first
      if (a.isVerified !== b.isVerified) {
        return b.isVerified ? 1 : -1;
      }
      // Then by posts
      if (a.postsCount !== b.postsCount) {
        return b.postsCount - a.postsCount;
      }
      // Then by followers
      if (a.followersCount !== b.followersCount) {
        return b.followersCount - a.followersCount;
      }
      // Then by newest
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Take top users (don't filter by postsCount - show all for onboarding)
    const filteredUsers = sortedUsers.slice(0, limit);

    return sendSuccess(res, 200, 'Suggested users fetched successfully', {
      users: filteredUsers,
    });
  } catch (error) {
    logger.error('Error getting suggested users:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch suggested users');
  }
};

// @desc    Save user interests
// @route   POST /profile/interests
// @access  Private
const saveInterests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { interests } = req.body;

    // Validate interests
    if (!Array.isArray(interests)) {
      return sendError(res, 'VAL_2001', 'Interests must be an array');
    }

    // Update user interests
    const user = await User.findByIdAndUpdate(
      userId,
      { interests },
      { new: true, runValidators: true }
    ).select('interests');

    if (!user) {
      return sendError(res, 'RES_3001', 'User not found');
    }

    // Clear cache for this user
    deleteCache(CacheKeys.user(userId));

    logger.info(`User ${userId} updated interests:`, interests);
    return sendSuccess(res, 200, 'Interests saved successfully', { interests: user.interests });
  } catch (error) {
    logger.error('Save interests error:', error);
    return sendError(res, 'SRV_6001', 'Error saving interests');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  toggleFollow,
  searchUsers,
  getFollowersList,
  getFollowingList,
  getFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
  getTripScoreContinents,
  getTripScoreCountries,
  getTripScoreCountryDetails,
  getTripScoreLocations,
  getTravelMapData,
  toggleBlockUser,
  getBlockStatus,
  getSuggestedUsers,
  saveInterests
};

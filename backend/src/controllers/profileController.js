const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { buildMediaKey, uploadObject, deleteObject } = require('../services/storage');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');
const { getFollowers } = require('../utils/socketBus');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { cacheWrapper, CacheKeys, CACHE_TTL, deleteCache, deleteCacheByPattern } = require('../utils/cache');
const Activity = require('../models/Activity');
const TripVisit = require('../models/TripVisit');
const { TRUSTED_TRUST_LEVELS } = require('../config/tripScoreConfig');

// @desc    Get user profile
// @route   GET /profile/:id
// @access  Public
const getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
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

    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
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

    // Calculate TripScore v2 based on TripVisit (unique, trusted visits)
    // Only TripVisits with trustLevel in ['high','medium'] contribute to TripScore.
    // Low/unverified/suspicious visits are excluded from scoring.
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS }
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

    // Track unique locations (deduplicate by lat/lng)
    const uniqueLocations = new Set();

    // Process visits to calculate TripScore (unique places only)
    trustedVisits.forEach(visit => {
      const locationKey = `${visit.lat},${visit.lng}`;
      
      // Only count each unique location once
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.add(locationKey);
        
        const continentKey = visit.continent || 'Unknown';

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

    const profile = {
      ...user,
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

    const user = await User.findById(id);
    if (!user) {
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

        const uploadResult = await uploadObject(req.file.buffer, profilePicStorageKey, req.file.mimetype);
        profilePicUrl = uploadResult.url;
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
      body: req.body,
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

    if (currentUserId.toString() === id) {
      return sendError(res, 'BIZ_7001', 'You cannot follow yourself');
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    const currentUser = await User.findById(currentUserId);
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
      const users = await User.find({
        $and: [
          { isVerified: true },
          {
            $or: [
              { fullName: { $regex: q, $options: 'i' } },
              { email: { $regex: q, $options: 'i' } }
            ]
          }
        ]
      })
      .select('fullName email profilePic followers following totalLikes')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

      const totalUsers = await User.countDocuments({
        $and: [
          { isVerified: true },
          {
            $or: [
              { fullName: { $regex: q, $options: 'i' } },
              { email: { $regex: q, $options: 'i' } }
            ]
          }
        ]
      }).lean();

      return { users, totalUsers };
    }, CACHE_TTL.SEARCH_RESULTS);

    const { users, totalUsers } = result;

    const currentUserId = req.user?._id?.toString();
    const usersWithFollowStatus = users.map(user => ({
      ...user,
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
      .select('fullName profilePic email followers following totalLikes isVerified');
    
    const currentUserId = req.user ? req.user._id.toString() : null;
    const followersWithStatus = followers.map(f => {
      const isFollowing = currentUserId ? f.followers.map(String).includes(currentUserId) : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: f.profilePic,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followers,
        following: f.following,
        isFollowing,
      };
    });
    
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
      .select('fullName profilePic email followers following totalLikes isVerified');
    
    const currentUserId = req.user ? req.user._id.toString() : null;
    const followingWithStatus = following.map(f => {
      const isFollowing = currentUserId ? f.followers.map(String).includes(currentUserId) : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: f.profilePic,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followers,
        following: f.following,
        isFollowing,
      };
    });
    
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

    // Find the follow request by requester ID (since requestId is actually the requester's user ID)
    const request = user.followRequests.find(req => 
      req.user.toString() === requestId && req.status === 'pending'
    );
    
    logger.debug('Searching for request with:');
    logger.debug('  - requestId:', requestId);
    logger.debug('  - requestId type:', typeof requestId);
    logger.debug('Found request:', request ? 'Yes' : 'No');
    
    if (request) {
      logger.debug('Request details:', {
        user: request.user.toString(),
        userType: typeof request.user,
        status: request.status,
        requestedAt: request.requestedAt
      });
    } else {
      logger.debug('❌ No pending request found for user:', requestId);
      logger.debug('Available request user IDs:', user.followRequests.map(req => ({
        id: req.user.toString(),
        type: typeof req.user,
        status: req.status
      })));
    }

    if (!request) {
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

    // Add to followers/following
    user.followers.push(requesterId);
    requester.following.push(currentUserId);

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
          
          // Re-apply the changes
          freshUser.followers.push(requesterId);
          freshRequester.following.push(currentUserId);
          
          const freshRequest = freshUser.followRequests.id(requestId);
          if (freshRequest) {
            freshRequest.status = 'approved';
          }
          
          const freshSentRequest = freshRequester.sentFollowRequests.find(
            req => req.user.toString() === currentUserId.toString()
          );
          if (freshSentRequest) {
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

    // Get trusted visits (TripScore v2 - unique places only)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS }
    })
    .select('lat lng continent country address takenAt uploadedAt')
    .sort({ takenAt: 1, uploadedAt: 1 }) // Sort chronologically for distance calculation
    .lean()
    .limit(1000);

    // Calculate continent scores and distances based on unique visits
    const continentScores = {};
    const continentLocations = {}; // Store unique locations per continent for distance calculation
    const uniqueLocationKeys = new Set(); // Track unique locations globally
    let totalScore = 0;

    trustedVisits.forEach(visit => {
      const locationKey = `${visit.lat},${visit.lng}`;
      
      // Only count each unique location once (TripScore v2 deduplication)
      if (!uniqueLocationKeys.has(locationKey)) {
        uniqueLocationKeys.add(locationKey);
        
        const continentKey = visit.continent || 'Unknown';
        
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

    return sendSuccess(res, 200, 'TripScore continents fetched successfully', {
      totalScore,
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

    const continentName = continent.toUpperCase();
    
    // Get trusted visits for this continent (TripScore v2 - unique places only)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS },
      continent: continentName
    })
    .select('lat lng country address')
    .lean();

    // Filter visits by continent and calculate country scores based on unique places
    const countryScores = {};
    const uniqueLocationKeys = new Set(); // Track unique locations
    let continentScore = 0;

    trustedVisits.forEach(visit => {
      const locationKey = `${visit.lat},${visit.lng}`;
      
      // Only count each unique location once
      if (!uniqueLocationKeys.has(locationKey)) {
        uniqueLocationKeys.add(locationKey);
        
        const country = visit.country || 'Unknown';
        
        // Count unique places visited
        if (!countryScores[country]) {
          countryScores[country] = 0;
        }
        countryScores[country] += 1;
        continentScore += 1;
      }
    });

    // Get countries for this continent
    const predefinedCountries = getCountriesForContinent(continentName);
    
    // Combine predefined countries with detected countries (including Unknown)
    const allCountriesSet = new Set([
      ...predefinedCountries,
      ...Object.keys(countryScores)
    ]);
    
    const countryList = Array.from(allCountriesSet).map(country => ({
      name: country,
      score: countryScores[country] || 0,
      visited: countryScores[country] > 0
    }));

    return sendSuccess(res, 200, 'TripScore countries fetched successfully', {
      continent: continentName,
      continentScore,
      countries: countryList
    });

  } catch (error) {
    logger.error('Get TripScore countries error:', error);
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

    // Get trusted visits for this country (TripScore v2 - unique places only)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS },
      country: { $regex: new RegExp(`^${country}$`, 'i') } // Case-insensitive match
    })
    .select('lat lng address takenAt uploadedAt')
    .sort({ takenAt: 1, uploadedAt: 1 }) // Sort chronologically for distance calculation
    .lean();

    // Filter visits by country and calculate locations (unique places only)
    const locations = [];
    const uniqueLocations = new Set(); // Track unique locations
    let countryScore = 0;
    let totalDistance = 0;
    let previousLocation = null;

    trustedVisits.forEach(visit => {
      const locationKey = `${visit.lat},${visit.lng}`;
      
      // Only count/show each unique location once
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.add(locationKey);
        
        // Count unique places visited
        countryScore += 1;
        
        locations.push({
          name: visit.address || 'Unknown Location',
          score: 1, // Each unique location counts as 1
          date: visit.takenAt || visit.uploadedAt,
          caption: '', // Caption is post-specific, not visit-specific
          category: { fromYou: 'Unknown', typeOfSpot: 'Unknown' }, // Category detection would need post data
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
    });

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

    // Get trusted visits for this country (TripScore v2 - unique places only)
    const trustedVisits = await TripVisit.find({
      user: id,
      isActive: true,
      trustLevel: { $in: TRUSTED_TRUST_LEVELS },
      country: { $regex: new RegExp(`^${country}$`, 'i') } // Case-insensitive match
    })
    .select('lat lng address takenAt uploadedAt')
    .lean();

    // Filter visits by country (unique places only)
    const locations = [];
    const uniqueLocations = new Set();
    let countryScore = 0;

    trustedVisits.forEach(visit => {
      const locationKey = `${visit.lat},${visit.lng}`;
      
      // Only count/show each unique location once
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.add(locationKey);
        
        // Count unique places visited
        countryScore += 1;
        
        locations.push({
          name: visit.address || 'Unknown Location',
          score: 1, // Each unique location counts as 1
          date: visit.takenAt || visit.uploadedAt,
          caption: '', // Caption is post-specific, not visit-specific
          category: { fromYou: 'Unknown', typeOfSpot: 'Unknown' } // Category detection would need post data
        });
      }
    });

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

// @desc    Get user's travel map data (locations, stats)
// @route   GET /profile/:id/travel-map
// @access  Public
const getTravelMapData = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'VAL_2001', 'User id must be a valid ObjectId');
    }

    // Get all posts with valid locations
    const posts = await Post.find({ 
      user: id, 
      isActive: true,
      'location.coordinates.latitude': { $ne: 0 },
      'location.coordinates.longitude': { $ne: 0 }
    })
    .select('location createdAt')
    .sort({ createdAt: 1 }) // Sort by creation date to maintain order
    .lean();

    // Extract unique locations for the map (numbered points)
    const uniqueLocations = new Map();
    const locations = [];
    let locationCounter = 1;

    posts.forEach(post => {
      const locationKey = `${post.location.coordinates.latitude},${post.location.coordinates.longitude}`;
      
      // Only add unique locations
      if (!uniqueLocations.has(locationKey)) {
        uniqueLocations.set(locationKey, locationCounter);
        
        locations.push({
          number: locationCounter,
          latitude: post.location.coordinates.latitude,
          longitude: post.location.coordinates.longitude,
          address: post.location.address,
          date: post.createdAt
        });
        
        locationCounter++;
      }
    });

    // Calculate statistics
    const totalLocations = locations.length;
    const totalDays = posts.length > 0 ? Math.ceil((Date.now() - new Date(posts[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
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

// Helper function to get countries for a continent
const getCountriesForContinent = (continent) => {
  const countryMap = {
    'AUSTRALIA': [
      'Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Solomon Islands',
      'Vanuatu', 'Federated States of Micronesia', 'Kiribati', 'Marshall Islands',
      'Nauru', 'Palau', 'Samoa', 'Tonga', 'Tuvalu', 'Cook Islands', 'French Polynesia',
      'New Caledonia', 'Niue', 'Pitcairn Islands', 'Tokelau', 'Wallis and Futuna'
    ],
    'ASIA': [
      'India', 'China', 'Japan', 'Thailand', 'Singapore', 'Malaysia', 'Indonesia',
      'South Korea', 'Vietnam', 'Philippines', 'Bangladesh', 'Pakistan', 'Sri Lanka',
      'Myanmar', 'Cambodia', 'Laos', 'Nepal', 'Bhutan', 'Maldives', 'Afghanistan',
      'Iran', 'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon', 'Oman', 'Qatar',
      'Saudi Arabia', 'Syria', 'Turkey', 'United Arab Emirates', 'Yemen', 'Kazakhstan',
      'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan', 'Mongolia', 'North Korea',
      'Taiwan', 'Hong Kong', 'Macau', 'Brunei', 'East Timor'
    ],
    'EUROPE': [
      'France', 'Germany', 'Italy', 'Spain', 'United Kingdom', 'Netherlands',
      'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Russia', 'Austria',
      'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Estonia',
      'Greece', 'Hungary', 'Ireland', 'Latvia', 'Lithuania', 'Luxembourg',
      'Malta', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Switzerland',
      'Ukraine', 'Belarus', 'Moldova', 'Albania', 'Bosnia and Herzegovina',
      'Montenegro', 'North Macedonia', 'Serbia', 'Iceland', 'Liechtenstein',
      'Monaco', 'San Marino', 'Vatican City', 'Andorra'
    ],
    'NORTH AMERICA': [
      'United States', 'Canada', 'Mexico', 'Guatemala', 'Cuba', 'Jamaica',
      'Haiti', 'Dominican Republic', 'Puerto Rico', 'Trinidad and Tobago',
      'Barbados', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines',
      'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Dominica', 'Belize',
      'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama',
      'Bahamas', 'Greenland', 'Bermuda', 'Cayman Islands', 'Turks and Caicos Islands'
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
      'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
    ],
    'ANTARCTICA': []
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
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 6;

    // Get users that:
    // 1. Are not the current user
    // 2. Are not already being followed
    // 3. Have at least one post
    // 4. Are verified (optional, can be removed)
    const currentUser = await User.findById(userId).select('following');
    const followingIds = currentUser.following.map(f => f.toString());
    followingIds.push(userId);

    const suggestedUsers = await User.find({
      _id: { $nin: followingIds },
      isActive: true,
    })
      .select('username fullName profilePic bio followers')
      .limit(limit)
      .sort({ followers: -1, createdAt: -1 })
      .lean();

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

    // Filter to only users with posts and sort by followers
    const filteredUsers = usersWithPostCounts
      .filter(user => user.postsCount > 0)
      .sort((a, b) => b.followersCount - a.followersCount)
      .slice(0, limit);

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

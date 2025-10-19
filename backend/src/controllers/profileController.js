const { validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');
const { getFollowers } = require('../utils/socketBus');
const mongoose = require('mongoose');

// @desc    Get user profile
// @route   GET /profile/:id
// @access  Public
const getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user id', message: 'User id must be a valid ObjectId' });
    }

    const user = await User.findById(id)
      .populate('followers', 'fullName profilePic')
      .populate('following', 'fullName profilePic')
      .select('-password -otp -otpExpires');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Get user's posts count and locations
    const posts = await Post.find({ user: id, isActive: true })
      .select('location createdAt')
      .lean();

    // Extract unique locations for the map
    const locations = posts
      .filter(post => post.location.coordinates.latitude !== 0 || post.location.coordinates.longitude !== 0)
      .map(post => ({
        latitude: post.location.coordinates.latitude,
        longitude: post.location.coordinates.longitude,
        address: post.location.address,
        date: post.createdAt
      }));

    // Check if current user is following this profile
    const isFollowing = req.user ? 
      user.followers.some(follower => follower._id.toString() === req.user._id.toString()) : 
      false;

    const profile = {
      ...user.toObject(),
      postsCount: posts.length,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      locations,
      isFollowing,
      isOwnProfile: req.user ? req.user._id.toString() === id : false
    };

    res.status(200).json({ profile });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching profile'
    });
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
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own profile'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const { fullName } = req.body;
    let profilePicUrl = user.profilePic;

    // Handle profile picture upload
    if (req.file) {
      try {
        // Delete old profile picture if it exists
        if (user.profilePic) {
          const publicId = user.profilePic.split('/').pop().split('.')[0];
          await deleteImage(`taatom/profiles/${publicId}`).catch(err => 
            console.error('Error deleting old profile picture:', err)
          );
        }

        // Upload new profile picture
        const cloudinaryResult = await uploadImage(req.file.buffer, {
          folder: 'taatom/profiles',
          public_id: `profile_${user._id}_${Date.now()}`,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' }
          ]
        });

        profilePicUrl = cloudinaryResult.secure_url;
      } catch (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        return res.status(500).json({
          error: 'Upload failed',
          message: 'Error uploading profile picture'
        });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        ...(fullName && { fullName }),
        ...(profilePicUrl !== user.profilePic && { profilePic: profilePicUrl })
      },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpires');

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser.getPublicProfile()
    });
    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(id);
      const audience = [id, ...followers];
      nsp.emitInvalidateProfile(id);
      nsp.emitInvalidateFeed(audience);
      nsp.emitEvent('profile:updated', audience, { userId: id });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating profile'
    });
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
      return res.status(400).json({
        error: 'Invalid action',
        message: 'You cannot follow yourself'
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
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

      res.status(200).json({
        message: 'User unfollowed',
        isFollowing: false,
        followersCount: targetUser.followers.length,
        followingCount: currentUser.following.length,
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
          return res.status(400).json({
            error: 'Request already sent',
            message: 'Follow request already pending'
          });
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

        res.status(200).json({
          message: 'Follow request sent',
          isFollowing: false,
          followersCount: targetUser.followers.length,
          followingCount: currentUser.following.length,
          followRequestSent: true
        });
      } else {
        // Direct follow (no approval required)
        currentUser.following.push(id);
        targetUser.followers.push(currentUserId);

        await Promise.all([currentUser.save(), targetUser.save()]);

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

        res.status(200).json({
          message: 'User followed',
          isFollowing: true,
          followersCount: targetUser.followers.length,
          followingCount: currentUser.following.length,
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
    console.error('Toggle follow error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating follow status'
    });
  }
};

// @desc    Search users
// @route   GET /profile/search
// @access  Public
const searchUsers = async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Invalid search',
        message: 'Search query must be at least 2 characters long'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

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

    const usersWithFollowStatus = users.map(user => ({
      ...user,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      isFollowing: req.user ? user.followers.some(follower => 
        follower.toString() === req.user._id.toString()) : false
    }));

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
    });

    res.status(200).json({
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
    console.error('Search users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error searching users'
    });
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
    const user = await User.findById(id).populate({
      path: 'followers',
      select: 'fullName profilePic email followers following totalLikes isVerified',
      options: { skip, limit }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const currentUserId = req.user ? req.user._id.toString() : null;
    const totalFollowers = user.followers.length;
    const followers = user.followers.map(f => {
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
    res.status(200).json({
      users: followers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowers / limit),
        totalUsers: totalFollowers,
        hasNextPage: skip + limit < totalFollowers,
        limit
      }
    });
  } catch (error) {
    console.error('Get followers list error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Error fetching followers list' });
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
    const user = await User.findById(id).populate({
      path: 'following',
      select: 'fullName profilePic email followers following totalLikes isVerified',
      options: { skip, limit }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const currentUserId = req.user ? req.user._id.toString() : null;
    const totalFollowing = user.following.length;
    const following = user.following.map(f => {
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
    res.status(200).json({
      users: following,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowing / limit),
        totalUsers: totalFollowing,
        hasNextPage: skip + limit < totalFollowing,
        limit
      }
    });
  } catch (error) {
    console.error('Get following list error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Error fetching following list' });
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
        console.log('🧹 Removing incorrect follow request with self ID in getFollowRequests');
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
      console.log(`🧹 Cleaned up follow requests in getFollowRequests: ${user.followRequests.length} -> ${uniqueRequests.length}`);
    }

    res.status(200).json({
      followRequests: uniqueRequests.map(req => ({
        _id: req._id,
        user: req.user,
        requestedAt: req.requestedAt
      }))
    });
  } catch (error) {
    console.error('Get follow requests error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching follow requests'
    });
  }
};

// @desc    Approve follow request
// @route   POST /profile/follow-requests/:requestId/approve
// @access  Private
const approveFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    console.log('=== APPROVE FOLLOW REQUEST DEBUG ===');
    console.log('Request ID from params:', requestId);
    console.log('Current User ID:', currentUserId);
    console.log('Request ID type:', typeof requestId);
    console.log('Current User ID type:', typeof currentUserId);

    let user = await User.findById(currentUserId);
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({
        error: 'User not found',
        message: 'Current user not found'
      });
    }

    console.log('✅ User found:', user.fullName);
    console.log('Total follow requests:', user.followRequests.length);
    console.log('Follow requests details:');
    user.followRequests.forEach((req, index) => {
      console.log(`  [${index}] User ID: ${req.user}, Status: ${req.status}, RequestedAt: ${req.requestedAt}`);
    });

    // Find the follow request by requester ID (since requestId is actually the requester's user ID)
    const request = user.followRequests.find(req => 
      req.user.toString() === requestId && req.status === 'pending'
    );
    
    console.log('Searching for request with:');
    console.log('  - requestId:', requestId);
    console.log('  - requestId type:', typeof requestId);
    console.log('Found request:', request ? 'Yes' : 'No');
    
    if (request) {
      console.log('Request details:', {
        user: request.user.toString(),
        userType: typeof request.user,
        status: request.status,
        requestedAt: request.requestedAt
      });
    } else {
      console.log('❌ No pending request found for user:', requestId);
      console.log('Available request user IDs:', user.followRequests.map(req => ({
        id: req.user.toString(),
        type: typeof req.user,
        status: req.status
      })));
    }

    if (!request) {
      return res.status(404).json({
        error: 'Request not found',
        message: 'Follow request not found or already processed'
      });
    }

    const requesterId = request.user;
    console.log('Requester ID:', requesterId);
    let requester = await User.findById(requesterId);
    console.log('Found requester:', requester ? `Yes (${requester.fullName})` : 'No');

    if (!requester) {
      console.log('❌ Requester not found');
      return res.status(404).json({
        error: 'Requester not found',
        message: 'The user who sent the follow request no longer exists'
      });
    }

    // Check if user is trying to approve their own request
    if (requesterId.toString() === currentUserId.toString()) {
      console.log('❌ Self-approval attempt');
      return res.status(400).json({
        error: 'Invalid action',
        message: 'You cannot approve your own follow request'
      });
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
        console.log('Successfully saved user and requester');
        break;
      } catch (error) {
        if (error.name === 'VersionError' && retryCount < maxRetries - 1) {
          console.log(`Version conflict, retrying... (${retryCount + 1}/${maxRetries})`);
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
          console.error('Error creating follow approval notification:', notificationError);
          // Don't fail the entire request if notification creation fails
        }

    res.status(200).json({
      message: 'Follow request approved',
      followersCount: user.followers.length
    });
  } catch (error) {
    console.error('Approve follow request error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error approving follow request'
    });
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
      return res.status(404).json({
        error: 'Request not found',
        message: 'Follow request not found or already processed'
      });
    }

    const requesterId = request.user;
    const requester = await User.findById(requesterId);

    if (!requester) {
      return res.status(404).json({
        error: 'Requester not found',
        message: 'The user who sent the follow request no longer exists'
      });
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

    res.status(200).json({
      message: 'Follow request rejected'
    });
  } catch (error) {
    console.error('Reject follow request error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error rejecting follow request'
    });
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
};

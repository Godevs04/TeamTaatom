const { validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const { uploadImage, deleteImage } = require('../config/cloudinary');

// @desc    Get user profile
// @route   GET /profile/:id
// @access  Public
const getProfile = async (req, res) => {
  try {
    const { id } = req.params;

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

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating profile'
    });
  }
};

// @desc    Follow/unfollow user
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
      // Unfollow
      currentUser.following.pull(id);
      targetUser.followers.pull(currentUserId);
    } else {
      // Follow
      currentUser.following.push(id);
      targetUser.followers.push(currentUserId);
    }

    await Promise.all([currentUser.save(), targetUser.save()]);

    res.status(200).json({
      message: isFollowing ? 'User unfollowed' : 'User followed',
      isFollowing: !isFollowing,
      followersCount: targetUser.followers.length,
      followingCount: currentUser.following.length
    });

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

module.exports = {
  getProfile,
  updateProfile,
  toggleFollow,
  searchUsers
};

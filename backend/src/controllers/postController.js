const { validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { getFollowers } = require('../utils/socketBus');
const { getIO } = require('../socket');

// @desc    Get all posts (only photo type)
// @route   GET /posts
// @access  Public
const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isActive: true, type: 'photo' })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add isLiked field if user is authenticated
    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: req.user ? post.likes.some(like => like.toString() === req.user._id.toString()) : false,
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    const totalPosts = await Post.countDocuments({ isActive: true, type: 'photo' });
    const totalPages = Math.ceil(totalPosts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      posts: postsWithLikeStatus,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching posts'
    });
  }
};

// @desc    Create new post
// @route   POST /posts
// @access  Private
const createPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Image required',
        message: 'Please upload an image'
      });
    }

    const { caption, address, latitude, longitude, tags } = req.body;

    // Upload image to Cloudinary
    const cloudinaryResult = await uploadImage(req.file.buffer, {
      folder: 'taatom/posts',
      public_id: `post_${req.user._id}_${Date.now()}`
    });

    // Parse tags if provided
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = [];
      }
    }

    // Create post
    const post = new Post({
      user: req.user._id,
      caption,
      imageUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      tags: parsedTags,
      type: 'photo',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      }
    });

    await post.save();

    // Populate user data for response
    await post.populate('user', 'fullName profilePic');

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(req.user._id);
      const audience = [req.user._id.toString(), ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(req.user._id.toString());
      nsp.emitEvent('post:created', audience, { postId: post._id });
    }

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        ...post.toObject(),
        isLiked: false,
        likesCount: 0,
        commentsCount: 0
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    
    // Clean up uploaded image if post creation failed
    if (req.cloudinaryResult) {
      deleteImage(req.cloudinaryResult.public_id).catch(err => 
        console.error('Error deleting image after failed post creation:', err)
      );
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error creating post'
    });
  }
};

// @desc    Get user's shorts
// @route   GET /shorts/user/:userId
// @access  Public
const getUserShorts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId).select('fullName profilePic');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const shorts = await Post.find({ user: userId, isActive: true, type: 'short' })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const shortsWithLikeStatus = shorts.map(short => ({
      ...short,
      isLiked: req.user ? short.likes.some(like => like.toString() === req.user._id.toString()) : false,
      likesCount: short.likes.length,
      commentsCount: short.comments.length
    }));

    const totalShorts = await Post.countDocuments({ user: userId, isActive: true, type: 'short' });

    res.status(200).json({
      shorts: shortsWithLikeStatus,
      user: user,
      totalShorts
    });

  } catch (error) {
    console.error('Get user shorts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching user shorts'
    });
  }
};

// @desc    Get user's posts
// @route   GET /posts/user/:userId
// @access  Public
const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user exists
    const user = await User.findById(userId).select('fullName profilePic');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    const posts = await Post.find({ user: userId, isActive: true, type: 'photo' })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: req.user ? post.likes.some(like => like.toString() === req.user._id.toString()) : false,
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    const totalPosts = await Post.countDocuments({ user: userId, isActive: true, type: 'photo' });

    res.status(200).json({
      posts: postsWithLikeStatus,
      user: user,
      totalPosts
    });

  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching user posts'
    });
  }
};

// @desc    Like/unlike post
// @route   POST /posts/:id/like
// @access  Private
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'Post does not exist'
      });
    }

    const isLiked = post.toggleLike(req.user._id);
    await post.save();

    // Update user's total likes if this is their post
    if (isLiked) {
      await User.findByIdAndUpdate(post.user, { $inc: { totalLikes: 1 } });
    } else {
      await User.findByIdAndUpdate(post.user, { $inc: { totalLikes: -1 } });
    }

    // Send push notification to post owner if liked by someone else
    try {
      if (isLiked && post.user.toString() !== req.user._id.toString()) {
        const owner = await User.findById(post.user);
        if (owner && owner.expoPushToken) {
          // Dynamically import fetch for compatibility
          const { default: fetch } = await import('node-fetch');
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: owner.expoPushToken,
              sound: 'default',
              title: 'New Like',
              body: `${req.user.fullName || 'Someone'} liked your post!`,
              data: { postId: post._id }
            })
          });
          
          if (!response.ok) {
            console.error('Push notification failed:', response.status, response.statusText);
          }
        }
      }
    } catch (err) {
      console.error('Failed to send push notification:', err);
    }

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(post.user);
      const audience = [post.user.toString(), ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(post.user.toString());
      nsp.emitEvent('post:liked', audience, { postId: post._id });
    }

    res.status(200).json({
      message: isLiked ? 'Post liked' : 'Post unliked',
      isLiked,
      likesCount: post.likes.length
    });

  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating like status'
    });
  }
};

// @desc    Add comment to post
// @route   POST /posts/:id/comments
// @access  Private
const addComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'Post does not exist'
      });
    }

    const { text } = req.body;
    const newComment = post.addComment(req.user._id, text);
    await post.save();

    // Populate the new comment with user data
    await post.populate('comments.user', 'fullName profilePic');
    const populatedComment = post.comments.id(newComment._id);

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(post.user);
      const audience = [post.user.toString(), ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(post.user.toString());
      nsp.emitEvent('comment:created', audience, { postId: post._id });
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: populatedComment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error adding comment'
    });
  }
};

// @desc    Delete comment
// @route   DELETE /posts/:id/comments/:commentId
// @access  Private
const deleteComment = async (req, res) => {
  try {
    const { id: postId, commentId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'Post does not exist'
      });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found',
        message: 'Comment does not exist'
      });
    }

    // Check if user owns the comment or the post
    if (comment.user.toString() !== req.user._id.toString() && 
        post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own comments or comments on your posts'
      });
    }

    post.removeComment(commentId);
    await post.save();

    res.status(200).json({
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error deleting comment'
    });
  }
};

// @desc    Delete post
// @route   DELETE /posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        error: 'Post not found',
        message: 'Post does not exist'
      });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own posts'
      });
    }

    // Delete image from Cloudinary
    try {
      await deleteImage(post.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Error deleting image from Cloudinary:', cloudinaryError);
      // Continue with post deletion even if image deletion fails
    }

    // Update user's total likes
    await User.findByIdAndUpdate(post.user, { 
      $inc: { totalLikes: -post.likes.length } 
    });

    // Soft delete (mark as inactive)
    post.isActive = false;
    await post.save();

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(post.user);
      const audience = [post.user.toString(), ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(post.user.toString());
      nsp.emitEvent('post:deleted', audience, { postId: post._id });
    }

    res.status(200).json({
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error deleting post'
    });
  }
};

// @desc    Get all shorts
// @route   GET /shorts
// @access  Public
const getShorts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const shorts = await Post.find({ isActive: true, type: 'short' })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add isLiked field if user is authenticated
    const shortsWithLikeStatus = shorts.map(short => ({
      ...short,
      isLiked: req.user ? short.likes.some(like => like.toString() === req.user._id.toString()) : false,
      likesCount: short.likes.length,
      commentsCount: short.comments.length
    }));

    const totalShorts = await Post.countDocuments({ isActive: true, type: 'short' });
    const totalPages = Math.ceil(totalShorts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      shorts: shortsWithLikeStatus,
      pagination: {
        currentPage: page,
        totalPages,
        totalShorts,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });

  } catch (error) {
    console.error('Get shorts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching shorts'
    });
  }
};

// @desc    Create new short
// @route   POST /shorts
// @access  Private
const createShort = async (req, res) => {
  try {
    console.log('createShort called');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({
        error: 'Video required',
        message: 'Please upload a video'
      });
    }

    const { caption, address, latitude, longitude, tags } = req.body;

    // Upload video to Cloudinary
    const cloudinaryResult = await uploadImage(req.file.buffer, {
      folder: 'taatom/shorts',
      resource_type: 'video',
      public_id: `short_${req.user._id}_${Date.now()}`
    });

    // Parse tags if provided
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = [];
      }
    }

    // Create short
    const short = new Post({
      user: req.user._id,
      caption,
      imageUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      tags: parsedTags,
      type: 'short',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      }
    });

    await short.save();

    // Populate user data for response
    await short.populate('user', 'fullName profilePic');

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(req.user._id);
      const audience = [req.user._id.toString(), ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(req.user._id.toString());
      nsp.emitEvent('short:created', audience, { shortId: short._id });
    }

    res.status(201).json({
      message: 'Short created successfully',
      short: {
        ...short.toObject(),
        isLiked: false,
        likesCount: 0,
        commentsCount: 0
      }
    });

  } catch (error) {
    console.error('Create short error:', error);
    
    // Clean up uploaded video if short creation failed
    if (cloudinaryResult) {
      deleteImage(cloudinaryResult.public_id).catch(err => 
        console.error('Error deleting video after failed short creation:', err)
      );
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error creating short'
    });
  }
};

module.exports = {
  getPosts,
  createPost,
  getUserPosts,
  getUserShorts,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  getShorts,
  createShort
};

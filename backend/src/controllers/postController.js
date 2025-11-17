const { validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Hashtag = require('../models/Hashtag');
const { uploadImage, deleteImage, getOptimizedImageUrl, getVideoThumbnailUrl, cloudinary } = require('../config/cloudinary');
const { getFollowers } = require('../utils/socketBus');
const { getIO } = require('../socket');
const logger = require('../utils/logger');
const { extractHashtags } = require('../utils/hashtagExtractor');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');

// @desc    Get all posts (only photo type)
// @route   GET /posts
// @access  Public
const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      isActive: true, 
      isArchived: { $ne: true },
      isHidden: { $ne: true },
      type: 'photo' 
    })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add isLiked field if user is authenticated and optimize image URLs
    const postsWithLikeStatus = posts.map(post => {
      // Generate optimized image URL for faster loading
      let optimizedImageUrl = post.imageUrl;
      if (post.imageUrl && post.imageUrl.includes('cloudinary.com')) {
        try {
          // Extract public ID from Cloudinary URL
          const urlParts = post.imageUrl.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split('.')[0];
          
          // Generate optimized URL
          optimizedImageUrl = getOptimizedImageUrl(`taatom/posts/${publicId}`, {
            width: 800,
            height: 800,
            quality: 'auto:good',
            format: 'auto'
          });
        } catch (error) {
          logger.warn('Failed to optimize image URL:', error);
          // Keep original URL as fallback
        }
      }

      // Debug likes for this specific post
      let isLiked = false;
      
      isLiked = req.user ? post.likes.some(like => like.toString() === req.user._id.toString()) : false;
      

      return {
        ...post,
        imageUrl: optimizedImageUrl,
        isLiked,
        likesCount: post.likes.length,
        commentsCount: post.comments.length
      };
    });

    const totalPosts = await Post.countDocuments({ isActive: true, type: 'photo' });
    const totalPages = Math.ceil(totalPosts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return sendSuccess(res, 200, 'Posts fetched successfully', {
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
    logger.error('Get posts error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching posts');
  }
};

// @desc    Get single post by ID
// @route   GET /posts/:id
// @access  Public
const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findOne({ _id: id, isActive: true })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .lean();

    if (!post) {
      return sendError(res, 'RES_3001', 'The requested post does not exist or has been deleted');
    }

    // Generate optimized image URL
    let optimizedImageUrl = post.imageUrl;
    if (post.imageUrl && post.imageUrl.includes('cloudinary.com')) {
      try {
        const urlParts = post.imageUrl.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];
        
        optimizedImageUrl = getOptimizedImageUrl(`taatom/posts/${publicId}`, {
          width: 1200,
          height: 1200,
          quality: 'auto:good',
          format: 'auto'
        });
      } catch (error) {
        logger.warn('Failed to optimize image URL:', error);
      }
    }

    // Add isLiked field if user is authenticated
    let isLiked = false;
    let isFollowing = false;
    if (req.user) {
      isLiked = post.likes.some(like => like.toString() === req.user._id.toString());
      
      // Check if current user is following the post author
      const postAuthor = await User.findById(post.user);
      if (postAuthor && postAuthor.followers) {
        isFollowing = postAuthor.followers.some(follower => follower.toString() === req.user._id.toString());
      }
    }

    const postWithDetails = {
      ...post,
      imageUrl: optimizedImageUrl,
      isLiked,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      user: {
        ...post.user,
        isFollowing
      }
    };

    return sendSuccess(res, 200, 'Post fetched successfully', { post: postWithDetails });
  } catch (error) {
    logger.error('Get post by ID error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch post');
  }
};

// @desc    Create new post
// @route   POST /posts
// @access  Private
const createPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }

    // Handle both single file and multiple files
    const files = req.files ? req.files.images : (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      return sendError(res, 'FILE_4001', 'Please upload at least one image');
    }

    if (files.length > 10) {
      return sendError(res, 'BIZ_7003', 'Maximum 10 images are allowed');
    }

    const { caption, address, latitude, longitude, tags } = req.body;

    // Upload all images to Cloudinary
    const imageUrls = [];
    const cloudinaryPublicIds = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const cloudinaryResult = await uploadImage(file.buffer, {
        folder: 'taatom/posts',
        public_id: `post_${req.user._id}_${Date.now()}_${i}`
      });
      
      imageUrls.push(cloudinaryResult.secure_url);
      cloudinaryPublicIds.push(cloudinaryResult.public_id);
    }

    // Parse tags if provided
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = [];
      }
    }

    // Extract hashtags from caption
    const extractedHashtags = extractHashtags(caption || '');
    // Merge extracted hashtags with provided tags (remove duplicates)
    const allHashtags = [...new Set([...parsedTags, ...extractedHashtags])];

    // Create post with multiple images
    const post = new Post({
      user: req.user._id,
      caption,
      imageUrl: imageUrls[0], // Keep first image as primary for backward compatibility
      images: imageUrls, // Store all images
      cloudinaryPublicIds: cloudinaryPublicIds,
      tags: allHashtags,
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

    // Update hashtag counts asynchronously (don't block post creation)
    if (allHashtags.length > 0) {
      Promise.all(
        allHashtags.map(async (hashtagName) => {
          try {
            let hashtag = await Hashtag.findOne({ name: hashtagName });
            if (!hashtag) {
              hashtag = new Hashtag({ name: hashtagName });
            }
            await hashtag.incrementPostCount(post._id);
          } catch (error) {
            logger.error(`Error updating hashtag ${hashtagName}:`, error);
          }
        })
      ).catch(err => logger.error('Error updating hashtags:', err));
    }

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

    return sendSuccess(res, 201, 'Post created successfully', {
      post: {
        ...post.toObject(),
        isLiked: false,
        likesCount: 0,
        commentsCount: 0
      }
    });

  } catch (error) {
    logger.error('Create post error:', error);
    
    // Clean up uploaded image if post creation failed
    if (req.cloudinaryResult) {
      deleteImage(req.cloudinaryResult.public_id).catch(err => 
        logger.error('Error deleting image after failed post creation:', err)
      );
    }

    // Provide more specific error messages
    let errorCode = 'SRV_6001';
    let errorMessage = 'Error creating post';

    if (error.name === 'ValidationError') {
      errorCode = 'VAL_2001';
      errorMessage = 'Invalid post data provided';
    } else if (error.message && error.message.includes('Cloudinary')) {
      errorCode = 'FILE_4004';
      errorMessage = 'Failed to upload image. Please try again.';
    } else if (error.message && error.message.includes('network')) {
      errorCode = 'SRV_6002';
      errorMessage = 'Network error. Please check your connection.';
    }

    return sendError(res, errorCode, errorMessage, process.env.NODE_ENV === 'development' ? { details: error.message } : {});
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

    const shortsWithLikeStatus = await Promise.all(shorts.map(async (short) => {
      let isFollowing = false;
      
      // Check if current user is following the post author
      if (req.user && short.user) {
        const postAuthor = await User.findById(short.user);
        if (postAuthor && postAuthor.followers) {
          isFollowing = postAuthor.followers.some(follower => follower.toString() === req.user._id.toString());
        }
      }
      
      return {
        ...short,
        isLiked: req.user ? short.likes.some(like => like.toString() === req.user._id.toString()) : false,
        likesCount: short.likes.length,
        commentsCount: short.comments.length,
        user: {
          ...short.user,
          isFollowing
        }
      };
    }));

    const totalShorts = await Post.countDocuments({ user: userId, isActive: true, type: 'short' });

    return sendSuccess(res, 200, 'User shorts fetched successfully', {
      shorts: shortsWithLikeStatus,
      user: user,
      totalShorts
    });

  } catch (error) {
    logger.error('Get user shorts error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching user shorts');
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

    return sendSuccess(res, 200, 'User posts fetched successfully', {
      posts: postsWithLikeStatus,
      user: user,
      totalPosts
    });

  } catch (error) {
    logger.error('Get user posts error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching user posts');
  }
};

// @desc    Like/unlike post
// @route   POST /posts/:id/like
// @access  Private
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('user', 'fullName profilePic');
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    const isLiked = post.toggleLike(req.user._id);
    await post.save();

    // Update user's total likes if this is their post
    if (isLiked) {
      await User.findByIdAndUpdate(post.user, { $inc: { totalLikes: 1 } });
      
      // Create notification for like (only if it's not the user's own post)
      if (post.user._id.toString() !== req.user._id.toString()) {
        try {
          logger.debug('🔔 Creating like notification:', {
            fromUser: req.user._id,
            toUser: post.user._id,
            post: post._id
          });
          
          const notification = await Notification.createNotification({
            type: 'like',
            fromUser: req.user._id,
            toUser: post.user._id,
            post: post._id
          });
          
          logger.debug('Like notification created successfully:', notification._id);

          // Emit real-time notification
          const io = getIO();
          if (io) {
            const nsp = io.of('/app');
            nsp.emit('notification', {
              type: 'like',
              fromUser: {
                _id: req.user._id,
                fullName: req.user.fullName,
                profilePic: req.user.profilePic
              },
              post: {
                _id: post._id,
                imageUrl: post.imageUrl
              },
              createdAt: new Date()
            });
          }
        } catch (notificationError) {
          logger.error('Error creating like notification:', notificationError);
        }
      }
    } else {
      await User.findByIdAndUpdate(post.user, { $inc: { totalLikes: -1 } });
    }

    // Emit real-time post like update to all connected users
    try {
      const io = getIO();
      if (io) {
        const nsp = io.of('/app');
        // Emit the new real-time post like update
        nsp.emitPostLike(post._id.toString(), isLiked, post.likes.length, req.user._id.toString());
        // Also emit the legacy notification event
        nsp.emitEvent('post:liked', [post.user.toString()], { postId: post._id });
      }
    } catch (socketError) {
      logger.error('Socket error:', socketError);
    }

    return sendSuccess(res, 200, isLiked ? 'Post liked' : 'Post unliked', {
      isLiked,
      likesCount: post.likes.length
    });

  } catch (error) {
    logger.error('Toggle like error:', error);
    return sendError(res, 'SRV_6001', 'Error updating like status');
  }
};

// @desc    Add comment to post
// @route   POST /posts/:id/comments
// @access  Private
const addComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }

    const post = await Post.findById(req.params.id).populate('user', 'fullName profilePic');
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    // Check if comments are disabled
    if (post.commentsDisabled) {
      return sendError(res, 'BIZ_7001', 'Comments are disabled for this post');
    }

    const { text } = req.body;
    const newComment = post.addComment(req.user._id, text);
    await post.save();

    // Populate the new comment with user data
    await post.populate('comments.user', 'fullName profilePic');
    const populatedComment = post.comments.id(newComment._id);

    // Create notification for comment (only if it's not the user's own post)
    if (post.user._id.toString() !== req.user._id.toString()) {
      try {
        logger.debug('🔔 Creating comment notification:', {
          fromUser: req.user._id,
          toUser: post.user._id,
          post: post._id,
          comment: newComment._id
        });
        
        const notification = await Notification.createNotification({
          type: 'comment',
          fromUser: req.user._id,
          toUser: post.user._id,
          post: post._id,
          comment: newComment._id
        });
        
        logger.debug('✅ Comment notification created successfully:', notification._id);

        // Emit real-time notification
        const io = getIO();
        if (io) {
          const nsp = io.of('/app');
          nsp.emit('notification', {
            type: 'comment',
            fromUser: {
              _id: req.user._id,
              fullName: req.user.fullName,
              profilePic: req.user.profilePic
            },
            post: {
              _id: post._id,
              imageUrl: post.imageUrl
            },
            comment: {
              _id: newComment._id,
              text: text
            },
            createdAt: new Date()
          });
        }
      } catch (notificationError) {
        logger.error('❌ Error creating comment notification:', notificationError);
      }
    }

    // Emit real-time post comment update to all connected users
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      // Emit the new real-time post comment update
      nsp.emitPostComment(post._id.toString(), populatedComment, post.comments.length, req.user._id.toString());
      
      // Also emit legacy events
      const followers = await getFollowers(post.user);
      const audience = [post.user.toString(), ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(post.user.toString());
      nsp.emitEvent('comment:created', audience, { postId: post._id });
    }

    return sendSuccess(res, 201, 'Comment added successfully', {
      comment: populatedComment,
      commentsCount: post.comments.length
    });

  } catch (error) {
    logger.error('Add comment error:', error);
    return sendError(res, 'SRV_6001', 'Error adding comment');
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
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return sendError(res, 'RES_3001', 'Comment does not exist');
    }

    // Check if user owns the comment or the post
    if (comment.user.toString() !== req.user._id.toString() && 
        post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only delete your own comments or comments on your posts');
    }

    post.removeComment(commentId);
    await post.save();

    return sendSuccess(res, 200, 'Comment deleted successfully', {
      commentsCount: post.comments.length
    });

  } catch (error) {
    logger.error('Delete comment error:', error);
    return sendError(res, 'SRV_6001', 'Error deleting comment');
  }
};

// @desc    Delete post
// @route   DELETE /posts/:id
// @access  Private
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only delete your own posts');
    }

    // Delete image from Cloudinary
    try {
      await deleteImage(post.cloudinaryPublicId);
    } catch (cloudinaryError) {
      logger.error('Error deleting image from Cloudinary:', cloudinaryError);
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

    return sendSuccess(res, 200, 'Post deleted successfully');

  } catch (error) {
    logger.error('Delete post error:', error);
    return sendError(res, 'SRV_6001', 'Error deleting post');
  }
};

// @desc    Archive post
// @route   PATCH /posts/:id/archive
// @access  Private
const archivePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only archive your own posts');
    }

    post.isArchived = true;
    await post.save();

    return sendSuccess(res, 200, 'Post archived successfully', { post });
  } catch (error) {
    logger.error('Archive post error:', error);
    return sendError(res, 'SRV_6001', 'Error archiving post');
  }
};

// @desc    Unarchive post
// @route   PATCH /posts/:id/unarchive
// @access  Private
const unarchivePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only unarchive your own posts');
    }

    post.isArchived = false;
    await post.save();

    return sendSuccess(res, 200, 'Post unarchived successfully', { post });
  } catch (error) {
    logger.error('Unarchive post error:', error);
    return sendError(res, 'SRV_6001', 'Error unarchiving post');
  }
};

// @desc    Get archived posts for authenticated user
// @route   GET /posts/archived
// @access  Private
const getArchivedPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      user: req.user._id, 
      isArchived: true, 
      isActive: true, 
      type: 'photo' 
    })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes.some(like => like.toString() === req.user._id.toString()),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    return sendSuccess(res, 200, 'Archived posts fetched successfully', {
      posts: postsWithLikeStatus,
      page,
      limit,
      total: posts.length
    });
  } catch (error) {
    logger.error('Get archived posts error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching archived posts');
  }
};

// @desc    Hide post from feed
// @route   PATCH /posts/:id/hide
// @access  Private
const hidePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    post.isHidden = true;
    await post.save();

    return sendSuccess(res, 200, 'Post hidden successfully', { post });
  } catch (error) {
    logger.error('Hide post error:', error);
    return sendError(res, 'SRV_6001', 'Error hiding post');
  }
};

// @desc    Unhide post
// @route   PATCH /posts/:id/unhide
// @access  Private
const unhidePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only unhide your own posts');
    }

    post.isHidden = false;
    await post.save();

    return sendSuccess(res, 200, 'Post unhidden successfully', { post });
  } catch (error) {
    logger.error('Unhide post error:', error);
    return sendError(res, 'SRV_6001', 'Error unhiding post');
  }
};

// @desc    Get hidden posts for authenticated user
// @route   GET /posts/hidden
// @access  Private
const getHiddenPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      user: req.user._id, 
      isHidden: true, 
      isActive: true, 
      type: 'photo' 
    })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes.some(like => like.toString() === req.user._id.toString()),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    res.status(200).json({
      success: true,
      posts: postsWithLikeStatus,
      page,
      limit,
      total: posts.length
    });
  } catch (error) {
    logger.error('Get hidden posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching hidden posts'
    });
  }
};

// @desc    Toggle comments on post
// @route   PATCH /posts/:id/toggle-comments
// @access  Private
const toggleComments = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only toggle comments on your own posts');
    }

    post.commentsDisabled = !post.commentsDisabled;
    await post.save();

    return sendSuccess(res, 200, post.commentsDisabled ? 'Comments disabled' : 'Comments enabled', {
      commentsDisabled: post.commentsDisabled
    });
  } catch (error) {
    logger.error('Toggle comments error:', error);
    return sendError(res, 'SRV_6001', 'Error toggling comments');
  }
};

// @desc    Update post
// @route   PATCH /posts/:id
// @access  Private
const updatePost = async (req, res) => {
  try {
    const { caption } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only edit your own posts');
    }

    // Track old hashtags for decrementing counts
    const oldHashtags = post.tags || [];
    
    if (caption) {
      post.caption = caption;
      // Extract hashtags from new caption
      const extractedHashtags = extractHashtags(caption || '');
      post.tags = extractedHashtags;
    }

    await post.save();

    // Update hashtag counts (decrement old, increment new)
    const newHashtags = post.tags || [];
    const hashtagsToRemove = oldHashtags.filter(tag => !newHashtags.includes(tag));
    const hashtagsToAdd = newHashtags.filter(tag => !oldHashtags.includes(tag));

    // Decrement counts for removed hashtags
    if (hashtagsToRemove.length > 0) {
      Promise.all(
        hashtagsToRemove.map(async (hashtagName) => {
          try {
            const hashtag = await Hashtag.findOne({ name: hashtagName });
            if (hashtag) {
              await hashtag.decrementPostCount();
            }
          } catch (error) {
            logger.error(`Error decrementing hashtag ${hashtagName}:`, error);
          }
        })
      ).catch(err => logger.error('Error updating removed hashtags:', err));
    }

    // Increment counts for new hashtags
    if (hashtagsToAdd.length > 0) {
      Promise.all(
        hashtagsToAdd.map(async (hashtagName) => {
          try {
            let hashtag = await Hashtag.findOne({ name: hashtagName });
            if (!hashtag) {
              hashtag = new Hashtag({ name: hashtagName });
            }
            await hashtag.incrementPostCount(post._id);
          } catch (error) {
            logger.error(`Error incrementing hashtag ${hashtagName}:`, error);
          }
        })
      ).catch(err => logger.error('Error updating new hashtags:', err));
    }

    return sendSuccess(res, 200, 'Post updated successfully', { post });
  } catch (error) {
    logger.error('Update post error:', error);
    return sendError(res, 'SRV_6001', 'Error updating post');
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
      .limit(limit);

    // Add isLiked field if user is authenticated and include virtual fields
    const shortsWithLikeStatus = await Promise.all(shorts.map(async (short) => {
      let isFollowing = false;
      
      // Check if current user is following the post author
      if (req.user && short.user) {
        const postAuthor = await User.findById(short.user);
        if (postAuthor && postAuthor.followers) {
          isFollowing = postAuthor.followers.some(follower => follower.toString() === req.user._id.toString());
        }
      }
      
      return {
        ...short.toObject(),
        mediaUrl: short.mediaUrl, // Include virtual field
        isLiked: req.user ? short.likes.some(like => like.toString() === req.user._id.toString()) : false,
        likesCount: short.likes.length,
        commentsCount: short.comments.length,
        user: {
          ...short.user.toObject(),
          isFollowing
        }
      };
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
    logger.error('Get shorts error:', error);
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
    logger.debug('createShort called');
    logger.debug('req.file:', req.file);
    logger.debug('req.body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.debug('Validation errors:', errors.array());
      return sendError(res, 'VAL_2001', 'Validation failed', { validationErrors: errors.array() });
    }

    // req.files.video[0] if fields upload; req.file if single
    const videoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) || req.file;
    const imageFile = (req.files && Array.isArray(req.files.image) && req.files.image[0]) || null;

    if (!videoFile) {
      logger.debug('No file uploaded');
      return sendError(res, 'FILE_4001', 'Please upload a video');
    }

    const { caption, address, latitude, longitude, tags } = req.body;

    // Upload video to Cloudinary with async eager; fallback to upload_large for very big files
    let cloudinaryResult;
    try {
      cloudinaryResult = await uploadImage(videoFile.buffer, {
        folder: 'taatom/shorts',
        resource_type: 'video',
        public_id: `short_${req.user._id}_${Date.now()}`,
        eager: [ { format: 'mp4', quality: 'auto', fetch_format: 'auto' } ],
        eager_async: true,
        chunk_size: 50 * 1024 * 1024,
      });
    } catch (streamErr) {
      logger.error('Cloudinary upload_stream error:', streamErr);
      try {
        const dataUri = `data:${videoFile.mimetype};base64,${videoFile.buffer.toString('base64')}`;
        cloudinaryResult = await cloudinary.uploader.upload_large(dataUri, {
          folder: 'taatom/shorts',
          resource_type: 'video',
          public_id: `short_${req.user._id}_${Date.now()}`,
          eager: [ { format: 'mp4', quality: 'auto', fetch_format: 'auto' } ],
          eager_async: true,
          chunk_size: 50 * 1024 * 1024,
        });
      } catch (largeErr) {
        logger.error('Cloudinary upload_large error:', largeErr);
        return sendError(res, 'FILE_4004', largeErr.message || 'Video is too large to process. Please try a smaller clip.');
      }
    }

    // Parse tags if provided
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = JSON.parse(tags);
      } catch (e) {
        parsedTags = [];
      }
    }

    // Extract hashtags from caption
    const extractedHashtags = extractHashtags(caption || '');
    // Merge extracted hashtags with provided tags (remove duplicates)
    const allHashtags = [...new Set([...parsedTags, ...extractedHashtags])];

    // Create short
    // If user provided a custom image, upload and use its secure_url; else generate thumbnail URL
    let thumbnailUrl = '';
    if (imageFile) {
      try {
        const imgRes = await uploadImage(imageFile.buffer, { folder: 'taatom/shorts', resource_type: 'image' });
        thumbnailUrl = imgRes.secure_url;
      } catch (imgErr) {
        logger.error('Thumbnail image upload failed, falling back to generated thumbnail');
      }
    }
    if (!thumbnailUrl) {
      thumbnailUrl = getVideoThumbnailUrl(cloudinaryResult.public_id);
    }
    const short = new Post({
      user: req.user._id,
      caption,
      imageUrl: thumbnailUrl || '',
      videoUrl: cloudinaryResult.secure_url, // Video URL goes here
      cloudinaryPublicId: cloudinaryResult.public_id,
      tags: allHashtags,
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

    // Update hashtag counts asynchronously (don't block short creation)
    if (allHashtags.length > 0) {
      Promise.all(
        allHashtags.map(async (hashtagName) => {
          try {
            let hashtag = await Hashtag.findOne({ name: hashtagName });
            if (!hashtag) {
              hashtag = new Hashtag({ name: hashtagName });
            }
            await hashtag.incrementPostCount(short._id);
          } catch (error) {
            logger.error(`Error updating hashtag ${hashtagName}:`, error);
          }
        })
      ).catch(err => logger.error('Error updating hashtags:', err));
    }

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

    return sendSuccess(res, 201, 'Short created successfully', {
      short: {
        ...short.toObject(),
        isLiked: false,
        likesCount: 0,
        commentsCount: 0
      }
    });

  } catch (error) {
    logger.error('Create short error:', error);
    
    // Clean up uploaded video if short creation failed
    if (cloudinaryResult) {
      deleteImage(cloudinaryResult.public_id).catch(err => 
        logger.error('Error deleting video after failed short creation:', err)
      );
    }

    return sendError(res, 'SRV_6001', 'Error creating short');
  }
};

module.exports = {
  getPosts,
  getPostById,
  createPost,
  getUserPosts,
  getUserShorts,
  toggleLike,
  addComment,
  deleteComment,
  deletePost,
  getShorts,
  createShort,
  archivePost,
  unarchivePost,
  hidePost,
  unhidePost,
  toggleComments,
  updatePost,
  getArchivedPosts,
  getHiddenPosts
};

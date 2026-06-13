const Hashtag = require('../models/Hashtag');
const Post = require('../models/Post');
const logger = require('../utils/logger');
const { getOptimizedImageUrl } = require('../config/cloudinary');
const { generateSignedUrl, generateSignedUrls, resolveProfilePic } = require('../services/mediaService');
const { getAllowedPostAuthorIds } = require('./postController');

// @desc    Search hashtags
// @route   GET /hashtags/search
// @access  Public
const searchHashtags = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Query required',
        message: 'Please provide a search query'
      });
    }

    const hashtags = await Hashtag.search(q.trim(), parseInt(limit));

    res.status(200).json({
      hashtags: hashtags.map(h => ({
        name: h.name,
        postCount: h.postCount,
        lastUsedAt: h.lastUsedAt,
      }))
    });
  } catch (error) {
    logger.error('Search hashtags error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error searching hashtags'
    });
  }
};

// @desc    Get trending hashtags
// @route   GET /hashtags/trending
// @access  Public
const getTrendingHashtags = async (req, res) => {
  try {
    const { limit = 20, timeRange = '24h' } = req.query;

    const hashtags = await Hashtag.getTrending(parseInt(limit), timeRange);

    res.status(200).json({
      hashtags: hashtags.map(h => ({
        name: h.name,
        postCount: h.postCount,
        lastUsedAt: h.lastUsedAt,
      }))
    });
  } catch (error) {
    logger.error('Get trending hashtags error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching trending hashtags'
    });
  }
};

// @desc    Get posts by hashtag
// @route   GET /hashtags/:hashtag/posts
// @access  Public
const getHashtagPosts = async (req, res) => {
  try {
    const { hashtag } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!hashtag || hashtag.trim().length === 0) {
      return res.status(400).json({
        error: 'Hashtag required',
        message: 'Please provide a hashtag'
      });
    }

    const hashtagName = hashtag.toLowerCase().trim().replace(/^#/, '');

    // Find hashtag to verify it exists
    const hashtagDoc = await Hashtag.findOne({ name: hashtagName });
    if (!hashtagDoc) {
      return res.status(404).json({
        error: 'Hashtag not found',
        message: 'This hashtag does not exist'
      });
    }

    // Get allowed author IDs based on privacy settings
    const viewerId = req.user?._id?.toString();
    const allowedAuthorIds = await getAllowedPostAuthorIds(viewerId);

    // Find posts with this hashtag
    const posts = await Post.find({
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true },
      tags: hashtagName,
      user: { $in: allowedAuthorIds }
    })
      .populate('user', 'fullName profilePic profilePicStorageKey settings.privacy.showLocation')
      .populate('comments.user', 'fullName profilePic profilePicStorageKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Generate signed URLs dynamically for posts
    const postsWithFreshUrls = await Promise.all(posts.map(async (post) => {
      // Generate image URLs from storage keys
      if (post.storageKeys && post.storageKeys.length > 0) {
        try {
          const imageUrls = await generateSignedUrls(post.storageKeys, 'IMAGE');
          post.imageUrl = imageUrls[0] || null; // Primary image
          post.images = imageUrls; // All images
        } catch (error) {
          logger.warn('Failed to generate image URLs for post:', { 
            postId: post._id, 
            error: error.message 
          });
          post.imageUrl = null;
          post.images = [];
        }
      } else if (post.storageKey) {
        // Fallback for single storage key
        try {
          const imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
          post.imageUrl = imageUrl;
          post.images = imageUrl ? [imageUrl] : [];
        } catch (error) {
          logger.warn('Failed to generate image URL for post:', { 
            postId: post._id, 
            error: error.message 
          });
          post.imageUrl = null;
          post.images = [];
        }
      } else {
        if (post.imageUrl && post.imageUrl.trim() !== '') {
          post.images = [post.imageUrl];
        } else {
          post.imageUrl = null;
          post.images = [];
        }
      }

      // Resolve fresh profile pic URL for post author and all commenters
      if (post.user) {
        post.user.profilePic = await resolveProfilePic(post.user);
      }
      if (post.comments && post.comments.length > 0) {
        for (const comment of post.comments) {
          if (comment.user) {
            comment.user.profilePic = await resolveProfilePic(comment.user);
          }
        }
      }

      return post;
    }));

    // Filter out posts with missing media or author data
    const validPosts = postsWithFreshUrls.filter(post => {
      const hasStorageKey = post.storageKey || (post.storageKeys && post.storageKeys.length > 0);
      const hasImageUrl = post.imageUrl && post.imageUrl.trim() !== '';
      
      if (!hasStorageKey && !hasImageUrl) {
        logger.warn(`Post ${post._id} missing both storageKey and imageUrl, filtering out`);
        return false;
      }
      
      if (!post.user || !post.user._id || !post.user.fullName) {
        logger.warn(`Post ${post._id} missing author data, filtering out`);
        return false;
      }
      
      return true;
    });

    // Add isLiked field if user is authenticated and optimize image URLs
    const userId = req.user?._id?.toString();
    const postsWithLikeStatus = validPosts.map(post => {
      let optimizedImageUrl = post.imageUrl;
      if (post.imageUrl && post.imageUrl.includes('cloudinary.com')) {
        try {
          const urlParts = post.imageUrl.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split('.')[0];
          optimizedImageUrl = getOptimizedImageUrl(`taatom/posts/${publicId}`, {
            width: 800,
            height: 800,
            quality: 'auto:good',
            format: 'auto',
            flags: 'progressive'
          });
        } catch (error) {
          logger.warn('Failed to optimize Cloudinary URL:', error);
        }
      }

      const isLiked = userId && post.likes 
        ? post.likes.some(like => like.toString() === userId)
        : false;

      const postOwnerId = post.user?._id?.toString();
      const hideLocation = postOwnerId !== userId && post.user?.settings?.privacy?.showLocation === false;
      const { settings: _settings, ...userWithoutSettings } = post.user || {};

      return {
        ...post,
        imageUrl: optimizedImageUrl,
        isLiked,
        location: hideLocation ? null : post.location,
        detectedPlace: hideLocation ? null : post.detectedPlace,
        user: userWithoutSettings,
        likesCount: post.likes ? post.likes.length : 0,
        commentsCount: post.comments ? post.comments.length : 0
      };
    });

    const totalPosts = await Post.countDocuments({
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true },
      tags: hashtagName
    });
    const totalPages = Math.ceil(totalPosts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      hashtag: {
        name: hashtagDoc.name,
        postCount: hashtagDoc.postCount,
        lastUsedAt: hashtagDoc.lastUsedAt,
      },
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
    logger.error('Get hashtag posts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching hashtag posts'
    });
  }
};

// @desc    Get hashtag details
// @route   GET /hashtags/:hashtag
// @access  Public
const getHashtagDetails = async (req, res) => {
  try {
    const { hashtag } = req.params;

    if (!hashtag || hashtag.trim().length === 0) {
      return res.status(400).json({
        error: 'Hashtag required',
        message: 'Please provide a hashtag'
      });
    }

    const hashtagName = hashtag.toLowerCase().trim().replace(/^#/, '');

    const hashtagDoc = await Hashtag.findOne({ name: hashtagName });

    if (!hashtagDoc) {
      return res.status(404).json({
        error: 'Hashtag not found',
        message: 'This hashtag does not exist'
      });
    }

    res.status(200).json({
      hashtag: {
        name: hashtagDoc.name,
        postCount: hashtagDoc.postCount,
        lastUsedAt: hashtagDoc.lastUsedAt,
        createdAt: hashtagDoc.createdAt,
      }
    });
  } catch (error) {
    logger.error('Get hashtag details error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching hashtag details'
    });
  }
};

module.exports = {
  searchHashtags,
  getTrendingHashtags,
  getHashtagPosts,
  getHashtagDetails,
};


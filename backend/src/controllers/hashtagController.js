const Hashtag = require('../models/Hashtag');
const Post = require('../models/Post');
const logger = require('../utils/logger');

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

    // Find posts with this hashtag
    const posts = await Post.find({
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true },
      tags: hashtagName
    })
      .populate('user', 'fullName profilePic')
      .populate('comments.user', 'fullName profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add isLiked field if user is authenticated
    const postsWithLikeStatus = posts.map(post => {
      const isLiked = req.user ? post.likes.some(like => like.toString() === req.user._id.toString()) : false;

      return {
        ...post,
        isLiked,
        likesCount: post.likes.length,
        commentsCount: post.comments.length
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


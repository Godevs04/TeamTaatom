const Post = require('../models/Post');
const User = require('../models/User');
const Hashtag = require('../models/Hashtag');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { cacheWrapper, CacheKeys, CACHE_TTL } = require('../utils/cache');
const { generateSignedUrl, generateSignedUrls } = require('../services/mediaService');

// @desc    Advanced search for posts
// @route   GET /api/v1/search/posts
// @access  Public
const searchPosts = async (req, res) => {
  try {
    const {
      q,
      query: queryParam,
      hashtag,
      location,
      startDate,
      endDate,
      type,
      page = 1,
      limit = 20
    } = req.query;

    const searchText = (queryParam != null && queryParam !== '') ? queryParam : q;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?._id?.toString();

    // Build search query
    const matchQuery = {
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true }
    };

    // Text search in caption (support both q and query params)
    if (searchText && String(searchText).trim().length > 0) {
      matchQuery.caption = { $regex: String(searchText).trim(), $options: 'i' };
    }

    // Hashtag filter
    if (hashtag) {
      matchQuery.tags = { $in: [hashtag.toLowerCase().replace('#', '')] };
    }

    // Location filter (address search)
    if (location) {
      matchQuery['location.address'] = { $regex: location, $options: 'i' };
    }

    // Date range filter
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) {
        matchQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Post type filter
    if (type && ['photo', 'short'].includes(type)) {
      matchQuery.type = type;
    }

    // Cache key
    const cacheKey = `search:posts:${JSON.stringify(matchQuery)}:page:${page}:limit:${limit}`;

    const result = await cacheWrapper(cacheKey, async () => {
      // Use aggregation pipeline for efficient search
      const posts = await Post.aggregate([
        { $match: matchQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1, username: 1 } }
            ]
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'users',
            localField: 'comments.user',
            foreignField: '_id',
            as: 'commentUsers',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1 } }
            ]
          }
        },
        {
          $addFields: {
            comments: {
              $map: {
                input: '$comments',
                as: 'comment',
                in: {
                  $mergeObjects: [
                    '$$comment',
                    {
                      user: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$commentUsers',
                              cond: { $eq: ['$$this._id', '$$comment.user'] }
                            }
                          },
                          0
                        ]
                      }
                    }
                  ]
                }
              }
            },
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } }
          }
        },
        {
          $project: {
            commentUsers: 0
          }
        }
      ]);

      const totalPosts = await Post.countDocuments(matchQuery).lean();

      return { posts, totalPosts };
    }, CACHE_TTL.SEARCH_RESULTS);

    const { posts, totalPosts } = result;

    // Generate signed image URLs (same as feed) so search results show thumbnails
    const postsWithImageUrls = await Promise.all(posts.map(async (post) => {
      if (post.storageKeys && post.storageKeys.length > 0) {
        try {
          const imageUrls = await generateSignedUrls(post.storageKeys, 'IMAGE');
          post.imageUrl = imageUrls[0] || null;
          post.images = imageUrls;
        } catch (err) {
          logger.warn('Search: failed to generate image URLs for post', { postId: post._id, error: err.message });
          post.imageUrl = post.imageUrl || null;
          post.images = post.images || (post.imageUrl ? [post.imageUrl] : []);
        }
      } else if (post.storageKey) {
        try {
          const imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
          post.imageUrl = imageUrl;
          post.images = imageUrl ? [imageUrl] : [];
        } catch (err) {
          logger.warn('Search: failed to generate image URL for post', { postId: post._id, error: err.message });
          post.imageUrl = post.imageUrl || null;
          post.images = post.images || (post.imageUrl ? [post.imageUrl] : []);
        }
      } else if (!post.imageUrl || post.imageUrl.trim() === '') {
        post.imageUrl = null;
        post.images = [];
      } else {
        post.images = post.images || (post.imageUrl ? [post.imageUrl] : []);
      }
      return post;
    }));

    // Add isLiked field
    const postsWithLikeStatus = postsWithImageUrls.map(post => ({
      ...post,
      isLiked: userId && post.likes
        ? post.likes.some(like => like.toString() === userId)
        : false
    }));

    return sendSuccess(res, 200, 'Posts found successfully', {
      posts: postsWithLikeStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / parseInt(limit)),
        totalPosts,
        hasNextPage: skip + parseInt(limit) < totalPosts,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Search posts error:', error);
    return sendError(res, 'SRV_6001', 'Error searching posts');
  }
};

// @desc    Search by location
// @route   GET /api/v1/search/location
// @access  Public
const searchByLocation = async (req, res) => {
  try {
    const { location, page = 1, limit = 20 } = req.query;

    if (!location || location.trim().length === 0) {
      return sendError(res, 'VAL_2001', 'Location query is required');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?._id?.toString();

    const matchQuery = {
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true },
      'location.address': { $regex: location.trim(), $options: 'i' }
    };

    const cacheKey = `search:location:${location}:page:${page}:limit:${limit}`;

    const result = await cacheWrapper(cacheKey, async () => {
      const posts = await Post.aggregate([
        { $match: matchQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1, username: 1 } }
            ]
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } }
          }
        }
      ]);

      const totalPosts = await Post.countDocuments(matchQuery).lean();

      return { posts, totalPosts };
    }, CACHE_TTL.SEARCH_RESULTS);

    const { posts, totalPosts } = result;

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: userId && post.likes 
        ? post.likes.some(like => like.toString() === userId)
        : false
    }));

    return sendSuccess(res, 200, 'Location search results', {
      posts: postsWithLikeStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / parseInt(limit)),
        totalPosts,
        hasNextPage: skip + parseInt(limit) < totalPosts,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Search by location error:', error);
    return sendError(res, 'SRV_6001', 'Error searching by location');
  }
};

module.exports = {
  searchPosts,
  searchByLocation
};


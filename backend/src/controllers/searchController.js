const Post = require('../models/Post');
const User = require('../models/User');
const Hashtag = require('../models/Hashtag');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { cacheWrapper, CacheKeys, CACHE_TTL } = require('../utils/cache');

// @desc    Advanced search for posts
// @route   GET /api/v1/search/posts
// @access  Public
const searchPosts = async (req, res) => {
  try {
    const { 
      q, 
      hashtag, 
      location, 
      startDate, 
      endDate, 
      type, 
      page = 1, 
      limit = 20 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user?._id?.toString();

    // Build search query
    const matchQuery = {
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true }
    };

    // Text search in caption
    if (q && q.trim().length > 0) {
      matchQuery.caption = { $regex: q.trim(), $options: 'i' };
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

    // Add isLiked field
    const postsWithLikeStatus = posts.map(post => ({
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


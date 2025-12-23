const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const Hashtag = require('../models/Hashtag');
const { uploadImage, deleteImage, getOptimizedImageUrl, getVideoThumbnailUrl, cloudinary } = require('../config/cloudinary');
const { buildMediaKey, uploadObject, deleteObject } = require('../services/storage');
const { generateSignedUrl, generateSignedUrls } = require('../services/mediaService');
const Song = require('../models/Song');
const { getFollowers } = require('../utils/socketBus');
const { getIO } = require('../socket');
const logger = require('../utils/logger');
const { extractHashtags } = require('../utils/hashtagExtractor');
const { extractMentions } = require('../utils/mentionExtractor');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const { cacheWrapper, CacheKeys, CACHE_TTL, deleteCache, deleteCacheByPattern } = require('../utils/cache');
const { cascadeDeletePost } = require('../utils/cascadeDelete');
const { sendNotificationToUser } = require('../utils/sendNotification');

// @desc    Get all posts (only photo type)
// @route   GET /posts
// @access  Public
const getPosts = async (req, res) => {
  try {
    // Defensive guards: validate and cap pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 50); // Cap at 50
    const skip = Math.max(0, (page - 1) * limit);
    const cursor = req.query.cursor; // Cursor for cursor-based pagination
    const useCursor = req.query.useCursor === 'true'; // Enable cursor-based pagination

    // Cache key with filters
    const cacheKey = CacheKeys.postList(page, limit, { type: 'photo', cursor });

    // Use cache wrapper for performance
    const result = await cacheWrapper(cacheKey, async () => {
      // Build match query
      const matchQuery = {
        isActive: true,
        isArchived: { $ne: true },
        isHidden: { $ne: true },
        type: 'photo'
      };

      // Add cursor-based filtering if cursor is provided
      if (useCursor && cursor) {
        try {
          const cursorDate = new Date(cursor);
          matchQuery.createdAt = { $lt: cursorDate };
        } catch (e) {
          logger.warn('Invalid cursor provided, using offset pagination');
        }
      }

      // Use aggregation pipeline for better performance (single query instead of populate)
      const posts = await Post.aggregate([
        {
          $match: matchQuery
        },
        { $sort: { createdAt: -1 } },
        ...(useCursor && cursor ? [] : [{ $skip: skip }]), // Skip only for offset pagination
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
            ]
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            user: {
              $cond: {
                if: { $eq: ['$user', null] },
                then: {
                  fullName: 'Unknown User',
                  profilePic: ''
                },
                else: '$user'
              }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'comments.user',
            foreignField: '_id',
            as: 'commentUsers',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'songs',
            localField: 'song.songId',
            foreignField: '_id',
            as: 'songData',
            pipeline: [
              { 
                $project: { 
                  title: 1, 
                  artist: 1, 
                  duration: 1, 
                  cloudinaryUrl: 1, 
                  s3Url: 1, 
                  thumbnailUrl: 1, 
                  storageKey: 1,
                  cloudinaryKey: 1,
                  s3Key: 1,
                  _id: 1 
                } 
              },
              {
                $addFields: {
                  s3Url: { $ifNull: ['$cloudinaryUrl', '$s3Url'] } // Use cloudinaryUrl if available, fallback to s3Url
                }
              }
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
            song: {
              $cond: {
                if: { $and: [{ $ne: ['$song.songId', null] }, { $gt: [{ $size: '$songData' }, 0] }] },
                then: {
                  songId: { $arrayElemAt: ['$songData', 0] },
                  startTime: '$song.startTime',
                  endTime: '$song.endTime',
                  volume: '$song.volume'
                },
                else: null
              }
            },
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
            viewsCount: { $ifNull: ['$views', 0] } // Include views count
          }
        },
        {
          $project: {
            commentUsers: 0, // Remove temporary field
            songData: 0 // Remove temporary field
          }
        }
      ]);

      const totalPosts = await Post.countDocuments({ 
        isActive: true, 
        isArchived: { $ne: true },
        isHidden: { $ne: true },
        type: 'photo' 
      }).lean();

      // Generate signed URLs dynamically for posts and songs
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
          // Legacy: try to use existing imageUrl if no storage key
          // This is for backward compatibility with old posts
          // Keep existing imageUrl from database if present
          if (post.imageUrl && post.imageUrl.trim() !== '') {
            // Use existing imageUrl (from Cloudinary or legacy storage)
            post.images = [post.imageUrl];
            // Keep imageUrl as is
          } else {
            post.imageUrl = null;
            post.images = [];
          }
        }

        // Generate signed URL for post author's profile picture
        if (post.user && post.user.profilePicStorageKey) {
          try {
            post.user.profilePic = await generateSignedUrl(post.user.profilePicStorageKey, 'PROFILE');
          } catch (error) {
            logger.warn('Failed to generate profile picture URL for post author:', { 
              postId: post._id, 
              userId: post.user._id,
              error: error.message 
            });
            // Fallback to legacy URL if available
            post.user.profilePic = post.user.profilePic || null;
          }
        } else if (post.user && post.user.profilePic) {
          // Legacy: use existing profilePic if no storage key
          // Keep the existing profilePic value
        }

        // Generate signed URLs for comment users' profile pictures
        if (post.comments && post.comments.length > 0) {
          for (const comment of post.comments) {
            if (comment.user && comment.user.profilePicStorageKey) {
              try {
                comment.user.profilePic = await generateSignedUrl(comment.user.profilePicStorageKey, 'PROFILE');
              } catch (error) {
                logger.warn('Failed to generate profile picture URL for comment user:', { 
                  postId: post._id, 
                  commentId: comment._id,
                  userId: comment.user._id,
                  error: error.message 
                });
                // Fallback to legacy URL if available
                comment.user.profilePic = comment.user.profilePic || null;
              }
            } else if (comment.user && comment.user.profilePic) {
              // Legacy: use existing profilePic if no storage key
              // Keep the existing profilePic value
            }
          }
        }

        // Generate song URL if present
        if (post.song?.songId) {
          const storageKey = post.song.songId.storageKey || post.song.songId.cloudinaryKey || post.song.songId.s3Key;
          if (storageKey) {
            try {
              const songUrl = await generateSignedUrl(storageKey, 'AUDIO');
              post.song.songId.s3Url = songUrl;
              post.song.songId.cloudinaryUrl = songUrl;
            } catch (error) {
              logger.warn('Failed to generate URL for song in post:', { 
                postId: post._id, 
                songId: post.song.songId._id, 
                storageKey,
                error: error.message 
              });
              post.song.songId.s3Url = null;
              post.song.songId.cloudinaryUrl = null;
            }
          }
        }
        return post;
      }));

      return { posts: postsWithFreshUrls, totalPosts };
    }, CACHE_TTL.POST_LIST);

    const { posts, totalPosts } = result;

    // Defensive guards: filter out posts with missing media or author data
    // Support both new storageKey-based posts and legacy imageUrl posts (backward compatibility)
    const validPosts = posts.filter(post => {
      // Must have either storage key(s) OR imageUrl (for backward compatibility with old posts)
      const hasStorageKey = post.storageKey || (post.storageKeys && post.storageKeys.length > 0);
      const hasImageUrl = post.imageUrl && post.imageUrl.trim() !== '';
      
      if (!hasStorageKey && !hasImageUrl) {
        logger.warn(`Post ${post._id} missing both storageKey and imageUrl, filtering out`);
        return false;
      }
      
      // Must have valid author data
      if (!post.user || !post.user._id || !post.user.fullName) {
        logger.warn(`Post ${post._id} missing author data, filtering out`);
        return false;
      }
      
      return true;
    });

    // Add isLiked field if user is authenticated and optimize image URLs
    const userId = req.user?._id?.toString();
    const postsWithLikeStatus = validPosts.map(post => {
      // Use image URL as-is (new uploads use R2, legacy Cloudinary URLs are kept for backward compatibility)
      // For legacy Cloudinary URLs, optionally optimize (but new R2 URLs don't need optimization)
      let optimizedImageUrl = post.imageUrl;
      if (post.imageUrl && post.imageUrl.includes('cloudinary.com')) {
        // Legacy Cloudinary URL - optionally optimize for backward compatibility
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
          // Keep original URL as fallback
        }
      }
      // For new R2 URLs, use as-is (no optimization needed - URLs are already pre-signed)

      // Check if user liked this post (optimized)
      const isLiked = userId && post.likes 
        ? post.likes.some(like => like.toString() === userId)
        : false;

      return {
        ...post,
        imageUrl: optimizedImageUrl,
        isLiked,
        // likesCount and commentsCount already added by aggregation
      };
    });

    // Improved error messages (no response shape change)
    if (postsWithLikeStatus.length === 0 && posts.length > 0) {
      logger.warn('All posts filtered out due to missing image URLs or author data');
    }

    // Determine next cursor (last post's createdAt)
    const nextCursor = postsWithLikeStatus.length > 0 
      ? postsWithLikeStatus[postsWithLikeStatus.length - 1].createdAt 
      : null;

    const totalPages = Math.ceil(totalPosts / limit);
    const hasNextPage = useCursor ? (postsWithLikeStatus.length === limit) : (page < totalPages);
    const hasPrevPage = !useCursor && page > 1;

    return sendSuccess(res, 200, 'Posts fetched successfully', {
      posts: postsWithLikeStatus,
      pagination: {
        ...(useCursor ? {
          cursor: nextCursor,
          hasNextPage,
          limit
        } : {
          currentPage: page,
          totalPages,
          totalPosts,
          hasNextPage,
          hasPrevPage,
          limit
        })
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
    const userId = req.user?._id?.toString();

    // Cache key
    const cacheKey = CacheKeys.post(id);

    // FIRST: Handle view increment (this must happen regardless of cache)
    // We need to check if we should increment BEFORE fetching from cache
    // So we'll fetch the post owner info first to determine if increment is needed
    let shouldIncrementViews = false;
    let postOwnerId = null;
    
    // Quick check to get post owner for view increment decision
    try {
      const postOwnerCheck = await Post.findById(id).select('user').lean();
      if (postOwnerCheck) {
        postOwnerId = postOwnerCheck.user?.toString();
        
        // Check if user is viewing someone else's post
        if (userId) {
          if (postOwnerId && postOwnerId !== userId) {
            shouldIncrementViews = true;
            const msg = `[VIEW TRACKING] Post ${id} - User ${userId} viewing another user's post (owner: ${postOwnerId}), will increment views`;
            logger.info(msg);
            logger.debug(msg);
          } else {
            const msg = `[VIEW TRACKING] Post ${id} - User ${userId} viewing own post (owner: ${postOwnerId}), skipping view increment`;
            logger.info(msg);
            logger.debug(msg);
          }
        } else {
          // Anonymous user - allow view increment
          shouldIncrementViews = true;
          const msg = `[VIEW TRACKING] Post ${id} - Anonymous user viewing post, will increment views`;
          logger.info(msg);
          logger.debug(msg);
        }
      }
    } catch (err) {
      logger.error(`[VIEW TRACKING] Error checking post owner for ${id}:`, err);
    }

    // Increment views BEFORE fetching from cache (if needed)
    let incrementedViews = null;
    if (shouldIncrementViews) {
      try {
        const incrementMsg = `[VIEW TRACKING] Post ${id} - Incrementing views, userId: ${userId || 'anonymous'}, postOwnerId: ${postOwnerId}`;
        logger.info(incrementMsg);
        logger.debug(incrementMsg);
        
        const updateResult = await Post.findOneAndUpdate(
          { _id: id },
          { $inc: { views: 1 } },
          { new: true, projection: { views: 1 }, lean: true }
        );
        
        if (updateResult && updateResult.views !== undefined && updateResult.views !== null) {
          incrementedViews = updateResult.views;
          const successMsg = `[VIEW TRACKING] Post ${id} views incremented to ${incrementedViews}`;
          logger.info(successMsg);
          logger.debug(successMsg);
          
          // Invalidate cache so fresh data is fetched
          await deleteCache(cacheKey).catch(() => {});
        } else {
          // Fallback: fetch updated views
          const postDoc = await Post.findById(id).select('views').lean();
          if (postDoc && postDoc.views !== undefined) {
            incrementedViews = postDoc.views;
            logger.info(`[VIEW TRACKING] Post ${id} views fetched after increment: ${incrementedViews}`);
            await deleteCache(cacheKey).catch(() => {});
          }
        }
      } catch (err) {
        logger.error(`[VIEW TRACKING] Error incrementing post views for post ${id}:`, err);
      }
    }

    // NOW: Use cache wrapper with aggregation pipeline to avoid N+1 queries
    const post = await cacheWrapper(cacheKey, async () => {
      // Use aggregation pipeline to fetch post with user and follow status in single query
      const posts = await Post.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(id),
            isActive: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { 
                $project: { 
                  fullName: 1, 
                  profilePic: 1,
                  profilePicStorageKey: 1,
                  followers: 1 // Include followers for follow status check
                } 
              }
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
              { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'songs',
            localField: 'song.songId',
            foreignField: '_id',
            as: 'songData',
            pipeline: [
              { 
                $project: { 
                  title: 1, 
                  artist: 1, 
                  duration: 1, 
                  cloudinaryUrl: 1, 
                  s3Url: 1, 
                  thumbnailUrl: 1, 
                  storageKey: 1,
                  cloudinaryKey: 1,
                  s3Key: 1,
                  _id: 1 
                } 
              },
              {
                $addFields: {
                  s3Url: { $ifNull: ['$cloudinaryUrl', '$s3Url'] } // Use cloudinaryUrl if available, fallback to s3Url
                }
              }
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
            song: {
              $cond: {
                if: { $and: [{ $ne: ['$song.songId', null] }, { $gt: [{ $size: '$songData' }, 0] }] },
                then: {
                  songId: { $arrayElemAt: ['$songData', 0] },
                  startTime: '$song.startTime',
                  endTime: '$song.endTime',
                  volume: '$song.volume'
                },
                else: null
              }
            },
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
            viewsCount: { $ifNull: ['$views', 0] } // Include views count
          }
        },
        {
          $project: {
            commentUsers: 0, // Remove temporary field
            songData: 0 // Remove temporary field
            // views and viewsCount are already included from $addFields, no need to explicitly project them
          }
        }
      ]);

      const result = posts[0] || null;
      
      // Ensure viewsCount is always present in the result
      if (result) {
        result.viewsCount = result.viewsCount !== undefined ? result.viewsCount : (result.views !== undefined ? result.views : 0);
        result.views = result.views !== undefined ? result.views : 0;
      }
      
      return result;
    }, CACHE_TTL.POST);

    if (!post) {
      return sendError(res, 'RES_3001', 'The requested post does not exist or has been deleted');
    }

    // Use incremented views if we incremented earlier, otherwise use post viewsCount
    const finalViewsCount = incrementedViews !== null ? incrementedViews : (post.viewsCount !== undefined ? post.viewsCount : (post.views !== undefined ? post.views : 0));
    
    const finalMsg = `[VIEW TRACKING] Post ${id} final response - viewsCount: ${finalViewsCount}, incrementedViews: ${incrementedViews}, post.viewsCount: ${post.viewsCount}, post.views: ${post.views}`;
    logger.info(finalMsg);
    logger.debug(finalMsg);

    // Generate dynamic image URLs from storage keys (same logic as getPosts)
    if (post.storageKeys && post.storageKeys.length > 0) {
      // Multiple images - generate URLs for all
      try {
        const imageUrls = await generateSignedUrls(post.storageKeys, 'IMAGE');
        post.imageUrl = imageUrls[0] || null;
        post.images = imageUrls;
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
      // Legacy: try to use existing imageUrl if no storage key
      // This is for backward compatibility with old posts
      if (!post.imageUrl) {
        post.imageUrl = null;
        post.images = [];
      }
      // For legacy Cloudinary URLs, optimize them
      if (post.imageUrl && post.imageUrl.includes('cloudinary.com')) {
        try {
          const urlParts = post.imageUrl.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split('.')[0];
          
          post.imageUrl = getOptimizedImageUrl(`taatom/posts/${publicId}`, {
            width: 1200,
            height: 1200,
            quality: 'auto:good',
            format: 'auto',
            flags: 'progressive'
          });
        } catch (error) {
          logger.warn('Failed to optimize Cloudinary URL:', error);
        }
      }
    }

    // Generate signed URL for post author's profile picture
    if (post.user && post.user.profilePicStorageKey) {
      try {
        post.user.profilePic = await generateSignedUrl(post.user.profilePicStorageKey, 'PROFILE');
      } catch (error) {
        logger.warn('Failed to generate profile picture URL for post author:', { 
          postId: post._id, 
          userId: post.user._id,
          error: error.message 
        });
        // Fallback to legacy URL if available
        post.user.profilePic = post.user.profilePic || null;
      }
    } else if (post.user && post.user.profilePic) {
      // Legacy: use existing profilePic if no storage key
      // Keep the existing profilePic value
    }

    // Generate signed URLs for comment users' profile pictures
    if (post.comments && post.comments.length > 0) {
      for (const comment of post.comments) {
        if (comment.user && comment.user.profilePicStorageKey) {
          try {
            comment.user.profilePic = await generateSignedUrl(comment.user.profilePicStorageKey, 'PROFILE');
          } catch (error) {
            logger.warn('Failed to generate profile picture URL for comment user:', { 
              postId: post._id, 
              commentId: comment._id,
              userId: comment.user._id,
              error: error.message 
            });
            // Fallback to legacy URL if available
            comment.user.profilePic = comment.user.profilePic || null;
          }
        } else if (comment.user && comment.user.profilePic) {
          // Legacy: use existing profilePic if no storage key
          // Keep the existing profilePic value
        }
      }
    }

    // Generate song URL if present (same logic as getPosts)
    if (post.song?.songId) {
      const storageKey = post.song.songId.storageKey || post.song.songId.cloudinaryKey || post.song.songId.s3Key;
      if (storageKey) {
        try {
          const songUrl = await generateSignedUrl(storageKey, 'AUDIO');
          post.song.songId.s3Url = songUrl;
          post.song.songId.cloudinaryUrl = songUrl;
        } catch (error) {
          logger.warn('Failed to generate URL for song in post:', { 
            postId: post._id, 
            songId: post.song.songId._id, 
            storageKey,
            error: error.message 
          });
          post.song.songId.s3Url = null;
          post.song.songId.cloudinaryUrl = null;
        }
      }
    }

    // Use generated imageUrl (already set above)
    const optimizedImageUrl = post.imageUrl;

    // Add isLiked and isFollowing fields if user is authenticated
    let isLiked = false;
    let isFollowing = false;
    if (userId) {
      isLiked = post.likes && post.likes.some(like => like.toString() === userId);
      
      // Check follow status (user data already populated in aggregation)
      if (post.user && post.user.followers) {
        isFollowing = post.user.followers.some(follower => 
          follower.toString() === userId
        );
      }
    }

    const postWithDetails = {
      ...post,
      imageUrl: optimizedImageUrl,
      isLiked,
      viewsCount: finalViewsCount, // Always include views count
      views: finalViewsCount, // Also include views field for consistency
      // likesCount and commentsCount already added by aggregation
      user: {
        ...post.user,
        isFollowing,
        followers: undefined // Remove followers array from response (not needed)
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

    // Defensive guards: validate required media exists
    const files = req.files ? req.files.images : (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      logger.warn('Post creation attempted without images');
      return sendError(res, 'FILE_4001', 'Please upload at least one image');
    }

    // Defensive: validate each file has buffer
    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        logger.error('Post creation attempted with empty file buffer');
        return sendError(res, 'FILE_4002', 'Invalid image file. Please try uploading again.');
      }
    }

    if (files.length > 10) {
      return sendError(res, 'BIZ_7003', 'Maximum 10 images are allowed');
    }

    const { caption, address, latitude, longitude, tags, songId, songStartTime, songEndTime, songVolume, spotType, travelInfo } = req.body;

    // Defensive guard: validate caption length within limits
    if (caption && caption.length > 2000) {
      logger.warn(`Post creation attempted with caption exceeding limit: ${caption.length} chars`);
      return sendError(res, 'VAL_2002', 'Caption cannot exceed 2000 characters');
    }

    // Upload all images to Sevalla Object Storage
    const storageKeys = [];
    
    // Store storage keys in request for cleanup if post creation fails
    req.storageKeys = storageKeys;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const extension = file.originalname.split('.').pop() || 'jpg';
        const storageKey = buildMediaKey({
          type: 'post',
          userId: req.user._id.toString(),
          filename: file.originalname,
          extension
        });
        
        await uploadObject(file.buffer, storageKey, file.mimetype);
        logger.debug(`Image ${i + 1} uploaded successfully:`, { storageKey });
        
        storageKeys.push(storageKey);
      }
    } catch (uploadError) {
      logger.error('Image upload error:', uploadError);
      // Clean up any successfully uploaded images if subsequent uploads fail
      if (storageKeys.length > 0) {
        await Promise.all(
          storageKeys.map(key => 
            deleteObject(key).catch(err => 
              logger.error('Error cleaning up failed upload:', err)
            )
          )
        );
      }
      return sendError(res, 'FILE_4004', uploadError.message || 'Image upload failed. Please try again.');
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

    // Extract hashtags and mentions from caption
    const extractedHashtags = extractHashtags(caption || '');
    const extractedMentions = extractMentions(caption || '');
    // Merge extracted hashtags with provided tags (remove duplicates)
    const allHashtags = [...new Set([...parsedTags, ...extractedHashtags])];
    
    // Resolve mentions to user IDs
    const mentionUserIds = [];
    if (extractedMentions.length > 0) {
      const mentionedUsers = await User.find({ 
        username: { $in: extractedMentions } 
      }).select('_id').lean();
      mentionUserIds.push(...mentionedUsers.map(u => u._id));
    }

    // Generate signed URLs for response (NOT stored in DB)
    const signedUrls = await generateSignedUrls(storageKeys, 'IMAGE');
    
    // Create post with multiple images - ONLY store storage keys, NOT signed URLs
    const post = new Post({
      user: req.user._id,
      caption,
      // DO NOT store imageUrl or images - they will be generated dynamically
      storageKey: storageKeys[0], // Primary storage key
      storageKeys: storageKeys, // All storage keys
      cloudinaryPublicIds: storageKeys, // Backward compatibility: use storageKeys as cloudinaryPublicIds
      tags: allHashtags,
      mentions: mentionUserIds,
      type: 'photo',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      },
      // CRITICAL: Dual-audio mixing support
      // When songId is provided, backend should mix:
      // - Original video audio at 0.6 volume (60%)
      // - Background music at songVolume (typically 1.0 = 100%)
      // This preserves both audio tracks instead of replacing video audio
      song: songId ? {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        endTime: songEndTime ? parseFloat(songEndTime) : null,
        volume: parseFloat(songVolume) || 1.0 // Music at full volume, video will be at 0.6
      } : undefined,
      // TripScore metadata from user dropdowns
      spotType: spotType || null,
      travelInfo: travelInfo || null
    });

    await post.save();

    // Create TripVisit for TripScore v2 (non-blocking)
    try {
      const { createTripVisitFromPost } = require('../services/tripVisitService');
      const metadata = {
        source: req.body.source || 'manual_only', // Can be passed from frontend
        hasExifGps: req.body.hasExifGps === 'true' || req.body.hasExifGps === true,
        takenAt: req.body.takenAt ? new Date(req.body.takenAt) : null,
        fromCamera: req.body.fromCamera === 'true' || req.body.fromCamera === true
      };
      await createTripVisitFromPost(post, metadata).catch(err => 
        logger.warn('Failed to create TripVisit for post:', err)
      );
    } catch (tripVisitError) {
      logger.warn('TripVisit creation failed (non-critical):', tripVisitError);
      // Don't fail post creation if TripVisit fails
    }

    // Increment song usage count if song is attached
    if (songId) {
      try {
        const Song = require('../models/Song');
        await Song.findByIdAndUpdate(songId, { $inc: { usageCount: 1 } });
      } catch (songError) {
        logger.error('Error incrementing song usage count:', songError);
        // Don't fail post creation if song update fails
      }
    }

    // Create activity (respect user's privacy settings)
    const user = await User.findById(req.user._id).select('settings.privacy.shareActivity').lean();
    const shareActivity = user?.settings?.privacy?.shareActivity !== false; // Default to true if not set
    Activity.createActivity({
      user: req.user._id,
      type: 'post_created',
      post: post._id,
      isPublic: shareActivity
    }).catch(err => logger.error('Error creating activity:', err));

    // Invalidate cache for post lists
    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(req.user._id.toString(), 1, 20));

    // Update hashtag counts asynchronously (don't block post creation)
    if (allHashtags.length > 0) {
      Promise.all(
        allHashtags.map(async (hashtagName) => {
          try {
            let hashtag = await Hashtag.findOne({ name: hashtagName }).lean();
            if (!hashtag) {
              hashtag = new Hashtag({ name: hashtagName });
              await hashtag.save();
            } else {
              hashtag = await Hashtag.findById(hashtag._id);
            }
            await hashtag.incrementPostCount(post._id);
            // Invalidate hashtag cache
            await deleteCache(CacheKeys.hashtag(hashtagName));
            await deleteCacheByPattern(`hashtag:${hashtagName}:*`);
          } catch (error) {
            logger.error(`Error updating hashtag ${hashtagName}:`, error);
          }
        })
      ).catch(err => logger.error('Error updating hashtags:', err));
    }

    // Populate user data for response (use lean for read-only)
    const populatedPost = await Post.findById(post._id)
      .populate('user', 'fullName profilePic')
      .lean();

    // Generate signed URLs dynamically for response
    if (populatedPost.storageKeys && populatedPost.storageKeys.length > 0) {
      try {
        const signedUrls = await generateSignedUrls(populatedPost.storageKeys, 'IMAGE');
        populatedPost.imageUrl = signedUrls[0] || null; // Primary image
        populatedPost.images = signedUrls; // All images
      } catch (error) {
        logger.warn('Failed to generate signed URLs for post response:', { 
          postId: populatedPost._id, 
          error: error.message 
        });
        populatedPost.imageUrl = null;
        populatedPost.images = [];
      }
    } else {
      logger.warn('Post missing storage keys:', { postId: populatedPost._id });
      populatedPost.imageUrl = null;
      populatedPost.images = [];
    }

    // Create mention notifications
    if (mentionUserIds.length > 0) {
      Promise.all(
        mentionUserIds.map(async (mentionedUserId) => {
          try {
            if (mentionedUserId.toString() !== req.user._id.toString()) {
              await Notification.createNotification({
                type: 'post_mention',
                fromUser: req.user._id,
                toUser: mentionedUserId,
                post: post._id,
                metadata: { caption: caption ? caption.substring(0, 100) : '' }
              });
            }
          } catch (error) {
            logger.error(`Error creating mention notification:`, error);
          }
        })
      ).catch(err => logger.error('Error creating mention notifications:', err));
    }

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(req.user._id);
      const audience = [req.user._id.toString(), ...followers, ...mentionUserIds.map(id => id.toString())];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(req.user._id.toString());
      nsp.emitEvent('post:created', audience, { postId: post._id });
      // Emit mention notifications
      mentionUserIds.forEach(mentionedUserId => {
        if (mentionedUserId.toString() !== req.user._id.toString()) {
          nsp.emitEvent('mention:new', [mentionedUserId.toString()], { 
            postId: post._id, 
            fromUser: req.user._id.toString() 
          });
        }
      });
    }

    // Return populated post with dynamically generated URLs
    return sendSuccess(res, 201, 'Post created successfully', {
      post: {
        ...populatedPost,
        isLiked: false,
        likesCount: 0,
        commentsCount: 0
      }
    });

  } catch (error) {
    logger.error('Create post error:', error);
    
    // Clean up uploaded images if post creation failed
    // Note: Storage keys are stored in req.storageKeys if available
    if (req.storageKeys && Array.isArray(req.storageKeys) && req.storageKeys.length > 0) {
      const { deleteObject } = require('../services/storage');
      await Promise.all(
        req.storageKeys.map(key => 
          deleteObject(key).catch(err => 
            logger.error('Error deleting image after failed post creation:', err)
          )
        )
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
    
    // Defensive guard: validate userId format
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'VAL_2002', 'Invalid user ID format');
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Defensive guard: ensure limit is reasonable
    const safeLimit = Math.min(Math.max(limit, 1), 50); // Cap at 50
    const safeSkip = Math.max(skip, 0);

    // Check if user exists
    const user = await User.findById(userId).select('fullName profilePic');
    if (!user) {
      return sendError(res, 'RES_3002', 'User not found');
    }

    // Use aggregation pipeline to avoid N+1 queries
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const currentUserId = req.user ? new mongoose.Types.ObjectId(req.user._id) : null;
    
    const shorts = await Post.aggregate([
      {
        $match: {
          user: userIdObj,
          isActive: true,
          type: 'short' // Explicitly filter for shorts only
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: safeSkip },
      { $limit: safeLimit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
            pipeline: [
              { 
                $project: { 
                  fullName: 1, 
                  profilePic: 1,
                  profilePicStorageKey: 1,
                  followers: currentUserId ? { $cond: [{ $eq: ['$_id', currentUserId] }, '$followers', []] } : []
                } 
              }
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
            { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
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
          commentsCount: { $size: { $ifNull: ['$comments', []] } },
          isLiked: currentUserId ? { $in: [currentUserId, { $ifNull: ['$likes', []] }] } : false,
          isFollowing: currentUserId && { $in: [currentUserId, { $ifNull: ['$user.followers', []] }] } || false
        }
      },
      {
        $project: {
          commentUsers: 0,
          'user.followers': 0 // Remove followers array from response
        }
      }
    ]);

    // Generate signed URLs for profile pictures
    const shortsWithProfilePics = await Promise.all(shorts.map(async (short) => {
      // Generate signed URL for short author's profile picture
      if (short.user && short.user.profilePicStorageKey) {
        try {
          short.user.profilePic = await generateSignedUrl(short.user.profilePicStorageKey, 'PROFILE');
        } catch (error) {
          logger.warn('Failed to generate profile picture URL for short author:', { 
            shortId: short._id, 
            userId: short.user._id,
            error: error.message 
          });
          // Fallback to legacy URL if available
          short.user.profilePic = short.user.profilePic || null;
        }
      } else if (short.user && short.user.profilePic) {
        // Legacy: use existing profilePic if no storage key
        // Keep the existing profilePic value
      }

      // Generate signed URLs for comment users' profile pictures
      if (short.comments && short.comments.length > 0) {
        for (const comment of short.comments) {
          if (comment.user && comment.user.profilePicStorageKey) {
            try {
              comment.user.profilePic = await generateSignedUrl(comment.user.profilePicStorageKey, 'PROFILE');
            } catch (error) {
              logger.warn('Failed to generate profile picture URL for comment user:', { 
                shortId: short._id, 
                commentId: comment._id,
                userId: comment.user._id,
                error: error.message 
              });
              // Fallback to legacy URL if available
              comment.user.profilePic = comment.user.profilePic || null;
            }
          } else if (comment.user && comment.user.profilePic) {
            // Legacy: use existing profilePic if no storage key
            // Keep the existing profilePic value
          }
        }
      }

      return short;
    }));

    // Defensive: filter out shorts without media URLs and add mediaUrl field
    const validShorts = shortsWithProfilePics
      .filter(short => {
        const hasMedia = short.videoUrl || short.imageUrl;
        if (!hasMedia) {
          logger.warn(`User short ${short._id} missing mediaUrl, filtering out`);
        }
        return hasMedia;
      })
      .map(short => ({
        ...short,
        mediaUrl: short.videoUrl || short.imageUrl, // Include virtual field
        user: {
          ...short.user,
          isFollowing: short.isFollowing || false
        }
      }));

    const totalShorts = await Post.countDocuments({ user: userIdObj, isActive: true, type: 'short' });

    return sendSuccess(res, 200, 'User shorts fetched successfully', {
      shorts: validShorts,
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

    // Cache key
    const cacheKey = CacheKeys.userPosts(userId, page, limit);

    // Use cache wrapper with aggregation pipeline
    const result = await cacheWrapper(cacheKey, async () => {
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const currentUserId = req.user ? new mongoose.Types.ObjectId(req.user._id) : null;

      const posts = await Post.aggregate([
        {
          $match: {
            user: userIdObj,
            isActive: true,
            type: 'photo'
          }
        },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
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
              { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
            ]
          }
        },
        {
          $lookup: {
            from: 'songs',
            localField: 'song.songId',
            foreignField: '_id',
            as: 'songData',
            pipeline: [
              { 
                $project: { 
                  title: 1, 
                  artist: 1, 
                  duration: 1, 
                  cloudinaryUrl: 1, 
                  s3Url: 1, 
                  thumbnailUrl: 1, 
                  storageKey: 1,
                  cloudinaryKey: 1,
                  s3Key: 1,
                  _id: 1 
                } 
              },
              {
                $addFields: {
                  s3Url: { $ifNull: ['$cloudinaryUrl', '$s3Url'] } // Use cloudinaryUrl if available, fallback to s3Url
                }
              }
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
            song: {
              $cond: {
                if: { $and: [{ $ne: ['$song.songId', null] }, { $gt: [{ $size: '$songData' }, 0] }] },
                then: {
                  songId: { $arrayElemAt: ['$songData', 0] },
                  startTime: '$song.startTime',
                  endTime: '$song.endTime',
                  volume: '$song.volume'
                },
                else: null
              }
            },
            likesCount: { $size: { $ifNull: ['$likes', []] } },
            commentsCount: { $size: { $ifNull: ['$comments', []] } },
            isLiked: currentUserId ? { $in: [currentUserId, { $ifNull: ['$likes', []] }] } : false
          }
        },
        {
          $project: {
            commentUsers: 0,
            songData: 0
          }
        }
      ]);

      const totalPosts = await Post.countDocuments({ user: userId, isActive: true, type: 'photo' }).lean();

      return { posts, totalPosts };
    }, CACHE_TTL.POST_LIST);

    const { posts, totalPosts } = result;
    
    // Generate signed URLs for profile pictures
    const postsWithProfilePics = await Promise.all(posts.map(async (post) => {
      // Generate signed URL for post author's profile picture
      if (post.user && post.user.profilePicStorageKey) {
        try {
          post.user.profilePic = await generateSignedUrl(post.user.profilePicStorageKey, 'PROFILE');
        } catch (error) {
          logger.warn('Failed to generate profile picture URL for post author:', { 
            postId: post._id, 
            userId: post.user._id,
            error: error.message 
          });
          // Fallback to legacy URL if available
          post.user.profilePic = post.user.profilePic || null;
        }
      } else if (post.user && post.user.profilePic) {
        // Legacy: use existing profilePic if no storage key
        // Keep the existing profilePic value
      }

      // Generate signed URLs for comment users' profile pictures
      if (post.comments && post.comments.length > 0) {
        for (const comment of post.comments) {
          if (comment.user && comment.user.profilePicStorageKey) {
            try {
              comment.user.profilePic = await generateSignedUrl(comment.user.profilePicStorageKey, 'PROFILE');
            } catch (error) {
              logger.warn('Failed to generate profile picture URL for comment user:', { 
                postId: post._id, 
                commentId: comment._id,
                userId: comment.user._id,
                error: error.message 
              });
              // Fallback to legacy URL if available
              comment.user.profilePic = comment.user.profilePic || null;
            }
          } else if (comment.user && comment.user.profilePic) {
            // Legacy: use existing profilePic if no storage key
            // Keep the existing profilePic value
          }
        }
      }

      return post;
    }));

    const postsWithLikeStatus = postsWithProfilePics.map(post => ({
      ...post,
      isLiked: post.isLiked || false
    }));

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
    const post = await Post.findById(req.params.id).lean();
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    // Use findByIdAndUpdate for better performance (single query)
    const update = post.likes.some(like => like.toString() === req.user._id.toString())
      ? { $pull: { likes: req.user._id } }
      : { $addToSet: { likes: req.user._id } };

    const isLiked = !post.likes.some(like => like.toString() === req.user._id.toString());
    
    // Update and get the updated post to get correct likes count
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, update, { new: true });
    const updatedLikesCount = updatedPost ? updatedPost.likes.length : post.likes.length;

    // Create activity for like (respect user's privacy settings)
    if (isLiked) {
      const user = await User.findById(req.user._id).select('settings.privacy.shareActivity').lean();
      const shareActivity = user?.settings?.privacy?.shareActivity !== false; // Default to true if not set
      Activity.createActivity({
        user: req.user._id,
        type: 'post_liked',
        post: req.params.id,
        targetUser: post.user,
        isPublic: shareActivity
      }).catch(err => logger.error('Error creating activity:', err));
    }

    // Invalidate cache
    await deleteCache(CacheKeys.post(req.params.id));
    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(post.user.toString(), 1, 20));

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

          // Send push notification
          await sendNotificationToUser({
            userId: post.user._id.toString(),
            title: 'New Like',
            body: `${req.user.fullName} liked your post`,
            data: {
              type: 'like',
              postId: post._id.toString(), // Frontend expects postId
              entityId: post._id.toString(), // Keep for backward compatibility
              fromUserId: req.user._id.toString(), // Frontend expects fromUserId
              senderId: req.user._id.toString() // Keep for backward compatibility
            }
          }).catch(err => logger.error('Error sending push notification for like:', err));

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
        nsp.emitPostLike(post._id.toString(), isLiked, updatedLikesCount, req.user._id.toString());
        // Also emit the legacy notification event
        nsp.emitEvent('post:liked', [post.user.toString()], { postId: post._id });
      }
    } catch (socketError) {
      logger.error('Socket error:', socketError);
    }

    return sendSuccess(res, 200, isLiked ? 'Post liked' : 'Post unliked', {
      isLiked,
      likesCount: updatedLikesCount
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
    
    // Extract mentions from comment
    const extractedMentions = extractMentions(text || '');
    const mentionUserIds = [];
    if (extractedMentions.length > 0) {
      const mentionedUsers = await User.find({ 
        username: { $in: extractedMentions } 
      }).select('_id').lean();
      mentionUserIds.push(...mentionedUsers.map(u => u._id));
    }
    
    const newComment = post.addComment(req.user._id, text);
    // Add mentions to comment
    if (mentionUserIds.length > 0) {
      const commentIndex = post.comments.length - 1;
      post.comments[commentIndex].mentions = mentionUserIds;
    }
    await post.save();

    // Create activity (respect user's privacy settings)
    const user = await User.findById(req.user._id).select('settings.privacy.shareActivity').lean();
    const shareActivity = user?.settings?.privacy?.shareActivity !== false; // Default to true if not set
    Activity.createActivity({
      user: req.user._id,
      type: 'comment_added',
      post: post._id,
      targetUser: post.user,
      metadata: { commentId: newComment._id },
      isPublic: shareActivity
    }).catch(err => logger.error('Error creating activity:', err));

    // Populate the new comment with user data
    await post.populate('comments.user', 'fullName profilePic');
    const populatedComment = post.comments.id(newComment._id);

    // Create mention notifications for comment
    if (mentionUserIds.length > 0) {
      Promise.all(
        mentionUserIds.map(async (mentionedUserId) => {
          try {
            // Don't notify if user mentioned themselves
            if (mentionedUserId.toString() === req.user._id.toString()) {
              return;
            }
            await Notification.createNotification({
              type: 'post_mention',
              fromUser: req.user._id,
              toUser: mentionedUserId,
              post: post._id,
              comment: newComment._id,
              metadata: { text: text ? text.substring(0, 100) : '' }
            });

            // Send push notification for mention
            await sendNotificationToUser({
              userId: mentionedUserId.toString(),
              title: 'You were mentioned',
              body: `${req.user.fullName} mentioned you in a comment`,
              data: {
                type: 'post_mention',
                postId: post._id.toString(), // Frontend expects postId
                entityId: post._id.toString(), // Keep for backward compatibility
                fromUserId: req.user._id.toString(), // Frontend expects fromUserId
                senderId: req.user._id.toString(), // Keep for backward compatibility
                metadata: { text: text ? text.substring(0, 100) : '' }
              }
            }).catch(err => logger.error(`Error sending push notification for mention to user ${mentionedUserId}:`, err));
          } catch (error) {
            logger.error(`Error creating mention notification for user ${mentionedUserId}:`, error);
          }
        })
      ).catch(err => logger.error('Error creating mention notifications:', err));
    }

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

        // Send push notification
        await sendNotificationToUser({
          userId: post.user._id.toString(),
          title: 'New Comment',
          body: `${req.user.fullName} commented on your post`,
          data: {
            type: 'comment',
            postId: post._id.toString(), // Frontend expects postId
            entityId: post._id.toString(), // Keep for backward compatibility
            fromUserId: req.user._id.toString(), // Frontend expects fromUserId
            senderId: req.user._id.toString() // Keep for backward compatibility
          }
        }).catch(err => logger.error('Error sending push notification for comment:', err));

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

    // Store post data for socket events before deletion
    const postId = post._id;
    const userId = post.user.toString();

    // Invalidate cache before deletion
    await deleteCache(CacheKeys.post(req.params.id));
    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(userId, 1, 20));

    // Cascade delete all related data FIRST (before deleting the post)
    await cascadeDeletePost(postId, post);

    // Hard delete - completely remove the post from database
    await Post.findByIdAndDelete(postId);
    logger.info(`Hard deleted post ${postId} from database`);

    // Emit socket events
    const io = getIO();
    if (io) {
      const nsp = io.of('/app');
      const followers = await getFollowers(userId);
      const audience = [userId, ...followers];
      nsp.emitInvalidateFeed(audience);
      nsp.emitInvalidateProfile(userId);
      nsp.emitEvent('post:deleted', audience, { postId });
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
    const post = await Post.findById(req.params.id).lean();
    
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only edit your own posts');
    }

    // Track old hashtags for decrementing counts
    const oldHashtags = post.tags || [];
    
    // Extract new hashtags if caption provided
    const extractedHashtags = caption ? extractHashtags(caption) : [];
    const updateData = {};
    if (caption) {
      updateData.caption = caption;
      updateData.tags = extractedHashtags;
    }

    // Use findByIdAndUpdate for better performance
    await Post.findByIdAndUpdate(req.params.id, updateData);

    // Invalidate cache
    await deleteCache(CacheKeys.post(req.params.id));
    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(post.user.toString(), 1, 20));

    // Update hashtag counts (decrement old, increment new)
    const newHashtags = extractedHashtags.length > 0 ? extractedHashtags : (post.tags || []);
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

    // Defensive guard: ensure limit is reasonable
    const safeLimit = Math.min(Math.max(limit, 1), 50); // Cap at 50
    const safeSkip = Math.max(skip, 0);

    // Use aggregation pipeline to populate song data efficiently
    const shorts = await Post.aggregate([
      {
        $match: {
          isActive: true,
          type: 'short' // Explicitly filter for shorts only
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1, followers: 1 } }
          ]
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          user: {
            $cond: {
              if: { $eq: ['$user', null] },
              then: {
                fullName: 'Unknown User',
                profilePic: '',
                followers: []
              },
              else: '$user'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'comments.user',
          foreignField: '_id',
          as: 'commentUsers',
          pipeline: [
            { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1 } }
          ]
        }
      },
      {
        $lookup: {
          from: 'songs',
          localField: 'song.songId',
          foreignField: '_id',
          as: 'songData',
          pipeline: [
            { $project: { title: 1, artist: 1, duration: 1, s3Url: 1, thumbnailUrl: 1, _id: 1 } }
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
          song: {
            $cond: {
              if: { $and: [{ $ne: ['$song.songId', null] }, { $gt: [{ $size: '$songData' }, 0] }] },
              then: {
                songId: { $arrayElemAt: ['$songData', 0] },
                startTime: '$song.startTime',
                endTime: '$song.endTime',
                volume: '$song.volume'
              },
              else: null
            }
          },
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          commentsCount: { $size: { $ifNull: ['$comments', []] } },
          viewsCount: { $ifNull: ['$views', 0] }
        }
      },
      {
        $project: {
          commentUsers: 0,
          songData: 0
        }
      }
    ]);

    // Generate signed URLs for profile pictures and add isLiked field
    // Defensive guards: validate media URLs and handle missing data gracefully
    const shortsWithLikeStatus = await Promise.all(shorts.map(async (short) => {
      let isFollowing = false;
      
      // Check if current user is following the post author
      if (req.user && short.user) {
        if (short.user.followers && Array.isArray(short.user.followers)) {
          isFollowing = short.user.followers.some(follower => 
            (typeof follower === 'object' ? follower.toString() : follower) === req.user._id.toString()
          );
        }
      }
      
      // Generate signed URL for short author's profile picture
      if (short.user && short.user.profilePicStorageKey) {
        try {
          short.user.profilePic = await generateSignedUrl(short.user.profilePicStorageKey, 'PROFILE');
        } catch (error) {
          logger.warn('Failed to generate profile picture URL for short author:', { 
            shortId: short._id, 
            userId: short.user._id,
            error: error.message 
          });
          // Fallback to legacy URL if available
          short.user.profilePic = short.user.profilePic || null;
        }
      } else if (short.user && short.user.profilePic) {
        // Legacy: use existing profilePic if no storage key
        // Keep the existing profilePic value
      }
      
      // Generate signed URLs for comment users' profile pictures
      if (short.comments && short.comments.length > 0) {
        for (const comment of short.comments) {
          if (comment.user && comment.user.profilePicStorageKey) {
            try {
              comment.user.profilePic = await generateSignedUrl(comment.user.profilePicStorageKey, 'PROFILE');
            } catch (error) {
              logger.warn('Failed to generate profile picture URL for comment user:', { 
                shortId: short._id, 
                commentId: comment._id,
                userId: comment.user._id,
                error: error.message 
              });
              // Fallback to legacy URL if available
              comment.user.profilePic = comment.user.profilePic || null;
            }
          } else if (comment.user && comment.user.profilePic) {
            // Legacy: use existing profilePic if no storage key
            // Keep the existing profilePic value
          }
        }
      }
      
      // Defensive: ensure mediaUrl exists (required for shorts)
      const mediaUrl = short.videoUrl || short.imageUrl || '';
      if (!mediaUrl) {
        logger.warn(`Short ${short._id} missing mediaUrl, skipping`);
        return null; // Filter out shorts without media
      }
      
      return {
        ...short,
        _id: short._id,
        mediaUrl, // Include virtual field with validation
        isLiked: req.user ? (short.likes || []).some(like => 
          (typeof like === 'object' ? like.toString() : like) === req.user._id.toString()
        ) : false,
        likesCount: short.likesCount || 0,
        commentsCount: short.commentsCount || 0,
        viewsCount: short.viewsCount || 0,
        user: {
          ...short.user,
          isFollowing
        }
      };
    }));

    // Filter out null entries (shorts without media)
    const validShorts = shortsWithLikeStatus.filter(short => short !== null);

    const totalShorts = await Post.countDocuments({ isActive: true, type: 'short' });
    const totalPages = Math.ceil(totalShorts / safeLimit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      shorts: validShorts,
      pagination: {
        currentPage: page,
        totalPages,
        totalShorts,
        hasNextPage,
        hasPrevPage,
        limit: safeLimit
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

    // Defensive guard: ensure this is a short creation request
    // (Backend already validates type='short' in Post model, but explicit check here for clarity)
    
    // req.files.video[0] if fields upload; req.file if single
    const videoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) || req.file;
    const imageFile = (req.files && Array.isArray(req.files.image) && req.files.image[0]) || null;

    if (!videoFile) {
      logger.debug('No file uploaded');
      return sendError(res, 'FILE_4001', 'Please upload a video');
    }

    // Defensive: validate video file buffer exists
    if (!videoFile.buffer || videoFile.buffer.length === 0) {
      logger.error('Video file buffer is empty or missing');
      return sendError(res, 'FILE_4002', 'Invalid video file. Please try uploading again.');
    }

    const { caption, address, latitude, longitude, tags, songId, songStartTime, songVolume, spotType, travelInfo, audioSource, copyrightAccepted, copyrightAcceptedAt } = req.body;
    
    // Copyright validation for shorts
    // If audioSource is 'user_original', copyrightAccepted MUST be true and copyrightAcceptedAt MUST be present
    if (audioSource === 'user_original') {
      if (copyrightAccepted !== true && copyrightAccepted !== 'true') {
        logger.warn('Copyright validation failed: user_original requires copyrightAccepted=true', {
          userId: req.user._id,
          audioSource,
          copyrightAccepted
        });
        return sendError(res, 'VAL_2001', 'Copyright confirmation is required for user-uploaded audio. Please confirm you have rights to use the audio.');
      }
      if (!copyrightAcceptedAt) {
        logger.warn('Copyright validation failed: user_original requires copyrightAcceptedAt timestamp', {
          userId: req.user._id,
          audioSource
        });
        return sendError(res, 'VAL_2001', 'Copyright acceptance timestamp is required for user-uploaded audio.');
      }
    }
    
    // Auto-set copyright fields for taatom_library
    let finalCopyrightAccepted = copyrightAccepted;
    let finalCopyrightAcceptedAt = copyrightAcceptedAt;
    if (audioSource === 'taatom_library') {
      finalCopyrightAccepted = true;
      finalCopyrightAcceptedAt = new Date();
    }

    // Upload video to Sevalla Object Storage
    const extension = videoFile.originalname.split('.').pop() || 'mp4';
    const videoStorageKey = buildMediaKey({
      type: 'short',
      userId: req.user._id.toString(),
      filename: videoFile.originalname,
      extension
    });
    
    let videoUploadResult;
    try {
      videoUploadResult = await uploadObject(videoFile.buffer, videoStorageKey, videoFile.mimetype);
      
      // Defensive: validate upload result has URL
      if (!videoUploadResult || !videoUploadResult.url) {
        logger.error('Video upload succeeded but no URL returned');
        return sendError(res, 'FILE_4005', 'Video upload completed but URL is missing. Please try again.');
      }
    } catch (uploadErr) {
      logger.error('Storage upload error:', uploadErr);
      return sendError(res, 'FILE_4004', uploadErr.message || 'Video upload failed. Please try again.');
    }

    // Note: Video duration validation would require video processing library
    // For now, we'll skip duration validation during upload
    // Duration can be validated client-side or via a background job

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
    // If user provided a custom thumbnail image, upload it
    let thumbnailUrl = '';
    let thumbnailStorageKey = null;
    if (imageFile) {
      try {
        const thumbExtension = imageFile.originalname.split('.').pop() || 'jpg';
        thumbnailStorageKey = buildMediaKey({
          type: 'short',
          userId: req.user._id.toString(),
          filename: `thumb_${imageFile.originalname}`,
          extension: thumbExtension
        });
        const thumbResult = await uploadObject(imageFile.buffer, thumbnailStorageKey, imageFile.mimetype);
        thumbnailUrl = thumbResult.url;
      } catch (imgErr) {
        logger.error('Thumbnail image upload failed:', imgErr);
        // Use video URL as fallback thumbnail
        thumbnailUrl = videoUploadResult.url;
      }
    } else {
      // Use video URL as thumbnail if no custom thumbnail provided
      thumbnailUrl = videoUploadResult.url;
    }
    
    const short = new Post({
      user: req.user._id,
      caption,
      imageUrl: thumbnailUrl || '', // Backward compatibility - thumbnail stored here too
      thumbnailUrl: thumbnailUrl || '', // New field for clarity - thumbnail for shorts
      videoUrl: videoUploadResult.url, // Video URL goes here
      storageKey: videoStorageKey, // Primary storage key for video
      cloudinaryPublicId: videoStorageKey, // Backward compatibility
      tags: allHashtags,
      type: 'short',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      },
      // CRITICAL: Dual-audio mixing support (same as posts)
      // When songId is provided, backend should mix:
      // - Original video audio at 0.6 volume (60%)
      // - Background music at songVolume (typically 1.0 = 100%)
      // This preserves both audio tracks instead of replacing video audio
      song: songId ? {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        endTime: songEndTime ? parseFloat(songEndTime) : null,
        volume: parseFloat(songVolume) || 1.0 // Music at full volume, video will be at 0.6
      } : undefined,
      // TripScore metadata from user dropdowns
      spotType: spotType || null,
      travelInfo: travelInfo || null,
      // Copyright compliance fields
      audioSource: audioSource || null,
      copyrightAccepted: finalCopyrightAccepted,
      copyrightAcceptedAt: finalCopyrightAcceptedAt ? new Date(finalCopyrightAcceptedAt) : null,
      status: 'active'
    });

    await short.save();

    // Create TripVisit for TripScore v2 (non-blocking)
    try {
      const { createTripVisitFromShort } = require('../services/tripVisitService');
      const metadata = {
        source: req.body.source || 'manual_only',
        hasExifGps: req.body.hasExifGps === 'true' || req.body.hasExifGps === true,
        takenAt: req.body.takenAt ? new Date(req.body.takenAt) : null,
        fromCamera: req.body.fromCamera === 'true' || req.body.fromCamera === true
      };
      await createTripVisitFromShort(short, metadata).catch(err => 
        logger.warn('Failed to create TripVisit for short:', err)
      );
    } catch (tripVisitError) {
      logger.warn('TripVisit creation failed (non-critical):', tripVisitError);
      // Don't fail short creation if TripVisit fails
    }

    // Increment song usage count if song is attached
    if (songId) {
      try {
        const Song = require('../models/Song');
        await Song.findByIdAndUpdate(songId, { $inc: { usageCount: 1 } });
      } catch (songError) {
        logger.error('Error incrementing song usage count:', songError);
        // Don't fail short creation if song update fails
      }
    }

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
    if (videoUploadResult && videoStorageKey) {
      deleteObject(videoStorageKey).catch(err => 
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

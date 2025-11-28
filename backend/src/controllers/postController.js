const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Activity = require('../models/Activity');
const Hashtag = require('../models/Hashtag');
const { uploadImage, deleteImage, getOptimizedImageUrl, getVideoThumbnailUrl, cloudinary } = require('../config/cloudinary');
const { getFollowers } = require('../utils/socketBus');
const { getIO } = require('../socket');
const logger = require('../utils/logger');
const { extractHashtags } = require('../utils/hashtagExtractor');
const { extractMentions } = require('../utils/mentionExtractor');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const { cacheWrapper, CacheKeys, CACHE_TTL, deleteCache, deleteCacheByPattern } = require('../utils/cache');

// @desc    Get all posts (only photo type)
// @route   GET /posts
// @access  Public
const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
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
              { $project: { fullName: 1, profilePic: 1 } }
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
              { $project: { fullName: 1, profilePic: 1 } }
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

      return { posts, totalPosts };
    }, CACHE_TTL.POST_LIST);

    const { posts, totalPosts } = result;

    // Add isLiked field if user is authenticated and optimize image URLs
    const userId = req.user?._id?.toString();
    const postsWithLikeStatus = posts.map(post => {
      // Generate optimized image URL with WebP format for better performance
      let optimizedImageUrl = post.imageUrl;
      if (post.imageUrl && post.imageUrl.includes('cloudinary.com')) {
        try {
          // Extract public ID from Cloudinary URL
          const urlParts = post.imageUrl.split('/');
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split('.')[0];
          
          // Generate optimized URL with WebP format and progressive loading
          optimizedImageUrl = getOptimizedImageUrl(`taatom/posts/${publicId}`, {
            width: 800,
            height: 800,
            quality: 'auto:good',
            format: 'auto', // Cloudinary auto-detects WebP support
            flags: 'progressive' // Progressive JPEG loading
          });
        } catch (error) {
          logger.warn('Failed to optimize image URL:', error);
          // Keep original URL as fallback
        }
      }

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
            console.log(msg);
          } else {
            const msg = `[VIEW TRACKING] Post ${id} - User ${userId} viewing own post (owner: ${postOwnerId}), skipping view increment`;
            logger.info(msg);
            console.log(msg);
          }
        } else {
          // Anonymous user - allow view increment
          shouldIncrementViews = true;
          const msg = `[VIEW TRACKING] Post ${id} - Anonymous user viewing post, will increment views`;
          logger.info(msg);
          console.log(msg);
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
        console.log(incrementMsg);
        
        const updateResult = await Post.findOneAndUpdate(
          { _id: id },
          { $inc: { views: 1 } },
          { new: true, projection: { views: 1 }, lean: true }
        );
        
        if (updateResult && updateResult.views !== undefined && updateResult.views !== null) {
          incrementedViews = updateResult.views;
          const successMsg = `[VIEW TRACKING] Post ${id} views incremented to ${incrementedViews}`;
          logger.info(successMsg);
          console.log(successMsg);
          
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
              { $project: { fullName: 1, profilePic: 1 } }
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
    console.log(finalMsg);

    // Generate optimized image URL with WebP and progressive loading
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
          format: 'auto', // Auto WebP when supported
          flags: 'progressive' // Progressive loading
        });
      } catch (error) {
        logger.warn('Failed to optimize image URL:', error);
      }
    }

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

    // Handle both single file and multiple files
    const files = req.files ? req.files.images : (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      return sendError(res, 'FILE_4001', 'Please upload at least one image');
    }

    if (files.length > 10) {
      return sendError(res, 'BIZ_7003', 'Maximum 10 images are allowed');
    }

    const { caption, address, latitude, longitude, tags, songId, songStartTime, songEndTime, songVolume } = req.body;

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

    // Create post with multiple images
    const post = new Post({
      user: req.user._id,
      caption,
      imageUrl: imageUrls[0], // Keep first image as primary for backward compatibility
      images: imageUrls, // Store all images
      cloudinaryPublicIds: cloudinaryPublicIds,
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
      song: songId ? {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        endTime: songEndTime ? parseFloat(songEndTime) : null,
        volume: parseFloat(songVolume) || 0.5
      } : undefined
    });

    await post.save();

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

    // Use aggregation pipeline to avoid N+1 queries
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const currentUserId = req.user ? new mongoose.Types.ObjectId(req.user._id) : null;
    
    const shorts = await Post.aggregate([
      {
        $match: {
          user: userIdObj,
          isActive: true,
          type: 'short'
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
            { 
              $project: { 
                fullName: 1, 
                profilePic: 1,
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

    const shortsWithLikeStatus = shorts.map(short => ({
      ...short,
      user: {
        ...short.user,
        isFollowing: short.isFollowing || false
      }
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
              { $project: { fullName: 1, profilePic: 1 } }
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
    const postsWithLikeStatus = posts.map(post => ({
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
    
    await Post.findByIdAndUpdate(req.params.id, update, { new: true });

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
    const post = await Post.findById(req.params.id).lean();
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    // Invalidate cache before deletion
    await deleteCache(CacheKeys.post(req.params.id));
    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(post.user.toString(), 1, 20));

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

    // Use aggregation pipeline to populate song data efficiently
    const shorts = await Post.aggregate([
      {
        $match: {
          isActive: true,
          type: 'short'
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
            { $project: { fullName: 1, profilePic: 1, followers: 1 } }
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
            { $project: { fullName: 1, profilePic: 1 } }
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

    // Add isLiked field if user is authenticated and include virtual fields
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
      
      return {
        ...short,
        _id: short._id,
        mediaUrl: short.videoUrl || short.imageUrl, // Include virtual field
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

    const { caption, address, latitude, longitude, tags, songId, songStartTime, songVolume } = req.body;

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

    // Validate video duration (max 60 minutes = 3600 seconds)
    const MAX_VIDEO_DURATION = 60 * 60; // 60 minutes in seconds
    if (cloudinaryResult.duration && cloudinaryResult.duration > MAX_VIDEO_DURATION) {
      // Delete the uploaded video from Cloudinary
      try {
        await cloudinary.uploader.destroy(cloudinaryResult.public_id, { resource_type: 'video' });
      } catch (deleteErr) {
        logger.error('Error deleting video from Cloudinary:', deleteErr);
      }
      return sendError(res, 'FILE_4005', `Video duration exceeds the maximum limit of 60 minutes. Your video is ${Math.round(cloudinaryResult.duration / 60)} minutes.`);
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
      },
      song: songId ? {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        endTime: songEndTime ? parseFloat(songEndTime) : null,
        volume: parseFloat(songVolume) || 0.5
      } : undefined
    });

    await short.save();

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

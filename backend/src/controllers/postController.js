const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const UserInteraction = require('../models/UserInteraction');
const Activity = require('../models/Activity');
const Hashtag = require('../models/Hashtag');
const { getOptimizedImageUrl } = require('../config/cloudinary');
const { buildMediaKey, uploadObject, deleteObject } = require('../services/storage');
const { generateSignedUrl, generateSignedUrls, resolveProfilePic, resolveSong } = require('../services/mediaService');
const { getFollowers } = require('../utils/socketBus');
const { getIO } = require('../socket');
const logger = require('../utils/logger');
const { extractHashtags } = require('../utils/hashtagExtractor');
const { extractMentions } = require('../utils/mentionExtractor');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const { cacheWrapper, CacheKeys, CACHE_TTL, deleteCache, deleteCacheByPattern } = require('../utils/cache');
const { cascadeDeletePost } = require('../utils/cascadeDelete');
const { sendNotificationToUser } = require('../utils/sendNotification');
const { startTranscodeWorker } = require('../services/videoTranscode');

// Start MongoDB-backed transcoding worker
startTranscodeWorker();

const getVideoUrlForShort = (short, req) => {
  if (short && short.storageKey && short.storageKey.endsWith('index.m3u8')) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/api/v1/shorts?hls=master&postId=${short._id}&ext=.m3u8`;
  }
  return null;
};

const handleHLSProxy = async (req, res) => {
  const { hls, postId, file } = req.query;
  
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ error: 'Invalid or missing postId' });
  }

  // Fetch the post to verify it exists and is active
  const post = await Post.findById(postId).lean();
  if (!post || post.type !== 'short') {
    return res.status(404).json({ error: 'Short not found' });
  }

  if (post.status !== 'active') {
    return res.status(403).json({ error: 'Video is still processing or failed' });
  }

  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { s3Client, BUCKET_NAME } = require('../services/storage');

  if (hls === 'master') {
    const s3Key = `shorts/hls/${postId}/index.m3u8`;
    try {
      const s3Response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }));

      const streamToString = (stream) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        });

      const m3u8Content = await streamToString(s3Response.Body);
      
      // Replace relative segments with absolute proxy endpoint URLs
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const lines = m3u8Content.split('\n');
      const mappedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.endsWith('.ts') && !trimmed.startsWith('http')) {
          return `${baseUrl}/api/v1/shorts?hls=segment&postId=${postId}&file=${trimmed}`;
        }
        return line;
      });

      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache playlist for 1 hour
      return res.status(200).send(mappedLines.join('\n'));
    } catch (err) {
      logger.error(`[HLS Proxy] Master playlist error for post ${postId}:`, err);
      return res.status(404).json({ error: 'Master playlist not found' });
    }
  } else if (hls === 'segment') {
    if (!file || !file.endsWith('.ts')) {
      return res.status(400).json({ error: 'Invalid or missing file parameter' });
    }

    const s3Key = `shorts/hls/${postId}/${file}`;
    try {
      const s3Response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      }));

      res.setHeader('Content-Type', 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache segment for 24 hours
      s3Response.Body.pipe(res);
    } catch (err) {
      logger.error(`[HLS Proxy] Segment error for post ${postId}, file ${file}:`, err);
      return res.status(404).json({ error: 'Segment not found' });
    }
  } else {
    return res.status(400).json({ error: 'Invalid hls parameter' });
  }
};

/**
 * Get user IDs whose posts the viewer is allowed to see in the feed.
 * - Anonymous: only authors with profileVisibility === 'public'
 * - Logged in: self + public authors + authors with 'followers'/'private' who have viewer in their followers
 */
async function getAllowedPostAuthorIds(viewerId) {
  const publicQuery = {
    $or: [
      { 'settings.privacy.profileVisibility': 'public' },
      { 'settings.privacy.profileVisibility': { $exists: false } },
      { 'settings.privacy': { $exists: false } },
      { 'settings': { $exists: false } }
    ]
  };

  if (!viewerId) {
    const users = await User.find(publicQuery).select('_id').lean();
    return users.map(u => u._id);
  }
  const viewerObjId = mongoose.Types.ObjectId.isValid(viewerId) ? new mongoose.Types.ObjectId(viewerId) : null;
  if (!viewerObjId) return [];

  const publicUsers = await User.find(publicQuery).select('_id').lean();
  const publicIds = publicUsers.map(u => u._id);

  const restrictedAuthors = await User.find({
    'settings.privacy.profileVisibility': { $in: ['followers', 'private'] },
    followers: viewerObjId
  }).select('_id').lean();
  const restrictedIds = restrictedAuthors.map(u => u._id);

  const allowed = [viewerObjId, ...publicIds, ...restrictedIds];
  const seen = new Set();
  return allowed.filter(id => {
    const key = id.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// @desc    Get all posts (only photo type)
// @route   GET /posts
// @access  Public
// @query   feed=recents|friends|popular (optional; recents = newest first, friends = from people you follow, popular = by likes)
const getPosts = async (req, res) => {
  try {
    // Defensive guards: validate and cap pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 50); // Cap at 50
    const skip = Math.max(0, (page - 1) * limit);
    const cursor = req.query.cursor; // Cursor for cursor-based pagination
    const useCursor = req.query.useCursor === 'true'; // Enable cursor-based pagination
    const feedMode = ['recents', 'friends', 'popular'].includes(req.query.feed) ? req.query.feed : 'recents';

    const viewerId = req.user?._id?.toString();
    const cacheKey = CacheKeys.postList(page, limit, { type: 'photo', cursor, viewerId: viewerId || 'anon', feed: feedMode });

    const result = await cacheWrapper(cacheKey, async () => {
      let allowedAuthorIds = await getAllowedPostAuthorIds(viewerId);
      const blockedIds = req.user?.blockedUsers?.length
        ? req.user.blockedUsers.map(b => (typeof b === 'object' && b?._id ? b._id.toString() : b.toString()))
        : [];
      let allowedFiltered = blockedIds.length
        ? allowedAuthorIds.filter(id => !blockedIds.includes(id.toString()))
        : allowedAuthorIds;

      // Friends feed: only posts from users the viewer follows
      if (feedMode === 'friends' && viewerId) {
        const viewer = await User.findById(viewerId).select('following').lean();
        const followingIds = (viewer?.following || []).map(id => (id && (id._id || id)).toString()).filter(Boolean);
        const followingObjIds = followingIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));
        if (followingObjIds.length > 0) {
          const allowedSet = new Set(allowedFiltered.map(id => id.toString()));
          allowedFiltered = followingObjIds.filter(id => allowedSet.has(id.toString()));
        } else {
          allowedFiltered = [];
        }
      }

      const matchQuery = {
        isActive: true,
        isArchived: { $ne: true },
        isHidden: { $ne: true },
        type: 'photo',
        $or: [{ status: 'active' }, { status: { $exists: false } }]
      };
      if (allowedFiltered.length > 0) {
        matchQuery.user = { $in: allowedFiltered };
      } else {
        matchQuery.user = { $in: [new mongoose.Types.ObjectId()] };
      }

      // Add cursor-based filtering if cursor is provided
      if (useCursor && cursor) {
        try {
          const cursorDate = new Date(cursor);
          matchQuery.createdAt = { $lt: cursorDate };
        } catch (e) {
          logger.warn('Invalid cursor provided, using offset pagination');
        }
      }

      // For popular sort we need likesCount before $sort
      const addLikesCountStage = { $addFields: { likesCount: { $size: { $ifNull: ['$likes', []] } } } };
      const sortStage = feedMode === 'popular'
        ? { $sort: { likesCount: -1, createdAt: -1 } }
        : { $sort: { createdAt: -1 } };

      // Use aggregation pipeline for better performance (single query instead of populate)
      const posts = await Post.aggregate([
        { $match: matchQuery },
        ...(feedMode === 'popular' ? [addLikesCountStage] : []),
        sortStage,
        ...(useCursor && cursor ? [] : [{ $skip: skip }]), // Skip only for offset pagination
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              { $project: { fullName: 1, profilePic: 1, profilePicStorageKey: 1, 'settings.privacy.showLocation': 1 } }
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
                input: { $ifNull: ['$comments', []] },
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

      // Use the same matchQuery so the count reflects the actual filtered feed
      // (e.g. friends-only posts, not all posts in the database)
      const totalPosts = await Post.countDocuments(matchQuery).lean();

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
        // Generate song URL if present
        if (post.song?.songId) {
          const storageKey = post.song.songId.storageKey || post.song.songId.cloudinaryKey || post.song.songId.s3Key;
          if (storageKey) {
            try {
              const songUrl = await generateSignedUrl(storageKey, 'AUDIO');
              post.song.songId.s3Url = songUrl || post.song.songId.s3Url || post.song.songId.cloudinaryUrl;
              post.song.songId.cloudinaryUrl = songUrl || post.song.songId.cloudinaryUrl || post.song.songId.s3Url;
            } catch (error) {
              logger.warn('Failed to generate URL for song in post:', {
                postId: post._id,
                songId: post.song.songId._id,
                storageKey,
                error: error.message
              });
              // Do not set to null, keep existing URLs as fallback
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
    // Disabled in getPostById to support the client-side "2-Second Rule" and prevent double-counting.
    // View increments now happen exclusively via the POST /analytics/events ('post_view' event) pathway.
    let incrementedViews = null;

    // NOW: Use cache wrapper with aggregation pipeline to avoid N+1 queries
    const post = await cacheWrapper(cacheKey, async () => {
      // Use aggregation pipeline to fetch post with user and follow status in single query
      const posts = await Post.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(id),
            isActive: true,
            $or: [{ status: 'active' }, { status: { $exists: false } }] // Hide flagged/removed
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
                  username: 1,
                  profilePic: 1,
                  profilePicStorageKey: 1,
                  followers: 1, // Include followers for follow status check
                  'settings.privacy.showLocation': 1,
                  'settings.privacy.profileVisibility': 1
                }
              }
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
                  followers: [],
                  settings: { privacy: { profileVisibility: 'public' } }
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
                input: { $ifNull: ['$comments', []] },
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

    // Privacy check: ensure viewer is allowed to see this post based on author's profileVisibility
    const postAuthorId = post.user?._id?.toString();
    const visibility = post.user?.settings?.privacy?.profileVisibility || 'public';
    if (visibility !== 'public' && postAuthorId !== userId) {
      const viewerObjId = userId ? new mongoose.Types.ObjectId(userId) : null;
      
      // Fetch fresh author data for followers check to avoid cache staleness
      const freshAuthor = await User.findById(postAuthorId).select('followers').lean();
      const authorFollowers = (freshAuthor?.followers || []).map(f => f.toString());
      const isFollower = viewerObjId ? authorFollowers.includes(viewerObjId.toString()) : false;

      if (visibility === 'followers' && !isFollower) {
        return sendError(res, 'AUTH_1006', 'This post is not available');
      }
      if (visibility === 'private' && !isFollower) {
        return sendError(res, 'AUTH_1006', 'This post is not available');
      }
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

    // Generate song URL if present (same logic as getPosts)
    if (post.song?.songId) {
      const storageKey = post.song.songId.storageKey || post.song.songId.cloudinaryKey || post.song.songId.s3Key;
      if (storageKey) {
        try {
          const songUrl = await generateSignedUrl(storageKey, 'AUDIO');
          post.song.songId.s3Url = songUrl || post.song.songId.s3Url || post.song.songId.cloudinaryUrl;
          post.song.songId.cloudinaryUrl = songUrl || post.song.songId.cloudinaryUrl || post.song.songId.s3Url;
        } catch (error) {
          logger.warn('Failed to generate URL for song in post:', { 
            postId: post._id, 
            songId: post.song.songId._id, 
            storageKey,
            error: error.message 
          });
          // Do not set to null, keep existing URLs as fallback
        }
      }
    }

    // CRITICAL: Generate fresh signed URL for video if post is a short (videos expire after 15 minutes)
    if (post.type === 'short') {
      const hlsProxyUrl = getVideoUrlForShort(post, req);
      if (hlsProxyUrl) {
        post.videoUrl = hlsProxyUrl;
        const thumbKey = (post.storageKeys || []).find(k => k && (k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.png')));
        if (thumbKey) {
          try {
            const freshImageUrl = await generateSignedUrl(thumbKey, 'IMAGE');
            if (freshImageUrl) {
              post.imageUrl = freshImageUrl;
            }
          } catch (error) {
            logger.warn(`Failed to generate signed URL for HLS short thumbnail ${post._id}:`, error.message);
          }
        }
      } else if (post.storageKey) {
        try {
          const freshVideoUrl = await generateSignedUrl(post.storageKey, 'VIDEO');
          post.videoUrl = freshVideoUrl;
          // Also generate thumbnail URL
          if (post.storageKeys && post.storageKeys.length > 1) {
            post.imageUrl = await generateSignedUrl(post.storageKeys[1], 'IMAGE');
          } else {
            post.imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
          }
          logger.debug(`Generated fresh signed URLs for short ${post._id}`);
        } catch (error) {
          logger.warn(`Failed to generate signed URL for short ${post._id}:`, error.message);
          // Fallback to stored URLs if generation fails
          post.videoUrl = post.videoUrl || post.imageUrl || null;
        }
      } else if (post.storageKeys && post.storageKeys.length > 0) {
        try {
          post.videoUrl = await generateSignedUrl(post.storageKeys[0], 'VIDEO');
          if (post.storageKeys.length > 1) {
            post.imageUrl = await generateSignedUrl(post.storageKeys[1], 'IMAGE');
          } else {
            post.imageUrl = await generateSignedUrl(post.storageKeys[0], 'IMAGE');
          }
          logger.debug(`Generated fresh signed URLs from storageKeys for short ${post._id}`);
        } catch (error) {
          logger.warn(`Failed to generate signed URL from storageKeys for short ${post._id}:`, error.message);
          post.videoUrl = post.videoUrl || post.imageUrl || null;
        }
      }
      // Set mediaUrl for shorts (virtual field)
      post.mediaUrl = post.videoUrl || post.imageUrl || null;
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

    const postOwnerId = post.user?._id?.toString();
    const hideLocation = postOwnerId !== userId && post.user?.settings?.privacy?.showLocation === false;
    const postWithDetails = {
      ...post,
      imageUrl: optimizedImageUrl,
      isLiked,
      viewsCount: finalViewsCount, // Always include views count
      views: finalViewsCount, // Also include views field for consistency
      location: hideLocation ? null : post.location,
      detectedPlace: hideLocation ? null : post.detectedPlace,
      // likesCount and commentsCount already added by aggregation
      user: {
        ...post.user,
        isFollowing,
        followers: undefined, // Remove followers array from response (not needed)
        settings: undefined  // Remove settings from response
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

    const { 
      caption, 
      address, 
      latitude, 
      longitude, 
      tags,
      songId,
      songStartTime,
      songEndTime,
      songVolume,
      spotType,
      travelInfo,
      aspectRatio,
      filter,
      // Detected place data from Google Maps API
      detectedPlaceName,
      detectedPlaceCountry,
      detectedPlaceCountryCode,
      detectedPlaceCity,
      detectedPlaceStateProvince,
      detectedPlaceLatitude,
      detectedPlaceLongitude,
      detectedPlacePlaceId,
      detectedPlaceFormattedAddress
    } = req.body;

    // Debug: Log detected place data to verify it's being received
    if (detectedPlaceName || detectedPlaceCountry || detectedPlaceCity) {
      logger.debug('Detected place data received:', {
        name: detectedPlaceName,
        country: detectedPlaceCountry,
        countryCode: detectedPlaceCountryCode,
        city: detectedPlaceCity,
        stateProvince: detectedPlaceStateProvince,
        latitude: detectedPlaceLatitude,
        longitude: detectedPlaceLongitude,
        placeId: detectedPlacePlaceId,
        formattedAddress: detectedPlaceFormattedAddress
      });
    }

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
      aspectRatio: ['16:9', 'full', '1.91:1', '1:1'].includes(aspectRatio) ? aspectRatio : '1:1',
      filter: ['vivid', 'warm', 'cool', 'bw'].includes(filter) ? filter : 'original',
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
      travelInfo: travelInfo || null,
      // Detected place data for admin review (from Google Maps API)
      // Check if any detected place field exists (handle empty strings from FormData)
      detectedPlace: (detectedPlaceName || detectedPlaceCountry || detectedPlaceCity ||
                     detectedPlaceCountryCode || detectedPlaceStateProvince ||
                     detectedPlaceLatitude || detectedPlaceLongitude ||
                     detectedPlacePlaceId || detectedPlaceFormattedAddress) ? {
        name: (detectedPlaceName && detectedPlaceName.trim()) || null,
        country: (detectedPlaceCountry && detectedPlaceCountry.trim()) || null,
        countryCode: (detectedPlaceCountryCode && detectedPlaceCountryCode.trim()) || null,
        city: (detectedPlaceCity && detectedPlaceCity.trim()) || null,
        stateProvince: (detectedPlaceStateProvince && detectedPlaceStateProvince.trim()) || null,
        latitude: (detectedPlaceLatitude && detectedPlaceLatitude.toString().trim() && !isNaN(parseFloat(detectedPlaceLatitude))) ? parseFloat(detectedPlaceLatitude) : null,
        longitude: (detectedPlaceLongitude && detectedPlaceLongitude.toString().trim() && !isNaN(parseFloat(detectedPlaceLongitude))) ? parseFloat(detectedPlaceLongitude) : null,
        placeId: (detectedPlacePlaceId && detectedPlacePlaceId.trim()) || null,
        formattedAddress: (detectedPlaceFormattedAddress && detectedPlaceFormattedAddress.trim()) || null
      } : undefined
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

    // Auto-attach post to active journey as waypoint (non-blocking)
    try {
      const Journey = require('../models/Journey');
      const postLat = post.location?.coordinates?.latitude || parseFloat(req.body.latitude);
      const postLng = post.location?.coordinates?.longitude || parseFloat(req.body.longitude);
      if (req.user && postLat && postLng && !isNaN(postLat) && !isNaN(postLng)) {
        const activeJourney = await Journey.findOne({
          user: req.user._id,
          status: { $in: ['active', 'paused'] }
        });
        if (activeJourney) {
          activeJourney.waypoints.push({
            post: post._id,
            lat: postLat,
            lng: postLng,
            timestamp: new Date(),
            contentType: 'photo'
          });
          await activeJourney.save();
          logger.info(`Auto-attached post ${post._id} to journey ${activeJourney._id}`);
        }
      }
    } catch (journeyError) {
      logger.warn('Failed to attach post to journey (non-critical):', journeyError);
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
    
const cursor = req.query.cursor || (req.query.page && isNaN(Number(req.query.page)) ? req.query.page : null);
    const limit = parseInt(req.query.limit) || 20;

    // Defensive guard: ensure limit is reasonable
    const safeLimit = Math.min(Math.max(limit, 1), 50); // Cap at 50

    // Check if user exists and get privacy settings
    const user = await User.findById(userId).select('fullName profilePic settings.privacy.profileVisibility followers following');
    if (!user) {
      return sendError(res, 'RES_3002', 'User not found');
    }

    // Check privacy settings for "followers only" profile
    const profileVisibility = user.settings?.privacy?.profileVisibility || 'public';
    const isOwnProfile = req.user ? req.user._id.toString() === userId : false;

    // For "followers only" profiles, requester must be in profile owner's followers list
    if (!isOwnProfile && profileVisibility === 'followers') {
      const isFollowing = req.user && user.followers ?
        user.followers.some(follower => {
          const followerId = typeof follower === 'object' && follower._id ? follower._id.toString() : follower.toString();
          return followerId === req.user._id.toString();
        }) :
        false;

      if (!isFollowing) {
        return sendSuccess(res, 200, 'Shorts fetched successfully', {
          shorts: [],
          totalShorts: 0,
          nextCursor: null,
          hasNextPage: false
        });
      }
    }

    // For "private" profiles, requester must be in profile owner's following list
    // (i.e. the profile owner follows the viewer) — matches getProfile/getTravelMapData.
    if (!isOwnProfile && profileVisibility === 'private') {
      const isFollowedBy = req.user && user.following ?
        user.following.some(following => {
          const followingId = typeof following === 'object' && following._id ? following._id.toString() : following.toString();
          return followingId === req.user._id.toString();
        }) :
        false;

      if (!isFollowedBy) {
        return sendSuccess(res, 200, 'Shorts fetched successfully', {
          shorts: [],
          totalShorts: 0,
          nextCursor: null,
          hasNextPage: false
        });
      }
    }

    // Use aggregation pipeline to avoid N+1 queries
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const currentUserId = req.user ? new mongoose.Types.ObjectId(req.user._id) : null;
    
    let cursorFilter = {};
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('ascii');
        const [createdAtStr, idStr] = decoded.split(',');
        if (createdAtStr && idStr && mongoose.Types.ObjectId.isValid(idStr)) {
          const cursorDate = new Date(parseInt(createdAtStr));
          const cursorId = new mongoose.Types.ObjectId(idStr);
          cursorFilter = {
            $or: [
              { createdAt: { $lt: cursorDate } },
              { createdAt: cursorDate, _id: { $lt: cursorId } }
            ]
          };
        }
      } catch (err) {
        logger.warn('Failed to parse cursor, using empty filter:', err);
      }
    }

    const matchQuery = {
      user: userIdObj,
      isActive: true,
      // Same rule as getUserPosts: hidden / archived shorts must not appear
      // on the profile for anyone, including the owner. They live in
      // Settings → Manage Posts.
      isHidden: { $ne: true },
      isArchived: { $ne: true },
      type: 'short',
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] }
      ]
    };
    if (cursorFilter.$or) {
      matchQuery.$and.push({ $or: cursorFilter.$or });
    }

    const shorts = await Post.aggregate([
      {
        $match: matchQuery
      },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: safeLimit + 1 },
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
                  username: 1,
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
            { $project: { fullName: 1, username: 1, profilePic: 1, profilePicStorageKey: 1 } }
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
                imageUrl: 1,
                imageStorageKey: 1,
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
              input: { $ifNull: ['$comments', []] },
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
          viewsCount: { $ifNull: ['$views', 0] },
          isLiked: currentUserId ? { $in: [currentUserId, { $ifNull: ['$likes', []] }] } : false,
          isFollowing: currentUserId && { $in: [currentUserId, { $ifNull: ['$user.followers', []] }] } || false
        }
      },
      {
        $project: {
          commentUsers: 0,
          songData: 0,
          'user.followers': 0 // Remove followers array from response
          // Note: All other fields are included by default (storageKey, storageKeys, videoUrl, imageUrl, thumbnailUrl, etc.)
        }
      }
    ]);

    // Generate signed URLs for profile pictures and short thumbnails
    const shortsWithProfilePics = await Promise.all(shorts.map(async (short) => {
      if (short.user) {
        short.user.profilePic = await resolveProfilePic(short.user);
      }

      // Generate signed URL for song if present (same logic as getShorts)
      if (short.song?.songId) {
        const storageKey = short.song.songId.storageKey || short.song.songId.cloudinaryKey || short.song.songId.s3Key;
        if (storageKey) {
          try {
            const songUrl = await generateSignedUrl(storageKey, 'AUDIO');
            short.song.songId.s3Url = songUrl || short.song.songId.s3Url || short.song.songId.cloudinaryUrl;
            short.song.songId.cloudinaryUrl = songUrl || short.song.songId.cloudinaryUrl || short.song.songId.s3Url;
          } catch (error) {
            logger.warn(`Failed to generate song URL for short ${short._id}:`, error.message);
            // Do not set to null, keep existing URLs as fallback
          }
        }
      }

      // Generate signed URLs for short video and thumbnail
      let videoUrl = short.videoUrl || null;
      let imageUrl = short.imageUrl || short.thumbnailUrl || null;
      
      // Log initial state for debugging
      logger.debug(`Processing short ${short._id}`, {
        hasStorageKey: !!short.storageKey,
        storageKey: short.storageKey ? short.storageKey.substring(0, 100) : null,
        hasStorageKeys: !!(short.storageKeys && short.storageKeys.length > 0),
        storageKeysLength: short.storageKeys ? short.storageKeys.length : 0,
        storageKeys: short.storageKeys ? short.storageKeys.map(k => k?.substring(0, 50)) : null,
        hasVideoUrl: !!short.videoUrl,
        hasImageUrl: !!short.imageUrl,
        hasThumbnailUrl: !!short.thumbnailUrl
      });
      
      const hlsProxyUrl = getVideoUrlForShort(short, req);
      if (hlsProxyUrl) {
        videoUrl = hlsProxyUrl;
        const thumbKey = (short.storageKeys || []).find(k => k && (k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.png')));
        if (thumbKey) {
          try {
            const freshImageUrl = await generateSignedUrl(thumbKey, 'IMAGE');
            if (freshImageUrl) {
              imageUrl = freshImageUrl;
            }
          } catch (error) {
            logger.warn(`Failed to generate signed URL for HLS short thumbnail ${short._id}:`, error.message);
          }
        }
      } else if (short.storageKeys && short.storageKeys.length > 0) {
        try {
          // First key is always the video
          videoUrl = await generateSignedUrl(short.storageKeys[0], 'VIDEO');
          if (!videoUrl) {
            logger.warn(`Failed to generate video URL from storageKeys[0] for short ${short._id}`);
          }
          
          // Second key is the thumbnail (if it exists)
          if (short.storageKeys.length > 1 && short.storageKeys[1]) {
            try {
              const freshImageUrl = await generateSignedUrl(short.storageKeys[1], 'IMAGE');
              if (freshImageUrl) {
                imageUrl = freshImageUrl;
                logger.debug(`Generated thumbnail from storageKeys[1] for short ${short._id}`, {
                  storageKey: short.storageKeys[1]?.substring(0, 50)
                });
              } else {
                logger.warn(`Failed to generate thumbnail URL from storageKeys[1] for short ${short._id} - returned null`);
              }
            } catch (thumbError) {
              logger.warn(`Failed to generate thumbnail from storageKeys[1] for short ${short._id}:`, {
                error: thumbError.message,
                storageKey: short.storageKeys[1]?.substring(0, 50)
              });
            }
          }
          
          logger.debug(`Generated fresh signed URLs from storageKeys for short ${short._id}`, { 
            videoUrl: !!videoUrl, 
            imageUrl: !!imageUrl,
            storageKeysCount: short.storageKeys.length
          });
        } catch (error) {
          logger.warn(`Failed to generate signed URL from storageKeys for short ${short._id}:`, error.message);
        }
      } else if (short.storageKey) {
        // Fallback: Use single storageKey (older shorts might only have this)
        try {
          const freshVideoUrl = await generateSignedUrl(short.storageKey, 'VIDEO');
          if (freshVideoUrl) {
            videoUrl = freshVideoUrl;
          }
          
          // For older shorts without storageKeys array, try to use existing thumbnailUrl from DB
          // Don't try to generate image from video storageKey - it won't work
          
          logger.debug(`Generated fresh video URL from storageKey for short ${short._id}`, { videoUrl: !!videoUrl });
        } catch (error) {
          logger.warn(`Failed to generate signed URL from storageKey for short ${short._id}:`, error.message);
          // Use stored URLs as fallback (already set above)
        }
      } else {
        // No storage keys - use existing URLs from database
        logger.debug(`Short ${short._id} has no storageKey or storageKeys - using existing URLs from DB`, {
          hasVideoUrl: !!short.videoUrl,
          hasImageUrl: !!short.imageUrl,
          hasThumbnailUrl: !!short.thumbnailUrl
        });
      }

      // Update short with generated URLs
      short.videoUrl = videoUrl;
      
      // CRITICAL: Only set imageUrl/thumbnailUrl if we successfully generated a valid one
      // Validate that imageUrl is a proper URL (not incomplete)
      if (imageUrl && imageUrl !== videoUrl && imageUrl.trim() !== '') {
        // Validate URL format - must be a complete URL
        const isValidUrl = imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
        if (isValidUrl && imageUrl.length > 20) { // Basic validation: complete URL
          short.imageUrl = imageUrl;
          short.thumbnailUrl = imageUrl;
        } else {
          logger.warn(`Short ${short._id} generated invalid thumbnail URL: ${imageUrl?.substring(0, 100)}`);
          // Fall through to check existing URLs
          imageUrl = null; // Reset to null so we check existing URLs
        }
      }
      
      // If no valid generated URL, check existing URLs from database
      if (!imageUrl || imageUrl === videoUrl) {
        // Helper function to check if URL is an R2 URL
        const isR2Url = (url) => {
          return url && typeof url === 'string' && 
                 (url.includes('r2.cloudflarestorage.com') || url.includes('cloudflarestorage.com')) &&
                 !url.includes('?'); // Not already signed
        };
        
        // Helper function to extract storage key from R2 URL
        const extractStorageKeyFromR2Url = (url) => {
          try {
            // R2 URL format: https://[account-id].r2.cloudflarestorage.com/[bucket]/[key]
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p);
            if (pathParts.length >= 2) {
              // Remove bucket name (first part), rest is the storage key
              return pathParts.slice(1).join('/');
            }
          } catch (e) {
            logger.warn(`Failed to extract storage key from R2 URL: ${url?.substring(0, 100)}`);
          }
          return null;
        };
        
        // Check existing thumbnailUrl first (preferred field for shorts)
        if (short.thumbnailUrl && short.thumbnailUrl.trim() !== '' && 
            (short.thumbnailUrl.startsWith('http://') || short.thumbnailUrl.startsWith('https://')) &&
            short.thumbnailUrl !== short.videoUrl) { // Don't use video URL as thumbnail
          
          // If it's an R2 URL, convert to signed URL
          if (isR2Url(short.thumbnailUrl)) {
            const storageKey = extractStorageKeyFromR2Url(short.thumbnailUrl);
            if (storageKey) {
              try {
                const signedUrl = await generateSignedUrl(storageKey, 'IMAGE');
                if (signedUrl) {
                  short.imageUrl = signedUrl;
                  short.thumbnailUrl = signedUrl;
                  logger.debug(`Converted R2 thumbnailUrl to signed URL for short ${short._id}`);
                } else {
                  logger.warn(`Failed to generate signed URL from R2 thumbnailUrl for short ${short._id}`);
                  short.imageUrl = null;
                  short.thumbnailUrl = null;
                }
              } catch (error) {
                logger.warn(`Error converting R2 thumbnailUrl to signed URL for short ${short._id}:`, error.message);
                short.imageUrl = null;
                short.thumbnailUrl = null;
              }
            } else {
              logger.warn(`Could not extract storage key from R2 thumbnailUrl for short ${short._id}`);
              short.imageUrl = null;
              short.thumbnailUrl = null;
            }
          } else {
            // Not an R2 URL, validate and use as-is
            if (short.thumbnailUrl.length > 30 && short.thumbnailUrl.includes('/')) {
              short.imageUrl = short.thumbnailUrl;
              logger.debug(`Short ${short._id} using existing thumbnailUrl from database`);
            } else {
              logger.warn(`Short ${short._id} has incomplete thumbnailUrl: ${short.thumbnailUrl?.substring(0, 100)}`);
              short.imageUrl = null;
              short.thumbnailUrl = null;
            }
          }
        } else if (short.imageUrl && short.imageUrl.trim() !== '' && 
                   (short.imageUrl.startsWith('http://') || short.imageUrl.startsWith('https://')) &&
                   short.imageUrl !== short.videoUrl) { // Don't use video URL as thumbnail
          
          // If it's an R2 URL, convert to signed URL
          if (isR2Url(short.imageUrl)) {
            const storageKey = extractStorageKeyFromR2Url(short.imageUrl);
            if (storageKey) {
              try {
                const signedUrl = await generateSignedUrl(storageKey, 'IMAGE');
                if (signedUrl) {
                  short.imageUrl = signedUrl;
                  short.thumbnailUrl = signedUrl;
                  logger.debug(`Converted R2 imageUrl to signed URL for short ${short._id}`);
                } else {
                  logger.warn(`Failed to generate signed URL from R2 imageUrl for short ${short._id}`);
                  short.imageUrl = null;
                  short.thumbnailUrl = null;
                }
              } catch (error) {
                logger.warn(`Error converting R2 imageUrl to signed URL for short ${short._id}:`, error.message);
                short.imageUrl = null;
                short.thumbnailUrl = null;
              }
            } else {
              logger.warn(`Could not extract storage key from R2 imageUrl for short ${short._id}`);
              short.imageUrl = null;
              short.thumbnailUrl = null;
            }
          } else {
            // Not an R2 URL, validate and use as-is
            if (short.imageUrl.length > 30 && short.imageUrl.includes('/')) {
              short.thumbnailUrl = short.imageUrl;
              logger.debug(`Short ${short._id} using existing imageUrl from database`);
            } else {
              logger.warn(`Short ${short._id} has incomplete imageUrl: ${short.imageUrl?.substring(0, 100)}`);
              short.imageUrl = null;
              short.thumbnailUrl = null;
            }
          }
        } else {
          // No valid thumbnail available - set to null (frontend will show placeholder)
          short.imageUrl = null;
          short.thumbnailUrl = null;
          logger.warn(`Short ${short._id} has no valid thumbnail URL available`, {
            storageKey: short.storageKey?.substring(0, 50),
            storageKeys: short.storageKeys?.map(k => k?.substring(0, 50)),
            generatedImageUrl: imageUrl?.substring(0, 50),
            existingImageUrl: short.imageUrl?.substring(0, 50),
            existingThumbnailUrl: short.thumbnailUrl?.substring(0, 50),
            videoUrl: short.videoUrl?.substring(0, 50)
          });
        }
      }
      
      // FINAL SAFETY CHECK: Ensure we NEVER return unsigned R2 URLs
      const isR2UrlFinal = (url) => {
        return url && typeof url === 'string' && 
               (url.includes('r2.cloudflarestorage.com') || url.includes('cloudflarestorage.com')) &&
               !url.includes('?');
      };
      
      if (short.imageUrl && isR2UrlFinal(short.imageUrl)) {
        logger.error(`CRITICAL: Short ${short._id} still has unsigned R2 URL in imageUrl! Setting to null.`);
        short.imageUrl = null;
        short.thumbnailUrl = null;
      }
      if (short.thumbnailUrl && isR2UrlFinal(short.thumbnailUrl)) {
        logger.error(`CRITICAL: Short ${short._id} still has unsigned R2 URL in thumbnailUrl! Setting to null.`);
        short.imageUrl = null;
        short.thumbnailUrl = null;
      }

      if (short.comments && short.comments.length > 0) {
        for (const comment of short.comments) {
          if (comment.user) {
            comment.user.profilePic = await resolveProfilePic(comment.user);
          }
        }
      }

      return short;
    }));

    // Defensive: filter out shorts without video URLs (video is required, thumbnail is optional)
    const validShorts = shortsWithProfilePics
      .filter(short => {
        // Video URL is required - shorts must have a video
        const hasVideo = !!short.videoUrl;
        if (!hasVideo) {
          logger.warn(`User short ${short._id} missing videoUrl, filtering out`, {
            hasVideoUrl: !!short.videoUrl,
            hasImageUrl: !!short.imageUrl,
            hasThumbnailUrl: !!short.thumbnailUrl,
            hasStorageKey: !!short.storageKey,
            hasStorageKeys: !!(short.storageKeys && short.storageKeys.length > 0)
          });
        }
        return hasVideo;
      })
      .map(short => {
        // Ensure we have a thumbnail URL - prioritize imageUrl, then thumbnailUrl
        // If neither exists, that's okay - frontend will show placeholder
        let thumbnailUrl = short.imageUrl || short.thumbnailUrl || null;
        
        // CRITICAL: Final safety check - if thumbnailUrl is an unsigned R2 URL, set to null
        if (thumbnailUrl && typeof thumbnailUrl === 'string') {
          const isR2Url = (thumbnailUrl.includes('r2.cloudflarestorage.com') || 
                           thumbnailUrl.includes('cloudflarestorage.com')) &&
                          !thumbnailUrl.includes('?'); // Not signed
          
          if (isR2Url) {
            logger.error(`CRITICAL: Short ${short._id} has unsigned R2 URL in final response! Setting to null. URL: ${thumbnailUrl.substring(0, 100)}`);
            thumbnailUrl = null; // Set to null so frontend shows placeholder
          }
        }
        
        // Validate thumbnail URL format if present
        let validThumbnailUrl = thumbnailUrl;
        if (thumbnailUrl) {
          // Check if URL looks valid (has proper format)
          const urlPattern = /^https?:\/\/.+/;
          if (!urlPattern.test(thumbnailUrl)) {
            logger.warn(`Short ${short._id} has invalid thumbnail URL format: ${thumbnailUrl?.substring(0, 100)}`);
            validThumbnailUrl = null;
          }
        }
        
        // Log for debugging if thumbnail is missing (but don't filter out - video is what matters)
        if (!validThumbnailUrl && short.videoUrl) {
          logger.debug(`Short ${short._id} has videoUrl but no valid thumbnailUrl - frontend will show placeholder`, {
            videoUrl: short.videoUrl ? 'present' : 'missing',
            imageUrl: short.imageUrl ? 'present' : 'missing',
            thumbnailUrl: short.thumbnailUrl ? 'present' : 'missing'
          });
        }
        
        return {
          ...short,
          mediaUrl: short.videoUrl, // Use videoUrl as mediaUrl for shorts
          // CRITICAL: Set thumbnailUrl for frontend display (null is acceptable - shows placeholder)
          thumbnailUrl: validThumbnailUrl,
          imageUrl: validThumbnailUrl, // Also set imageUrl for compatibility
          user: {
            ...short.user,
            isFollowing: short.isFollowing || false
          }
        };
      });

    const hasNextPage = validShorts.length > safeLimit;
    const responseShorts = hasNextPage ? validShorts.slice(0, safeLimit) : validShorts;

    let nextCursor = null;
    if (responseShorts.length > 0) {
      const lastItem = responseShorts[responseShorts.length - 1];
      const lastCreatedAtMs = new Date(lastItem.createdAt).getTime();
      const lastId = lastItem._id.toString();
      nextCursor = Buffer.from(`${lastCreatedAtMs},${lastId}`).toString('base64');
    }

    const totalShorts = await Post.countDocuments({
      user: userIdObj,
      isActive: true,
      isHidden: { $ne: true },
      isArchived: { $ne: true },
      type: 'short',
      $or: [{ status: 'active' }, { status: { $exists: false } }]
    });

    return sendSuccess(res, 200, 'User shorts fetched successfully', {
      shorts: responseShorts,
      user: user,
      totalShorts,
      nextCursor,
      hasNextPage
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

    // Check if user exists and get privacy settings
    const user = await User.findById(userId).select('fullName profilePic settings.privacy.profileVisibility settings.privacy.showLocation followers following');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    // Check privacy settings for "followers only" profile
    const profileVisibility = user.settings?.privacy?.profileVisibility || 'public';
    const isOwnProfile = req.user ? req.user._id.toString() === userId : false;

    // For "followers only" profiles, requester must be in profile owner's followers list
    if (!isOwnProfile && profileVisibility === 'followers') {
      const isFollowing = req.user && user.followers ?
        user.followers.some(follower => {
          const followerId = typeof follower === 'object' && follower._id ? follower._id.toString() : follower.toString();
          return followerId === req.user._id.toString();
        }) :
        false;

      if (!isFollowing) {
        return sendSuccess(res, 200, 'Posts fetched successfully', {
          posts: [],
          totalPosts: 0,
          currentPage: page,
          totalPages: 0
        });
      }
    }

    // For "private" profiles, requester must be in profile owner's following list
    // (i.e. the profile owner follows the viewer) — matches getProfile/getTravelMapData.
    if (!isOwnProfile && profileVisibility === 'private') {
      const isFollowedBy = req.user && user.following ?
        user.following.some(following => {
          const followingId = typeof following === 'object' && following._id ? following._id.toString() : following.toString();
          return followingId === req.user._id.toString();
        }) :
        false;

      if (!isFollowedBy) {
        return sendSuccess(res, 200, 'Posts fetched successfully', {
          posts: [],
          totalPosts: 0,
          currentPage: page,
          totalPages: 0
        });
      }
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
            // Hidden / archived posts must not appear on the profile —
            // not for the owner (they live in Settings → Manage Posts) and
            // definitely not for other users viewing the profile. Without
            // these, hide/archive only removed the post from the home feed
            // (getPosts already filters them) but it stayed visible on the
            // author's profile to everyone, defeating the feature.
            isHidden: { $ne: true },
            isArchived: { $ne: true },
            type: 'photo',
            $or: [{ status: 'active' }, { status: { $exists: false } }]
          }
        },
        { $sort: { createdAt: -1, _id: -1 } },
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
                input: { $ifNull: ['$comments', []] },
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
            viewsCount: { $ifNull: ['$views', 0] },
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

      const totalPosts = await Post.countDocuments({
        user: userIdObj,
        isActive: true,
        isHidden: { $ne: true },
        isArchived: { $ne: true },
        type: 'photo',
        $or: [{ status: 'active' }, { status: { $exists: false } }]
      }).lean();

      return { posts, totalPosts };
    }, CACHE_TTL.POST_LIST);

    const { posts, totalPosts } = result;
    
    // Generate signed URLs for posts and profile pictures
    const postsWithProfilePics = await Promise.all(posts.map(async (post) => {
      // Generate image URLs from storage keys (same logic as getPosts)
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
        if (post.imageUrl && post.imageUrl.trim() !== '') {
          // Use existing imageUrl (from Cloudinary or legacy storage)
          post.images = [post.imageUrl];
          // Keep imageUrl as is
        } else {
          post.imageUrl = null;
          post.images = [];
        }
      }

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

      // Generate signed URL for song if present
      if (post.song?.songId) {
        const storageKey = post.song.songId.storageKey || post.song.songId.cloudinaryKey || post.song.songId.s3Key;
        if (storageKey) {
          try {
            const songUrl = await generateSignedUrl(storageKey, 'AUDIO');
            post.song.songId.s3Url = songUrl || post.song.songId.s3Url || post.song.songId.cloudinaryUrl;
            post.song.songId.cloudinaryUrl = songUrl || post.song.songId.cloudinaryUrl || post.song.songId.s3Url;
          } catch (error) {
            logger.warn(`Failed to generate song URL for post ${post._id}:`, error.message);
            // Do not set to null, keep existing URLs as fallback
          }
        }
      }

      return post;
    }));

    const hideLocation = !isOwnProfile && user.settings?.privacy?.showLocation === false;
    const postsWithLikeStatus = postsWithProfilePics.map(post => ({
      ...post,
      isLiked: post.isLiked || false,
      location: hideLocation ? null : post.location,
      detectedPlace: hideLocation ? null : post.detectedPlace,
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

    // Privacy check: ensure viewer is allowed to interact with this post
    const postOwnerId = post.user?.toString();
    if (postOwnerId && postOwnerId !== req.user._id.toString()) {
      const postAuthor = await User.findById(postOwnerId)
        .select('settings.privacy.profileVisibility followers')
        .lean();
      const vis = postAuthor?.settings?.privacy?.profileVisibility || 'public';
      if (vis !== 'public') {
        const isFollower = (postAuthor?.followers || []).some(
          f => f.toString() === req.user._id.toString()
        );
        if (!isFollower) {
          return sendError(res, 'AUTH_1003', 'You cannot interact with this post');
        }
      }
    }

    // Check current like status BEFORE update
    const currentlyLiked = post.likes.some(like => like.toString() === req.user._id.toString());
    
    let updatedPost;
    let operationExecuted = false;

    if (currentlyLiked) {
      // We want to UNLIKE. Only match if user is currently in likes.
      updatedPost = await Post.findOneAndUpdate(
        { _id: req.params.id, likes: req.user._id },
        { $pull: { likes: req.user._id } },
        { new: true }
      );
      if (updatedPost) {
        operationExecuted = true;
      }
    } else {
      // We want to LIKE. Only match if user is NOT currently in likes.
      updatedPost = await Post.findOneAndUpdate(
        { _id: req.params.id, likes: { $ne: req.user._id } },
        { $addToSet: { likes: req.user._id } },
        { new: true }
      );
      if (updatedPost) {
        operationExecuted = true;
      }
    }

    let finalIsLiked;
    let updatedLikesCount;

    if (operationExecuted) {
      finalIsLiked = !currentlyLiked;
      updatedLikesCount = updatedPost.likes.length;
    } else {
      // Duplicate concurrent request, state was already updated.
      // Fetch fresh post to return accurate status to client.
      const freshPost = await Post.findById(req.params.id).lean();
      if (!freshPost) {
        return sendError(res, 'RES_3001', 'Post does not exist');
      }
      finalIsLiked = freshPost.likes.some(like => like.toString() === req.user._id.toString());
      updatedLikesCount = freshPost.likes.length;
    }

    if (operationExecuted) {
      // Handle activity creation/deletion to prevent duplicates
      // Check if activity already exists for this user, post, and type
      const existingActivity = await Activity.findOne({
        user: req.user._id,
        type: 'post_liked',
        post: req.params.id
      });

      if (finalIsLiked) {
        // User liked the post
        const user = await User.findById(req.user._id).select('settings.privacy.shareActivity').lean();
        const shareActivity = user?.settings?.privacy?.shareActivity !== false; // Default to true if not set
        
        if (existingActivity) {
          // Activity already exists, just update the timestamp to reflect the latest like
          existingActivity.createdAt = new Date();
          existingActivity.isPublic = shareActivity;
          await existingActivity.save().catch(err => logger.error('Error updating activity:', err));
        } else {
          // Create new activity only if it doesn't exist
          Activity.createActivity({
            user: req.user._id,
            type: 'post_liked',
            post: req.params.id,
            targetUser: post.user,
            isPublic: shareActivity
          }).catch(err => logger.error('Error creating activity:', err));
        }
      } else {
        // User unliked the post - remove the activity if it exists
        if (existingActivity) {
          await Activity.deleteOne({ _id: existingActivity._id }).catch(err => logger.error('Error deleting activity:', err));
        }
      }

      // Invalidate cache
      await deleteCache(CacheKeys.post(req.params.id));
      await deleteCacheByPattern('posts:*');
      await deleteCache(CacheKeys.userPosts(post.user.toString(), 1, 20));

      // Update user's total likes if this is their post - use final verified state
      if (finalIsLiked) {
        await User.findByIdAndUpdate(post.user, { $inc: { totalLikes: 1 } });
        
        // Create notification for like (only if it's not the user's own post)
        if (post.user.toString() !== req.user._id.toString()) {
          try {
            logger.debug('🔔 Creating like notification:', {
              fromUser: req.user._id,
              toUser: post.user,
              post: post._id
            });
            
            const notification = await Notification.createNotification({
              type: 'like',
              fromUser: req.user._id,
              toUser: post.user,
              post: post._id
            });
            
            logger.debug('Like notification created successfully:', notification._id);

            // Send push notification
            await sendNotificationToUser({
              userId: post.user.toString(),
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

            // Emit real-time notification to recipient only
            const io = getIO();
            if (io) {
              const nsp = io.of('/app');
              nsp.to(`user:${post.user}`).emit('notification', {
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
          // Emit the new real-time post like update with correct final state
          nsp.emitPostLike(post._id.toString(), finalIsLiked, updatedLikesCount, req.user._id.toString());
          // Also emit the legacy notification event (only for likes, not unlikes)
          if (finalIsLiked) {
            nsp.emitEvent('post:liked', [post.user.toString()], { postId: post._id });
          }
        }
      } catch (socketError) {
        logger.error('Socket error:', socketError);
      }
    }

    return sendSuccess(res, 200, finalIsLiked ? 'Post liked' : 'Post unliked', {
      isLiked: finalIsLiked,
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

    // Privacy check: ensure viewer is allowed to interact with this post
    const commentPostOwnerId = post.user?._id?.toString();
    if (commentPostOwnerId && commentPostOwnerId !== req.user._id.toString()) {
      const commentPostAuthor = await User.findById(commentPostOwnerId)
        .select('settings.privacy.profileVisibility followers')
        .lean();
      const commentVis = commentPostAuthor?.settings?.privacy?.profileVisibility || 'public';
      if (commentVis !== 'public') {
        const isCommentFollower = (commentPostAuthor?.followers || []).some(
          f => f.toString() === req.user._id.toString()
        );
        if (!isCommentFollower) {
          return sendError(res, 'AUTH_1003', 'You cannot interact with this post');
        }
      }
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

    // Populate the new comment with user data (include profilePicStorageKey for signed URL generation)
    await post.populate('comments.user', 'fullName profilePic profilePicStorageKey');
    const populatedComment = post.comments.id(newComment._id);
    
    if (populatedComment && populatedComment.user) {
      populatedComment.user.profilePic = await resolveProfilePic(populatedComment.user);
    }

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

        // Emit real-time notification to recipient only
        const io = getIO();
        if (io) {
          const nsp = io.of('/app');
          nsp.to(`user:${post.user._id}`).emit('notification', {
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

    // Convert populated comment to plain object for response
    const commentResponse = populatedComment.toObject ? populatedComment.toObject() : populatedComment;
    
    return sendSuccess(res, 201, 'Comment added successfully', {
      comment: commentResponse,
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

    // Decrement user's postCount atomically
    await User.findByIdAndUpdate(userId, { $inc: { postCount: -1 } });
    logger.info(`Decremented postCount for user ${userId}`);

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

    // No `type` filter — archived shorts must appear here too. The 3-dot menu
    // sets isArchived on both photos and shorts, but until the filter was
    // removed only photos came back, so users saw an empty list when they'd
    // archived shorts. The single Post collection holds both.
    const posts = await Post.find({
      user: req.user._id,
      isArchived: true,
      isActive: true
    })
      .populate('user', 'fullName profilePic profilePicStorageKey')
      .populate('comments.user', 'fullName profilePic profilePicStorageKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Resolve storage keys to signed URLs
    for (const post of posts) {
      // Post images
      if (post.storageKeys && post.storageKeys.length > 0) {
        try {
          const imageUrls = await generateSignedUrls(post.storageKeys, 'IMAGE');
          post.imageUrl = imageUrls[0] || post.imageUrl;
          post.images = imageUrls;
        } catch { /* keep existing */ }
      } else if (post.storageKey) {
        try {
          const imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
          if (imageUrl) { post.imageUrl = imageUrl; post.images = [imageUrl]; }
        } catch { /* keep existing */ }
      }
      // Author + comment profile pics
      if (post.user) {
        post.user.profilePic = await resolveProfilePic(post.user);
      }
      if (post.comments) {
        for (const comment of post.comments) {
          if (comment.user) {
            comment.user.profilePic = await resolveProfilePic(comment.user);
          }
        }
      }
    }

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

    // No `type` filter — hidden shorts must appear here too. See note in
    // getArchivedPosts above for the full reasoning.
    const posts = await Post.find({
      user: req.user._id,
      isHidden: true,
      isActive: true
    })
      .populate('user', 'fullName profilePic profilePicStorageKey')
      .populate('comments.user', 'fullName profilePic profilePicStorageKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Resolve storage keys to signed URLs
    for (const post of posts) {
      // Post images
      if (post.storageKeys && post.storageKeys.length > 0) {
        try {
          const imageUrls = await generateSignedUrls(post.storageKeys, 'IMAGE');
          post.imageUrl = imageUrls[0] || post.imageUrl;
          post.images = imageUrls;
        } catch { /* keep existing */ }
      } else if (post.storageKey) {
        try {
          const imageUrl = await generateSignedUrl(post.storageKey, 'IMAGE');
          if (imageUrl) { post.imageUrl = imageUrl; post.images = [imageUrl]; }
        } catch { /* keep existing */ }
      }
      // Author + comment profile pics
      if (post.user) {
        post.user.profilePic = await resolveProfilePic(post.user);
      }
      if (post.comments) {
        for (const comment of post.comments) {
          if (comment.user) {
            comment.user.profilePic = await resolveProfilePic(comment.user);
          }
        }
      }
    }

    const postsWithLikeStatus = posts.map(post => ({
      ...post,
      isLiked: post.likes.some(like => like.toString() === req.user._id.toString()),
      likesCount: post.likes.length,
      commentsCount: post.comments.length
    }));

    return sendSuccess(res, 200, 'Hidden posts fetched successfully', {
      posts: postsWithLikeStatus,
      page,
      limit,
      total: posts.length
    });
  } catch (error) {
    logger.error('Get hidden posts error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching hidden posts');
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
  if (req.query.hls) {
    try {
      return await handleHLSProxy(req, res);
    } catch (err) {
      logger.error('HLS Proxy error:', err);
      return res.status(500).json({ error: 'Internal HLS proxy error' });
    }
  }

  try {
    const cursor = req.query.cursor || (req.query.page && isNaN(Number(req.query.page)) ? req.query.page : null);
    const limit = parseInt(req.query.limit) || 20;

    // Defensive guard: ensure limit is reasonable
    const safeLimit = Math.min(Math.max(limit, 1), 50); // Cap at 50

    const viewerId = req.user?._id?.toString();
    const allowedAuthorIds = await getAllowedPostAuthorIds(viewerId);
    const blockedIds = req.user?.blockedUsers?.length
      ? req.user.blockedUsers.map(b => (typeof b === 'object' && b?._id ? b._id.toString() : b.toString()))
      : [];
    const allowedFiltered = blockedIds.length
      ? allowedAuthorIds.filter(id => !blockedIds.includes(id.toString()))
      : allowedAuthorIds;

    let viewedPostIds = [];
    let spotTypeAffinities = new Map();
    let travelInfoAffinities = new Map();
    let creatorAffinities = new Map();
    
    if (viewerId) {
      try {
        const ui = await UserInteraction.findOne({ user: req.user._id });
        if (ui) {
          viewedPostIds = (ui.viewedPosts || []).map(vp => vp.postId);
          spotTypeAffinities = ui.spotTypeAffinities || new Map();
          travelInfoAffinities = ui.travelInfoAffinities || new Map();
          creatorAffinities = ui.creatorAffinities || new Map();
        }
      } catch (err) {
        logger.error('Error fetching UserInteraction', err);
      }
    }

    let dateCursorFilter = null;
    let scoreCursorFilter = null;
    
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('ascii');
        const [scoreOrDateStr, idStr] = decoded.split(',');
        if (scoreOrDateStr && idStr && mongoose.Types.ObjectId.isValid(idStr)) {
          const cursorVal = parseFloat(scoreOrDateStr);
          const cursorId = new mongoose.Types.ObjectId(idStr);
          
          if (cursorVal > 1000000000000) { // Old date cursor
            dateCursorFilter = {
              $or: [
                { createdAt: { $lt: new Date(cursorVal) } },
                { createdAt: new Date(cursorVal), _id: { $lt: cursorId } }
              ]
            };
          } else { // New score cursor
            scoreCursorFilter = { score: cursorVal, id: cursorId };
          }
        }
      } catch (err) {
        logger.warn('Failed to parse cursor, using empty filter:', err);
      }
    }

    const baseConditions = {
      isActive: true,
      isArchived: { $ne: true },
      isHidden: { $ne: true },
      type: 'short',
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] }
      ]
    };

    if (allowedFiltered.length > 0) {
      baseConditions.user = { $in: allowedFiltered.map(id => new mongoose.Types.ObjectId(id)) };
    } else {
      baseConditions.user = { $in: [new mongoose.Types.ObjectId()] };
    }

    const spotTypeBranches = [];
    spotTypeAffinities.forEach((val, key) => {
      spotTypeBranches.push({ case: { $eq: ['$spotType', key] }, then: val });
    });
    
    const travelInfoBranches = [];
    travelInfoAffinities.forEach((val, key) => {
      travelInfoBranches.push({ case: { $eq: ['$travelInfo', key] }, then: val });
    });
    
    const creatorBranches = [];
    creatorAffinities.forEach((val, key) => {
      creatorBranches.push({ case: { $eq: [{ $toString: '$user' }, key] }, then: val });
    });

    // Match user's onboarding interests to boost scoring
    const interestScores = [];
    if (req.user?.interests && Array.isArray(req.user.interests) && req.user.interests.length > 0) {
      req.user.interests.forEach(interest => {
        const lowerInterest = interest.toLowerCase();
        
        let spotMatch = null;
        if (lowerInterest === 'beach') spotMatch = 'Beach';
        else if (lowerInterest === 'mountains') spotMatch = 'Mountain';
        else if (lowerInterest === 'city') spotMatch = 'City';
        else if (lowerInterest === 'nature') spotMatch = 'Natural spots';
        else if (lowerInterest === 'culture') spotMatch = 'Cultural';
        else if (lowerInterest === 'art') spotMatch = 'Cultural';
        else if (lowerInterest === 'history') spotMatch = 'Cultural';
        
        let travelMatch = null;
        if (lowerInterest === 'adventure') travelMatch = 'Hiking';

        const conds = [];
        if (spotMatch) {
          conds.push({ $eq: ['$spotType', spotMatch] });
        }
        if (travelMatch) {
          conds.push({ $eq: ['$travelInfo', travelMatch] });
        }
        conds.push({
          $in: [
            lowerInterest,
            {
              $map: {
                input: { $ifNull: ['$tags', []] },
                as: 't',
                in: { $toLower: '$$t' }
              }
            }
          ]
        });

        interestScores.push({
          $cond: {
            if: { $or: conds },
            then: 10,
            else: 0
          }
        });
      });
    }

    const scoringStages = [
      {
        $addFields: {
          baseScore: {
            $add: [
              { $multiply: [{ $size: { $ifNull: ['$likes', []] } }, 2] },
              { $multiply: [{ $size: { $ifNull: ['$comments', []] } }, 2] },
              { $multiply: [{ $ifNull: ['$sharesCount', 0] }, 3] },
              {
                $max: [
                  0,
                  {
                    $subtract: [
                      100,
                      { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }
                    ]
                  }
                ]
              }
            ]
          },
          spotAffinity: spotTypeBranches.length > 0 ? { $switch: { branches: spotTypeBranches, default: 0 } } : 0,
          travelAffinity: travelInfoBranches.length > 0 ? { $switch: { branches: travelInfoBranches, default: 0 } } : 0,
          creatorAffinity: creatorBranches.length > 0 ? { $switch: { branches: creatorBranches, default: 0 } } : 0,
          interestAffinity: interestScores.length > 0 ? { $add: interestScores } : 0,
        }
      },
      {
        $addFields: {
          totalScore: {
            $add: [
              "$baseScore",
              "$spotAffinity",
              "$travelAffinity",
              "$creatorAffinity",
              "$interestAffinity"
            ]
          }
        }
      }
    ];

    const projectionPipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [
            { $project: { fullName: 1, username: 1, profilePic: 1, profilePicStorageKey: 1, followers: 1 } }
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
            { $project: { fullName: 1, username: 1, profilePic: 1, profilePicStorageKey: 1 } }
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
                s3Url: 1,
                cloudinaryUrl: 1,
                thumbnailUrl: 1,
                imageUrl: 1,
                imageStorageKey: 1,
                storageKey: 1,
                cloudinaryKey: 1,
                s3Key: 1,
                _id: 1
              }
            }
          ]
        }
      },
      {
        $addFields: {
          comments: {
            $map: {
              input: { $ifNull: ['$comments', []] },
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
    ];

    const collectedShorts = [];
    const skippedShorts = [];
    const seenShortIds = new Set();
    const recentCreators = new Set();

    const addShortsWithDiversity = (shortsList) => {
      for (const short of shortsList) {
        const idStr = short._id.toString();
        if (seenShortIds.has(idStr)) continue;

        // Skip if short has absolutely no media fields
        const hasMedia = short.videoUrl || short.imageUrl || short.storageKey || (short.storageKeys && short.storageKeys.length > 0);
        if (!hasMedia) {
          logger.warn(`Short ${short._id} missing media fields completely, skipping`);
          continue;
        }

        const creatorId = short.user && short.user._id ? short.user._id.toString() : null;
        if (creatorId && recentCreators.has(creatorId)) {
          skippedShorts.push(short);
          continue;
        }

        if (creatorId) {
          recentCreators.add(creatorId);
          if (recentCreators.size > 3) {
            const firstItem = recentCreators.values().next().value;
            recentCreators.delete(firstItem);
          }
        }

        collectedShorts.push(short);
        seenShortIds.add(idStr);
        if (collectedShorts.length >= safeLimit + 1) {
          return true; // We are full
        }
      }
      return false; // Not full yet
    };

    // Phase 1: Fetch unviewed allowed shorts matching the cursor filter
    const phase1Match = { ...baseConditions };
    
    if (viewedPostIds.length > 0) {
      phase1Match._id = { $nin: viewedPostIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    if (dateCursorFilter) {
      if (!phase1Match.$and) phase1Match.$and = [];
      phase1Match.$and.push(dateCursorFilter);
    }

    const phase1Pipeline = [
      { $match: phase1Match },
      ...scoringStages
    ];

    if (scoreCursorFilter) {
      phase1Pipeline.push({
        $match: {
          $or: [
            { totalScore: { $lt: scoreCursorFilter.score } },
            { totalScore: scoreCursorFilter.score, _id: { $lt: scoreCursorFilter.id } }
          ]
        }
      });
    }

    phase1Pipeline.push(
      { $sort: { totalScore: -1, _id: -1 } },
      { $limit: safeLimit * 3 },
      ...projectionPipeline
    );

    const phase1Shorts = await Post.aggregate(phase1Pipeline);
    let isFull = addShortsWithDiversity(phase1Shorts);

    // Phase 2: Fallback to other unviewed allowed shorts (without cursor filter)
    if (!isFull) {
      const excludeIds = [
        ...viewedPostIds.map(id => new mongoose.Types.ObjectId(id)),
        ...Array.from(seenShortIds).map(id => new mongoose.Types.ObjectId(id))
      ];

      const phase2Match = {
        ...baseConditions,
        _id: { $nin: excludeIds }
      };

      const phase2Pipeline = [
        { $match: phase2Match },
        ...scoringStages,
        { $sort: { totalScore: -1, _id: -1 } },
        { $limit: (safeLimit + 1) * 2 },
        ...projectionPipeline
      ];

      const phase2Shorts = await Post.aggregate(phase2Pipeline);
      isFull = addShortsWithDiversity(phase2Shorts);
    }

    // Phase 3: Fallback to already viewed allowed shorts to guarantee infinite scrolling
    if (!isFull) {
      const excludeIds = Array.from(seenShortIds).map(id => new mongoose.Types.ObjectId(id));

      const phase3Match = {
        ...baseConditions,
        _id: { $nin: excludeIds }
      };

      const phase3Pipeline = [
        { $match: phase3Match },
        ...scoringStages,
        { $sort: { totalScore: -1, _id: -1 } },
        { $limit: (safeLimit + 1) * 2 },
        ...projectionPipeline
      ];

      const phase3Shorts = await Post.aggregate(phase3Pipeline);
      isFull = addShortsWithDiversity(phase3Shorts);
    }

    // Phase 4: Fallback to skipped shorts if diversity control made us return too few items
    if (collectedShorts.length < safeLimit + 1 && skippedShorts.length > 0) {
      for (const short of skippedShorts) {
        const idStr = short._id.toString();
        if (!seenShortIds.has(idStr)) {
          collectedShorts.push(short);
          seenShortIds.add(idStr);
          if (collectedShorts.length >= safeLimit + 1) {
            break;
          }
        }
      }
    }

    const hasNextPage = collectedShorts.length > safeLimit;
    const responseShorts = hasNextPage ? collectedShorts.slice(0, safeLimit) : collectedShorts;
    const shorts = responseShorts;

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
      
      if (short.user) {
        short.user.profilePic = await resolveProfilePic(short.user);
      }
      if (short.comments && short.comments.length > 0) {
        for (const comment of short.comments) {
          if (comment.user) {
            comment.user.profilePic = await resolveProfilePic(comment.user);
          }
        }
      }
      
      // Generate signed URL for song if present (same logic as getPosts)
      if (short.song?.songId) {
        await resolveSong(short.song.songId);
      } else {
        logger.debug('getShorts - No song data for short:', { shortId: short._id });
      }
      
      // Generate fresh signed URL for video if storageKey exists (CRITICAL: Videos expire after 15 minutes)
      let videoUrl = short.videoUrl || null; // Start with stored URL as fallback
      let imageUrl = short.imageUrl || null; // Start with stored URL as fallback
      
      const hlsProxyUrl = getVideoUrlForShort(short, req);
      if (hlsProxyUrl) {
        videoUrl = hlsProxyUrl;
        const thumbKey = (short.storageKeys || []).find(k => k && (k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.png')));
        if (thumbKey) {
          try {
            const freshImageUrl = await generateSignedUrl(thumbKey, 'IMAGE');
            if (freshImageUrl) {
              imageUrl = freshImageUrl;
            }
          } catch (error) {
            logger.warn(`Failed to generate signed URL for HLS short thumbnail ${short._id}:`, error.message);
          }
        }
      } else if (short.storageKey) {
        try {
          const freshVideoUrl = await generateSignedUrl(short.storageKey, 'VIDEO');
          if (freshVideoUrl) {
            videoUrl = freshVideoUrl;
          }
          // For shorts, also generate thumbnail URL (use same storageKey or separate one)
          if (short.storageKeys && short.storageKeys.length > 1) {
            // Second key might be thumbnail
            const freshImageUrl = await generateSignedUrl(short.storageKeys[1], 'IMAGE');
            if (freshImageUrl) {
              imageUrl = freshImageUrl;
            }
          } else {
            // Use same key for thumbnail (CDN can generate thumbnails)
            const freshImageUrl = await generateSignedUrl(short.storageKey, 'IMAGE');
            if (freshImageUrl) {
              imageUrl = freshImageUrl;
            }
          }
          logger.debug(`Generated fresh signed URLs for short ${short._id}`);
        } catch (error) {
          logger.warn(`Failed to generate signed URL for short ${short._id}:`, error.message);
          // Use stored URLs as fallback (already set above)
          if (!videoUrl && !imageUrl) {
            logger.error(`Short ${short._id} has no stored URLs and signed URL generation failed - this short will be skipped`);
          }
        }
      } else if (short.storageKeys && short.storageKeys.length > 0) {
        // Try storageKeys array (backward compatibility)
        try {
          const freshVideoUrl = await generateSignedUrl(short.storageKeys[0], 'VIDEO');
          if (freshVideoUrl) {
            videoUrl = freshVideoUrl;
          }
          if (short.storageKeys.length > 1) {
            const freshImageUrl = await generateSignedUrl(short.storageKeys[1], 'IMAGE');
            if (freshImageUrl) {
              imageUrl = freshImageUrl;
            }
          } else {
            const freshImageUrl = await generateSignedUrl(short.storageKeys[0], 'IMAGE');
            if (freshImageUrl) {
              imageUrl = freshImageUrl;
            }
          }
          logger.debug(`Generated fresh signed URLs from storageKeys for short ${short._id}`);
        } catch (error) {
          logger.warn(`Failed to generate signed URL from storageKeys for short ${short._id}:`, error.message);
          // Use stored URLs as fallback (already set above)
          if (!videoUrl && !imageUrl) {
            logger.error(`Short ${short._id} has no stored URLs and signed URL generation failed - this short will be skipped`);
          }
        }
      } else {
        // Use stored URLs (legacy support) - no storageKey found
        logger.debug(`Using stored URLs for short ${short._id} (no storageKey found)`);
        if (!videoUrl && !imageUrl) {
          logger.warn(`Short ${short._id} has no storageKey and no stored URLs`);
        }
      }
      
      // Defensive: ensure mediaUrl exists (required for shorts)
      // Use stored URLs if fresh URLs failed, or fresh URLs if available
      const mediaUrl = videoUrl || imageUrl || short.videoUrl || short.imageUrl || '';
      if (!mediaUrl) {
        logger.warn(`Short ${short._id} missing mediaUrl completely (no storageKey, no stored URLs), skipping`);
        return null; // Filter out shorts without any media URL
      }
      
      return {
        ...short,
        _id: short._id,
        // Use fresh signed URLs if available, otherwise use stored URLs as fallback
        videoUrl: videoUrl || short.videoUrl || null,
        imageUrl: imageUrl || short.imageUrl || null,
        mediaUrl, // Include virtual field with fresh signed URL or fallback
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
    const finalShorts = shortsWithLikeStatus.filter(short => short !== null);

    let nextCursor = null;
    if (finalShorts.length > 0) {
      const lastItem = finalShorts[finalShorts.length - 1];
      const cursorVal = lastItem.totalScore !== undefined ? lastItem.totalScore : new Date(lastItem.createdAt || Date.now()).getTime();
      const lastId = lastItem._id ? lastItem._id.toString() : new mongoose.Types.ObjectId().toString();
      nextCursor = Buffer.from(`${cursorVal},${lastId}`).toString('base64');
    }

    res.status(200).json({
      shorts: finalShorts,
      pagination: {
        nextCursor,
        hasNextPage,
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
  // Hoisted so the outer catch can reference them for cleanup on failure
  let videoStorageKey;
  let videoUploadResult;
  try {
    logger.debug('createShort called');
    logger.debug('req.file:', req.file ? { fieldname: req.file.fieldname, size: req.file.size } : null);

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

    const { caption, address, latitude, longitude, tags, songId, songStartTime, songEndTime, songVolume, spotType, travelInfo, audioSource, copyrightAccepted, copyrightAcceptedAt } = req.body;
    logger.info('createShort - Received data:', {
      hasSongId: !!songId,
      hasAudioSource: !!audioSource,
      hasCopyrightAccepted: !!copyrightAccepted,
    });
    
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

    const shortId = new mongoose.Types.ObjectId();
    const rawExtension = videoFile.originalname.split('.').pop() || 'mp4';
    videoStorageKey = `shorts/raw/${shortId}.${rawExtension}`;

    // Upload raw video buffer directly to S3
    const fileSizeMB = (videoFile.buffer.length / (1024 * 1024)).toFixed(2);
    logger.info('Starting raw video upload to S3:', {
      key: videoStorageKey,
      size: `${fileSizeMB}MB`,
      mimetype: videoFile.mimetype,
      userId: req.user._id.toString(),
    });

    try {
      const uploadStartTime = Date.now();
      videoUploadResult = await uploadObject(videoFile.buffer, videoStorageKey, videoFile.mimetype);
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      
      logger.info('Raw video upload completed:', {
        key: videoStorageKey,
        size: `${fileSizeMB}MB`,
        duration: `${uploadDuration}s`
      });
      
      if (!videoUploadResult || !videoUploadResult.url) {
        logger.error('Raw video upload succeeded but no URL returned');
        return sendError(res, 'FILE_4005', 'Video upload completed but URL is missing. Please try again.');
      }
    } catch (uploadErr) {
      logger.error('Storage upload error:', {
        error: uploadErr.message || uploadErr,
        key: videoStorageKey,
        size: `${fileSizeMB}MB`,
        stack: uploadErr.stack
      });
      return sendError(res, 'FILE_4004', 'Video upload failed. Please try again.');
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
      }
    }
    
    // CRITICAL: Normalize audioSource early for consistent comparison
    const normalizedAudioSource = audioSource ? String(audioSource).trim() : null;
    const shouldSaveSong = songId && normalizedAudioSource === 'taatom_library';
    
    logger.info('createShort - Song data decision (before Post creation):', {
      hasSongId: !!songId,
      songId: songId,
      audioSource: audioSource,
      normalizedAudioSource: normalizedAudioSource,
      shouldSaveSong: shouldSaveSong,
      songStartTime: songStartTime,
      songEndTime: songEndTime,
      songVolume: songVolume
    });
    
    // Build storageKeys array: [video, thumbnail] if thumbnail exists
    const storageKeys = [videoStorageKey];
    if (thumbnailStorageKey) {
      storageKeys.push(thumbnailStorageKey);
    }
    
    // Build base post object
    const postData = {
      _id: shortId,
      user: req.user._id,
      caption,
      imageUrl: thumbnailUrl || '', // Backward compatibility
      thumbnailUrl: thumbnailUrl || '', // New field for clarity
      videoUrl: videoUploadResult.url, // Playable raw video initially, updated by background worker if needed
      storageKey: videoStorageKey, // Raw video key initially, updated by background worker if needed
      storageKeys: storageKeys, // CRITICAL: Initially holds raw video key & custom thumbnail key
      cloudinaryPublicId: videoStorageKey, // Backward compatibility
      cloudinaryPublicIds: storageKeys, // Backward compatibility
      tags: allHashtags,
      type: 'short',
      location: {
        address: address || 'Unknown Location',
        coordinates: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        }
      },
      // TripScore metadata from user dropdowns
      spotType: spotType || null,
      travelInfo: travelInfo || null,
      // Copyright compliance fields
      audioSource: audioSource || null,
      copyrightAccepted: finalCopyrightAccepted,
      copyrightAcceptedAt: finalCopyrightAcceptedAt ? new Date(finalCopyrightAcceptedAt) : null,
      status: 'active'
    };
    
    // CRITICAL: Only include song field if we actually want to save it
    // Using conditional spread prevents Mongoose from applying default values
    if (shouldSaveSong) {
      postData.song = {
        songId: songId,
        startTime: parseFloat(songStartTime) || 0,
        endTime: songEndTime ? parseFloat(songEndTime) : null,
        volume: parseFloat(songVolume) || 1.0 // Music at full volume, video will be at 0.6
      };
      logger.info('createShort - SAVING song data:', postData.song);
    } else {
      logger.info('createShort - NOT saving song data:', {
        reason: !songId ? 'No songId provided' : `audioSource is '${normalizedAudioSource}', expected 'taatom_library'`
      });
      // Do NOT include song field at all - this prevents Mongoose defaults
    }
    
    const short = new Post(postData);

    await short.save();

    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(req.user._id.toString(), 1, 20));

    // Create TranscodeJob
    const TranscodeJob = mongoose.model('TranscodeJob');
    const job = new TranscodeJob({
      post: short._id,
      rawStorageKey: videoStorageKey,
      status: 'pending'
    });
    await job.save();
    logger.info(`Enqueued background transcoding job for post ${short._id}`);
    
    // Log saved short data for debugging - use logger.info for visibility
    logger.info('createShort - Short saved successfully:', {
      shortId: short._id,
      hasSong: !!short.song,
      songId: short.song?.songId,
      audioSource: short.audioSource,
      songStartTime: short.song?.startTime,
      songVolume: short.song?.volume,
      songEndTime: short.song?.endTime
    });
    
    // Also log the full song object for debugging
    if (short.song) {
      logger.info('createShort - Full song object:', JSON.stringify(short.song, null, 2));
    } else {
      logger.warn('createShort - WARNING: Short saved WITHOUT song data!', {
        shortId: short._id,
        receivedSongId: songId,
        receivedAudioSource: audioSource
      });
    }

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

    // Auto-attach short to active journey as waypoint (non-blocking)
    try {
      const Journey = require('../models/Journey');
      const shortLat = short.location?.coordinates?.latitude || parseFloat(req.body.latitude);
      const shortLng = short.location?.coordinates?.longitude || parseFloat(req.body.longitude);
      if (req.user && shortLat && shortLng && !isNaN(shortLat) && !isNaN(shortLng)) {
        const activeJourney = await Journey.findOne({
          user: req.user._id,
          status: { $in: ['active', 'paused'] }
        });
        if (activeJourney) {
          activeJourney.waypoints.push({
            post: short._id,
            lat: shortLat,
            lng: shortLng,
            timestamp: new Date(),
            contentType: short.mediaType === 'video' ? 'video' : 'short'
          });
          await activeJourney.save();
          logger.info(`Auto-attached short ${short._id} to journey ${activeJourney._id}`);
        }
      }
    } catch (journeyError) {
      logger.warn('Failed to attach short to journey (non-critical):', journeyError);
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

    return sendSuccess(res, 202, 'Short uploaded successfully and is being processed', {
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

// @desc    Increment share count on a post
// @route   POST /posts/:id/share
// @access  Public (optionalAuth)
const incrementShare = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    post.sharesCount = (post.sharesCount || 0) + 1;
    await post.save();

    // Invalidate cache
    await deleteCache(CacheKeys.post(req.params.id));
    await deleteCacheByPattern('posts:*');
    await deleteCache(CacheKeys.userPosts(post.user.toString(), 1, 20));

    // Emit real-time post share update if socket is configured
    try {
      const io = getIO();
      if (io) {
        const nsp = io.of('/app');
        nsp.emit('post:share', { postId: post._id.toString(), sharesCount: post.sharesCount });
      }
    } catch (socketError) {
      logger.error('Socket error:', socketError);
    }

    return sendSuccess(res, 200, 'Post share count incremented', {
      sharesCount: post.sharesCount
    });
  } catch (error) {
    logger.error('Increment share error:', error);
    return sendError(res, 'SRV_6001', 'Error updating share status');
  }
};

// @desc    Get users who liked a post
// @route   GET /posts/:id/likes
// @access  Public (optionalAuth)
const getPostLikers = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const post = await Post.findById(id).select('likes').lean();
    if (!post) {
      return sendError(res, 'RES_3001', 'Post does not exist');
    }

    const likerIds = (post.likes || []).slice(skip, skip + limit);
    const totalLikes = (post.likes || []).length;

    const likers = await User.find({ _id: { $in: likerIds } })
      .select('fullName username profilePic profilePicStorageKey settings.privacy.profileVisibility')
      .lean();

    // Map to preserve order and resolve profile pics
    const likersMap = new Map(likers.map(u => [u._id.toString(), u]));
    
    const orderedLikers = [];
    for (const userId of likerIds) {
      const user = likersMap.get(userId.toString());
      if (user) {
        user.profilePic = await resolveProfilePic(user);
        orderedLikers.push(user);
      }
    }

    return sendSuccess(res, 200, 'Likers fetched successfully', {
      likers: orderedLikers,
      pagination: {
        total: totalLikes,
        page,
        limit,
        pages: Math.ceil(totalLikes / limit)
      }
    });
  } catch (error) {
    logger.error('Get post likers error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching likers');
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
  getHiddenPosts,
  incrementShare,
  getPostLikers
};

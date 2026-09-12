const mongoose = require('mongoose');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Post = require('../models/Post');
const Like = require('../models/Like');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { buildMediaKey, uploadObject } = require('../services/storage');
const { triggerTranscode } = require('../services/videoTranscode');
const { buildLongVideoAdSchedule } = require('../services/longVideoAdSchedule');
const { deleteCacheByPattern } = require('../utils/cache');

const LONG_VIDEO = 'long_video';
const MAX_DURATION_SECONDS = 60 * 60;
const MAX_FILE_BYTES = 500 * 1024 * 1024;

function serializeLongVideo(doc, { liked = false } = {}) {
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  const durationSeconds = o.durationSeconds ?? null;
  const schedule =
    durationSeconds != null ? buildLongVideoAdSchedule(durationSeconds) : { slots: [] };
  return {
    _id: o._id,
    type: LONG_VIDEO,
    caption: o.caption || '',
    title: o.caption || '',
    durationSeconds,
    thumbnailUrl: o.thumbnailUrl || null,
    imageUrl: o.thumbnailUrl || o.imageUrl || null,
    mediaUrl: o.videoUrl || o.mediaUrl || o.thumbnailUrl || o.imageUrl || null,
    videoUrl: o.videoUrl || null,
    storageKey: o.storageKey || null,
    storageKeys: o.storageKeys || [],
    source: o.source || 'upload',
    isActive: o.isActive !== false,
    displayOrder: o.displayOrder || 0,
    likesCount: o.likesCount || 0,
    sharesCount: o.sharesCount || 0,
    views: o.views || 0,
    commentsCount: Array.isArray(o.comments) ? o.comments.length : o.commentsCount || 0,
    commentsDisabled: !!o.commentsDisabled,
    user: o.user,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    liked,
    isLiked: liked,
    adSchedule: schedule,
  };
}

async function probeDurationSeconds(buffer, ext = 'mp4') {
  let ffmpeg;
  try {
    ffmpeg = require('fluent-ffmpeg');
    try {
      const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
      ffmpeg.setFfprobePath(ffprobeInstaller.path);
    } catch {
      /* system ffprobe */
    }
  } catch {
    return null;
  }

  const tmp = path.join(os.tmpdir(), `taatom-lv-${crypto.randomBytes(8).toString('hex')}.${ext}`);
  try {
    fs.writeFileSync(tmp, buffer);
    const meta = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(tmp, (err, data) => (err ? reject(err) : resolve(data)));
    });
    const sec = meta?.format?.duration;
    return Number.isFinite(sec) ? Math.round(sec) : null;
  } catch (e) {
    logger.warn('probeDurationSeconds failed:', e.message);
    return null;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/** POST /api/v1/long-videos — approved creators only */
async function createLongVideoUpload(req, res) {
  let videoStorageKey;
  try {
    const user = await User.findById(req.user._id).select('videoCreatorStatus');
    if (!user || user.videoCreatorStatus !== 'approved') {
      return sendError(res, 'BIZ_7002', 'Only approved video creators can upload long videos');
    }

    const videoFile =
      (req.files && Array.isArray(req.files.video) && req.files.video[0]) || req.file;
    const imageFile =
      (req.files && Array.isArray(req.files.image) && req.files.image[0]) || null;

    if (!videoFile?.buffer?.length) {
      return sendError(res, 'FILE_4001', 'Please upload a video');
    }
    if (videoFile.buffer.length > MAX_FILE_BYTES) {
      return sendError(res, 'FILE_4002', 'Video exceeds 500 MB limit');
    }

    const caption = (req.body?.caption || req.body?.title || '').toString().trim().slice(0, 1000);
    const clientDuration = Number(req.body?.durationSeconds);
    const ext = (videoFile.originalname || 'video.mp4').split('.').pop() || 'mp4';

    let durationSeconds = await probeDurationSeconds(videoFile.buffer, ext);
    if (durationSeconds == null && Number.isFinite(clientDuration) && clientDuration > 0) {
      durationSeconds = Math.round(clientDuration);
    }
    if (durationSeconds != null && durationSeconds > MAX_DURATION_SECONDS) {
      return sendError(res, 'VAL_2001', 'Video cannot exceed 60 minutes');
    }

    const postId = new mongoose.Types.ObjectId();
    videoStorageKey = `long_videos/raw/${postId}.${ext}`;

    const uploadResult = await uploadObject(
      videoFile.buffer,
      videoStorageKey,
      videoFile.mimetype || 'video/mp4'
    );
    if (!uploadResult?.url) {
      return sendError(res, 'FILE_4004', 'Video upload failed');
    }

    let thumbnailUrl = '';
    let thumbnailStorageKey = null;
    if (imageFile?.buffer?.length) {
      try {
        const thumbExt = (imageFile.originalname || 'thumb.jpg').split('.').pop() || 'jpg';
        thumbnailStorageKey = buildMediaKey({
          type: 'long_video',
          userId: req.user._id.toString(),
          filename: `thumb_${imageFile.originalname || 'thumb'}`,
          extension: thumbExt,
        });
        const thumbResult = await uploadObject(
          imageFile.buffer,
          thumbnailStorageKey,
          imageFile.mimetype || 'image/jpeg'
        );
        thumbnailUrl = thumbResult.url || '';
      } catch (e) {
        logger.warn('Long video thumbnail upload failed:', e.message);
      }
    }

    const storageKeys = [videoStorageKey];
    if (thumbnailStorageKey) storageKeys.push(thumbnailStorageKey);

    const post = await Post.create({
      _id: postId,
      user: req.user._id,
      type: LONG_VIDEO,
      caption,
      source: 'upload',
      durationSeconds: durationSeconds ?? null,
      thumbnailUrl: thumbnailUrl || undefined,
      imageUrl: thumbnailUrl || undefined,
      videoUrl: uploadResult.url,
      storageKey: videoStorageKey,
      storageKeys,
      isActive: true,
      status: 'active',
      location: {
        address: (req.body?.address || 'Videos').toString().slice(0, 200),
        coordinates: { latitude: 0, longitude: 0 },
      },
    });

    try {
      const TranscodeJob = mongoose.model('TranscodeJob');
      await TranscodeJob.create({
        post: post._id,
        rawStorageKey: videoStorageKey,
        status: 'pending',
      });
      if (typeof triggerTranscode === 'function') triggerTranscode();
    } catch (e) {
      logger.warn('Failed to enqueue long video transcode:', e.message);
    }

    try {
      await deleteCacheByPattern('posts:*');
      await deleteCacheByPattern(`user:${req.user._id}:posts:*`);
    } catch {
      /* ignore */
    }

    return sendSuccess(res, 201, 'Long video uploaded', {
      video: serializeLongVideo(post),
      post: serializeLongVideo(post),
    });
  } catch (error) {
    logger.error('createLongVideoUpload error:', error);
    return sendError(res, 'SRV_6001', 'Failed to upload long video');
  }
}

async function listLongVideos(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const skip = (page - 1) * limit;

    const match = {
      type: LONG_VIDEO,
      source: 'upload',
      isActive: true,
      isHidden: { $ne: true },
      status: { $nin: ['removed', 'failed'] },
    };

    const [rows, total] = await Promise.all([
      Post.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username fullName profilePic profilePicStorageKey')
        .lean({ virtuals: true }),
      Post.countDocuments(match),
    ]);

    let likedSet = new Set();
    if (req.user?._id && rows.length) {
      const likes = await Like.find({
        user: req.user._id,
        post: { $in: rows.map((r) => r._id) },
      })
        .select('post')
        .lean();
      likedSet = new Set(likes.map((l) => String(l.post)));
    }

    const videos = rows.map((r) =>
      serializeLongVideo(r, { liked: likedSet.has(String(r._id)) })
    );

    return sendSuccess(res, 200, 'Videos feed fetched', {
      videos,
      posts: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + rows.length < total,
      },
    });
  } catch (error) {
    logger.error('listLongVideos error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch Videos feed');
  }
}

async function getLongVideo(req, res) {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      type: LONG_VIDEO,
      isActive: true,
      isHidden: { $ne: true },
      status: { $nin: ['removed', 'failed'] },
    })
      .populate('user', 'username fullName profilePic profilePicStorageKey')
      .lean({ virtuals: true });

    if (!post) {
      return sendError(res, 'RES_3001', 'Video not found');
    }

    let liked = false;
    if (req.user?._id) {
      liked = !!(await Like.exists({ user: req.user._id, post: post._id }));
    }

    Post.updateOne({ _id: post._id }, { $inc: { views: 1 } }).catch(() => {});

    const video = serializeLongVideo(post, { liked });
    return sendSuccess(res, 200, 'Video fetched', { video, post: video });
  } catch (error) {
    logger.error('getLongVideo error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch video');
  }
}

/** GET /api/v1/long-videos/user/:userId */
async function listUserLongVideos(req, res) {
  try {
    const userId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'VAL_2001', 'Invalid user id');
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const skip = (page - 1) * limit;

    const match = {
      type: LONG_VIDEO,
      source: 'upload',
      user: userId,
      isActive: true,
      isHidden: { $ne: true },
      status: { $nin: ['removed', 'failed'] },
    };

    const [rows, total] = await Promise.all([
      Post.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username fullName profilePic')
        .lean({ virtuals: true }),
      Post.countDocuments(match),
    ]);

    const videos = rows.map((r) => serializeLongVideo(r));
    return sendSuccess(res, 200, 'User videos fetched', {
      videos,
      posts: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: skip + rows.length < total,
      },
    });
  } catch (error) {
    logger.error('listUserLongVideos error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch user videos');
  }
}

async function listLongVideosAdmin(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const q = (req.query.q || req.query.search || '').trim();
    const activeFilter = req.query.isActive;

    const match = { type: LONG_VIDEO, source: 'upload' };
    if (activeFilter === 'true' || activeFilter === true) match.isActive = true;
    if (activeFilter === 'false' || activeFilter === false) match.isActive = false;
    if (q) {
      match.caption = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const [rows, total] = await Promise.all([
      Post.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username fullName profilePic email')
        .lean({ virtuals: true }),
      Post.countDocuments(match),
    ]);

    return sendSuccess(res, 200, 'Long videos fetched', {
      videos: rows.map((r) => serializeLongVideo(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    logger.error('listLongVideosAdmin error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch long videos');
  }
}

async function getLongVideoAdmin(req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.id, type: LONG_VIDEO })
      .populate('user', 'username fullName profilePic email')
      .lean({ virtuals: true });
    if (!post) return sendError(res, 'RES_3001', 'Long video not found');
    return sendSuccess(res, 200, 'Long video fetched', { video: serializeLongVideo(post) });
  } catch (error) {
    logger.error('getLongVideoAdmin error:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch long video');
  }
}

async function updateLongVideo(req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.id, type: LONG_VIDEO });
    if (!post) return sendError(res, 'RES_3001', 'Long video not found');

    if (req.body.title !== undefined || req.body.caption !== undefined) {
      post.caption = (req.body.title ?? req.body.caption ?? '').toString().trim();
    }
    if (req.body.isActive !== undefined) {
      const active = !(req.body.isActive === false || req.body.isActive === 'false');
      post.isActive = active;
      if (!active) post.status = 'removed';
      else if (post.status === 'removed') post.status = 'active';
    }
    await post.save();
    return sendSuccess(res, 200, 'Long video updated', { video: serializeLongVideo(post) });
  } catch (error) {
    logger.error('updateLongVideo error:', error);
    return sendError(res, 'SRV_6001', 'Failed to update long video');
  }
}

async function deleteLongVideo(req, res) {
  try {
    const post = await Post.findOne({ _id: req.params.id, type: LONG_VIDEO });
    if (!post) return sendError(res, 'RES_3001', 'Long video not found');
    post.isActive = false;
    post.status = 'removed';
    await post.save();
    return sendSuccess(res, 200, 'Long video deactivated', { video: serializeLongVideo(post) });
  } catch (error) {
    logger.error('deleteLongVideo error:', error);
    return sendError(res, 'SRV_6001', 'Failed to delete long video');
  }
}

module.exports = {
  createLongVideoUpload,
  listLongVideos,
  getLongVideo,
  listUserLongVideos,
  listLongVideosAdmin,
  getLongVideoAdmin,
  updateLongVideo,
  deleteLongVideo,
  serializeLongVideo,
};

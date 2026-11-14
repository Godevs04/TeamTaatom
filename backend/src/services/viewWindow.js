const AnalyticsEvent = require('../models/AnalyticsEvent');
const { claimKey } = require('../utils/cache');

/** Long videos: one counted view and one ad break per viewer per video every 8 hours. */
const LONG_VIDEO_VIEW_WINDOW_MS = 8 * 60 * 60 * 1000;
const DEFAULT_VIEW_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const viewCooldownFor = (postType) =>
  postType === 'long_video' ? LONG_VIDEO_VIEW_WINDOW_MS : DEFAULT_VIEW_COOLDOWN_MS;

/**
 * Latest `post_view` by this viewer for this post within `windowMs` before `before`, or null.
 * Viewer is the logged-in user when known, otherwise the analytics session.
 */
const findRecentView = ({ postId, userId, sessionId, windowMs, before = new Date() }) => {
  const query = {
    event: 'post_view',
    timestamp: { $gte: new Date(before.getTime() - windowMs), $lt: before },
    $or: [{ 'properties.post_id': postId }, { 'properties.postId': postId }],
  };
  if (userId) {
    query.userId = userId;
  } else {
    query.sessionId = sessionId;
  }
  return AnalyticsEvent.findOne(query);
};

/**
 * Atomic per-viewer slot so concurrent `post_view` requests (double fires, retries,
 * offline-queue replays) cannot both pass `findRecentView` and double count.
 * @returns {Promise<boolean|null>} true if this view may be counted, false if already counted, null if unknown
 */
const claimViewSlot = ({ postId, userId, sessionId, windowMs }) => {
  const viewer = userId ? `u:${userId}` : `s:${sessionId || 'anon'}`;
  return claimKey(`viewslot:${postId}:${viewer}`, windowMs);
};

module.exports = {
  LONG_VIDEO_VIEW_WINDOW_MS,
  DEFAULT_VIEW_COOLDOWN_MS,
  viewCooldownFor,
  findRecentView,
  claimViewSlot,
};

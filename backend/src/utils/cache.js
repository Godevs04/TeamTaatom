/**
 * Cache Utility (No-op implementation)
 * Cache functionality is disabled - all operations return null/false
 * This maintains API compatibility for future Redis integration
 */

const logger = require('./logger');

// Cache TTL (Time To Live) in seconds
// Kept for API compatibility
const CACHE_TTL = {
  USER_SESSION: 3600, // 1 hour
  POST: 300, // 5 minutes
  POST_LIST: 60, // 1 minute
  USER_PROFILE: 600, // 10 minutes
  SEARCH_RESULTS: 300, // 5 minutes
  TRENDING_CONTENT: 600, // 10 minutes
  HASHTAG: 1800, // 30 minutes
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - for moderately changing data
  LONG: 1800, // 30 minutes - for slowly changing data
};

/**
 * Get cached value (no-op - always returns null)
 * @param {string} key - Cache key
 * @returns {Promise<null>} - Always returns null (cache disabled)
 */
const getCache = async (key) => {
  // Cache disabled - always return null to fallback to DB
  return null;
};

/**
 * Set cached value (no-op - always returns false)
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Always returns false (cache disabled)
 */
const setCache = async (key, value, ttl = null) => {
  // Cache disabled - always return false
  return false;
};

/**
 * Delete cached value (no-op - always returns false)
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Always returns false (cache disabled)
 */
const deleteCache = async (key) => {
  // Cache disabled - always return false
  return false;
};

/**
 * Delete multiple cached values by pattern (no-op - always returns 0)
 * @param {string} pattern - Cache key pattern (e.g., 'post:*')
 * @returns {Promise<number>} - Always returns 0 (cache disabled)
 */
const deleteCacheByPattern = async (pattern) => {
  // Cache disabled - always return 0
  return 0;
};

/**
 * Cache wrapper function - executes function without caching
 * @param {string} key - Cache key (ignored)
 * @param {Function} fn - Function to execute
 * @param {number} ttl - Time to live in seconds (ignored)
 * @returns {Promise<any>} - Result from function execution
 */
const cacheWrapper = async (key, fn, ttl = CACHE_TTL.POST) => {
  // Cache disabled - always execute function directly
  return await fn();
};

/**
 * Generate cache keys (kept for API compatibility)
 */
const CacheKeys = {
  user: (userId) => `user:${userId}`,
  userSession: (userId) => `session:${userId}`,
  post: (postId) => `post:${postId}`,
  postList: (page, limit, filters) => {
    const filterStr = filters ? JSON.stringify(filters) : 'default';
    return `posts:page:${page}:limit:${limit}:filters:${filterStr}`;
  },
  userPosts: (userId, page, limit) => `user:${userId}:posts:page:${page}:limit:${limit}`,
  search: (query, type) => `search:${type}:${query}`,
  trendingPosts: (limit) => `trending:posts:limit:${limit}`,
  trendingHashtags: (limit) => `trending:hashtags:limit:${limit}`,
  hashtag: (hashtagName) => `hashtag:${hashtagName}`,
  hashtagPosts: (hashtagName, page, limit) => `hashtag:${hashtagName}:posts:page:${page}:limit:${limit}`,
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  cacheWrapper,
  CacheKeys,
  CACHE_TTL,
};

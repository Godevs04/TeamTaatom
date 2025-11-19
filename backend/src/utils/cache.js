/**
 * Redis Caching Utility
 * Provides caching layer for frequently accessed data
 */

const { getRedisClient } = require('./redisHealth');
const logger = require('./logger');

// Cache TTL (Time To Live) in seconds
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
 * Get cached value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null
 */
const getCache = async (key) => {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return null; // Cache unavailable, return null to fallback to DB
    }

    const value = await client.get(key);
    if (value) {
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(value);
    }
    logger.debug(`Cache MISS: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`Cache get error for key ${key}:`, error.message);
    return null; // Fail gracefully, fallback to DB
  }
};

/**
 * Set cached value
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
const setCache = async (key, value, ttl = null) => {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return false; // Cache unavailable
    }

    const serialized = JSON.stringify(value);
    if (ttl) {
      await client.setEx(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
    logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'none'})`);
    return true;
  } catch (error) {
    logger.warn(`Cache set error for key ${key}:`, error.message);
    return false; // Fail gracefully
  }
};

/**
 * Delete cached value
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
const deleteCache = async (key) => {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return false;
    }

    await client.del(key);
    logger.debug(`Cache DELETE: ${key}`);
    return true;
  } catch (error) {
    logger.warn(`Cache delete error for key ${key}:`, error.message);
    return false;
  }
};

/**
 * Delete multiple cached values by pattern
 * @param {string} pattern - Redis key pattern (e.g., 'post:*')
 * @returns {Promise<number>} - Number of keys deleted
 */
const deleteCacheByPattern = async (pattern) => {
  try {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      return 0;
    }

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      logger.debug(`Cache DELETE pattern: ${pattern} (${keys.length} keys)`);
      return keys.length;
    }
    return 0;
  } catch (error) {
    logger.warn(`Cache delete pattern error for ${pattern}:`, error.message);
    return 0;
  }
};

/**
 * Cache wrapper function - executes function and caches result
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute if cache miss
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} - Cached or fresh value
 */
const cacheWrapper = async (key, fn, ttl = CACHE_TTL.POST) => {
  // Try to get from cache first
  const cached = await getCache(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - execute function
  const result = await fn();
  
  // Cache the result
  await setCache(key, result, ttl);
  
  return result;
};

/**
 * Generate cache keys
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


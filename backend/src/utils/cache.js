/**
 * Cache Utility (Redis implementation with memory-bounded local fallback)
 */

const Redis = require('ioredis');
const logger = require('./logger');

const memoryStore = new Map();
const MAX_MEMORY_KEYS = 1000;

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  USER_SESSION: 3600, // 1 hour
  POST: 300, // 5 minutes
  POST_LIST: 60, // 1 minute
  USER_PROFILE: 600, // 10 minutes
  SEARCH_RESULTS: 300, // 5 minutes
  TRENDING_CONTENT: 600, // 10 minutes
  HASHTAG: 1800, // 30 minutes
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
};

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

let redisClient = null;
let isRedisConnected = false;

try {
  const options = {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy(times) {
      // Limit reconnect attempts to not block application lifecycle
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 100, 2000);
    }
  };

  if (redisUrl) {
    redisClient = new Redis(redisUrl, options);
  } else {
    redisClient = new Redis({
      host: redisHost,
      port: parseInt(redisPort, 10),
      ...options
    });
  }

  redisClient.on('connect', () => {
    isRedisConnected = true;
    logger.info('Redis connected successfully');
  });

  redisClient.on('ready', () => {
    isRedisConnected = true;
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
    logger.warn('Redis connection error, falling back to local memory cache:', { error: err.message });
  });

  redisClient.on('close', () => {
    isRedisConnected = false;
  });
} catch (err) {
  logger.warn('Failed to initialize Redis client, falling back to local memory cache:', { error: err.message });
}

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Returns cached value or null if expired/missing
 */
const getCache = async (key) => {
  if (redisClient && isRedisConnected) {
    try {
      const data = await redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      logger.error('Redis getCache error:', err);
      return null;
    }
  }

  // Memory fallback
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiry && Date.now() > item.expiry) {
    memoryStore.delete(key);
    return null;
  }
  try {
    return JSON.parse(item.value);
  } catch (err) {
    return null;
  }
};

/**
 * Set cached value
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Returns true on success
 */
const setCache = async (key, value, ttl = CACHE_TTL.POST) => {
  if (value === undefined) return false;

  if (redisClient && isRedisConnected) {
    try {
      const stringified = JSON.stringify(value);
      if (ttl) {
        await redisClient.set(key, stringified, 'EX', ttl);
      } else {
        await redisClient.set(key, stringified);
      }
      return true;
    } catch (err) {
      logger.error('Redis setCache error:', err);
      return false;
    }
  }

  // Memory fallback
  if (memoryStore.size >= MAX_MEMORY_KEYS) {
    // Evict the oldest key (first element in the Map iterator)
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey) {
      memoryStore.delete(oldestKey);
    }
  }

  const expiry = ttl ? Date.now() + (ttl * 1000) : null;
  memoryStore.set(key, {
    value: JSON.stringify(value),
    expiry
  });
  return true;
};

/**
 * Delete cached value
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Returns true if deleted
 */
const deleteCache = async (key) => {
  if (redisClient && isRedisConnected) {
    try {
      const result = await redisClient.del(key);
      return result > 0;
    } catch (err) {
      logger.error('Redis deleteCache error:', err);
      return false;
    }
  }

  // Memory fallback
  return memoryStore.delete(key);
};

/**
 * Delete multiple cached values by pattern (e.g., 'posts:*')
 * @param {string} pattern - Cache key pattern (using * as wildcard)
 * @returns {Promise<number>} - Returns count of deleted keys
 */
const deleteCacheByPattern = async (pattern) => {
  if (redisClient && isRedisConnected) {
    try {
      let cursor = '0';
      let deletedCount = 0;
      do {
        const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        const keys = reply[1];
        if (keys.length > 0) {
          const result = await redisClient.del(keys);
          deletedCount += result;
        }
      } while (cursor !== '0');
      return deletedCount;
    } catch (err) {
      logger.error('Redis deleteCacheByPattern error:', err);
      return 0;
    }
  }

  // Memory fallback
  const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
  const regex = new RegExp(regexPattern);
  let count = 0;
  for (const key of memoryStore.keys()) {
    if (regex.test(key)) {
      memoryStore.delete(key);
      count++;
    }
  }
  return count;
};

/**
 * Cache wrapper function - executes function and caches result if missing
 * @param {string} key - Cache key
 * @param {Function} fn - Function to execute
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>} - Result from function execution (or cache)
 */
const cacheWrapper = async (key, fn, ttl = CACHE_TTL.POST) => {
  const cachedValue = await getCache(key);
  if (cachedValue !== null) {
    return cachedValue;
  }
  const freshValue = await fn();
  if (freshValue !== null && freshValue !== undefined) {
    await setCache(key, freshValue, ttl);
  }
  return freshValue;
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
  redisClient,
};

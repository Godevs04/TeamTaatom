/**
 * Cache Utility (In-Memory implementation as Redis fallback)
 */

const memoryStore = new Map();

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

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Returns cached value or null if expired/missing
 */
const getCache = async (key) => {
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
  return memoryStore.delete(key);
};

/**
 * Delete multiple cached values by pattern (e.g., 'posts:*')
 * @param {string} pattern - Cache key pattern (using * as wildcard)
 * @returns {Promise<number>} - Returns count of deleted keys
 */
const deleteCacheByPattern = async (pattern) => {
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
};

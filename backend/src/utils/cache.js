/**
 * Cache Utility (Redis implementation with memory-bounded local fallback)
 */

const Redis = require('ioredis');
const logger = require('./logger');

// Sentry is initialised in src/instrument.js (loaded first by server.js); requiring the SDK here
// returns that same client. Before init (tests, scripts) captureException is a no-op.
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch {
  Sentry = null;
}

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
  LOCALE: 120, // 2 minutes — signed locale images stay valid
  SIGNED_URL: 90,
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
};

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let redisClient = null;
let isRedisConnected = false;
let lastRedisErrorKey = null;
let lastRedisErrorAt = 0;
const REDIS_ERROR_LOG_INTERVAL_MS = 60 * 1000;

// Node's dual-stack connect raises an AggregateError with an empty message,
// so derive a readable description from its code / nested errors.
const describeRedisError = (err) => {
  if (!err) return 'unknown error';
  if (err.message) return err.message;
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return err.errors.map((e) => e.message || e.code).filter(Boolean).join('; ');
  }
  return err.code || String(err);
};

/**
 * Which feature a cache key belongs to, used to tag Sentry events so a Redis
 * problem can be traced to the module that hit it.
 */
const moduleForKey = (key) => {
  if (!key || typeof key !== 'string') return 'unknown';
  if (/^user:[^:]+:posts:/.test(key)) return 'user-posts';
  const head = key.split(':')[0];
  const MODULES = {
    posts: 'posts-feed',
    post: 'post',
    user: 'profile',
    session: 'session',
    search: 'search',
    trending: 'trending',
    hashtag: 'hashtag',
    locales: 'locale',
    shorts: 'shorts',
    signedurl: 'media-signed-url',
    blocked: 'blocked-users',
    authuser: 'auth',
    analytics: 'analytics-admin',
    idx: 'cache-index',
  };
  return MODULES[head] || head || 'unknown';
};

const REPORT_THROTTLE_MS = 60 * 1000;
const lastReportAt = new Map();

/**
 * Log a Redis failure and send it to Sentry, tagged with the module and operation.
 * Identical failures (same module + operation + error code) are reported at most once a minute
 * so an outage cannot flood Sentry.
 *
 * @param {object} info
 * @param {string} info.module - feature that hit the error (e.g. 'posts-feed', 'rate-limit:general')
 * @param {string} info.operation - Redis/cache operation (e.g. 'get', 'set', 'invalidate')
 * @param {Error} err
 * @param {object} [info.extra] - extra non-sensitive context (never values)
 * @param {'error'|'warning'} [info.level]
 */
const reportRedisError = ({ module: mod, operation, extra, level = 'error' }, err) => {
  const code = err?.code || err?.name || 'ERR';
  const message = describeRedisError(err);
  const throttleKey = `${mod}|${operation}|${code}`;
  const now = Date.now();
  const last = lastReportAt.get(throttleKey) || 0;
  if (now - last < REPORT_THROTTLE_MS) return;
  lastReportAt.set(throttleKey, now);
  if (lastReportAt.size > 500) lastReportAt.clear();

  const logFn = level === 'warning' ? logger.warn : logger.error;
  logFn(`[Redis][${mod}] ${operation} failed: ${message}`, { code, ...extra });

  if (!Sentry || typeof Sentry.captureException !== 'function' || !process.env.SENTRY_DSN) return;
  try {
    const error = err instanceof Error ? err : new Error(message);
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      scope.setTag('component', 'redis');
      scope.setTag('redis.module', mod);
      scope.setTag('redis.operation', operation);
      scope.setTag('redis.code', String(code));
      scope.setContext('redis', {
        module: mod,
        operation,
        code,
        message,
        connected: isRedisConnected,
        status: redisClient?.status,
        ...extra,
      });
      // One Sentry issue per module/operation/code instead of one per stack trace.
      scope.setFingerprint(['redis', mod, operation, String(code)]);
      Sentry.captureException(error);
    });
  } catch {
    // Reporting must never break a request.
  }
};

try {
  const options = {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    enableOfflineQueue: false,
    retryStrategy(times) {
      return Math.min(times * 500, 30000);
    }
  };

  if (redisUrl) {
    redisClient = new Redis(redisUrl, options);
  } else {
    redisClient = new Redis({
      host: redisHost === 'localhost' ? '127.0.0.1' : redisHost,
      port: parseInt(redisPort, 10),
      password: redisPassword,
      ...options
    });
  }

  redisClient.on('connect', () => {
    logger.info('Redis socket connected');
  });

  redisClient.on('ready', () => {
    isRedisConnected = true;
    lastRedisErrorKey = null;
    logger.info('Redis connected successfully');
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
    const errorKey = err?.code || describeRedisError(err);
    const now = Date.now();
    if (errorKey === lastRedisErrorKey && now - lastRedisErrorAt < REDIS_ERROR_LOG_INTERVAL_MS) {
      return;
    }
    lastRedisErrorKey = errorKey;
    lastRedisErrorAt = now;
    reportRedisError({
      module: 'redis-connection',
      operation: 'connect',
      level: 'warning',
      extra: { target: redisUrl ? 'REDIS_URL' : `${redisHost}:${redisPort}`, fallback: 'memory' },
    }, err);
  });

  redisClient.on('close', () => {
    isRedisConnected = false;
  });
} catch (err) {
  reportRedisError({ module: 'redis-connection', operation: 'init', extra: { fallback: 'memory' } }, err);
}

/**
 * Bulk invalidation without SCAN.
 * deleteCacheByPattern('posts:*') used to SCAN the whole keyspace (signed URLs, sessions, shorts…)
 * on every like/comment/save. Keys in these groups are now also recorded in a small Redis SET
 * (`idx:<prefix>`), so invalidating a group only touches that group's keys.
 */
const INDEX_PREFIX_RULES = [
  /^posts:/,
  /^user:[^:]+:posts:/,
  /^hashtag:[^:]+:/,
  /^locales:/,
  /^shorts:feed:first:/,
];
const INDEX_KEY_TTL_SECONDS = 2 * 60 * 60; // longer than any TTL used for indexed keys

/** The index group a key belongs to (e.g. 'user:42:posts:'), or null if it is not indexed. */
const indexPrefixFor = (key) => {
  for (const rule of INDEX_PREFIX_RULES) {
    const m = key.match(rule);
    if (m) return m[0];
  }
  return null;
};
const indexKeyFor = (prefix) => `idx:${prefix}`;

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
      try {
        return JSON.parse(data);
      } catch (parseErr) {
        // Corrupt entry: drop it so every later read doesn't fail the same way.
        reportRedisError({ module: moduleForKey(key), operation: 'get:parse' }, parseErr);
        redisClient.unlink(key).catch(() => {});
        return null;
      }
    } catch (err) {
      reportRedisError({ module: moduleForKey(key), operation: 'get' }, err);
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
      const indexPrefix = indexPrefixFor(key);
      if (indexPrefix) {
        // One round trip: value + index membership.
        const indexKey = indexKeyFor(indexPrefix);
        const multi = redisClient.multi();
        if (ttl) multi.set(key, stringified, 'EX', ttl);
        else multi.set(key, stringified);
        multi.sadd(indexKey, key);
        multi.expire(indexKey, INDEX_KEY_TTL_SECONDS);
        const results = await multi.exec();
        const failed = results && results.find(([e]) => e);
        if (failed) throw failed[0];
      } else if (ttl) {
        await redisClient.set(key, stringified, 'EX', ttl);
      } else {
        await redisClient.set(key, stringified);
      }
      return true;
    } catch (err) {
      reportRedisError({ module: moduleForKey(key), operation: 'set', extra: { ttl } }, err);
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
 * Atomically claim `key` for `ttlMs` (Redis SET NX PX).
 * @returns {Promise<boolean|null>} true if claimed, false if already held, null if the store errored
 */
const claimKey = async (key, ttlMs) => {
  if (redisClient && isRedisConnected) {
    try {
      const result = await redisClient.set(key, '1', 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err) {
      reportRedisError({ module: moduleForKey(key), operation: 'claim' }, err);
      return null;
    }
  }

  const existing = memoryStore.get(key);
  if (existing && (!existing.expiry || Date.now() <= existing.expiry)) return false;
  if (memoryStore.size >= MAX_MEMORY_KEYS) {
    const oldestKey = memoryStore.keys().next().value;
    if (oldestKey) memoryStore.delete(oldestKey);
  }
  memoryStore.set(key, { value: '1', expiry: Date.now() + ttlMs });
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
      const result = await redisClient.unlink(key);
      return result > 0;
    } catch (err) {
      reportRedisError({ module: moduleForKey(key), operation: 'delete' }, err);
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
    // Indexed group ('posts:*', 'user:<id>:posts:*', …): delete exactly the recorded keys.
    const prefix = pattern.endsWith('*') && pattern.indexOf('*') === pattern.length - 1
      ? pattern.slice(0, -1)
      : null;
    if (prefix && indexPrefixFor(prefix) === prefix) {
      const indexKey = indexKeyFor(prefix);
      try {
        const keys = await redisClient.smembers(indexKey);
        let deletedCount = 0;
        for (let i = 0; i < keys.length; i += 500) {
          deletedCount += await redisClient.unlink(keys.slice(i, i + 500));
        }
        // Remove only the members we deleted; keys added meanwhile stay indexed.
        if (keys.length > 0) await redisClient.srem(indexKey, keys);
        return deletedCount;
      } catch (err) {
        reportRedisError({ module: moduleForKey(prefix), operation: 'invalidate', extra: { pattern } }, err);
        return 0;
      }
    }

    try {
      let cursor = '0';
      let deletedCount = 0;
      do {
        const reply = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
        cursor = reply[0];
        const keys = reply[1];
        if (keys.length > 0) {
          const result = await redisClient.unlink(keys);
          deletedCount += result;
        }
      } while (cursor !== '0');
      return deletedCount;
    } catch (err) {
      reportRedisError({ module: moduleForKey(pattern), operation: 'invalidate:scan', extra: { pattern } }, err);
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
const inFlight = new Map();

const cacheWrapper = async (key, fn, ttl = CACHE_TTL.POST) => {
  // Join an in-flight load first: concurrent misses then share one Redis GET and one DB query.
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }
  const pending = (async () => {
    try {
      const cachedValue = await getCache(key);
      if (cachedValue !== null) {
        return cachedValue;
      }
      const freshValue = await fn();
      if (freshValue !== null && freshValue !== undefined) {
        // Don't make the caller wait for the write; setCache reports its own failures.
        setCache(key, freshValue, ttl).catch(() => {});
      }
      return freshValue;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, pending);
  return pending;
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
  localeList: (filters) => `locales:list:${JSON.stringify(filters)}`,
  locale: (localeId) => `locales:item:${localeId}`,
  localeCountries: () => 'locales:countries',
  localeStates: (countryCode) => `locales:states:${countryCode}`,
  localeSpotTypes: () => 'locales:spot-types',
  shortsCandidates: () => 'shorts:candidates:v2',
  shortsPublicAuthors: () => 'shorts:authors:public:v1',
  shortsFeedFirst: (viewerId, limit) => `shorts:feed:first:${viewerId}:${limit}`,
  shortsHlsPlaylist: (postId) => `shorts:hls:playlist:${postId}`,
  signedUrl: (mediaType, storageKey) => `signedurl:${mediaType}:${storageKey}`,
  blockedIds: (userId) => `blocked:${userId}`,
  authUser: (userId) => `authuser:${userId}`,
};

const invalidateShortsFeedCache = async () => {
  await Promise.all([
    deleteCache(CacheKeys.shortsCandidates()),
    deleteCacheByPattern('shorts:feed:first:*'),
  ]);
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  claimKey,
  cacheWrapper,
  invalidateShortsFeedCache,
  CacheKeys,
  CACHE_TTL,
  redisClient,
  reportRedisError,
  moduleForKey,
};

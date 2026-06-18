const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { redisClient } = require('../utils/cache');
const logger = require('../utils/logger');

// Custom resilient store that delegates to RedisStore if Redis is ready,
// and falls back to express-rate-limit's built-in MemoryStore otherwise.
class ResilientRedisStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.redisStore = null;
    this.memoryStore = new rateLimit.MemoryStore();
    this.options = null;
  }

  init(options) {
    this.options = options;
    if (typeof this.memoryStore.init === 'function') {
      this.memoryStore.init(options);
    }
    if (this.redisStore && typeof this.redisStore.init === 'function') {
      this.redisStore.init(options);
    }
  }

  getRedisStore() {
    if (redisClient && redisClient.status === 'ready') {
      if (!this.redisStore) {
        try {
          this.redisStore = new RedisStore({
            sendCommand: (...args) => {
              if (redisClient && redisClient.status === 'ready') {
                return redisClient.call(...args);
              }
              return Promise.reject(new Error('Redis is not connected'));
            },
            prefix: `rl:${this.prefix}:`,
          });
          if (this.options && typeof this.redisStore.init === 'function') {
            this.redisStore.init(this.options);
          }
        } catch (err) {
          logger.error(`Failed to initialize RedisStore for prefix ${this.prefix}:`, err.message);
          return null;
        }
      }
      return this.redisStore;
    }
    return null;
  }

  async get(key) {
    const store = this.getRedisStore();
    if (store) {
      try {
        return await store.get(key);
      } catch (err) {
        logger.warn(`Rate limiter Redis get failed for prefix ${this.prefix}, falling back to memory:`, err.message);
      }
    }
    if (typeof this.memoryStore.get === 'function') {
      return await this.memoryStore.get(key);
    }
  }

  async increment(key) {
    const store = this.getRedisStore();
    if (store) {
      try {
        return await store.increment(key);
      } catch (err) {
        logger.warn(`Rate limiter Redis increment failed for prefix ${this.prefix}, falling back to memory:`, err.message);
      }
    }
    return await this.memoryStore.increment(key);
  }

  async decrement(key) {
    const store = this.getRedisStore();
    if (store) {
      try {
        return await store.decrement(key);
      } catch (err) {
        logger.warn(`Rate limiter Redis decrement failed for prefix ${this.prefix}, falling back to memory:`, err.message);
      }
    }
    return await this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    const store = this.getRedisStore();
    if (store) {
      try {
        return await store.resetKey(key);
      } catch (err) {
        logger.warn(`Rate limiter Redis resetKey failed for prefix ${this.prefix}, falling back to memory:`, err.message);
      }
    }
    return await this.memoryStore.resetKey(key);
  }
}

// Custom key generator for user-based rate limiting
const userKeyGenerator = (req) => {
  return req.user?.id || req.user?._id || req.ip;
};

// Custom key generator for IP-based rate limiting
const ipKeyGenerator = (req) => {
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
  },
  keyGenerator: ipKeyGenerator,
  store: new ResilientRedisStore('general'),
});

// Strict rate limiter for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Too many requests. Please wait 15 minutes before trying again.',
  },
  keyGenerator: ipKeyGenerator,
  skipSuccessfulRequests: false,
  store: new ResilientRedisStore('strict'),
});

// User-based rate limiter (for authenticated users)
const createUserLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: 'You have exceeded your rate limit. Please try again later.',
    },
    keyGenerator: userKeyGenerator,
    skipSuccessfulRequests: false,
    store: new ResilientRedisStore(`user:${maxRequests}:${windowMs}`),
  });
};

// IP-based rate limiter
const createIPLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.',
    },
    keyGenerator: ipKeyGenerator,
    skipSuccessfulRequests: false,
    store: new ResilientRedisStore(`ip:${maxRequests}:${windowMs}`),
  });
};

// Endpoint-specific limiters
const endpointLimiters = {
  // Auth endpoints
  signup: createIPLimiter(5, 15 * 60 * 1000), // 5 signups per 15 minutes per IP
  signin: createIPLimiter(10, 15 * 60 * 1000), // 10 signins per 15 minutes per IP
  otp: strictLimiter, // 5 OTP requests per 15 minutes per IP
  passwordReset: strictLimiter, // 5 password resets per 15 minutes per IP
  
  // Post endpoints
  createPost: createUserLimiter(20, 60 * 60 * 1000), // 20 posts per hour per user
  likePost: createUserLimiter(100, 15 * 60 * 1000), // 100 likes per 15 minutes per user
  commentPost: createUserLimiter(50, 15 * 60 * 1000), // 50 comments per 15 minutes per user
  
  // Profile endpoints
  updateProfile: createUserLimiter(10, 60 * 60 * 1000), // 10 updates per hour per user
  followUser: createUserLimiter(50, 15 * 60 * 1000), // 50 follows per 15 minutes per user
  
  // Chat endpoints
  sendMessage: createUserLimiter(100, 15 * 60 * 1000), // 100 messages per 15 minutes per user
  
  // Analytics endpoints
  trackEvents: createUserLimiter(100, 60 * 1000), // 100 events per minute per user
  
  // Search endpoints
  search: createIPLimiter(30, 60 * 1000), // 30 searches per minute per IP

  // Subscription / money-path endpoints — protect Cashfree from being spammed
  // and protect us from reckless retry storms by a buggy client.
  subscriptionWrite: createUserLimiter(10, 60 * 60 * 1000), // 10 subscribe/cancel per hour per user
  subscriptionRead: createUserLimiter(60, 60 * 1000),       // 60 status/payout-preview per minute per user

  // Journey high-frequency endpoint. The hook batches every ~10s, so 30/min
  // gives plenty of headroom for normal use while blocking flood from a
  // buggy retry loop or a malicious client.
  journeyLocation: createUserLimiter(30, 60 * 1000),
};

// Middleware to combine user and IP rate limiting
const combinedLimiter = (userLimit = 100, ipLimit = 50, windowMs = 15 * 60 * 1000) => {
  const userLimiter = createUserLimiter(userLimit, windowMs);
  const ipLimiter = createIPLimiter(ipLimit, windowMs);
  
  return (req, res, next) => {
    // Apply IP limiter first
    ipLimiter(req, res, (err) => {
      if (err) return next(err);
      
      // If authenticated, also apply user limiter
      if (req.user) {
        userLimiter(req, res, next);
      } else {
        next();
      }
    });
  };
};

module.exports = {
  generalLimiter,
  strictLimiter,
  createUserLimiter,
  createIPLimiter,
  endpointLimiters,
  combinedLimiter,
};


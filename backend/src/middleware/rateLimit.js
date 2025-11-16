const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Store user-based rate limit tracking
const userRateLimitStore = new Map();
const ipRateLimitStore = new Map();

// Cleanup old entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of userRateLimitStore.entries()) {
    if (now - data.resetTime > 15 * 60 * 1000) {
      userRateLimitStore.delete(key);
    }
  }
  for (const [key, data] of ipRateLimitStore.entries()) {
    if (now - data.resetTime > 15 * 60 * 1000) {
      ipRateLimitStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

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


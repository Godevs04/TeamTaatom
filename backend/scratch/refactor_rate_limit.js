const fs = require('fs');
const path = require('path');

const filePath = 'h:/Ganesh Files/RootedAI/taatom/TeamTaatom/backend/src/middleware/rateLimit.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original content length:', content.length);

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Replace the top store & interval block with imports and ResilientRedisStore definition
const target1 = `const rateLimit = require('express-rate-limit');

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
}, 15 * 60 * 1000);`;

const replacement1 = `const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { redisClient } = require('../utils/cache');
const logger = require('../utils/logger');

// Custom resilient store that delegates to RedisStore if Redis is ready,
// and falls back to express-rate-limit's built-in MemoryStore otherwise.
class ResilientRedisStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.redisStore = new RedisStore({
      sendCommand: (...args) => {
        if (redisClient && redisClient.status === 'ready') {
          return redisClient.call(...args);
        }
        return Promise.reject(new Error('Redis is not connected'));
      },
      prefix: \`rl:\${prefix}:\`,
    });
    this.memoryStore = new rateLimit.MemoryStore();
  }

  async increment(key) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await this.redisStore.increment(key);
      } catch (err) {
        logger.warn(\`Rate limiter Redis increment failed for prefix \${this.prefix}, falling back to memory:\`, err.message);
      }
    }
    return await this.memoryStore.increment(key);
  }

  async decrement(key) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await this.redisStore.decrement(key);
      } catch (err) {
        logger.warn(\`Rate limiter Redis decrement failed for prefix \${this.prefix}, falling back to memory:\`, err.message);
      }
    }
    return await this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await this.redisStore.resetKey(key);
      } catch (err) {
        logger.warn(\`Rate limiter Redis resetKey failed for prefix \${this.prefix}, falling back to memory:\`, err.message);
      }
    }
    return await this.memoryStore.resetKey(key);
  }
}`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('Successfully replaced top store & interval block.');
} else {
  console.warn('Could not find target 1!');
}

// 2. Add store to generalLimiter
const target2 = `// General rate limiter
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
});`;

const replacement2 = `// General rate limiter
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
});`;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('Successfully added store to generalLimiter.');
} else {
  console.warn('Could not find target 2!');
}

// 3. Add store to strictLimiter
const target3 = `// Strict rate limiter for sensitive endpoints
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
});`;

const replacement3 = `// Strict rate limiter for sensitive endpoints
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
});`;

if (content.includes(target3)) {
  content = content.replace(target3, replacement3);
  console.log('Successfully added store to strictLimiter.');
} else {
  console.warn('Could not find target 3!');
}

// 4. Add store to createUserLimiter
const target4 = `// User-based rate limiter (for authenticated users)
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
};`;

const replacement4 = `// User-based rate limiter (for authenticated users)
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
    store: new ResilientRedisStore(\`user:\${maxRequests}:\${windowMs}\`),
  });
};`;

if (content.includes(target4)) {
  content = content.replace(target4, replacement4);
  console.log('Successfully added store to createUserLimiter.');
} else {
  console.warn('Could not find target 4!');
}

// 5. Add store to createIPLimiter
const target5 = `// IP-based rate limiter
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
};`;

const replacement5 = `// IP-based rate limiter
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
    store: new ResilientRedisStore(\`ip:\${maxRequests}:\${windowMs}\`),
  });
};`;

if (content.includes(target5)) {
  content = content.replace(target5, replacement5);
  console.log('Successfully added store to createIPLimiter.');
} else {
  console.warn('Could not find target 5!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done refactoring rateLimit.js. New length:', content.length);

const redis = require('redis');
const logger = require('./logger');

let redisClient = null;

// Create Redis client
const createRedisClient = () => {
  if (redisClient) {
    return redisClient;
  }

  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    enableReadyCheck: true,
  };

  redisClient = redis.createClient(config);

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis Client: Connecting...');
  });

  redisClient.on('ready', () => {
    logger.info('Redis Client: Ready');
  });

  redisClient.on('reconnecting', () => {
    logger.warn('Redis Client: Reconnecting...');
  });

  return redisClient;
};

// Check Redis connection health
const checkRedisHealth = async () => {
  try {
    const client = createRedisClient();
    
    if (!client.isOpen) {
      await client.connect();
    }
    
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error.message);
    return false;
  }
};

// Initialize Redis connection
const initializeRedis = async () => {
  try {
    const client = createRedisClient();
    
    if (!client.isOpen) {
      await client.connect();
    }
    
    const isHealthy = await checkRedisHealth();
    if (isHealthy) {
      logger.info('✅ Redis connection established successfully');
      return client;
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    logger.error('❌ Failed to connect to Redis:', error.message);
    logger.warn('⚠️  Background jobs will not work without Redis');
    return null;
  }
};

// Get Redis client (lazy initialization)
const getRedisClient = () => {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
};

// Close Redis connection
const closeRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

module.exports = {
  createRedisClient,
  checkRedisHealth,
  initializeRedis,
  getRedisClient,
  closeRedis,
};


const Queue = require('bull');
const logger = require('../utils/logger');
const { initializeRedis, checkRedisHealth } = require('../utils/redisHealth');

// Redis connection configuration for Bull
// Note: Bull doesn't allow enableReadyCheck or maxRetriesPerRequest
// See: https://github.com/OptimalBits/bull/issues/1873
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // Bull handles retries internally, so we don't set retryStrategy here
  // Bull also doesn't allow enableReadyCheck or maxRetriesPerRequest
};

// Create queues
const emailQueue = new Queue('email', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

const imageProcessingQueue = new Queue('image-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

const analyticsQueue = new Queue('analytics', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

const cleanupQueue = new Queue('cleanup', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Initialize Redis before creating queues
let redisInitialized = false;

const initializeRedisConnection = async () => {
  if (redisInitialized) return true;
  
  try {
    const isHealthy = await checkRedisHealth();
    if (isHealthy) {
      redisInitialized = true;
      logger.info('✅ Redis is ready for Bull queues');
      return true;
    } else {
      logger.warn('⚠️  Redis health check failed - queues may not work');
      return false;
    }
  } catch (error) {
    logger.error('❌ Redis initialization failed:', error.message);
    logger.warn('⚠️  Background jobs will not work without Redis');
    return false;
  }
};

// Queue event handlers
const setupQueueEvents = (queue, queueName) => {
  queue.on('completed', (job) => {
    logger.info(`[${queueName}] Job ${job.id} completed`);
  });

  queue.on('failed', (job, err) => {
    logger.error(`[${queueName}] Job ${job.id} failed:`, err);
  });

  queue.on('error', (error) => {
    logger.error(`[${queueName}] Queue error:`, error);
  });

  queue.on('stalled', (job) => {
    logger.warn(`[${queueName}] Job ${job.id} stalled`);
  });

  queue.on('waiting', (jobId) => {
    logger.debug(`[${queueName}] Job ${jobId} waiting`);
  });
};

// Initialize Redis and setup queues
(async () => {
  const redisReady = await initializeRedisConnection();
  if (redisReady) {
    // Setup event handlers for all queues
    setupQueueEvents(emailQueue, 'email');
    setupQueueEvents(imageProcessingQueue, 'image-processing');
    setupQueueEvents(analyticsQueue, 'analytics');
    setupQueueEvents(cleanupQueue, 'cleanup');
  }
})();

// Graceful shutdown
const closeQueues = async () => {
  await Promise.all([
    emailQueue.close(),
    imageProcessingQueue.close(),
    analyticsQueue.close(),
    cleanupQueue.close(),
  ]);
  logger.info('All queues closed');
};

process.on('SIGTERM', closeQueues);
process.on('SIGINT', closeQueues);

module.exports = {
  emailQueue,
  imageProcessingQueue,
  analyticsQueue,
  cleanupQueue,
  closeQueues,
};


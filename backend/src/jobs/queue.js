/**
 * Background Job Queue (Disabled)
 * Queue functionality is disabled - all queues are no-op
 * This maintains API compatibility for future Redis/Bull integration
 */

const logger = require('../utils/logger');

// No-op queue objects that maintain API compatibility
const createNoOpQueue = (name) => {
  return {
    add: async (jobName, data, options) => {
      logger.warn(`Queue disabled: Attempted to add job "${jobName}" to "${name}" queue. Job data:`, data);
      return Promise.resolve({ id: 'disabled', name: jobName });
    },
    process: () => {
      logger.warn(`Queue disabled: Attempted to process "${name}" queue`);
    },
    close: async () => {
      logger.debug(`Queue "${name}" close called (no-op)`);
      return Promise.resolve();
    },
    on: () => {
      // No-op event handler
    },
  };
};

// Create no-op queues
const emailQueue = createNoOpQueue('email');
const imageProcessingQueue = createNoOpQueue('image-processing');
const analyticsQueue = createNoOpQueue('analytics');
const cleanupQueue = createNoOpQueue('cleanup');

logger.info('⚠️  Background job queues are disabled (Redis not configured)');

// Graceful shutdown (no-op)
const closeQueues = async () => {
  logger.info('Queue shutdown called (queues already disabled)');
  return Promise.resolve();
};

module.exports = {
  emailQueue,
  imageProcessingQueue,
  analyticsQueue,
  cleanupQueue,
  closeQueues,
};

const {
  emailQueue,
  imageProcessingQueue,
  analyticsQueue,
  cleanupQueue,
} = require('./queue');
const logger = require('../utils/logger');

// Note: Queues are disabled (no Redis) - process() calls are no-op
// Workers will log warnings when jobs are attempted but won't process them
// This maintains API compatibility for future Redis integration

logger.info('⚠️  Background job workers initialized (queues disabled - no Redis)');

module.exports = {
  emailQueue,
  imageProcessingQueue,
  analyticsQueue,
  cleanupQueue,
};


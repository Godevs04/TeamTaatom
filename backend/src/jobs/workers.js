const {
  emailQueue,
  imageProcessingQueue,
  analyticsQueue,
  cleanupQueue,
} = require('./queue');
const { processEmailJob } = require('./processors/email');
const { processImageJob } = require('./processors/image');
const { processAnalyticsJob } = require('./processors/analytics');
const { processCleanupJob } = require('./processors/cleanup');
const logger = require('../utils/logger');

// Start email worker
emailQueue.process('send-email', 5, async (job) => {
  return await processEmailJob(job);
});

// Start image processing worker
imageProcessingQueue.process('process-image', 3, async (job) => {
  return await processImageJob(job);
});

// Start analytics worker
analyticsQueue.process('aggregate-analytics', 2, async (job) => {
  return await processAnalyticsJob(job);
});

// Start cleanup worker
cleanupQueue.process('cleanup', 1, async (job) => {
  return await processCleanupJob(job);
});

logger.info('Background job workers started');

module.exports = {
  emailQueue,
  imageProcessingQueue,
  analyticsQueue,
  cleanupQueue,
};


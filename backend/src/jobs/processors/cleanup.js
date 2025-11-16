const AnalyticsEvent = require('../../models/AnalyticsEvent');
const ErrorLog = require('../../models/ErrorLog');
const { logger } = require('../../utils/logger');

// Process cleanup job
const processCleanupJob = async (job) => {
  const { cleanupType, olderThanDays } = job.data;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (olderThanDays || 90));

    let result;
    switch (cleanupType) {
      case 'analytics':
        result = await AnalyticsEvent.deleteMany({
          timestamp: { $lt: cutoffDate },
        });
        logger.info(`Cleaned up ${result.deletedCount} old analytics events`);
        break;
      case 'errors':
        result = await ErrorLog.deleteMany({
          timestamp: { $lt: cutoffDate },
          resolved: true,
        });
        logger.info(`Cleaned up ${result.deletedCount} resolved error logs`);
        break;
      case 'all':
        const analyticsResult = await AnalyticsEvent.deleteMany({
          timestamp: { $lt: cutoffDate },
        });
        const errorsResult = await ErrorLog.deleteMany({
          timestamp: { $lt: cutoffDate },
          resolved: true,
        });
        result = {
          analytics: analyticsResult.deletedCount,
          errors: errorsResult.deletedCount,
        };
        logger.info(`Cleaned up ${result.analytics} analytics events and ${result.errors} error logs`);
        break;
      default:
        throw new Error(`Unknown cleanup type: ${cleanupType}`);
    }

    return { success: true, result };
  } catch (error) {
    logger.error('Error processing cleanup:', error);
    throw error;
  }
};

module.exports = {
  processCleanupJob,
};


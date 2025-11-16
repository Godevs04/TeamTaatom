const AnalyticsEvent = require('../../models/AnalyticsEvent');
const logger = require('../../utils/logger');

// Process analytics aggregation job
const processAnalyticsJob = async (job) => {
  const { startDate, endDate, aggregationType } = job.data;

  try {
    const query = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    let result;
    switch (aggregationType) {
      case 'daily':
        result = await AnalyticsEvent.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
              },
              count: { $sum: 1 },
              events: { $push: '$event' },
            },
          },
          { $sort: { _id: 1 } },
        ]);
        break;
      case 'hourly':
        result = await AnalyticsEvent.aggregate([
          { $match: query },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d %H:00:00', date: '$timestamp' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]);
        break;
      default:
        result = await AnalyticsEvent.find(query).countDocuments();
    }

    logger.info(`Analytics aggregation completed: ${aggregationType}`);
    return { success: true, result };
  } catch (error) {
    logger.error('Error processing analytics:', error);
    throw error;
  }
};

module.exports = {
  processAnalyticsJob,
};


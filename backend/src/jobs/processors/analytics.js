const AnalyticsEvent = require('../../models/AnalyticsEvent');
const logger = require('../../utils/logger');

// Process analytics aggregation job
const processAnalyticsJob = async (job) => {
  const { startDate, endDate, aggregationType, events } = job.data;

  try {
    // If job is for flushing queued events to database
    if (events && Array.isArray(events)) {
      const Post = require('../../models/Post');
      const eventsToSave = events.map(event => ({
        event: event.event,
        userId: event.userId || null,
        properties: event.properties || {},
        platform: event.platform,
        sessionId: event.sessionId,
        timestamp: new Date(event.timestamp || Date.now()),
      }));

      await AnalyticsEvent.insertMany(eventsToSave);

      // Increment views
      for (const event of eventsToSave) {
        if (event.event === 'post_view') {
          const postId = event.properties?.post_id || event.properties?.postId;
          if (postId) {
            try {
              const post = await Post.findById(postId);
              if (post) {
                const isCreator = post.user && event.userId && post.user.toString() === event.userId.toString();
                let shouldIncrement = true;
                if (isCreator) {
                  const startOfDay = new Date();
                  startOfDay.setHours(0, 0, 0, 0);
                  const existingCreatorView = await AnalyticsEvent.findOne({
                    event: 'post_view',
                    userId: event.userId,
                    $or: [
                      { 'properties.post_id': postId },
                      { 'properties.postId': postId }
                    ],
                    timestamp: { $gte: startOfDay, $lt: event.timestamp }
                  });
                  if (existingCreatorView) {
                    shouldIncrement = false;
                  }
                }
                if (shouldIncrement) {
                  const viewAggregator = require('../../utils/viewAggregator');
                  viewAggregator.addView(postId);
                }
              }
            } catch (err) {
              logger.error(`Error incrementing post view in queue for ${postId}:`, err);
            }
          }
        }
      }
      logger.info(`Analytics event flush completed: ${events.length} events`);
      return { success: true, count: events.length };
    }

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


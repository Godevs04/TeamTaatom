const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  properties: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  platform: {
    type: String,
    index: true,
  },
  sessionId: {
    type: String,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    // Index created by compound indexes and TTL index below
  },
}, {
  timestamps: false, // We use custom timestamp
});

// Compound indexes for common queries
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ event: 1, timestamp: -1 });
analyticsEventSchema.index({ sessionId: 1, timestamp: -1 });

// TTL index to auto-delete old events after 90 days
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);


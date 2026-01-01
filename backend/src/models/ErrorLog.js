const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
  },
  stack: {
    type: String,
  },
  name: {
    type: String,
    default: 'Error',
  },
  platform: {
    type: String,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  context: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    // Index created by compound indexes and TTL index below
  },
  resolved: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: false,
});

// Indexes for common queries
errorLogSchema.index({ platform: 1, timestamp: -1 });
errorLogSchema.index({ userId: 1, timestamp: -1 });
errorLogSchema.index({ resolved: 1, timestamp: -1 });

// TTL index to auto-delete resolved errors after 30 days
errorLogSchema.index(
  { timestamp: 1 },
  { 
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { resolved: true }
  }
);

module.exports = mongoose.model('ErrorLog', errorLogSchema);


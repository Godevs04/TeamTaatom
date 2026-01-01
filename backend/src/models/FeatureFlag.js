const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  description: {
    type: String,
    default: '',
  },
  enabled: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String,
    enum: ['A', 'B', 'C', 'D', null],
    default: null,
  },
  category: {
    type: String,
    default: 'other',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  impact: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  targetUsers: {
    type: mongoose.Schema.Types.Mixed, // Can be 'all', array of user IDs, or object
    default: 'all',
  },
  targetPlatforms: {
    type: [String],
    default: [], // ['ios', 'android', 'web'] - empty means all platforms
  },
  rolloutPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 100, // 100% rollout by default
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
  },
  changelog: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'enabled', 'disabled', 'deleted'],
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin',
    },
    changes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Index for active flags
featureFlagSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);

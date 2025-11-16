const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
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
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  targetUsers: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: [],
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
}, {
  timestamps: true,
});

// Index for active flags
featureFlagSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);

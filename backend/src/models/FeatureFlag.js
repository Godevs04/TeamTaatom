const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  enabled: {
    type: Boolean,
    default: false
  },
  rolloutPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  targetUsers: {
    type: String,
    enum: ['all', 'beta', 'premium', 'new'],
    default: 'all'
  },
  category: {
    type: String,
    enum: ['ui', 'ai', 'analytics', 'social', 'security', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  impact: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  changelog: [{
    action: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin'
    },
    changes: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  environments: {
    local: {
      enabled: {
        type: Boolean,
        default: false
      }
    },
    staging: {
      enabled: {
        type: Boolean,
        default: false
      }
    },
    production: {
      enabled: {
        type: Boolean,
        default: false
      }
    }
  }
}, {
  timestamps: true
});

// Indexes
featureFlagSchema.index({ name: 1 });
featureFlagSchema.index({ category: 1 });
featureFlagSchema.index({ enabled: 1 });
featureFlagSchema.index({ updatedAt: -1 });

// Method to log changes
featureFlagSchema.methods.logChange = function(action, changedBy, changes) {
  this.changelog.push({
    action,
    changedBy,
    changes,
    timestamp: new Date()
  });
  
  // Keep only last 50 changes
  if (this.changelog.length > 50) {
    this.changelog = this.changelog.slice(-50);
  }
  
  return this.save();
};

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);


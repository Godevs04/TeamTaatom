const mongoose = require('mongoose');

/**
 * Journey Model - Continuous Travel Recorder
 *
 * Represents a continuous travel journey spanning days/weeks.
 * A journey starts when user taps "Start", records GPS continuously,
 * can be paused/resumed multiple times, and ends either manually or
 * automatically after 24 hours of being paused.
 */
const journeySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: ''
  },
  // Starting location
  startCoords: {
    lat: {
      type: Number,
      required: true
    },
    lng: {
      type: Number,
      required: true
    }
  },
  // Ending location (set on completion)
  endCoords: {
    lat: {
      type: Number,
      required: false
    },
    lng: {
      type: Number,
      required: false
    }
  },
  // Continuous GPS path recorded during travel
  polyline: [
    {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      accuracy: {
        type: Number,
        required: false
      }
    }
  ],
  // Posts/shorts/videos auto-attached during journey
  waypoints: [
    {
      post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: false
      },
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      contentType: {
        type: String,
        enum: ['photo', 'short', 'video'],
        default: 'photo'
      }
    }
  ],
  // Journey status
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  // Track each start/stop cycle
  sessions: [
    {
      startedAt: {
        type: Date,
        required: true
      },
      stoppedAt: {
        type: Date,
        required: false
      },
      startCoords: {
        lat: Number,
        lng: Number
      },
      endCoords: {
        lat: Number,
        lng: Number
      }
    }
  ],
  // Timeline
  startedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    required: false
  },
  pausedAt: {
    type: Date,
    required: false
  },
  // Distance in meters
  distanceTraveled: {
    type: Number,
    default: 0
  },
  // Countries traversed (derived from GPS)
  countries: [
    {
      type: String
    }
  ],
  // Friend whose trip inspired this journey (if navigating to their place)
  sourceUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Privacy setting
  privacy: {
    type: String,
    enum: ['public', 'followers'],
    default: 'public'
  },
  // TripScore awarded on completion
  tripScoreAwarded: {
    type: Number,
    default: 0
  },
  // Whether journey was ended by 24hr rule
  autoEnded: {
    type: Boolean,
    default: false
  },
  // Active flag for filtering
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for efficient queries
journeySchema.index({ user: 1, status: 1 });
journeySchema.index({ status: 1, pausedAt: 1 }); // For 24hr auto-end query
journeySchema.index({ user: 1, isActive: 1, startedAt: -1 });

/**
 * Instance method: Check if journey belongs to userId
 */
journeySchema.methods.isOwner = function(userId) {
  return this.user.toString() === userId.toString();
};

/**
 * Instance method: Check privacy - can viewerUser see this journey?
 * Public: anyone can view
 * Followers: only followers of owner can view
 */
journeySchema.methods.canBeViewedBy = async function(viewerUser) {
  // Owner can always view
  if (this.isOwner(viewerUser._id)) {
    return true;
  }

  // Public journeys visible to everyone
  if (this.privacy === 'public') {
    return true;
  }

  // Followers privacy: check if viewer follows journey owner
  if (this.privacy === 'followers') {
    // Get the journey owner's user document
    const User = require('./User');
    const owner = await User.findById(this.user).select('followers').lean();
    if (owner && owner.followers) {
      return owner.followers.some(f => f.toString() === viewerUser._id.toString());
    }
    return false;
  }

  return false;
};

/**
 * Static method: Get user's currently active or paused journey
 */
journeySchema.statics.getActiveJourney = function(userId) {
  return this.findOne({
    user: userId,
    status: { $in: ['active', 'paused'] }
  });
};

/**
 * Static method: Find journeys that have been paused for more than 24 hours
 * @param {Number} hoursAgo - Hours to check back (default: 24)
 * @returns {Promise<Array>} Array of expired paused journeys
 */
journeySchema.statics.getExpiredPausedJourneys = function(hoursAgo = 24) {
  const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return this.find({
    status: 'paused',
    pausedAt: { $lt: cutoffTime }
  });
};

module.exports = mongoose.model('Journey', journeySchema);

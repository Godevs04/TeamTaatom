const mongoose = require('mongoose');

const polylineLengthMeters = (points) => {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const lat1 = a.lat ?? a.latitude;
    const lng1 = a.lng ?? a.longitude;
    const lat2 = b.lat ?? b.latitude;
    const lng2 = b.lng ?? b.longitude;
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) continue;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  return total;
};

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
  // The Hardware Truth: Used for audits and OSRM debugging
  raw_polyline: [
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
      },
      segmentBreak: {
        type: Boolean,
        default: false
      },
      speed: {
        type: Number,
        required: false
      },
      heading: {
        type: Number,
        required: false
      }
    }
  ],
  // The Mathematical Truth: Used exclusively for Frontend Rendering
  snapped_polyline: [
    {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    }
  ],
  // Legacy / Compatibility GPS path (getter reconstructed dynamically for reads)
  polyline: {
    type: [
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
        },
        segmentBreak: {
          type: Boolean,
          default: false
        },
        speed: {
          type: Number,
          required: false
        },
        heading: {
          type: Number,
          required: false
        }
      }
    ],
    get: function(val) {
      const snapped = this.snapped_polyline || [];
      const raw = this.raw_polyline || [];
      if (snapped.length === 0) return val;
      if (raw.length >= 2 && polylineLengthMeters(snapped) + 5 < polylineLengthMeters(raw)) return raw;
      return snapped.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp,
        accuracy: p.accuracy || 0,
        segmentBreak: !!p.segmentBreak,
        speed: p.speed,
        heading: p.heading,
      }));
    }
  },
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
  // Tracking / map-matching diagnostics for route trust and debugging
  routeQuality: {
    totalRawPoints: {
      type: Number,
      default: 0
    },
    acceptedPoints: {
      type: Number,
      default: 0
    },
    rejectedInvalidPoints: {
      type: Number,
      default: 0
    },
    rejectedLowAccuracyPoints: {
      type: Number,
      default: 0
    },
    rejectedDuplicatePoints: {
      type: Number,
      default: 0
    },
    rejectedImpossibleSpeedPoints: {
      type: Number,
      default: 0
    },
    matchedPoints: {
      type: Number,
      default: 0
    },
    rawFallbackPoints: {
      type: Number,
      default: 0
    },
    averageGpsAccuracy: {
      type: Number,
      default: null
    },
    averageSnapDistance: {
      type: Number,
      default: null
    },
    averageMatchConfidence: {
      type: Number,
      default: null
    },
    lastUpdatedAt: {
      type: Date,
      required: false
    }
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
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
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
    const Follow = require('./Follow');
    return !!(await Follow.exists({ follower: viewerUser._id, following: this.user }));
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

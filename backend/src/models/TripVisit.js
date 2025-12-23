const mongoose = require('mongoose');

/**
 * TripVisit Model - TripScore v2
 * 
 * Represents a single travel visit derived from posts or shorts.
 * TripScore v2 is based on unique, verified visits rather than raw post counts.
 */
const tripVisitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: false, // Can be null if derived from short
    sparse: true
  },
  contentType: {
    type: String,
    enum: ['post', 'short'],
    required: true,
    default: 'post'
  },
  // Location data
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  continent: {
    type: String,
    required: true,
    enum: ['ASIA', 'AFRICA', 'NORTH AMERICA', 'SOUTH AMERICA', 'AUSTRALIA', 'EUROPE', 'ANTARCTICA', 'Unknown'],
    index: true
  },
  country: {
    type: String,
    required: true,
    index: true
  },
  city: {
    type: String,
    required: false
  },
  address: {
    type: String,
    required: false
  },
  // TripScore metadata from post
  spotType: {
    type: String,
    required: false,
    enum: ['Beach', 'Mountain', 'City', 'Natural spots', 'Religious', 'Cultural', 'General', null],
    default: null
  },
  travelInfo: {
    type: String,
    required: false,
    enum: ['Drivable', 'Hiking', 'Water Transport', 'Flight', 'Train', null],
    default: null
  },
  // Source and trust level
  source: {
    type: String,
    enum: ['taatom_camera_live', 'gallery_exif', 'gallery_no_exif', 'manual_only'],
    required: true,
    default: 'manual_only'
  },
  trustLevel: {
    type: String,
    enum: ['high', 'medium', 'low', 'unverified', 'suspicious'],
    required: true,
    default: 'unverified',
    index: true
  },
  // Timestamps
  takenAt: {
    type: Date,
    required: false // Can be null if not available from EXIF
  },
  uploadedAt: {
    type: Date,
    required: true // From post/short createdAt
  },
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Verification status (Hybrid TripScore Verification System)
  verificationStatus: {
    type: String,
    enum: ['auto_verified', 'pending_review', 'approved', 'rejected'],
    default: 'auto_verified', // Default to auto_verified for backward compatibility
    index: true
  },
  verificationReason: {
    type: String,
    enum: ['no_exif', 'manual_location', 'suspicious_pattern', 'photo_requires_review', 'gallery_exif_requires_review', 'photo_from_camera_requires_review', 'requires_admin_review'],
    required: false,
    default: null
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin user
    required: false,
    default: null
  },
  reviewedAt: {
    type: Date,
    required: false,
    default: null
  },
  // Metadata for fraud detection
  metadata: {
    exifAvailable: {
      type: Boolean,
      default: false
    },
    exifTimestamp: {
      type: Date,
      required: false
    },
    distanceFromPrevious: {
      type: Number, // Distance in km from previous trusted visit
      required: false
    },
    timeFromPrevious: {
      type: Number, // Time difference in hours from previous trusted visit
      required: false
    },
    flaggedReason: {
      type: String,
      required: false
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound indexes for efficient queries
tripVisitSchema.index({ user: 1, continent: 1, country: 1 });
tripVisitSchema.index({ user: 1, takenAt: 1 });
tripVisitSchema.index({ user: 1, trustLevel: 1 });
tripVisitSchema.index({ user: 1, isActive: 1, trustLevel: 1 });
tripVisitSchema.index({ user: 1, isActive: 1, verificationStatus: 1 }); // For TripScore calculation
tripVisitSchema.index({ verificationStatus: 1, isActive: 1 }); // For admin review queries
tripVisitSchema.index({ user: 1, lat: 1, lng: 1 }); // For deduplication

// Index for unique location per user (for deduplication)
tripVisitSchema.index({ user: 1, lat: 1, lng: 1, continent: 1, country: 1 }, { unique: false });

/**
 * Static method to check if a visit exists for a location
 * Uses tolerance to group nearby locations (default 0.01 degrees ≈ 1.1km)
 * This ensures multiple posts at the same location are grouped together
 */
tripVisitSchema.statics.findVisitByLocation = function(userId, lat, lng, tolerance = 0.01) {
  return this.findOne({
    user: userId,
    isActive: true,
    lat: { $gte: lat - tolerance, $lte: lat + tolerance },
    lng: { $gte: lng - tolerance, $lte: lng + tolerance }
  });
};

/**
 * Instance method to check if visit should count towards TripScore
 * Updated to use verificationStatus instead of trustLevel
 */
tripVisitSchema.methods.countsTowardsScore = function() {
  return this.isActive && ['auto_verified', 'approved'].includes(this.verificationStatus);
};

module.exports = mongoose.model('TripVisit', tripVisitSchema);


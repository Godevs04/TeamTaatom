const mongoose = require('mongoose');

const localeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Locale name is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  countryCode: {
    type: String,
    required: [true, 'Country code is required'],
    trim: true,
    uppercase: true
  },
  stateProvince: {
    type: String,
    trim: true,
    default: ''
  },
  stateCode: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [50, 'City must be less than 50 characters']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // New storage fields for Sevalla Object Storage
  storageKey: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  cloudinaryKey: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  cloudinaryUrl: {
    type: String,
    required: false
  },
  // Legacy fields for backward compatibility (deprecated, use storageKey/cloudinaryKey)
  imageKey: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  spotTypes: {
    type: [String],
    default: [],
    trim: true
  },
  travelInfo: {
    type: String,
    trim: true,
    default: 'Drivable',
    enum: ['Drivable', 'Walkable', 'Public Transport', 'Flight Required', 'Not Accessible']
  },
  latitude: {
    type: Number,
    required: false,
    default: null,
    validate: {
      validator: function(v) {
        return v === null || (v >= -90 && v <= 90);
      },
      message: 'Latitude must be between -90 and 90'
    }
  },
  longitude: {
    type: Number,
    required: false,
    default: null,
    validate: {
      validator: function(v) {
        return v === null || (v >= -180 && v <= 180);
      },
      message: 'Longitude must be between -180 and 180'
    }
  }
}, {
  timestamps: true
});

// Indexes for search and filtering
localeSchema.index({ isActive: 1, createdAt: -1 });
localeSchema.index({ countryCode: 1 });
localeSchema.index({ name: 1 }); // For faster regex searches
localeSchema.index({ country: 1 }); // For faster regex searches
localeSchema.index({ displayOrder: 1 });
// Geospatial index for location-based queries
localeSchema.index({ latitude: 1, longitude: 1 });
// Sparse unique index on imageKey to prevent duplicate null values (allows multiple nulls)
localeSchema.index({ imageKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Locale', localeSchema);


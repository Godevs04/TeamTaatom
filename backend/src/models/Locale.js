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
    sparse: true
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

module.exports = mongoose.model('Locale', localeSchema);


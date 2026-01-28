const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Song title is required'],
    trim: true
  },
  artist: {
    type: String,
    required: [true, 'Artist name is required'],
    trim: true
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [0, 'Duration must be positive']
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
  s3Key: {
    type: String,
    unique: true,
    sparse: true
  },
  s3Url: {
    type: String,
    sparse: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  // Image storage for song cover/artwork
  imageStorageKey: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  imageUrl: {
    type: String,
    required: false
  },
  genre: {
    type: String,
    default: 'General'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for search and filtering
// Note: Using regex search instead of text index for better compatibility
songSchema.index({ isActive: 1, createdAt: -1 });
songSchema.index({ genre: 1 });
songSchema.index({ title: 1 }); // For faster regex searches
songSchema.index({ artist: 1 }); // For faster regex searches

module.exports = mongoose.model('Song', songSchema);


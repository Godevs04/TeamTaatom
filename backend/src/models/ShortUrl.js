const mongoose = require('mongoose');

const shortUrlSchema = new mongoose.Schema({
  shortCode: {
    type: String,
    required: true,
    unique: true, // unique: true automatically creates an index
    trim: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  clickCount: {
    type: Number,
    default: 0
  },
  lastClickedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster lookups
// Note: shortCode index is automatically created by unique: true
shortUrlSchema.index({ postId: 1 });
// TTL index - expires documents after 1 year
shortUrlSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('ShortUrl', shortUrlSchema);

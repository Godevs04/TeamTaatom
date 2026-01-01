const mongoose = require('mongoose');

const hashtagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  postCount: {
    type: Number,
    default: 0,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
  // Store post IDs for quick access (optional, can be removed if not needed)
  recentPosts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
  }],
}, {
  timestamps: true,
});

// Indexes for performance
hashtagSchema.index({ postCount: -1 }); // For trending hashtags
hashtagSchema.index({ lastUsedAt: -1 }); // For recent hashtags
hashtagSchema.index({ name: 'text' }); // For text search

// Static method to get trending hashtags
hashtagSchema.statics.getTrending = async function(limit = 20, timeRange = '24h') {
  const timeRanges = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const timeAgo = new Date(Date.now() - (timeRanges[timeRange] || timeRanges['24h']));

  return this.find({
    lastUsedAt: { $gte: timeAgo },
  })
    .sort({ postCount: -1, lastUsedAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to search hashtags
hashtagSchema.statics.search = async function(query, limit = 20) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchQuery = query.toLowerCase().trim();
  
  return this.find({
    name: { $regex: `^${searchQuery}`, $options: 'i' },
  })
    .sort({ postCount: -1 })
    .limit(limit)
    .lean();
};

// Method to increment post count
hashtagSchema.methods.incrementPostCount = async function(postId) {
  this.postCount += 1;
  this.lastUsedAt = new Date();
  
  // Keep only recent 10 posts
  if (!this.recentPosts.includes(postId)) {
    this.recentPosts.push(postId);
    if (this.recentPosts.length > 10) {
      this.recentPosts.shift();
    }
  }
  
  await this.save();
};

// Method to decrement post count
hashtagSchema.methods.decrementPostCount = async function() {
  this.postCount = Math.max(0, this.postCount - 1);
  await this.save();
};

module.exports = mongoose.model('Hashtag', hashtagSchema);


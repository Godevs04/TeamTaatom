const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['post_created', 'post_liked', 'comment_added', 'user_followed', 'collection_created'],
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: false
  },
  collection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collection',
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Indexes for performance
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ targetUser: 1, createdAt: -1 });
activitySchema.index({ user: 1, type: 1, createdAt: -1 });
activitySchema.index({ isPublic: 1, createdAt: -1 });
// Unique index to prevent duplicate activities for same user, post, and type
activitySchema.index({ user: 1, type: 1, post: 1 }, { unique: true, sparse: true });

// Static method to create activity (with duplicate prevention)
activitySchema.statics.createActivity = async function(data) {
  // For post_liked type, check if activity already exists to prevent duplicates
  if (data.type === 'post_liked' && data.post) {
    const existing = await this.findOne({
      user: data.user,
      type: data.type,
      post: data.post
    });
    
    if (existing) {
      // Update timestamp and privacy settings if activity exists
      existing.createdAt = new Date();
      existing.isPublic = data.isPublic !== undefined ? data.isPublic : existing.isPublic;
      return await existing.save();
    }
  }
  
  // Create new activity if it doesn't exist
  const activity = new this(data);
  return await activity.save();
};

// Static method to get user activity feed
activitySchema.statics.getActivityFeed = async function(userId, options = {}) {
  const { 
    page = 1, 
    limit = 20, 
    type = null,
    includeOwn = true 
  } = options;
  
  const skip = (page - 1) * limit;
  
  // Get user's following list
  const user = await mongoose.model('User').findById(userId).select('following').lean();
  const followingIds = user?.following || [];
  
  // Build query
  const query = {};
  
  if (includeOwn) {
    // Include own activities (regardless of isPublic) and following's public activities
    if (followingIds.length > 0) {
      query.$or = [
        { user: userId }, // Own activities (show all, even if private)
        { user: { $in: followingIds }, isPublic: true } // Following's public activities
      ];
    } else {
      // No following, just show own activities
      query.user = userId;
    }
  } else {
    // Only show following's public activities
    if (followingIds.length > 0) {
      query.user = { $in: followingIds };
      query.isPublic = true;
    } else {
      // No following, return empty
      query.user = { $in: [] }; // Empty array, will return no results
    }
  }
  
  if (type) {
    query.type = type;
  }
  
  const activities = await this.find(query)
    .populate('user', 'fullName profilePic username')
    .populate('targetUser', 'fullName profilePic username')
    .populate('post', 'imageUrl caption type')
    .populate('collection', 'name coverImage')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  
  const totalActivities = await this.countDocuments(query);
  
  return {
    activities,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalActivities / limit),
      totalActivities,
      hasNextPage: skip + limit < totalActivities,
      limit
    }
  };
};

module.exports = mongoose.model('Activity', activitySchema);


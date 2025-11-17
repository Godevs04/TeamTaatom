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
  timestamps: true
});

// Indexes for performance
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ targetUser: 1, createdAt: -1 });
activitySchema.index({ user: 1, type: 1, createdAt: -1 });
activitySchema.index({ isPublic: 1, createdAt: -1 });

// Static method to create activity
activitySchema.statics.createActivity = async function(data) {
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
  const query = {
    isPublic: true
  };
  
  if (includeOwn) {
    query.$or = [
      { user: userId },
      { user: { $in: followingIds } }
    ];
  } else {
    query.user = { $in: followingIds };
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


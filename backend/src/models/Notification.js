const mongoose = require('mongoose');

// Import models to ensure they are registered with Mongoose
require('./User');
require('./Post');
require('./Comment');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'follow_request', 'follow_approved', 'post_mention'],
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: false
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: false
  },
  isRead: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ toUser: 1, createdAt: -1 });
notificationSchema.index({ toUser: 1, isRead: 1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  return await notification.save();
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const notifications = await this.find({ toUser: userId })
    .populate('fromUser', 'fullName profilePic email')
    .populate('post', 'imageUrl caption')
    .populate('comment', 'text')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalNotifications = await this.countDocuments({ toUser: userId });
  const unreadCount = await this.countDocuments({ toUser: userId, isRead: false });

  return {
    notifications,
    unreadCount,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalNotifications / limit),
      totalNotifications,
      hasNextPage: skip + limit < totalNotifications,
      limit
    }
  };
};

module.exports = mongoose.model('Notification', notificationSchema);


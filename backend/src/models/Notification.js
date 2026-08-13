const mongoose = require('mongoose');

// Import models to ensure they are registered with Mongoose
require('./User');
require('./Post');
require('./Comment');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'like',
      'comment',
      'follow',
      'follow_request',
      'follow_approved',
      'follow_request_accepted',
      'follow_request_rejected',
      'post_mention',
      // Sent to a Connect page owner when someone activates a paid subscription / purchase.
      'subscription_active',
      // Route access request notification types
      'route_access_request',
      'route_access_approved',
      'route_access_accepted',
      'route_access_rejected',
    ],
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
  await notification.save();

  // Real-time delivery, centralized here so every call site gets it "for
  // free" -- the same principle chat.controller.js's REST sendMessage
  // already uses for message:new/message:sent/chat:update. Targeted to the
  // recipient's own room (not a global nsp.emit broadcast): mobile's
  // existing 'notification' listeners (frontend/app/(tabs)/profile.tsx,
  // frontend/app/notifications.tsx) don't filter by payload.userId, so a
  // global broadcast would show every user every other user's notifications
  // the moment every notification type started delivering live. A targeted
  // emit makes that missing client-side filter moot without touching any
  // mobile code.
  //
  // Failure here must never fail notification creation -- the DB write
  // succeeding is what matters; real-time delivery degrading gracefully
  // matches how push-notification calls elsewhere in this codebase are
  // already fire-and-forget.
  try {
    // getSocket(), not getIO() -- getIO() logs an error every time it's
    // called before setupSocket() has run (e.g. in tests or one-off
    // scripts), which would add log noise to every context that creates a
    // notification without a running socket server.
    const { getSocket } = require('../socket');
    const io = getSocket();
    if (io) {
      // Re-fetch populated rather than populate the document being returned
      // to the caller, so this doesn't change what createNotification's own
      // return value looks like to any existing caller. Same projections
      // getUserNotifications already uses, so the socket payload matches
      // what a REST-fetched notification looks like -- no client-side shape
      // surprises. populate() on an absent ref (e.g. `post`/`comment` on a
      // follow notification) is a safe no-op.
      const populated = await this.findById(notification._id)
        .populate('fromUser', 'fullName profilePic profilePicStorageKey email')
        .populate('post', 'imageUrl caption storageKey storageKeys thumbnailUrl type')
        .populate('comment', 'text')
        .lean();

      io.of('/app').to(`user:${data.toUser}`).emit('notification', {
        userId: data.toUser,
        notification: {
          _id: populated._id,
          type: populated.type,
          fromUser: populated.fromUser,
          post: populated.post,
          comment: populated.comment,
          isRead: populated.isRead,
          createdAt: populated.createdAt,
        },
      });
    }
  } catch (err) {
    const logger = require('../utils/logger');
    logger.warn('createNotification: real-time emit failed:', err.message);
  }

  return notification;
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const notifications = await this.find({ toUser: userId })
    .populate('fromUser', 'fullName profilePic profilePicStorageKey email')
    .populate('post', 'imageUrl caption storageKey storageKeys thumbnailUrl type')
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


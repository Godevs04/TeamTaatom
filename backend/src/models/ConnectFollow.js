const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ConnectFollowSchema = new Schema({
  followerId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  connectPageId: {
    type: Types.ObjectId,
    ref: 'ConnectPage',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  followedAt: {
    type: Date,
    default: Date.now
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Unique compound index — a user can only follow a page once
ConnectFollowSchema.index({ followerId: 1, connectPageId: 1 }, { unique: true });
// For fetching user's followed pages
ConnectFollowSchema.index({ followerId: 1, status: 1, followedAt: -1 });
// For fetching page's followers
ConnectFollowSchema.index({ connectPageId: 1, status: 1 });

module.exports = mongoose.model('ConnectFollow', ConnectFollowSchema);

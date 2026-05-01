const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ConnectPageViewSchema = new Schema({
  userId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true
  },
  connectPageId: {
    type: Types.ObjectId,
    ref: 'ConnectPage',
    required: true
  },
  viewedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// For dedup query: check if view exists within 8-hour window
ConnectPageViewSchema.index({ userId: 1, connectPageId: 1, viewedAt: -1 });
// For analytics: count views per page
ConnectPageViewSchema.index({ connectPageId: 1, viewedAt: -1 });

module.exports = mongoose.model('ConnectPageView', ConnectPageViewSchema);

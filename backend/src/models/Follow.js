const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index to ensure follow relationship is unique
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Index for getting followers list of a user
followSchema.index({ following: 1 });

module.exports = mongoose.model('Follow', followSchema);

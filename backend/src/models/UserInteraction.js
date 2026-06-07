const mongoose = require('mongoose');

const userInteractionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // Array of recently viewed post IDs, capped logically in code
  viewedPosts: [{
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Affinities for spot types
  spotTypeAffinities: {
    type: Map,
    of: Number,
    default: {}
  },
  // Affinities for travel info
  travelInfoAffinities: {
    type: Map,
    of: Number,
    default: {}
  },
  // Affinities for specific creators
  creatorAffinities: {
    type: Map,
    of: Number,
    default: {}
  }
}, {
  timestamps: true
});

const UserInteraction = mongoose.model('UserInteraction', userInteractionSchema);

module.exports = UserInteraction;

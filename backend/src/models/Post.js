const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: [true, 'Comment text is required'],
    maxlength: [500, 'Comment cannot be more than 500 characters']
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    required: [true, 'Caption is required'],
    maxlength: [1000, 'Caption cannot be more than 1000 characters']
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  imageUrl: {
    type: String,
    required: function() {
      return this.type !== 'short';
    }
  },
  videoUrl: {
    type: String,
    required: false
  },
  cloudinaryPublicId: {
    type: String,
    required: false
  },
  images: [{
    type: String
  }],
  cloudinaryPublicIds: [{
    type: String
  }],
  tags: [{
    type: String,
    trim: true
  }],
  type: {
    type: String,
    enum: ['photo', 'short'],
    default: 'photo'
  },
  location: {
    address: {
      type: String,
      default: 'Unknown Location'
    },
    coordinates: {
      latitude: {
        type: Number,
        default: 0
      },
      longitude: {
        type: Number,
        default: 0
      }
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  commentsDisabled: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  song: {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: false
    },
    startTime: {
      type: Number,
      default: 0
    },
    endTime: {
      type: Number,
      default: null // null means play until end or 60 seconds from start
    },
    volume: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
postSchema.index({ user: 1, createdAt: -1 }); // User posts sorted by date
postSchema.index({ createdAt: -1 }); // All posts sorted by date
postSchema.index({ isActive: 1 }); // Filter active posts
postSchema.index({ type: 1, isActive: 1, createdAt: -1 }); // Type-based feed queries
postSchema.index({ user: 1, type: 1, isActive: 1, createdAt: -1 }); // User posts by type
postSchema.index({ tags: 1 }); // For hashtag/tag searches
postSchema.index({ 'location.coordinates': '2dsphere' }); // For geospatial location queries
postSchema.index({ likes: 1 }); // For like count queries
postSchema.index({ isHidden: 1, isActive: 1 }); // For filtering visible posts

// Virtual for like count
postSchema.virtual('likesCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for comments count
postSchema.virtual('commentsCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for views count (alias for views field)
postSchema.virtual('viewsCount').get(function() {
  return this.views || 0;
});

// Virtual for media URL (returns videoUrl for shorts, imageUrl for photos)
postSchema.virtual('mediaUrl').get(function() {
  if (this.type === 'short') {
    return this.videoUrl; // For shorts, always use videoUrl
  }
  return this.imageUrl; // For photos, use imageUrl
});

// Ensure virtual fields are serialized
postSchema.set('toJSON', { virtuals: true });
postSchema.set('toObject', { virtuals: true });

// Method to check if user liked the post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes ? this.likes.some(like => like.toString() === userId.toString()) : false;
};

// Method to toggle like
postSchema.methods.toggleLike = function(userId) {
  if (!this.likes) {
    this.likes = [];
  }
  
  const likeIndex = this.likes.findIndex(like => like.toString() === userId.toString());
  
  if (likeIndex > -1) {
    // Unlike
    this.likes.splice(likeIndex, 1);
    return false; // unliked
  } else {
    // Like
    this.likes.push(userId);
    return true; // liked
  }
};

// Method to add comment
postSchema.methods.addComment = function(userId, text) {
  if (!this.comments) {
    this.comments = [];
  }
  
  this.comments.push({
    user: userId,
    text: text
  });
  return this.comments[this.comments.length - 1];
};

// Method to remove comment
postSchema.methods.removeComment = function(commentId) {
  if (!this.comments) {
    this.comments = [];
  }
  this.comments = this.comments.filter(comment => comment._id.toString() !== commentId.toString());
};

// Static method to get posts with user data
postSchema.statics.getPostsWithUserData = function(filter = {}, options = {}) {
  const { page = 1, limit = 20, sortBy = '-createdAt' } = options;
  const skip = (page - 1) * limit;

  return this.find({ isActive: true, ...filter })
    .populate('user', 'fullName profilePic')
    .populate('comments.user', 'fullName profilePic')
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('Post', postSchema);

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
    required: false,
    maxlength: [1000, 'Caption cannot be more than 1000 characters'],
    default: ''
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  imageUrl: {
    type: String,
    required: function() {
      // If type is 'short', imageUrl is not required
      if (this.type === 'short') {
        return false;
      }
      // For 'photo' type, imageUrl is required only if storageKey/storageKeys are not present
      // This allows backward compatibility with old posts while supporting new storage-key-only posts
      return !(this.storageKey || (this.storageKeys && this.storageKeys.length > 0));
    }
  },
  videoUrl: {
    type: String,
    required: false
  },
  thumbnailUrl: {
    type: String,
    required: false
  },
  cloudinaryPublicId: {
    type: String,
    required: false
  },
  // New storage fields for Sevalla Object Storage
  storageKey: {
    type: String,
    required: false
  },
  storageKeys: [{
    type: String
  }],
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
  // Display aspect ratio chosen at post creation — used by feed to render container.
  // Original image is stored untouched; aspect ratio only affects display box (cover fit).
  // 'full' = render at the image's natural aspect ratio (measured on load).
  aspectRatio: {
    type: String,
    enum: ['1:1', '16:9', 'full', '1.91:1'],
    default: '1:1'
  },
  // Photo filter chosen at post creation. Applied non-destructively at
  // render time via Cloudinary URL transformations (see frontend
  // utils/imageCache.optimizeCloudinaryUrl). The original upload is
  // never modified, so the user can change the filter later without a
  // re-upload.
  filter: {
    type: String,
    enum: ['original', 'vivid', 'warm', 'cool', 'bw'],
    default: 'original'
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
  // TripScore metadata - selected by user during post creation
  spotType: {
    type: String,
    required: false,
    enum: ['Beach', 'Mountain', 'City', 'Natural spots', 'Religious', 'Cultural', 'General', null],
    default: null
  },
  travelInfo: {
    type: String,
    required: false,
    enum: ['Drivable', 'Hiking', 'Water Transport', 'Flight', 'Train', null],
    default: null
  },
  likesCount: {
    type: Number,
    default: 0
  },
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
  flagged: {
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
  sharesCount: {
    type: Number,
    default: 0
  },
  savesCount: {
    type: Number,
    default: 0
  },
  completionsCount: {
    type: Number,
    default: 0
  },
  rewatchesCount: {
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
  },
  // Copyright compliance fields for shorts
  audioSource: {
    type: String,
    enum: ['taatom_library', 'user_original'],
    required: false,
    default: null
  },
  copyrightAccepted: {
    type: Boolean,
    required: false,
    default: null
  },
  copyrightAcceptedAt: {
    type: Date,
    required: false,
    default: null
  },
  // Post status for DMCA compliance
  status: {
    type: String,
    enum: ['active', 'flagged', 'removed', 'processing', 'failed'],
    default: 'active'
  },
  removalReason: {
    type: String,
    enum: ['copyright_claim', 'user_request', 'policy_violation', 'other'],
    required: false,
    default: null
  },
  // Detected place data from Google Maps API for admin review
  detectedPlace: {
    name: {
      type: String,
      required: false,
      default: null
    },
    country: {
      type: String,
      required: false,
      default: null
    },
    countryCode: {
      type: String,
      required: false,
      default: null
    },
    city: {
      type: String,
      required: false,
      default: null
    },
    stateProvince: {
      type: String,
      required: false,
      default: null
    },
    latitude: {
      type: Number,
      required: false,
      default: null
    },
    longitude: {
      type: Number,
      required: false,
      default: null
    },
    placeId: {
      type: String,
      required: false,
      default: null
    },
    formattedAddress: {
      type: String,
      required: false,
      default: null
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
postSchema.index({ createdAt: -1, _id: -1 }); // Compound index for cursor pagination
postSchema.index({ user: 1, createdAt: -1 }); // User posts sorted by date
postSchema.index({ createdAt: -1 }); // All posts sorted by date
postSchema.index({ isActive: 1 }); // Filter active posts
postSchema.index({ type: 1, isActive: 1, createdAt: -1 }); // Type-based feed queries
postSchema.index({ user: 1, type: 1, isActive: 1, createdAt: -1 }); // User posts by type
postSchema.index({ tags: 1 }); // For hashtag/tag searches
postSchema.index({ 'location.coordinates': '2dsphere' }); // For geospatial location queries
postSchema.index({ likesCount: -1, createdAt: -1 }); // Compound index for sorting popular feed
postSchema.index({ isHidden: 1, isActive: 1 }); // For filtering visible posts

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
postSchema.methods.isLikedBy = async function(userId) {
  if (!userId) return false;
  return await mongoose.model('Like').exists({ post: this._id, user: userId });
};

// Method to toggle like
postSchema.methods.toggleLike = async function(userId) {
  if (!userId) return false;
  const Like = mongoose.model('Like');
  const existingLike = await Like.findOneAndDelete({ post: this._id, user: userId });
  if (existingLike) {
    this.likesCount = Math.max(0, (this.likesCount || 0) - 1);
    await this.save();
    return false; // unliked
  } else {
    await Like.create({ post: this._id, user: userId });
    this.likesCount = (this.likesCount || 0) + 1;
    await this.save();
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

// Static method to get posts with user data using cursor pagination
postSchema.statics.getPostsWithUserData = function(filter = {}, options = {}) {
  const { cursor, limit = 20, sortBy = '-createdAt', useCursor = true } = options;

  let query = { isActive: true, ...filter };

  if (useCursor && cursor) {
    let parsedCursor = cursor;
    if (typeof cursor === 'string') {
      try {
        parsedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('ascii'));
      } catch (e) {
        // Ignore parsing errors and fallback
      }
    }

    if (parsedCursor && parsedCursor.createdAt && parsedCursor._id) {
      const cursorDate = new Date(parsedCursor.createdAt);
      const cursorId = new mongoose.Types.ObjectId(parsedCursor._id);
      
      query.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorId } }
      ];
    }
  }

  return this.find(query)
    .populate('user', 'fullName profilePic')
    .populate('comments.user', 'fullName profilePic')
    .sort(sortBy)
    .limit(limit)
    .lean();
};

const PostModel = mongoose.model('Post', postSchema);

// Schema for tracking background transcoding worker tasks (MongoDB-Backed Task Queue)
const transcodeJobSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  rawStorageKey: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  error: { type: String, default: null }
}, { timestamps: true });

// Register TranscodeJob model globally with mongoose
mongoose.model('TranscodeJob', transcodeJobSchema);

module.exports = PostModel;

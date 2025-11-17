const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Collection name is required'],
    trim: true,
    maxlength: [50, 'Collection name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  posts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  coverImage: {
    type: String,
    default: '' // URL to cover image (first post image or custom)
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0 // For custom ordering
  }
}, {
  timestamps: true
});

// Indexes for performance
collectionSchema.index({ user: 1, createdAt: -1 });
collectionSchema.index({ user: 1, isPublic: 1 });

// Virtual for post count
collectionSchema.virtual('postCount').get(function() {
  return this.posts ? this.posts.length : 0;
});

// Ensure virtual fields are serialized
collectionSchema.set('toJSON', { virtuals: true });
collectionSchema.set('toObject', { virtuals: true });

// Method to add post to collection
collectionSchema.methods.addPost = function(postId) {
  if (!this.posts) {
    this.posts = [];
  }
  // Check if post already exists
  if (!this.posts.some(post => post.toString() === postId.toString())) {
    this.posts.push(postId);
    // Update cover image if collection is empty
    if (!this.coverImage) {
      // Will be updated by controller after populating post
    }
  }
};

// Method to remove post from collection
collectionSchema.methods.removePost = function(postId) {
  if (!this.posts) {
    this.posts = [];
  }
  this.posts = this.posts.filter(post => post.toString() !== postId.toString());
};

// Method to reorder posts
collectionSchema.methods.reorderPosts = function(postIds) {
  this.posts = postIds;
};

module.exports = mongoose.model('Collection', collectionSchema);


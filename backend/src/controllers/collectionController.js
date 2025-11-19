const Collection = require('../models/Collection');
const Post = require('../models/Post');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { deleteCache, CacheKeys } = require('../utils/cache');

// @desc    Create a new collection
// @route   POST /api/v1/collections
// @access  Private
const createCollection = async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length === 0) {
      return sendError(res, 'VAL_2001', 'Collection name is required');
    }

    if (name.length > 50) {
      return sendError(res, 'VAL_2001', 'Collection name cannot exceed 50 characters');
    }

    const collection = new Collection({
      name: name.trim(),
      description: description ? description.trim() : '',
      user: req.user._id,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await collection.save();

    // Create activity (respect user's privacy settings)
    const user = await User.findById(req.user._id).select('settings.privacy.shareActivity').lean();
    const shareActivity = user?.settings?.privacy?.shareActivity !== false; // Default to true if not set
    Activity.createActivity({
      user: req.user._id,
      type: 'collection_created',
      collection: collection._id,
      isPublic: shareActivity && collection.isPublic // Only public if user allows sharing AND collection is public
    }).catch(err => logger.error('Error creating activity:', err));

    // Invalidate cache
    await deleteCache(CacheKeys.user(req.user._id.toString()));

    return sendSuccess(res, 201, 'Collection created successfully', { collection });
  } catch (error) {
    logger.error('Create collection error:', error);
    return sendError(res, 'SRV_6001', 'Error creating collection');
  }
};

// @desc    Get user's collections
// @route   GET /api/v1/collections
// @access  Private
const getCollections = async (req, res) => {
  try {
    const userId = req.query.userId || req.user._id.toString();
    const includePrivate = req.user._id.toString() === userId;

    const query = { user: userId };
    if (!includePrivate) {
      query.isPublic = true;
    }

    const collections = await Collection.find(query)
      .populate('posts', 'imageUrl images videoUrl type createdAt')
      .sort({ order: 1, createdAt: -1 })
      .lean();

    // Update cover images for collections
    const collectionsWithCovers = collections.map(collection => {
      if (!collection.coverImage && collection.posts && collection.posts.length > 0) {
        const firstPost = collection.posts[0];
        collection.coverImage = firstPost.imageUrl || firstPost.images?.[0] || firstPost.videoUrl || '';
      }
      return collection;
    });

    return sendSuccess(res, 200, 'Collections fetched successfully', {
      collections: collectionsWithCovers
    });
  } catch (error) {
    logger.error('Get collections error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching collections');
  }
};

// @desc    Get single collection
// @route   GET /api/v1/collections/:id
// @access  Public (if public) / Private (if private)
const getCollection = async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findById(id)
      .populate('user', 'fullName profilePic username')
      .populate({
        path: 'posts',
        match: { isActive: true },
        select: 'imageUrl images videoUrl caption type location likes comments createdAt user',
        populate: {
          path: 'user',
          select: 'fullName profilePic username'
        }
      })
      .lean();

    if (!collection) {
      return sendError(res, 'RES_3001', 'Collection not found');
    }

    // Check privacy
    if (!collection.isPublic && collection.user._id.toString() !== req.user?._id?.toString()) {
      return sendError(res, 'AUTH_1006', 'You do not have permission to view this collection');
    }

    // Update cover image if needed
    if (!collection.coverImage && collection.posts && collection.posts.length > 0) {
      const firstPost = collection.posts[0];
      collection.coverImage = firstPost.imageUrl || firstPost.images?.[0] || firstPost.videoUrl || '';
    }

    // Add like status for posts
    const userId = req.user?._id?.toString();
    if (userId && collection.posts) {
      collection.posts = collection.posts.map(post => ({
        ...post,
        isLiked: post.likes ? post.likes.some(like => like.toString() === userId) : false,
        likesCount: post.likes ? post.likes.length : 0,
        commentsCount: post.comments ? post.comments.length : 0
      }));
    }

    return sendSuccess(res, 200, 'Collection fetched successfully', { collection });
  } catch (error) {
    logger.error('Get collection error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching collection');
  }
};

// @desc    Update collection
// @route   PUT /api/v1/collections/:id
// @access  Private
const updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic, coverImage } = req.body;

    const collection = await Collection.findById(id);
    if (!collection) {
      return sendError(res, 'RES_3001', 'Collection not found');
    }

    if (collection.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only update your own collections');
    }

    if (name !== undefined) {
      if (name.trim().length === 0) {
        return sendError(res, 'VAL_2001', 'Collection name cannot be empty');
      }
      if (name.length > 50) {
        return sendError(res, 'VAL_2001', 'Collection name cannot exceed 50 characters');
      }
      collection.name = name.trim();
    }

    if (description !== undefined) {
      collection.description = description.trim();
    }

    if (isPublic !== undefined) {
      collection.isPublic = isPublic;
    }

    if (coverImage !== undefined) {
      collection.coverImage = coverImage;
    }

    await collection.save();

    // Invalidate cache
    await deleteCache(CacheKeys.user(req.user._id.toString()));

    return sendSuccess(res, 200, 'Collection updated successfully', { collection });
  } catch (error) {
    logger.error('Update collection error:', error);
    return sendError(res, 'SRV_6001', 'Error updating collection');
  }
};

// @desc    Delete collection
// @route   DELETE /api/v1/collections/:id
// @access  Private
const deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await Collection.findById(id);
    if (!collection) {
      return sendError(res, 'RES_3001', 'Collection not found');
    }

    if (collection.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only delete your own collections');
    }

    await Collection.findByIdAndDelete(id);

    // Invalidate cache
    await deleteCache(CacheKeys.user(req.user._id.toString()));

    return sendSuccess(res, 200, 'Collection deleted successfully');
  } catch (error) {
    logger.error('Delete collection error:', error);
    return sendError(res, 'SRV_6001', 'Error deleting collection');
  }
};

// @desc    Add post to collection
// @route   POST /api/v1/collections/:id/posts
// @access  Private
const addPostToCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { postId } = req.body;

    if (!postId) {
      return sendError(res, 'VAL_2001', 'Post ID is required');
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return sendError(res, 'RES_3001', 'Collection not found');
    }

    if (collection.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only add posts to your own collections');
    }

    // Verify post exists and is active
    const post = await Post.findById(postId).lean();
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found');
    }

    // Check if post is active (users can add any active post to their collections)
    if (!post.isActive) {
      return sendError(res, 'RES_3001', 'Post is not available');
    }

    // Check if post is already in the collection
    if (collection.posts.some(p => p.toString() === postId)) {
      return sendError(res, 'VAL_2001', 'Post is already in this collection');
    }

    // Add post to collection
    collection.addPost(postId);

    // Update cover image if collection is empty
    if (!collection.coverImage) {
      collection.coverImage = post.imageUrl || post.images?.[0] || post.videoUrl || '';
    }

    await collection.save();

    // Invalidate cache
    await deleteCache(CacheKeys.user(req.user._id.toString()));

    return sendSuccess(res, 200, 'Post added to collection successfully', { collection });
  } catch (error) {
    logger.error('Add post to collection error:', error);
    return sendError(res, 'SRV_6001', 'Error adding post to collection');
  }
};

// @desc    Remove post from collection
// @route   DELETE /api/v1/collections/:id/posts/:postId
// @access  Private
const removePostFromCollection = async (req, res) => {
  try {
    const { id, postId } = req.params;

    const collection = await Collection.findById(id);
    if (!collection) {
      return sendError(res, 'RES_3001', 'Collection not found');
    }

    if (collection.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only remove posts from your own collections');
    }

    collection.removePost(postId);

    // Update cover image if needed
    if (collection.posts.length > 0) {
      const firstPost = await Post.findById(collection.posts[0]).lean();
      if (firstPost) {
        collection.coverImage = firstPost.imageUrl || firstPost.images?.[0] || firstPost.videoUrl || '';
      }
    } else {
      collection.coverImage = '';
    }

    await collection.save();

    // Invalidate cache
    await deleteCache(CacheKeys.user(req.user._id.toString()));

    return sendSuccess(res, 200, 'Post removed from collection successfully', { collection });
  } catch (error) {
    logger.error('Remove post from collection error:', error);
    return sendError(res, 'SRV_6001', 'Error removing post from collection');
  }
};

// @desc    Reorder posts in collection
// @route   PUT /api/v1/collections/:id/reorder
// @access  Private
const reorderCollectionPosts = async (req, res) => {
  try {
    const { id } = req.params;
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds)) {
      return sendError(res, 'VAL_2001', 'Post IDs array is required');
    }

    const collection = await Collection.findById(id);
    if (!collection) {
      return sendError(res, 'RES_3001', 'Collection not found');
    }

    if (collection.user.toString() !== req.user._id.toString()) {
      return sendError(res, 'AUTH_1006', 'You can only reorder posts in your own collections');
    }

    // Verify all post IDs belong to this collection
    const validPostIds = postIds.filter(postId => 
      collection.posts.some(post => post.toString() === postId.toString())
    );

    if (validPostIds.length !== postIds.length) {
      return sendError(res, 'VAL_2001', 'Some post IDs are invalid');
    }

    collection.reorderPosts(postIds);
    await collection.save();

    // Invalidate cache
    await deleteCache(CacheKeys.user(req.user._id.toString()));

    return sendSuccess(res, 200, 'Posts reordered successfully', { collection });
  } catch (error) {
    logger.error('Reorder collection posts error:', error);
    return sendError(res, 'SRV_6001', 'Error reordering posts');
  }
};

module.exports = {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  addPostToCollection,
  removePostFromCollection,
  reorderCollectionPosts
};


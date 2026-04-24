const mongoose = require('mongoose');
const ConnectPage = require('../models/ConnectPage');
const ConnectFollow = require('../models/ConnectFollow');
const ConnectPageView = require('../models/ConnectPageView');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { uploadObject, buildMediaKey } = require('../services/storage');
const { generateSignedUrl } = require('../services/mediaService');

// Helper: resolve storage keys to signed URLs for page images
const resolvePageImages = async (page) => {
  if (page.profileImage && !page.profileImage.startsWith('http')) {
    try {
      page.profileImage = await generateSignedUrl(page.profileImage, 'PROFILE');
    } catch {
      page.profileImage = '';
    }
  }
  if (page.bannerImage && !page.bannerImage.startsWith('http')) {
    try {
      page.bannerImage = await generateSignedUrl(page.bannerImage, 'PROFILE');
    } catch {
      page.bannerImage = '';
    }
  }
  return page;
};

// ─────────────────────────────────────────────
// CRUD — Connect Pages
// ─────────────────────────────────────────────

/**
 * Create a new Connect page
 * POST /api/v1/connect/create
 */
const createPage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, type, bio, features } = req.body;

    if (!name || name.trim().length < 3 || name.trim().length > 50) {
      return sendError(res, 'VALIDATION_FAILED', 'Connect page name must be 3-50 characters');
    }

    // Parse features (may come as JSON string from FormData)
    let parsedFeatures = features;
    if (typeof features === 'string') {
      try { parsedFeatures = JSON.parse(features); } catch { parsedFeatures = {}; }
    }

    let profileImageStorageKey = '';
    let bannerImageStorageKey = '';

    // Handle profile image upload
    const profileFile = req.files?.profileImage?.[0];
    if (profileFile) {
      try {
        const extension = profileFile.originalname?.split('.').pop() || 'jpg';
        profileImageStorageKey = buildMediaKey({
          type: 'connect',
          userId: userId.toString(),
          filename: profileFile.originalname || 'profile.jpg',
          extension
        });
        await uploadObject(profileFile.buffer, profileImageStorageKey, profileFile.mimetype);
      } catch (uploadError) {
        logger.error('Connect page profile image upload error:', uploadError);
      }
    }

    // Handle banner image upload
    const bannerFile = req.files?.bannerImage?.[0];
    if (bannerFile) {
      try {
        const extension = bannerFile.originalname?.split('.').pop() || 'jpg';
        bannerImageStorageKey = buildMediaKey({
          type: 'connect',
          userId: userId.toString(),
          filename: bannerFile.originalname || 'banner.jpg',
          extension
        });
        await uploadObject(bannerFile.buffer, bannerImageStorageKey, bannerFile.mimetype);
      } catch (uploadError) {
        logger.error('Connect page banner image upload error:', uploadError);
      }
    }

    const pageData = {
      userId,
      name: name.trim(),
      type: type || 'public',
      bio: bio ? bio.trim() : '',
      profileImage: profileImageStorageKey,
      bannerImage: bannerImageStorageKey,
      features: {
        website: parsedFeatures?.website === true || parsedFeatures?.website === 'true' || false,
        groupChat: parsedFeatures?.groupChat === true || parsedFeatures?.groupChat === 'true' || false,
        subscription: parsedFeatures?.subscription === true || parsedFeatures?.subscription === 'true' || false
      }
    };

    const page = new ConnectPage(pageData);

    // If groupChat is enabled, create a Chat room
    if (pageData.features.groupChat) {
      // Save page first to get _id for the chat reference
      await page.save();
      const chatRoom = new Chat({
        participants: [userId],
        type: 'connect_page',
        connectPageId: page._id,
        messages: [],
        status: 'open'
      });
      await chatRoom.save();
      page.chatRoomId = chatRoom._id;
    }

    await page.save();

    return sendSuccess(res, 201, 'Connect page created successfully', { page });
  } catch (error) {
    logger.error('Error creating connect page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create connect page');
  }
};

/**
 * Get all pages created by current user
 * GET /api/v1/connect/my-pages
 */
const getMyPages = async (req, res) => {
  try {
    const userId = req.user._id;
    const pages = await ConnectPage.find({ userId, status: { $ne: 'archived' } })
      .sort({ createdAt: -1 })
      .lean();

    // Resolve signed URLs for profile images
    for (const p of pages) {
      await resolvePageImages(p);
    }

    return sendSuccess(res, 200, 'My pages fetched', { pages });
  } catch (error) {
    logger.error('Error fetching my pages:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch pages');
  }
};

/**
 * Get single page detail
 * GET /api/v1/connect/page/:pageId
 */
const getPageDetail = async (req, res) => {
  try {
    const { pageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(pageId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid page ID');
    }

    const page = await ConnectPage.findById(pageId)
      .populate('userId', 'username fullName profilePic')
      .lean();

    if (!page || page.status === 'archived') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    // Check if current user is the owner
    const currentUserId = req.user?._id;
    const isOwner = currentUserId && page.userId._id.toString() === currentUserId.toString();

    // Check if current user follows this page
    let isFollowing = false;
    if (currentUserId && !isOwner) {
      const follow = await ConnectFollow.findOne({
        followerId: currentUserId,
        connectPageId: pageId,
        status: 'active'
      });
      isFollowing = !!follow;
    }

    await resolvePageImages(page);

    return sendSuccess(res, 200, 'Page detail fetched', {
      page,
      isOwner,
      isFollowing
    });
  } catch (error) {
    logger.error('Error fetching page detail:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch page detail');
  }
};

/**
 * Update page info (owner only)
 * PUT /api/v1/connect/page/:pageId
 */
const updatePage = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;

    const page = await ConnectPage.findById(pageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the owner can edit this page');
    }

    const allowedFields = ['name', 'type', 'bio', 'profileImage', 'features', 'subscriptionPrice'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // If groupChat was just enabled and no chat room exists, create one
    if (updates.features?.groupChat && !page.chatRoomId) {
      const chatRoom = new Chat({
        participants: [userId],
        type: 'connect_page',
        connectPageId: pageId,
        messages: [],
        status: 'open'
      });
      await chatRoom.save();
      updates.chatRoomId = chatRoom._id;

      // Add existing followers to the chat
      const followers = await ConnectFollow.find({
        connectPageId: pageId,
        status: 'active'
      }).select('followerId');
      if (followers.length > 0) {
        const followerIds = followers.map(f => f.followerId);
        await Chat.findByIdAndUpdate(chatRoom._id, {
          $addToSet: { participants: { $each: followerIds } }
        });
      }
    }

    const updatedPage = await ConnectPage.findByIdAndUpdate(pageId, updates, { new: true, runValidators: true });

    return sendSuccess(res, 200, 'Page updated successfully', { page: updatedPage });
  } catch (error) {
    logger.error('Error updating page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to update page');
  }
};

/**
 * Soft delete a page (owner only)
 * DELETE /api/v1/connect/page/:pageId
 */
const deletePage = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;

    const page = await ConnectPage.findById(pageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the owner can delete this page');
    }

    page.status = 'archived';
    await page.save();

    return sendSuccess(res, 200, 'Page deleted successfully');
  } catch (error) {
    logger.error('Error deleting page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to delete page');
  }
};

// ─────────────────────────────────────────────
// DISCOVERY
// ─────────────────────────────────────────────

/**
 * Get community pages (admin-created) for Community tab
 * GET /api/v1/connect/communities
 */
const getCommunities = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = { isAdminPage: true, status: 'active' };
    const [pages, total] = await Promise.all([
      ConnectPage.find(query)
        .populate('userId', 'username fullName profilePic')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConnectPage.countDocuments(query)
    ]);

    // Check follow status for current user
    const currentUserId = req.user?._id;
    if (currentUserId) {
      const follows = await ConnectFollow.find({
        followerId: currentUserId,
        connectPageId: { $in: pages.map(p => p._id) },
        status: 'active'
      }).select('connectPageId');
      const followedIds = new Set(follows.map(f => f.connectPageId.toString()));
      pages.forEach(p => {
        p.isFollowing = followedIds.has(p._id.toString());
      });
    }

    return sendSuccess(res, 200, 'Communities fetched', {
      pages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error fetching communities:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch communities');
  }
};

/**
 * Search Connect pages by name (for Search icon)
 * GET /api/v1/connect/search-by-name?q=...
 */
const searchByName = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length < 1) {
      return sendSuccess(res, 200, 'No query provided', { pages: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const query = {
      status: 'active',
      type: 'public',
      name: { $regex: q.trim(), $options: 'i' }
    };

    const [pages, total] = await Promise.all([
      ConnectPage.find(query)
        .populate('userId', 'username fullName profilePic')
        .sort({ followerCount: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConnectPage.countDocuments(query)
    ]);

    // Check follow status
    const currentUserId = req.user?._id;
    if (currentUserId) {
      const follows = await ConnectFollow.find({
        followerId: currentUserId,
        connectPageId: { $in: pages.map(p => p._id) },
        status: 'active'
      }).select('connectPageId');
      const followedIds = new Set(follows.map(f => f.connectPageId.toString()));
      pages.forEach(p => {
        p.isFollowing = followedIds.has(p._id.toString());
      });
    }

    return sendSuccess(res, 200, 'Search results', {
      pages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error searching pages by name:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to search pages');
  }
};

/**
 * Find users with similar interests (for Find tab)
 * Uses existing User model — returns users, not Connect pages
 * Follow from here uses existing profile follow system
 * GET /api/v1/connect/find-users?target_country=X&current_country=Y&lang=Z
 */
const findUsers = async (req, res) => {
  try {
    const { target_country, current_country, lang } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    if (!lang) {
      return sendError(res, 'VALIDATION_FAILED', 'Language is required');
    }

    // Build user query based on filters
    const userQuery = {
      _id: { $ne: currentUserId },
      isVerified: true
    };

    // Filter by language preference
    if (lang) {
      userQuery['settings.account.language'] = lang;
    }

    // Filter by interests matching target_country or current_country
    // Since User model doesn't have country fields directly,
    // we use interests array and any available metadata
    if (target_country) {
      userQuery.$or = userQuery.$or || [];
      userQuery.$or.push({ interests: { $regex: target_country, $options: 'i' } });
    }

    const [users, total] = await Promise.all([
      User.find(userQuery)
        .select('username fullName profilePic bio interests settings.account.language followers')
        .sort({ lastLogin: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(userQuery)
    ]);

    // Check if current user follows each user (existing profile follow)
    const usersWithFollowStatus = users.map(user => ({
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      profilePic: user.profilePic,
      bio: user.bio,
      language: user.settings?.account?.language || 'en',
      isFollowing: user.followers?.some(fId => fId.toString() === currentUserId.toString()) || false
    }));

    return sendSuccess(res, 200, 'Users found', {
      users: usersWithFollowStatus,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error finding users:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to find users');
  }
};

// ─────────────────────────────────────────────
// FOLLOW SYSTEM (ConnectFollow — for Connect pages)
// ─────────────────────────────────────────────

/**
 * Follow a Connect page
 * POST /api/v1/connect/follow
 */
const followPage = async (req, res) => {
  try {
    const { connectPageId } = req.body;
    const followerId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(connectPageId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid page ID');
    }

    const page = await ConnectPage.findById(connectPageId);
    if (!page || page.status !== 'active') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    // Can't follow your own page
    if (page.userId.toString() === followerId.toString()) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Cannot follow your own page');
    }

    // Check if already following (might be archived)
    const existingFollow = await ConnectFollow.findOne({ followerId, connectPageId });

    if (existingFollow) {
      if (existingFollow.status === 'active') {
        return sendError(res, 'RESOURCE_ALREADY_EXISTS', 'Already following this page');
      }
      // Restore archived follow
      existingFollow.status = 'active';
      existingFollow.archivedAt = null;
      existingFollow.followedAt = new Date();
      await existingFollow.save();
    } else {
      await ConnectFollow.create({ followerId, connectPageId });
    }

    // Increment follower count
    await ConnectPage.findByIdAndUpdate(connectPageId, { $inc: { followerCount: 1 } });

    // If page has group chat, add follower to chat participants
    if (page.chatRoomId) {
      await Chat.findByIdAndUpdate(page.chatRoomId, {
        $addToSet: { participants: followerId }
      });
    }

    return sendSuccess(res, 200, 'Followed successfully');
  } catch (error) {
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return sendError(res, 'RESOURCE_ALREADY_EXISTS', 'Already following this page');
    }
    logger.error('Error following page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to follow page');
  }
};

/**
 * Unfollow a Connect page
 * POST /api/v1/connect/unfollow
 */
const unfollowPage = async (req, res) => {
  try {
    const { connectPageId } = req.body;
    const followerId = req.user._id;

    const follow = await ConnectFollow.findOne({ followerId, connectPageId, status: 'active' });
    if (!follow) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Not following this page');
    }

    await ConnectFollow.deleteOne({ _id: follow._id });

    // Decrement follower count (never below 0)
    await ConnectPage.findByIdAndUpdate(connectPageId, {
      $inc: { followerCount: -1 },
      $max: { followerCount: 0 }
    });

    // Remove from chat participants if page has group chat
    const page = await ConnectPage.findById(connectPageId).select('chatRoomId');
    if (page?.chatRoomId) {
      await Chat.findByIdAndUpdate(page.chatRoomId, {
        $pull: { participants: followerId }
      });
    }

    return sendSuccess(res, 200, 'Unfollowed successfully');
  } catch (error) {
    logger.error('Error unfollowing page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to unfollow page');
  }
};

/**
 * Archive a followed page (swipe gesture)
 * POST /api/v1/connect/archive
 */
const archivePage = async (req, res) => {
  try {
    const { connectPageId } = req.body;
    const followerId = req.user._id;

    const follow = await ConnectFollow.findOne({ followerId, connectPageId, status: 'active' });
    if (!follow) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Not following this page');
    }

    follow.status = 'archived';
    follow.archivedAt = new Date();
    await follow.save();

    return sendSuccess(res, 200, 'Page archived');
  } catch (error) {
    logger.error('Error archiving page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to archive page');
  }
};

/**
 * Unarchive a followed page
 * POST /api/v1/connect/unarchive
 */
const unarchivePage = async (req, res) => {
  try {
    const { connectPageId } = req.body;
    const followerId = req.user._id;

    const follow = await ConnectFollow.findOne({ followerId, connectPageId, status: 'archived' });
    if (!follow) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'No archived follow found');
    }

    follow.status = 'active';
    follow.archivedAt = null;
    await follow.save();

    return sendSuccess(res, 200, 'Page unarchived');
  } catch (error) {
    logger.error('Error unarchiving page:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to unarchive page');
  }
};

/**
 * Get all pages user follows (active)
 * GET /api/v1/connect/following
 */
const getFollowing = async (req, res) => {
  try {
    const followerId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      ConnectFollow.find({ followerId, status: 'active' })
        .populate({
          path: 'connectPageId',
          populate: { path: 'userId', select: 'username fullName profilePic' }
        })
        .sort({ followedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConnectFollow.countDocuments({ followerId, status: 'active' })
    ]);

    const pages = follows
      .filter(f => f.connectPageId && f.connectPageId.status === 'active')
      .map(f => ({ ...f.connectPageId, isFollowing: true }));

    return sendSuccess(res, 200, 'Following list fetched', {
      pages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error fetching following:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch following list');
  }
};

/**
 * Get all archived follows
 * GET /api/v1/connect/archived
 */
const getArchived = async (req, res) => {
  try {
    const followerId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      ConnectFollow.find({ followerId, status: 'archived' })
        .populate({
          path: 'connectPageId',
          populate: { path: 'userId', select: 'username fullName profilePic' }
        })
        .sort({ archivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConnectFollow.countDocuments({ followerId, status: 'archived' })
    ]);

    const pages = follows
      .filter(f => f.connectPageId)
      .map(f => ({ ...f.connectPageId, isFollowing: false }));

    return sendSuccess(res, 200, 'Archived list fetched', {
      pages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error fetching archived:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch archived list');
  }
};

/**
 * Get followers of a page
 * GET /api/v1/connect/page/:pageId/followers
 */
const getPageFollowers = async (req, res) => {
  try {
    const { pageId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get the page to find the creator
    const connectPage = await ConnectPage.findById(pageId)
      .populate('userId', 'username fullName profilePic profilePicStorageKey')
      .select('userId')
      .lean();

    if (!connectPage) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    const [follows, total] = await Promise.all([
      ConnectFollow.find({ connectPageId: pageId, status: 'active' })
        .populate('followerId', 'username fullName profilePic profilePicStorageKey')
        .sort({ followedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConnectFollow.countDocuments({ connectPageId: pageId, status: 'active' })
    ]);

    const followers = follows.map(f => f.followerId).filter(Boolean);

    // Resolve signed URLs for follower profile pics
    for (const follower of followers) {
      if (follower.profilePicStorageKey) {
        try {
          follower.profilePic = await generateSignedUrl(follower.profilePicStorageKey, 'PROFILE');
        } catch (e) {
          // keep existing profilePic
        }
      }
    }

    // Build creator entry with admin flag
    const creator = connectPage.userId;
    if (creator) {
      if (creator.profilePicStorageKey) {
        try {
          creator.profilePic = await generateSignedUrl(creator.profilePicStorageKey, 'PROFILE');
        } catch (e) {
          // keep existing
        }
      }
    }

    // Add role to each follower and prepend the creator as admin on page 1
    const membersWithRole = followers.map(f => ({
      _id: f._id,
      username: f.username,
      fullName: f.fullName,
      profilePic: f.profilePic,
      role: 'member',
    }));

    // On page 1, prepend creator as admin (filter out if also in followers list)
    let members = membersWithRole;
    if (page === 1 && creator) {
      const creatorId = creator._id.toString();
      members = members.filter(m => m._id.toString() !== creatorId);
      members.unshift({
        _id: creator._id,
        username: creator.username,
        fullName: creator.fullName,
        profilePic: creator.profilePic,
        role: 'admin',
      });
    }

    return sendSuccess(res, 200, 'Followers fetched', {
      followers: members,
      pagination: { page, limit, total: total + 1, totalPages: Math.ceil((total + 1) / limit) }
    });
  } catch (error) {
    logger.error('Error fetching page followers:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch followers');
  }
};

// ─────────────────────────────────────────────
// WEBSITE & SUBSCRIPTION CONTENT
// ─────────────────────────────────────────────

/**
 * Update website content (owner only)
 * PUT /api/v1/connect/page/:pageId/website
 */
const updateWebsiteContent = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;
    const { content } = req.body;

    const page = await ConnectPage.findById(pageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the owner can edit website content');
    }
    if (!page.features.website) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Website feature is not enabled on this page');
    }

    if (!Array.isArray(content)) {
      return sendError(res, 'VALIDATION_FAILED', 'Content must be an array of blocks');
    }

    // Filter out empty blocks and strip _id to avoid subdocument conflicts
    const sanitized = content
      .filter(block => block.content && block.content.trim() !== '')
      .map((block, idx) => ({
        type: block.type,
        content: block.content,
        order: idx,
      }));

    page.websiteContent = sanitized;
    await page.save();

    return sendSuccess(res, 200, 'Website content updated', { websiteContent: page.websiteContent });
  } catch (error) {
    logger.error('Error updating website content:', error);
    logger.error('Validation details:', error.errors || error.message);
    return sendError(res, 'SERVER_ERROR', 'Failed to update website content');
  }
};

/**
 * Get website content
 * GET /api/v1/connect/page/:pageId/website
 */
const getWebsiteContent = async (req, res) => {
  try {
    const { pageId } = req.params;

    const page = await ConnectPage.findById(pageId).select('websiteContent type features userId').lean();
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    // If private, check if user is a follower or owner
    if (page.type === 'private') {
      const currentUserId = req.user?._id;
      const isOwner = currentUserId && page.userId.toString() === currentUserId.toString();
      if (!isOwner) {
        const follow = await ConnectFollow.findOne({
          followerId: currentUserId,
          connectPageId: pageId,
          status: 'active'
        });
        if (!follow) {
          return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'This content is private');
        }
      }
    }

    return sendSuccess(res, 200, 'Website content fetched', { websiteContent: page.websiteContent || [] });
  } catch (error) {
    logger.error('Error fetching website content:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch website content');
  }
};

/**
 * Update subscription content (owner only)
 * PUT /api/v1/connect/page/:pageId/subscription
 */
const updateSubscriptionContent = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;
    const { content } = req.body;

    const page = await ConnectPage.findById(pageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the owner can edit subscription content');
    }
    if (!page.features.subscription) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Subscription feature is not enabled on this page');
    }

    if (!Array.isArray(content)) {
      return sendError(res, 'VALIDATION_FAILED', 'Content must be an array of blocks');
    }

    // Filter out empty blocks and strip _id to avoid subdocument conflicts
    const sanitized = content
      .filter(block => block.content && block.content.trim() !== '')
      .map((block, idx) => ({
        type: block.type,
        content: block.content,
        order: idx,
      }));

    page.subscriptionContent = sanitized;
    await page.save();

    return sendSuccess(res, 200, 'Subscription content updated', { subscriptionContent: page.subscriptionContent });
  } catch (error) {
    logger.error('Error updating subscription content:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to update subscription content');
  }
};

/**
 * Get subscription content
 * GET /api/v1/connect/page/:pageId/subscription
 */
const getSubscriptionContent = async (req, res) => {
  try {
    const { pageId } = req.params;

    const page = await ConnectPage.findById(pageId).select('subscriptionContent features').lean();
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    return sendSuccess(res, 200, 'Subscription content fetched', { subscriptionContent: page.subscriptionContent || [] });
  } catch (error) {
    logger.error('Error fetching subscription content:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch subscription content');
  }
};

// ─────────────────────────────────────────────
// VIEWS
// ─────────────────────────────────────────────

/**
 * Record a page view (8-hour dedup)
 * POST /api/v1/connect/page/:pageId/view
 */
const recordView = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;

    // Check for existing view within 8 hours
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const recentView = await ConnectPageView.findOne({
      userId,
      connectPageId: pageId,
      viewedAt: { $gte: eightHoursAgo }
    });

    if (recentView) {
      return sendSuccess(res, 200, 'View already counted within 8-hour window');
    }

    await ConnectPageView.create({ userId, connectPageId: pageId });

    // Increment denormalized view count
    await ConnectPage.findByIdAndUpdate(pageId, { $inc: { viewCount: 1 } });

    return sendSuccess(res, 200, 'View recorded');
  } catch (error) {
    logger.error('Error recording view:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to record view');
  }
};

// ─────────────────────────────────────────────
// GEO (for Advanced Discovery)
// ─────────────────────────────────────────────

/**
 * Get list of all countries
 * GET /api/v1/geo/countries
 */
const getCountries = async (req, res) => {
  try {
    // Static list of countries with ISO codes
    const countries = require('../data/countries.json');
    return sendSuccess(res, 200, 'Countries fetched', { countries });
  } catch (error) {
    logger.error('Error fetching countries:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch countries');
  }
};

/**
 * Get list of supported languages
 * GET /api/v1/geo/languages
 */
const getLanguages = async (req, res) => {
  try {
    const languages = require('../data/languages.json');
    return sendSuccess(res, 200, 'Languages fetched', { languages });
  } catch (error) {
    logger.error('Error fetching languages:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch languages');
  }
};

/**
 * Get analytics for a Connect page (owner only)
 * GET /api/v1/connect/page/:pageId/analytics
 */
const getPageAnalytics = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;

    const page = await ConnectPage.findById(pageId);
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'FORBIDDEN', 'Only the page owner can view analytics');
    }

    // Get follower growth (last 30 days, grouped by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const followerGrowth = await ConnectFollow.aggregate([
      {
        $match: {
          connectPageId: new mongoose.Types.ObjectId(pageId),
          followedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$followedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get view growth (last 30 days, grouped by day)
    const viewGrowth = await ConnectPageView.aggregate([
      {
        $match: {
          connectPageId: new mongoose.Types.ObjectId(pageId),
          viewedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$viewedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Total counts
    const totalFollowers = page.followerCount || 0;
    const totalViews = page.viewCount || 0;

    return sendSuccess(res, 200, 'Analytics fetched', {
      totalFollowers,
      totalViews,
      followerGrowth: followerGrowth.map(g => ({ date: g._id, count: g.count })),
      viewGrowth: viewGrowth.map(g => ({ date: g._id, count: g.count })),
    });
  } catch (error) {
    logger.error('Error fetching page analytics:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch analytics');
  }
};

module.exports = {
  // CRUD
  createPage,
  getMyPages,
  getPageDetail,
  updatePage,
  deletePage,
  // Discovery
  getCommunities,
  searchByName,
  findUsers,
  // Follow
  followPage,
  unfollowPage,
  archivePage,
  unarchivePage,
  getFollowing,
  getArchived,
  getPageFollowers,
  // Content
  updateWebsiteContent,
  getWebsiteContent,
  updateSubscriptionContent,
  getSubscriptionContent,
  // Views
  recordView,
  // Analytics
  getPageAnalytics,
  // Geo
  getCountries,
  getLanguages
};

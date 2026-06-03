const mongoose = require('mongoose');
const ConnectPage = require('../models/ConnectPage');
const ConnectFollow = require('../models/ConnectFollow');
const ConnectPageView = require('../models/ConnectPageView');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Order = require('../models/Order');
const cashfreeService = require('../services/cashfreeService');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { uploadObject, buildMediaKey } = require('../services/storage');
const { generateSignedUrl, isSignedUrl, extractStorageKeyFromUrl } = require('../services/mediaService');


/**
 * Subscription content gate — true when the viewer is allowed to see paid
 * content on this page. Owners always pass; everyone else must have an
 * active Subscription row. The check lives here so every read path that
 * surfaces `subscriptionContent` (page detail, dedicated content endpoint,
 * future endpoints) can apply the same rule.
 *
 * Returns false for unauthenticated callers — never throws.
 */
// Normalize a user-entered URL: prepend `https://` when no scheme is
// present so "taatom.com" works on mobile (Linking.openURL needs a scheme)
// and on web (<a href="taatom.com"> would otherwise resolve relative to
// the current origin).
const normalizeButtonUrl = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed; // already has a scheme
  return `https://${trimmed}`;
};

// Clamp 12-grid column width to [1, 12]. Anything missing defaults to
// full-width (12) so legacy blocks keep their old single-column-per-row
// layout after this field is added.
const normalizeCol = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(12, Math.round(n)));
};

// Validate a hex / CSS-named color. Returns '' for anything we don't
// recognize so the renderer falls back to page-level / theme defaults
// rather than rendering with arbitrary user-supplied strings.
const ALLOWED_NAMED_COLORS = new Set([
  'transparent', 'white', 'black', 'red', 'green', 'blue', 'yellow',
  'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta'
]);
const normalizeColor = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return trimmed;
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:\d*\.?\d+))?\s*\)$/i.test(trimmed)) return trimmed;
  if (ALLOWED_NAMED_COLORS.has(trimmed.toLowerCase())) return trimmed.toLowerCase();
  return '';
};

// Shared sanitizer for websiteContent / subscriptionContent. Drops empty
// blocks (except buttons with only a URL and dividers), strips _id to avoid
// Mongoose subdocument conflicts, restores storage keys from signed URLs
// on image blocks, normalizes button URLs, clamps grid column width, and
// validates color overrides.
const sanitizeContentBlocks = (content) =>
  content
    .filter(block => {
      if (!block || !block.type) return false;
      if (block.type === 'button') {
        return (block.content && block.content.trim() !== '') || (block.url && block.url.trim() !== '');
      }
      if (block.type === 'divider') return true;
      return block.content && block.content.trim() !== '';
    })
    .map((block, idx) => {
      let blockContent = block.content;
      if (block.type === 'image' && blockContent && isSignedUrl(blockContent)) {
        const storageKey = extractStorageKeyFromUrl(blockContent);
        if (storageKey) blockContent = storageKey;
      }
      const clean = {
        type: block.type,
        content: blockContent || '',
        order: idx,
        col: normalizeCol(block.col),
        backgroundColor: normalizeColor(block.backgroundColor),
        color: normalizeColor(block.color),
        bold: !!block.bold,
        align: ['left', 'center', 'right'].includes(block.align) ? block.align : '',
        fontSize: ['small', 'normal', 'large'].includes(block.fontSize) ? block.fontSize : '',
        stacked: !!block.stacked,
      };
      if (block.type === 'button') clean.url = normalizeButtonUrl(block.url);
      else if (block.url) clean.url = block.url;
      if (block.embedType) clean.embedType = block.embedType;
      return clean;
    });

const userCanReadSubscriptionContent = async (currentUserId, pageOwnerId, pageId) => {
  if (!currentUserId) return false;
  if (pageOwnerId && currentUserId.toString() === pageOwnerId.toString()) return true;
  try {
    const sub = await Subscription.exists({
      userId: currentUserId,
      connectPageId: pageId,
      status: 'active',
    });
    return !!sub;
  } catch (err) {
    logger.warn('userCanReadSubscriptionContent check failed:', err.message);
    return false;
  }
};

// Helper: resolve storage keys to signed URLs for page images
const resolvePageImages = async (page) => {
  if (page.profileImage && !page.profileImage.startsWith('http')) {
    try {
      const url = await generateSignedUrl(page.profileImage, 'PROFILE');
      if (url) page.profileImage = url;
      else page.profileImage = '';
    } catch {
      page.profileImage = '';
    }
  }
  if (page.bannerImage && !page.bannerImage.startsWith('http')) {
    try {
      const url = await generateSignedUrl(page.bannerImage, 'PROFILE');
      if (url) page.bannerImage = url;
      else page.bannerImage = '';
    } catch {
      page.bannerImage = '';
    }
  }
  if (page.buyItems && Array.isArray(page.buyItems)) {
    for (const item of page.buyItems) {
      if (item.imageUrl && !item.imageUrl.startsWith('http')) {
        try {
          const url = await generateSignedUrl(item.imageUrl, 'DEFAULT');
          if (url) item.imageUrl = url;
        } catch (e) {
          logger.warn(`Failed to resolve signed URL for buy item image: ${item.imageUrl}`, e.message);
        }
      }
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
    const { name, type, category, bio, features, subscriptionPrice, subscriptionCurrency, country, payoutInfo } = req.body;
    const { getCurrencyFromCountry, validatePrice } = require('../utils/currencyConfig');

    // Ensure users can only create at most one Connect page
    const targetCategory = category === 'community' ? 'community' : 'connect';
    if (targetCategory === 'connect') {
      const existingPage = await ConnectPage.findOne({ userId, category: 'connect', status: { $ne: 'archived' } });
      if (existingPage) {
        return sendError(res, 'BUSINESS_LIMIT_EXCEEDED', 'You can only create one Connect page');
      }
    }

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
      category: category === 'community' ? 'community' : 'connect',
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

    // Determine currency from country or explicit selection
    const resolvedCurrency = subscriptionCurrency || getCurrencyFromCountry(country || 'IN');
    pageData.subscriptionCurrency = resolvedCurrency;

    // Set creator payout info from country + bank details
    if (country) {
      const { isInternational } = require('../utils/currencyConfig');
      pageData.creatorPayoutInfo = {
        country: country.toUpperCase(),
        isInternational: isInternational(country),
      };
    }

    // Merge payout/bank details if provided
    if (payoutInfo) {
      let parsedPayout = payoutInfo;
      if (typeof payoutInfo === 'string') {
        try { parsedPayout = JSON.parse(payoutInfo); } catch { parsedPayout = {}; }
      }
      if (!pageData.creatorPayoutInfo) pageData.creatorPayoutInfo = {};
      if (parsedPayout.bankAccountName) pageData.creatorPayoutInfo.bankAccountName = parsedPayout.bankAccountName;
      if (parsedPayout.bankAccountNumber) pageData.creatorPayoutInfo.bankAccountNumber = parsedPayout.bankAccountNumber;
      if (parsedPayout.bankIfsc) pageData.creatorPayoutInfo.bankIfsc = parsedPayout.bankIfsc;
      if (parsedPayout.upiId) pageData.creatorPayoutInfo.upiId = parsedPayout.upiId;
      if (parsedPayout.wiseEmail) pageData.creatorPayoutInfo.wiseEmail = parsedPayout.wiseEmail;
      if (parsedPayout.payoutMethod) pageData.creatorPayoutInfo.payoutMethod = parsedPayout.payoutMethod;
      if (parsedPayout.bankName) pageData.creatorPayoutInfo.bankName = parsedPayout.bankName;
      if (parsedPayout.bankCountry) pageData.creatorPayoutInfo.bankCountry = parsedPayout.bankCountry;
      if (parsedPayout.swiftCode) pageData.creatorPayoutInfo.swiftCode = parsedPayout.swiftCode;
      if (parsedPayout.iban) pageData.creatorPayoutInfo.iban = parsedPayout.iban;
      if (parsedPayout.routingNumber) pageData.creatorPayoutInfo.routingNumber = parsedPayout.routingNumber;
    }

    // Set subscription price if provided — democratized: approved instantly
    if (pageData.features.subscription && subscriptionPrice) {
      const price = parseFloat(subscriptionPrice);
      const priceValidation = validatePrice(price, resolvedCurrency);
      if (priceValidation.valid) {
        pageData.subscriptionPrice = price;
        pageData.subscriptionApproval = {
          status: 'approved',
          requestedPrice: price,
          approvedAt: new Date(),
        };
      }
    }

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

const maskSubscriptionContent = (content) => {
  if (!content || !Array.isArray(content)) return [];
  return content.map(block => {
    const masked = { ...block };
    if (block.type === 'heading') {
      masked.content = 'Premium Section';
    } else if (block.type === 'text') {
      masked.content = 'This premium content is locked. Subscribe to unlock this section and access all premium services, links, and exclusive content.';
    } else if (block.type === 'image') {
      masked.content = 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&q=80&w=600';
    } else if (block.type === 'video') {
      masked.content = '';
    } else if (block.type === 'button') {
      masked.content = 'Unlock Content';
      masked.url = '';
    } else if (block.type === 'embed') {
      masked.content = '';
    }
    return masked;
  });
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

    // Self-heal any existing drift from the historical $inc/$max bug
    // (counts could go stale or even negative). Mutations now sync from
    // the active follow set on every state change, but pre-existing rows
    // still need this corrective read on first detail-view.
    const liveFollowerCount = await ConnectFollow.countDocuments({
      connectPageId: pageId,
      status: 'active'
    });
    if (page.followerCount !== liveFollowerCount) {
      page.followerCount = liveFollowerCount;
      ConnectPage.findByIdAndUpdate(pageId, { $set: { followerCount: liveFollowerCount } })
        .catch((e) => logger.warn('Failed to persist self-healed followerCount:', e));
    }

    // Check if current user is the owner
    const currentUserId = req.user?._id;
    const pageOwnerId = page.userId?._id || page.userId;
    const isOwner = currentUserId && pageOwnerId && pageOwnerId.toString() === currentUserId.toString();

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

    // Resolve image storage keys in content blocks
    // Also handle corrupted data: expired signed URLs stored in DB
    for (const block of (page.websiteContent || [])) {
      if (block.type === 'image' && block.content) {
        if (!block.content.startsWith('http')) {
          try {
            const url = await generateSignedUrl(block.content, 'DEFAULT');
            if (url) block.content = url;
          } catch { /* keep original key */ }
        } else if (isSignedUrl(block.content)) {
          const storageKey = extractStorageKeyFromUrl(block.content);
          if (storageKey) {
            try {
              const url = await generateSignedUrl(storageKey, 'DEFAULT');
              if (url) block.content = url;
            } catch { /* keep existing URL */ }
          }
        }
      }
    }
    for (const block of (page.subscriptionContent || [])) {
      if (block.type === 'image' && block.content) {
        if (!block.content.startsWith('http')) {
          try {
            const url = await generateSignedUrl(block.content, 'DEFAULT');
            if (url) block.content = url;
          } catch { /* keep original key */ }
        } else if (isSignedUrl(block.content)) {
          const storageKey = extractStorageKeyFromUrl(block.content);
          if (storageKey) {
            try {
              const url = await generateSignedUrl(storageKey, 'DEFAULT');
              if (url) block.content = url;
            } catch { /* keep existing URL */ }
          }
        }
      }
    }
    // Compute localized display prices for the subscription, if priced.
    // INR stays the source of truth (Cashfree only charges INR); the rest are
    // approximate conversions for fan-facing UI. Failure here must NEVER block
    // returning the page — wrap it tightly.
    let subscriptionDisplayPrices = null;
    try {
      const inrPrice = page.subscriptionPrice || page.subscriptionApproval?.requestedPrice;
      if (inrPrice && inrPrice > 0) {
        const { buildDisplayPrices } = require('../services/fxRateService');
        subscriptionDisplayPrices = await buildDisplayPrices(inrPrice);
      }
    } catch (e) {
      logger.warn('[connect.getPageDetail] FX display prices failed (non-fatal):', e.message);
    }

    // Privacy gate: for private pages, redact gated fields when the viewer
    // is neither the owner nor an active follower. The card / lock screen
    // can still render (name, bio, profile image, follower count) but the
    // body content, subscription content, and chat room id stay hidden.
    // Without this, anyone hitting /api/v1/connect/page/:id could read every
    // private page's full website + paid content directly from the response.
    const isPrivateLocked = page.type === 'private' && !isOwner && !isFollowing;
    if (isPrivateLocked) {
      page.websiteContent = [];
      page.subscriptionContent = [];
      page.chatRoomId = null;
      page.buyItems = [];
    }

    // Paid content gate: subscriptionContent is only visible to the owner or
    // an active subscriber. Without this, the lock screen on the client was
    // purely cosmetic — every visitor's API response carried the full paid
    // content. Website content stays visible to everyone.
    const isSubscribed = isPrivateLocked
      ? false
      : await userCanReadSubscriptionContent(currentUserId, pageOwnerId, pageId);
    if (!isOwner && !isSubscribed) {
      page.subscriptionContent = maskSubscriptionContent(page.subscriptionContent);
    }

    return sendSuccess(res, 200, 'Page detail fetched', {
      page,
      isOwner,
      isFollowing,
      isSubscribed,
      isPrivateLocked,
      subscriptionDisplayPrices: isPrivateLocked ? null : subscriptionDisplayPrices,
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

    const allowedFields = ['name', 'type', 'category', 'bio', 'profileImage', 'features', 'creatorPayoutInfo'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle currency update from country change
    if (req.body.subscriptionCurrency) {
      updates['subscriptionCurrency'] = req.body.subscriptionCurrency;
    } else if (req.body.country) {
      const { getCurrencyFromCountry } = require('../utils/currencyConfig');
      updates['subscriptionCurrency'] = getCurrencyFromCountry(req.body.country);
    }

    // Handle country in creatorPayoutInfo
    if (req.body.country) {
      const { isInternational } = require('../utils/currencyConfig');
      if (!updates['creatorPayoutInfo']) {
        updates['creatorPayoutInfo'] = page.creatorPayoutInfo?.toObject?.() || {};
      }
      updates['creatorPayoutInfo'].country = req.body.country.toUpperCase();
      updates['creatorPayoutInfo'].isInternational = isInternational(req.body.country);
    }

    // Merge payout/bank details if provided via payoutInfo field
    if (req.body.payoutInfo) {
      let parsedPayout = req.body.payoutInfo;
      if (typeof parsedPayout === 'string') {
        try { parsedPayout = JSON.parse(parsedPayout); } catch { parsedPayout = {}; }
      }
      if (!updates['creatorPayoutInfo']) {
        updates['creatorPayoutInfo'] = page.creatorPayoutInfo?.toObject?.() || {};
      }
      if (parsedPayout.bankAccountName !== undefined) updates['creatorPayoutInfo'].bankAccountName = parsedPayout.bankAccountName;
      if (parsedPayout.bankAccountNumber !== undefined) updates['creatorPayoutInfo'].bankAccountNumber = parsedPayout.bankAccountNumber;
      if (parsedPayout.bankIfsc !== undefined) updates['creatorPayoutInfo'].bankIfsc = parsedPayout.bankIfsc;
      if (parsedPayout.upiId !== undefined) updates['creatorPayoutInfo'].upiId = parsedPayout.upiId;
      if (parsedPayout.wiseEmail !== undefined) updates['creatorPayoutInfo'].wiseEmail = parsedPayout.wiseEmail;
      if (parsedPayout.payoutMethod !== undefined) updates['creatorPayoutInfo'].payoutMethod = parsedPayout.payoutMethod;
      if (parsedPayout.bankName !== undefined) updates['creatorPayoutInfo'].bankName = parsedPayout.bankName;
      if (parsedPayout.bankCountry !== undefined) updates['creatorPayoutInfo'].bankCountry = parsedPayout.bankCountry;
      if (parsedPayout.swiftCode !== undefined) updates['creatorPayoutInfo'].swiftCode = parsedPayout.swiftCode;
      if (parsedPayout.iban !== undefined) updates['creatorPayoutInfo'].iban = parsedPayout.iban;
      if (parsedPayout.routingNumber !== undefined) updates['creatorPayoutInfo'].routingNumber = parsedPayout.routingNumber;
    }

    // Handle subscription price change — democratized: approved instantly
    if (req.body.subscriptionPrice !== undefined) {
      const { validatePrice, getCurrencyConfig } = require('../utils/currencyConfig');
      const currency = updates['subscriptionCurrency'] || page.subscriptionCurrency || 'INR';
      const price = parseFloat(req.body.subscriptionPrice);
      const priceValidation = validatePrice(price, currency);
      if (priceValidation.valid) {
        updates['subscriptionPrice'] = price;
        updates['subscriptionApproval'] = {
          status: 'approved',
          requestedPrice: price,
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: '',
          reviewedBy: null
        };
      } else {
        const config = getCurrencyConfig(currency);
        return sendError(res, 'VALIDATION_FAILED', `Price must be between ${config.symbol}${config.minPrice} and ${config.symbol}${config.maxPrice}`);
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

    // Clean up: remove the associated group chat so it doesn't linger in chat lists
    if (page.chatRoomId) {
      try {
        await Chat.findByIdAndDelete(page.chatRoomId);
        logger.info('[deletePage] Deleted associated chat room:', page.chatRoomId);
      } catch (chatErr) {
        logger.warn('[deletePage] Failed to delete chat room:', chatErr.message);
      }
    }

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

    // Resolve storage keys to signed URLs for images
    for (const p of pages) {
      await resolvePageImages(p);
    }

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
 * Get user-created (non-admin) Connect pages for the Connect tab.
 * For authenticated viewers, every page they follow is ranked above every
 * page they don't, GLOBALLY across the whole collection — so a followed
 * entry that would otherwise land on page 5 by recency still appears in
 * batch 1. Pagination uses a stable two-key sort (isFollowing desc,
 * createdAt desc) so consecutive fetches don't re-shuffle items.
 * GET /api/v1/connect/connect-pages
 */
const getConnectPages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Non-admin (community-built) pages only. Admin-created pages live on
    // the Community tab via getCommunities.
    const matchStage = { isAdminPage: { $ne: true }, status: 'active' };
    const currentUserId = req.user?._id;

    let pages;
    let total;
    if (currentUserId) {
      // Resolve the viewer's follow set first so the aggregation can rank
      // the entire collection (not just the fetched batch) by it.
      const followDocs = await ConnectFollow.find({
        followerId: currentUserId,
        status: 'active'
      }).select('connectPageId').lean();
      // Stringify both sides of the comparisons for robustness against
      // ObjectId vs string mismatches across Mongo driver versions.
      const followedIdStrings = followDocs.map(f => f.connectPageId.toString());
      const currentUserIdString = currentUserId.toString();

      const aggPipeline = [
        { $match: matchStage },
        {
          $addFields: {
            isOwn: { $eq: [{ $toString: '$userId' }, currentUserIdString] },
            isFollowing: { $in: [{ $toString: '$_id' }, followedIdStrings] }
          }
        },
        // Sort: pages I created → pages I follow → everything else by recency.
        // Without `isOwn` first, a user's own pages (which can't be followed)
        // sank below every followed page and appeared "missing" to the user.
        { $sort: { isOwn: -1, isFollowing: -1, createdAt: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limit }
      ];

      try {
        [pages, total] = await Promise.all([
          ConnectPage.aggregate(aggPipeline),
          ConnectPage.countDocuments(matchStage)
        ]);

        // aggregate() bypasses Mongoose schema population — populate the
        // creator separately on the resulting plain documents.
        await ConnectPage.populate(pages, {
          path: 'userId',
          select: 'username fullName profilePic'
        });
      } catch (aggErr) {
        // Defensive fallback: $toString / $in / $eq inside $addFields
        // require MongoDB 4.0+. If we hit an older server (e.g. mirror,
        // staging, version downgrade) the aggregation throws — fall back
        // to recency-only sort and tag isFollowing/isOwn in JS so the
        // client still gets a usable list rather than a 500.
        logger.warn('Connect-pages aggregation failed, falling back to recency sort:', aggErr?.message || aggErr);
        [pages, total] = await Promise.all([
          ConnectPage.find(matchStage)
            .populate('userId', 'username fullName profilePic')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          ConnectPage.countDocuments(matchStage)
        ]);
        const followedIdSet = new Set(followedIdStrings);
        pages.forEach((p) => {
          p.isFollowing = followedIdSet.has(p._id.toString());
          const ownerId = p.userId?._id?.toString?.() || (typeof p.userId === 'string' ? p.userId : '');
          p.isOwn = ownerId === currentUserIdString;
        });
      }
    } else {
      // Anonymous viewers have no follow set; recency-only ordering.
      [pages, total] = await Promise.all([
        ConnectPage.find(matchStage)
          .populate('userId', 'username fullName profilePic')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ConnectPage.countDocuments(matchStage)
      ]);
    }

    // Resolve storage keys to signed URLs for images
    for (const p of pages) {
      await resolvePageImages(p);
    }

    return sendSuccess(res, 200, 'Connect pages fetched', {
      pages,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('Error fetching connect pages:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch connect pages');
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

    // Resolve storage keys to signed URLs for images
    for (const p of pages) {
      await resolvePageImages(p);
    }

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
    const { target_country, current_country, lang, travel_style } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    if (!lang) {
      return sendError(res, 'VALIDATION_FAILED', 'Language is required');
    }

    // Fetch the logged-in user profile to read their interests
    const currentUser = await User.findById(currentUserId).select('interests languagesKnown nationality');

    // Resolve country codes to names so we can match against the
    // free-text `nationality` field (e.g. "IN" → "India").
    const countriesList = require('../data/countries.json');
    const codeToName = {};
    for (const c of countriesList) {
      codeToName[c.code.toUpperCase()] = c.name;
    }

    // Resolve language codes to names so we can match against the
    // free-text `languagesKnown` array / account settings (e.g. "ta" → "Tamil").
    const languagesList = require('../data/languages.json');
    const langCodeToName = {};
    for (const l of languagesList) {
      langCodeToName[l.code.toLowerCase()] = l.name.toLowerCase();
    }

    // Build user query based on filters
    const userQuery = {
      _id: { $ne: currentUserId }
    };

    // Filter by language: match UI preference, languagesKnown array, or bio text
    if (lang) {
      const langLower = lang.toLowerCase();
      const langName = langCodeToName[langLower] || langLower;
      const langNameEscaped = langName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const langConditions = [
        { 'settings.account.language': langLower },
        { languagesKnown: langLower },
        { languagesKnown: { $regex: `^${langNameEscaped}$`, $options: 'i' } },
        { bio: { $regex: langNameEscaped, $options: 'i' } },
        { bio: { $regex: langLower, $options: 'i' } }
      ];
      if (userQuery.$or) {
        const existingOr = userQuery.$or;
        delete userQuery.$or;
        userQuery.$and = userQuery.$and || [];
        userQuery.$and.push({ $or: existingOr }, { $or: langConditions });
      } else {
        userQuery.$or = langConditions;
      }
    }

    // Filter by travel style
    if (travel_style) {
      userQuery.travelStyle = travel_style;
    }

    // Filter by target country (people-from) — match nationality and bio.
    // Optional: when omitted, all users matching language are returned.
    if (target_country) {
      const countryName = codeToName[target_country.toUpperCase()] || target_country;
      const escaped = countryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const codeEscaped = target_country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nationalityConditions = [
        { nationality: { $regex: escaped, $options: 'i' } },
        { nationality: { $regex: codeEscaped, $options: 'i' } },
        { bio: { $regex: escaped, $options: 'i' } },
      ];
      // Merge with existing $or (from language) using $and
      if (userQuery.$or) {
        // Already have $or for language — wrap both in $and
        const langOr = userQuery.$or;
        delete userQuery.$or;
        userQuery.$and = [
          { $or: langOr },
          { $or: nationalityConditions }
        ];
      } else {
        userQuery.$or = nationalityConditions;
      }
    }

    // Filter by current_country — same approach as target_country but
    // checks where the user currently is. Since User doesn't have a
    // dedicated currentCountry field, we fall back to nationality if
    // different from target_country (i.e. skip if same filter already applied).
    if (current_country && current_country !== target_country) {
      const countryName = codeToName[current_country.toUpperCase()] || current_country;
      const escaped = countryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const codeEscaped = current_country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const currentConditions = [
        { nationality: { $regex: escaped, $options: 'i' } },
        { nationality: { $regex: codeEscaped, $options: 'i' } }
      ];
      if (userQuery.$and) {
        userQuery.$and.push({ $or: currentConditions });
      } else if (userQuery.$or) {
        const existingOr = userQuery.$or;
        delete userQuery.$or;
        userQuery.$and = [
          { $or: existingOr },
          { $or: currentConditions }
        ];
      } else {
        userQuery.$or = currentConditions;
      }
    }

    const [users, total] = await Promise.all([
      User.find(userQuery)
        .select('username fullName profilePic bio interests travelStyle nationality languagesKnown settings.account.language followers')
        .sort({ lastLogin: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(userQuery)
    ]);

    // Calculate shared interests count with the current user and sort results
    const currentUserInterests = currentUser?.interests || [];
    const usersWithFollowStatus = users.map(user => {
      const sharedInterests = (user.interests || []).filter(interest => 
        currentUserInterests.some(ci => ci.toLowerCase() === interest.toLowerCase())
      );

      return {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        profilePic: user.profilePic,
        bio: user.bio,
        language: user.settings?.account?.language || 'en',
        travelStyle: user.travelStyle || '',
        sharedInterestsCount: sharedInterests.length,
        isFollowing: user.followers?.some(fId => fId.toString() === currentUserId.toString()) || false
      };
    });

    // Sort by shared interests count descending
    usersWithFollowStatus.sort((a, b) => b.sharedInterestsCount - a.sharedInterestsCount);

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
 * Sync the cached `followerCount` on a ConnectPage with the actual count of
 * active ConnectFollow records. Use this from every follow-state mutation
 * (follow / unfollow / archive / unarchive) instead of $inc/$dec arithmetic.
 *
 * Why: the previous arithmetic approach drifted out of sync whenever the
 * archive/unarchive paths skipped a counter update, then compounded with
 * the re-follow-restore-archived branch double-incrementing. Combined with
 * MongoDB's non-deterministic handling of `$inc + $max` on the same field
 * across versions, some pages even ended up with a negative `followerCount`.
 * Re-deriving from `countDocuments` is cheap (indexed lookup) and makes
 * drift mathematically impossible.
 */
const syncFollowerCount = async (connectPageId) => {
  try {
    const liveCount = await ConnectFollow.countDocuments({
      connectPageId,
      status: 'active'
    });
    await ConnectPage.findByIdAndUpdate(connectPageId, {
      $set: { followerCount: liveCount }
    });
    return liveCount;
  } catch (e) {
    logger.error('Failed to sync followerCount:', e);
    return null;
  }
};

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

    // Re-derive the cached count from the active follow set instead of
    // running an arithmetic increment. Bulletproof against drift / re-
    // activation double-counts.
    await syncFollowerCount(connectPageId);

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

    // Re-derive the cached count from the active follow set. Always
    // accurate, never negative.
    await syncFollowerCount(connectPageId);

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

    // Re-derive the cached count from the active follow set.
    await syncFollowerCount(connectPageId);

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

    // Re-derive the cached count from the active follow set.
    await syncFollowerCount(connectPageId);

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

    // Resolve storage keys to signed URLs for images
    for (const p of pages) {
      await resolvePageImages(p);
    }

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

    // Resolve storage keys to signed URLs for images
    for (const p of pages) {
      await resolvePageImages(p);
    }

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

    // Get the page to find the creator AND check privacy.
    const connectPage = await ConnectPage.findById(pageId)
      .populate('userId', 'username fullName profilePic profilePicStorageKey')
      .select('userId type')
      .lean();

    if (!connectPage) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    // Privacy gate: private pages don't expose their follower roster to
    // non-followers / non-owners. Match the rest of the connect surface.
    if (connectPage.type === 'private') {
      const currentUserId = req.user?._id;
      const ownerId = connectPage.userId?._id || connectPage.userId;
      const isOwner = !!(currentUserId && ownerId && ownerId.toString() === currentUserId.toString());
      let isFollower = false;
      if (currentUserId && !isOwner) {
        const follow = await ConnectFollow.findOne({
          followerId: currentUserId,
          connectPageId: pageId,
          status: 'active'
        }).lean();
        isFollower = !!follow;
      }
      if (!isOwner && !isFollower) {
        return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Followers are private for this page');
      }
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
    const isCommunity = connectPage.category === 'community' || connectPage.type === 'community';
    if (page === 1 && creator && !isCommunity) {
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

    const finalTotal = (page === 1 && creator && !isCommunity) ? total + 1 : total;
    return sendSuccess(res, 200, 'Followers fetched', {
      followers: members,
      pagination: { page, limit, total: finalTotal, totalPages: Math.ceil(finalTotal / limit) }
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
    const { content, background, textColor } = req.body;

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

    page.websiteContent = sanitizeContentBlocks(content);
    if (typeof background !== 'undefined') page.websiteBackground = normalizeColor(background);
    if (typeof textColor !== 'undefined') page.websiteTextColor = normalizeColor(textColor);
    await page.save();

    return sendSuccess(res, 200, 'Website content updated', {
      websiteContent: page.websiteContent,
      websiteBackground: page.websiteBackground,
      websiteTextColor: page.websiteTextColor,
    });
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

    const page = await ConnectPage.findById(pageId).select('websiteContent websiteBackground websiteTextColor type features userId').lean();
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

    // Resolve image storage keys to signed URLs
    // Also handle corrupted data: if a signed URL was previously stored (now expired),
    // extract the storage key and re-generate a fresh signed URL
    for (const block of (page.websiteContent || [])) {
      if (block.type === 'image' && block.content) {
        if (!block.content.startsWith('http')) {
          // Storage key — generate signed URL
          try {
            const url = await generateSignedUrl(block.content, 'DEFAULT');
            if (url) block.content = url;
          } catch { /* keep original key */ }
        } else if (isSignedUrl(block.content)) {
          // Expired signed URL stored in DB — extract key and re-sign
          const storageKey = extractStorageKeyFromUrl(block.content);
          if (storageKey) {
            try {
              const url = await generateSignedUrl(storageKey, 'DEFAULT');
              if (url) block.content = url;
            } catch { /* keep existing URL */ }
          }
        }
      }
    }

    return sendSuccess(res, 200, 'Website content fetched', {
      websiteContent: page.websiteContent || [],
      websiteBackground: page.websiteBackground || '',
      websiteTextColor: page.websiteTextColor || '',
    });
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
    const { content, background, textColor } = req.body;

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

    page.subscriptionContent = sanitizeContentBlocks(content);
    if (typeof background !== 'undefined') page.subscriptionBackground = normalizeColor(background);
    if (typeof textColor !== 'undefined') page.subscriptionTextColor = normalizeColor(textColor);
    await page.save();

    return sendSuccess(res, 200, 'Subscription content updated', {
      subscriptionContent: page.subscriptionContent,
      subscriptionBackground: page.subscriptionBackground,
      subscriptionTextColor: page.subscriptionTextColor,
    });
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

    // Need userId to gate access; lean+select must include it.
    const page = await ConnectPage.findById(pageId).select('subscriptionContent subscriptionBackground subscriptionTextColor features userId').lean();
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }

    // Paid content gate: only the owner or an active subscriber can read this.
    // Return 200 with empty content + isSubscribed=false rather than 403 so the
    // client can render the existing "Subscribe to view" UI without special
    // error handling.
    const currentUserId = req.user?._id;
    const isOwner = !!(currentUserId && page.userId && page.userId.toString() === currentUserId.toString());
    const isSubscribed = isOwner
      ? true
      : await userCanReadSubscriptionContent(currentUserId, page.userId, pageId);
    if (!isOwner && !isSubscribed) {
      // Map and obfuscate blocks to show a blurred preview layout without leaking sensitive data
      const obfuscatedContent = (page.subscriptionContent || []).map((block, idx) => {
        const clean = {
          _id: block._id || idx,
          type: block.type,
          order: block.order !== undefined ? block.order : idx,
          col: block.col,
          backgroundColor: block.backgroundColor,
          color: block.color,
          bold: block.bold,
          align: block.align,
          fontSize: block.fontSize,
          stacked: block.stacked,
          padding: block.padding,
          borderRadius: block.borderRadius,
          verticalAlign: block.verticalAlign,
          aspectRatio: block.aspectRatio,
        };

        if (block.type === 'heading' || block.type === 'text') {
          // Replace each word with block characters of equal length to preserve layout/visual flow
          clean.content = (block.content || '')
            .split(' ')
            .map(word => '█'.repeat(word.length || 3))
            .join(' ');
        } else if (block.type === 'image') {
          // Abstract colorful image from unsplash that looks great when blurred
          clean.content = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80';
        } else if (block.type === 'button') {
          clean.content = block.content || 'Premium Link';
          clean.url = ''; // Strip redirect URL
        } else if (block.type === 'video') {
          clean.content = '';
        } else if (block.type === 'embed') {
          clean.content = '';
          clean.embedType = block.embedType;
        } else {
          clean.content = '';
        }
        return clean;
      });

      return sendSuccess(res, 200, 'Subscription content gated', {
        subscriptionContent: obfuscatedContent,
        isSubscribed: false,
        gated: true,
      });
    }

    // Resolve image storage keys to signed URLs
    // Also handle corrupted data: expired signed URLs stored in DB
    for (const block of (page.subscriptionContent || [])) {
      if (block.type === 'image' && block.content) {
        if (!block.content.startsWith('http')) {
          try {
            const url = await generateSignedUrl(block.content, 'DEFAULT');
            if (url) block.content = url;
          } catch { /* keep original key */ }
        } else if (isSignedUrl(block.content)) {
          const storageKey = extractStorageKeyFromUrl(block.content);
          if (storageKey) {
            try {
              const url = await generateSignedUrl(storageKey, 'DEFAULT');
              if (url) block.content = url;
            } catch { /* keep existing URL */ }
          }
        }
      }
    }

    return sendSuccess(res, 200, 'Subscription content fetched', {
      subscriptionContent: page.subscriptionContent || [],
      subscriptionBackground: page.subscriptionBackground || '',
      subscriptionTextColor: page.subscriptionTextColor || '',
      isSubscribed: true,
      gated: false,
    });
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

/**
 * Upload a content block image to R2 storage
 * POST /api/v1/connect/page/:pageId/content-image
 * Expects multer file in req.file (field: 'image')
 * Returns { storageKey, signedUrl }
 */
const uploadContentImage = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;

    const page = await ConnectPage.findById(pageId).select('userId');
    if (!page) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Connect page not found');
    }
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the owner can upload images');
    }

    const file = req.file;
    if (!file) {
      return sendError(res, 'VALIDATION_FAILED', 'No image file provided');
    }

    const extension = file.originalname?.split('.').pop() || 'jpg';
    const storageKey = buildMediaKey({
      type: 'connect-content',
      userId: userId.toString(),
      filename: file.originalname || 'content.jpg',
      extension
    });
    await uploadObject(file.buffer, storageKey, file.mimetype);

    const signedUrl = await generateSignedUrl(storageKey, 'DEFAULT');

    return sendSuccess(res, 200, 'Image uploaded', { storageKey, signedUrl });
  } catch (error) {
    logger.error('Error uploading content block image:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to upload image');
  }
};

/**
 * Create a Cashfree one-time payment order for a buy item.
 * POST /api/v1/connect/page/:pageId/buy-order
 */
const createBuyOrder = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;
    const { itemId, buyerName, buyerPhone, deliveryAddress } = req.body;

    if (!itemId || !buyerName || !buyerPhone || !deliveryAddress) {
      return sendError(res, 'VALIDATION_FAILED', 'Fields itemId, buyerName, buyerPhone, deliveryAddress are required');
    }

    const page = await ConnectPage.findById(pageId);
    if (!page || page.status === 'archived') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Community page not found');
    }

    const item = page.buyItems.id(itemId);
    if (!item || !item.active) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Item not found or is inactive');
    }

    const user = await (require('../models/User')).findById(userId).select('fullName email phone username').lean();
    if (!user) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'User not found');
    }

    const currency = page.subscriptionCurrency || 'INR';
    const ts = Date.now();
    const cashfreeOrderId = `item_ord_${userId}_${ts}`;

    // Build return URL
    const webBase = (process.env.WEB_FRONTEND_URL || process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
    const apiBase = (process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
    let returnUrl = `${apiBase}/api/v1/connect/order/return?pageId=${encodeURIComponent(pageId)}`;
    if (webBase) {
      returnUrl = `${webBase}/connect/page/${pageId}?order_return=1`;
    }

    // Create Cashfree order
    const cfResult = await cashfreeService.createOrder({
      orderId: cashfreeOrderId,
      amount: item.price,
      currency,
      customer: {
        id: userId.toString(),
        name: user.fullName || user.username || 'User',
        email: user.email || `${user.username}@taatom.app`,
        phone: user.phone || buyerPhone || '9999999999',
      },
      returnUrl,
      orderNote: `${item.name} - ${page.name}`,
    });

    // Save a pending order in DB
    const order = new Order({
      userId,
      connectPageId: pageId,
      itemId: item._id,
      itemName: item.name,
      price: item.price,
      currency,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      deliveryAddress: deliveryAddress.trim(),
      cashfreeOrderId: cfResult.orderId,
      paymentSessionId: cfResult.paymentSessionId,
      cashfreeEnvironment: (process.env.CASHFREE_ENV || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox',
      paymentStatus: 'pending',
      deliveryStatus: 'pending',
    });
    await order.save();

    return sendSuccess(res, 201, 'Payment order created', {
      orderId: order._id,
      cashfreeOrderId: cfResult.orderId,
      paymentSessionId: cfResult.paymentSessionId,
      amount: item.price,
      currency,
      cashfreeEnvironment: order.cashfreeEnvironment,
      itemName: item.name,
    });
  } catch (error) {
    logger.error('Error creating buy order:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Failed to create payment order');
  }
};

/**
 * Verify and complete a buy item payment after Cashfree SDK callback.
 * POST /api/v1/connect/page/:pageId/buy-verify
 */
const verifyBuyOrder = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;
    const { orderId, cashfreeOrderId, cashfreePaymentId } = req.body;

    if (!orderId && !cashfreeOrderId) {
      return sendError(res, 'VALIDATION_FAILED', 'orderId or cashfreeOrderId is required');
    }

    // Find order
    const query = orderId
      ? { _id: orderId, userId, connectPageId: pageId }
      : { cashfreeOrderId, userId, connectPageId: pageId };
    const order = await Order.findOne(query);
    if (!order) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Order not found');
    }

    if (order.paymentStatus === 'paid') {
      return sendSuccess(res, 200, 'Order already verified', { order });
    }

    // Optionally verify with Cashfree (best-effort — don't fail if Cashfree is unreachable)
    let cfVerified = false;
    if (cashfreeService.isCashfreeConfigured()) {
      try {
        const cfOrder = await cashfreeService.getOrderStatus(order.cashfreeOrderId);
        const cfStatus = String(cfOrder?.order_status || '').toUpperCase();
        cfVerified = cfStatus === 'PAID';
      } catch (cfErr) {
        logger.warn('Cashfree order status check failed (non-blocking):', cfErr.message);
        // If Cashfree is unreachable, trust the SDK callback
        cfVerified = true;
      }
    } else {
      // Cashfree not configured (dev/sandbox without creds) — trust SDK
      cfVerified = true;
    }

    if (!cfVerified) {
      return sendError(res, 'PAYMENT_FAILED', 'Payment has not been completed for this order');
    }

    order.paymentStatus = 'paid';
    if (cashfreePaymentId) order.cashfreePaymentId = cashfreePaymentId;
    await order.save();

    return sendSuccess(res, 200, 'Payment verified and order confirmed', { order });
  } catch (error) {
    logger.error('Error verifying buy order:', error);
    return sendError(res, 'SERVER_ERROR', error.message || 'Failed to verify payment');
  }
};

/**
 * Get orders for a page (page owner only)
 * GET /api/v1/connect/page/:pageId/orders
 */
const getPageOrders = async (req, res) => {
  try {
    const { pageId } = req.params;
    const userId = req.user._id;

    const page = await ConnectPage.findById(pageId).select('userId');
    if (!page) return sendError(res, 'RESOURCE_NOT_FOUND', 'Page not found');
    if (page.userId.toString() !== userId.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only the page owner can view orders');
    }

    const orders = await Order.find({ connectPageId: pageId })
      .populate('userId', 'username fullName profilePic')
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, 200, 'Orders fetched', { orders });
  } catch (error) {
    logger.error('Error fetching page orders:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to fetch orders');
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
  getConnectPages,
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
  uploadContentImage,
  // Views
  recordView,
  // Analytics
  getPageAnalytics,
  // Geo
  getCountries,
  getLanguages,
  // Shared helpers used by SuperAdmin routes
  sanitizeContentBlocks,
  normalizeColor,
  // Buy Items (Cashfree one-time payment)
  createBuyOrder,
  verifyBuyOrder,
  getPageOrders,
};


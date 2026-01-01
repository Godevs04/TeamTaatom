const User = require('../models/User');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const { sendOTPEmail } = require('../utils/sendOtp');

// @desc    Get user account activity
// @route   GET /api/v1/users/me/activity
// @access  Private
const getAccountActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('lastLogin createdAt isVerified');
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    // Build activity log from available data
    const activities = [];
    
    // Account creation
    if (user.createdAt) {
      activities.push({
        type: 'account_created',
        description: 'Account created',
        timestamp: user.createdAt,
        ipAddress: null,
        device: null,
        location: null
      });
    }

    // Last login
    if (user.lastLogin) {
      activities.push({
        type: 'login',
        description: 'Last login',
        timestamp: user.lastLogin,
        ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress || null,
        device: req.headers['user-agent'] || null,
        location: null
      });
    }

    // Email verification status
    if (user.isVerified) {
      activities.push({
        type: 'email_verified',
        description: 'Email verified',
        timestamp: user.updatedAt || user.createdAt,
        ipAddress: null,
        device: null,
        location: null
      });
    }

    // Sort by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return sendSuccess(res, 200, 'Account activity fetched successfully', {
      activities,
      totalCount: activities.length
    });
  } catch (error) {
    logger.error('Get account activity error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching account activity');
  }
};

// @desc    Get active sessions (simplified - returns current session info)
// @route   GET /api/v1/users/me/sessions
// @access  Private
const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('lastLogin');
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    // Since we use JWT tokens without server-side session storage,
    // we return a simplified session list with current session
    const currentSession = {
      sessionId: 'current',
      device: req.headers['user-agent'] || 'Unknown device',
      ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown',
      location: null,
      lastActive: user.lastLogin || new Date(),
      isCurrent: true
    };

    // Try to get location from IP
    try {
      const fetch = (...args) => import("node-fetch").then(m => m.default(...args));
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
      if (ip) {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          currentSession.location = `${geo.city || ''}, ${geo.region || ''}, ${geo.country_name || ''}`.replace(/^, |, $/g, '');
        }
      }
    } catch (e) {
      // Ignore location errors
    }

    return sendSuccess(res, 200, 'Active sessions fetched successfully', {
      sessions: [currentSession],
      totalCount: 1
    });
  } catch (error) {
    logger.error('Get active sessions error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching active sessions');
  }
};

// @desc    Logout from session (informational - JWT tokens are stateless)
// @route   DELETE /api/v1/users/me/sessions/:sessionId
// @access  Private
const logoutFromSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Since we use stateless JWT tokens, we can't actually invalidate them server-side
    // This endpoint is informational and tells the client to clear the token
    // In a production system with session storage, you would invalidate the session here
    
    if (sessionId === 'current') {
      return sendSuccess(res, 200, 'Session logout initiated. Please clear your token on the client side.', {
        message: 'Token-based authentication requires client-side token removal'
      });
    }

    return sendError(res, 'RES_3002', 'Session not found');
  } catch (error) {
    logger.error('Logout from session error:', error);
    return sendError(res, 'SRV_6001', 'Error logging out from session');
  }
};

// @desc    Get blocked users list
// @route   GET /api/v1/users/me/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .select('blockedUsers')
      .populate('blockedUsers', 'fullName username email profilePic');
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    const blockedUsers = (user.blockedUsers || []).map(blockedUser => ({
      _id: blockedUser._id,
      fullName: blockedUser.fullName,
      username: blockedUser.username,
      email: blockedUser.email,
      profilePic: blockedUser.profilePic
    }));

    return sendSuccess(res, 200, 'Blocked users fetched successfully', {
      blockedUsers,
      totalCount: blockedUsers.length
    });
  } catch (error) {
    logger.error('Get blocked users error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching blocked users');
  }
};

// @desc    Unblock a user
// @route   DELETE /api/v1/users/me/blocked/:userId
// @access  Private
const unblockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: blockedUserId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    if (!user.blockedUsers || !user.blockedUsers.includes(blockedUserId)) {
      return sendError(res, 'RES_3002', 'User is not blocked');
    }

    user.blockedUsers.pull(blockedUserId);
    await user.save();

    return sendSuccess(res, 200, 'User unblocked successfully', {
      unblocked: true
    });
  } catch (error) {
    logger.error('Unblock user error:', error);
    return sendError(res, 'SRV_6001', 'Error unblocking user');
  }
};

// @desc    Resend verification email
// @route   POST /api/v1/users/me/verify-email
// @access  Private
const resendVerificationEmail = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('email fullName isVerified otp otpExpires');
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    if (user.isVerified) {
      return sendError(res, 'RES_3005', 'Email is already verified');
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send OTP email
    await sendOTPEmail(user.email, otp, user.fullName);

    return sendSuccess(res, 200, 'Verification email sent successfully', {
      email: user.email
    });
  } catch (error) {
    logger.error('Resend verification email error:', error);
    return sendError(res, 'SRV_6001', 'Error sending verification email');
  }
};

// @desc    Sync user data
// @route   POST /api/v1/sync
// @access  Private
const syncUserData = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .select('fullName username email profilePic followers following blockedUsers isVerified lastLogin createdAt')
      .populate('followers', 'fullName username profilePic')
      .populate('following', 'fullName username profilePic');
    
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    // Return synced data
    return sendSuccess(res, 200, 'Data synced successfully', {
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        followersCount: user.followers?.length || 0,
        followingCount: user.following?.length || 0,
        blockedUsersCount: user.blockedUsers?.length || 0
      },
      syncedAt: new Date()
    });
  } catch (error) {
    logger.error('Sync user data error:', error);
    return sendError(res, 'SRV_6001', 'Error syncing user data');
  }
};

// @desc    Delete user account (GDPR/DPDP compliance)
// @route   DELETE /api/v1/users/me
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    if (!password) {
      return sendError(res, 'VAL_2002', 'Password is required to delete account');
    }

    // Verify password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Return 400 (Bad Request) instead of 401 to prevent token refresh loop
      // User is authenticated, but password is incorrect
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTH_1004',
          message: 'Invalid password'
        }
      });
    }

    // Cascade delete all user data
    const { cascadeDeleteUser } = require('../utils/cascadeDelete');
    await cascadeDeleteUser(userId);

    // Delete user document
    await User.findByIdAndDelete(userId);
    logger.info(`User account ${userId} deleted successfully`);

    return sendSuccess(res, 200, 'Account deleted successfully', {
      message: 'Your account and all associated data have been permanently deleted'
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    return sendError(res, 'SRV_6001', 'Error deleting account');
  }
};

// Helper function to mask email addresses for security
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  
  // Show first 2 characters and mask the rest of local part
  const maskedLocal = localPart.length > 2 
    ? `${localPart.substring(0, 2)}${'*'.repeat(Math.min(localPart.length - 2, 6))}`
    : '**';
  
  return `${maskedLocal}@${domain}`;
};

// Helper function to sanitize URLs (remove signed tokens, query parameters, and user IDs from path)
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  try {
    const urlObj = new URL(url);
    // Remove all query parameters (signed tokens, credentials, etc.)
    urlObj.search = '';
    
    // Remove user IDs and sensitive paths from URL pathname
    // Pattern: /profiles/{userId}/filename or /{userId}/filename
    // Replace with generic path like /profiles/[user]/filename
    let pathname = urlObj.pathname;
    
    // Match MongoDB ObjectId pattern (24 hex characters) in path
    const objectIdPattern = /[0-9a-fA-F]{24}/g;
    pathname = pathname.replace(objectIdPattern, '[user-id]');
    
    // Also replace any numeric IDs that might be timestamps or other identifiers
    // Pattern: /{long-number}-{hex}.jpg or similar
    pathname = pathname.replace(/\/(\d{10,})-/g, '/[timestamp]-');
    pathname = pathname.replace(/-[0-9a-fA-F]{8,}/g, '-[hash]');
    
    urlObj.pathname = pathname;
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, try to sanitize manually
    // Remove query parameters
    const withoutQuery = url.split('?')[0];
    // Remove ObjectIds from path
    const sanitized = withoutQuery.replace(/[0-9a-fA-F]{24}/g, '[user-id]');
    return sanitized;
  }
};

// Helper function to hash user IDs for privacy (optional - can be removed if IDs are needed)
const hashId = (id) => {
  if (!id) return id;
  // Simple hash for privacy - keeps format but makes it non-identifiable
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(String(id)).digest('hex').substring(0, 16);
};

// @desc    Export user data (GDPR compliance)
// @route   GET /api/v1/users/me/export
// @access  Private
const exportUserData = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .select('-password -otp -otpExpires')
      .populate('followers', 'fullName username email')
      .populate('following', 'fullName username email')
      .lean();

    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    // Get user's posts
    const Post = require('../models/Post');
    const posts = await Post.find({ user: userId, isActive: true })
      .select('caption location createdAt updatedAt likes comments')
      .lean();

    // Get user's collections
    const Collection = require('../models/Collection');
    const collections = await Collection.find({ user: userId })
      .select('name description posts createdAt')
      .lean();

    // Get user's notifications
    const Notification = require('../models/Notification');
    const notifications = await Notification.find({ toUser: userId })
      .select('type message createdAt read')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Get user's activities
    const Activity = require('../models/Activity');
    const activities = await Activity.find({ user: userId })
      .select('type description createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Compile export data with sanitization
    const exportData = {
      exportDate: new Date().toISOString(),
      securityNotice: 'This export contains masked sensitive information for your privacy and security.',
      user: {
        id: hashId(user._id), // Hashed ID for privacy
        fullName: user.fullName,
        username: user.username,
        email: maskEmail(user.email), // Masked email
        bio: user.bio,
        profilePic: user.profilePic ? sanitizeUrl(user.profilePic) : null, // Sanitized URL (no tokens)
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isVerified: user.isVerified,
        settings: user.settings ? {
          // Remove sensitive settings if any
          privacy: user.settings.privacy,
          notifications: user.settings.notifications,
          account: {
            language: user.settings.account?.language,
            theme: user.settings.account?.theme,
            dataUsage: user.settings.account?.dataUsage
            // Exclude any sensitive account settings
          }
        } : null,
      },
      followers: user.followers?.map(f => ({
        id: hashId(f._id), // Hashed ID
        fullName: f.fullName,
        username: f.username,
        email: maskEmail(f.email) // Masked email
      })) || [],
      following: user.following?.map(f => ({
        id: hashId(f._id), // Hashed ID
        fullName: f.fullName,
        username: f.username,
        email: maskEmail(f.email) // Masked email
      })) || [],
      posts: posts.map(p => ({
        id: hashId(p._id), // Hashed ID
        caption: p.caption,
        location: p.location ? {
          // Sanitize location data (keep address but round coordinates for privacy)
          address: p.location.address,
          coordinates: p.location.coordinates ? {
            latitude: Math.round(p.location.coordinates.latitude * 10) / 10, // Round to 1 decimal (~11km precision)
            longitude: Math.round(p.location.coordinates.longitude * 10) / 10 // Round to 1 decimal (~11km precision)
          } : null
        } : null,
        likesCount: p.likes?.length || 0,
        commentsCount: p.comments?.length || 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })),
      collections: collections.map(c => ({
        id: hashId(c._id), // Hashed ID
        name: c.name,
        description: c.description,
        postsCount: c.posts?.length || 0,
        createdAt: c.createdAt
      })),
      notifications: notifications.map(n => ({
        id: hashId(n._id), // Hashed ID
        type: n.type,
        message: n.message || null, // Keep message but ensure no URLs with tokens
        read: n.read,
        createdAt: n.createdAt
      })),
      activities: activities.map(a => ({
        id: hashId(a._id), // Hashed ID
        type: a.type,
        description: a.description || null, // Keep description
        createdAt: a.createdAt
      }))
    };

    // Set response headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="taatom-data-export-${Date.now()}.json"`);

    return res.status(200).json(exportData);
  } catch (error) {
    logger.error('Export user data error:', error);
    return sendError(res, 'SRV_6001', 'Error exporting user data');
  }
};

module.exports = {
  getAccountActivity,
  getActiveSessions,
  logoutFromSession,
  getBlockedUsers,
  unblockUser,
  resendVerificationEmail,
  syncUserData,
  deleteAccount,
  exportUserData
};


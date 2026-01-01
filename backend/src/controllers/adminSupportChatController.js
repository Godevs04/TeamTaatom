const Chat = require('../models/Chat');
const User = require('../models/User');
const { sendError, sendSuccess } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { 
  getOrCreateSupportConversation, 
  sendSystemMessage
} = require('../services/adminSupportChatService');
const { getIO } = require('../socket');
const { TAATOM_OFFICIAL_USER_ID } = require('../constants/taatomOfficial');
const { generateSignedUrl } = require('../services/mediaService');

/**
 * Admin Support Chat Controller
 * 
 * Handles admin operations for support conversations
 */

// @desc    List all support conversations (admin only)
// @route   GET /admin/conversations?type=admin_support
// @access  Private (SuperAdmin)
// Ensure Taatom Official user exists in database
const ensureTaatomOfficialUser = async () => {
  try {
    const { TAATOM_OFFICIAL_USER } = require('../constants/taatomOfficial');
    
    let existingUser = null;
    
    // Try to find user by ID if TAATOM_OFFICIAL_USER_ID is set and valid
    if (TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(TAATOM_OFFICIAL_USER_ID)) {
      existingUser = await User.findById(TAATOM_OFFICIAL_USER_ID);
    }
    
    // If not found by ID, try to find by email or username
    if (!existingUser) {
      existingUser = await User.findOne({
        $or: [
          { email: 'taatom_official@taatom.com' },
          { username: 'taatom_official' }
        ]
      });
    }
    
    if (!existingUser) {
      logger.info('Creating Taatom Official user in database...');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('system_user_no_login', 10);
      
      const userData = {
        username: TAATOM_OFFICIAL_USER.username,
        fullName: TAATOM_OFFICIAL_USER.fullName,
        email: 'taatom_official@taatom.com',
        password: hashedPassword,
        isVerified: true,
        isActive: true,
        bio: 'Official Taatom support account',
        profilePic: TAATOM_OFFICIAL_USER.profilePic
      };
      
      // Only set _id if TAATOM_OFFICIAL_USER_ID is valid
      if (TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(TAATOM_OFFICIAL_USER_ID)) {
        userData._id = new mongoose.Types.ObjectId(TAATOM_OFFICIAL_USER_ID);
      }
      
      const officialUser = new User(userData);
      await officialUser.save();
      logger.info('Taatom Official user created successfully', { userId: officialUser._id.toString() });
      
      // Update the constant if it was null (for this session)
      if (!TAATOM_OFFICIAL_USER_ID) {
        logger.warn('TAATOM_OFFICIAL_USER_ID not set in environment. Using created user ID:', officialUser._id.toString());
        logger.warn('Please set TAATOM_OFFICIAL_USER_ID in your .env file for consistency');
      }
    } else {
      // Update profile picture if it's not set or different
      if (!existingUser.profilePic || existingUser.profilePic !== TAATOM_OFFICIAL_USER.profilePic) {
        existingUser.profilePic = TAATOM_OFFICIAL_USER.profilePic;
        await existingUser.save();
        logger.info('Taatom Official user profile picture updated');
      }
    }
  } catch (error) {
    // If user already exists (duplicate key) or other error, log but don't fail
    if (error.code === 11000) {
      logger.debug('Taatom Official user already exists');
    } else {
      logger.error('Error ensuring Taatom Official user:', error);
      // Don't throw - allow the system to continue, but log the error
    }
  }
};

const listSupportConversations = async (req, res) => {
  try {
    // Ensure Taatom Official user exists
    await ensureTaatomOfficialUser();
    
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Query for admin_support conversations
    const query = {
      type: 'admin_support'
    };

    // Optional status filter (can be extended)
    if (status) {
      // For now, we can filter by whether there are unread messages
      // This can be extended with a status field if needed
    }

    // Fetch conversations without populate first to get participant IDs
    const conversationsRaw = await Chat.find(query)
      .select('participants messages relatedEntity updatedAt createdAt _id')
      .sort('-updatedAt')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    logger.debug(`Found ${conversationsRaw.length} admin_support conversations`);

    // Extract user IDs (excluding TAATOM_OFFICIAL_USER_ID)
    const userIds = new Set();
    conversationsRaw.forEach(convo => {
      if (convo.participants && Array.isArray(convo.participants)) {
        convo.participants.forEach(pId => {
          // Handle both ObjectId and string formats
          let idStr;
          if (pId && typeof pId === 'object') {
            idStr = pId._id ? pId._id.toString() : pId.toString();
          } else {
            idStr = pId.toString();
          }
          if (idStr !== TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(idStr)) {
            userIds.add(new mongoose.Types.ObjectId(idStr));
          }
        });
      }
    });

    logger.debug(`Extracted ${userIds.size} unique user IDs from conversations`);

    // Fetch all users in one query
    const usersMap = new Map();
    if (userIds.size > 0) {
      const users = await User.find({ _id: { $in: Array.from(userIds) } })
        .select('fullName profilePic profilePicStorageKey email username isVerified')
        .lean();
      
      // Generate signed URLs for profile pictures
      for (const user of users) {
        let profilePicUrl = null;
        if (user.profilePicStorageKey) {
          try {
            profilePicUrl = await generateSignedUrl(user.profilePicStorageKey, 'PROFILE');
          } catch (error) {
            logger.warn('Failed to generate profile picture URL:', { 
              userId: user._id, 
              error: error.message 
            });
            // Fallback to legacy URL if available
            profilePicUrl = user.profilePic || null;
          }
        } else if (user.profilePic) {
          // Legacy: use existing profilePic if no storage key
          profilePicUrl = user.profilePic;
        }
        // Store user with signed URL
        usersMap.set(user._id.toString(), {
          ...user,
          profilePic: profilePicUrl
        });
      }
      logger.debug(`Fetched ${users.length} users for conversations`);
    }

    // Format response
    const formattedConversations = conversationsRaw.map(convo => {
      // Find user ID (not Taatom Official)
      let userId = null;
      if (convo.participants && Array.isArray(convo.participants)) {
        for (const pId of convo.participants) {
          // Handle both ObjectId and string formats
          let idStr;
          if (pId && typeof pId === 'object') {
            idStr = pId._id ? pId._id.toString() : pId.toString();
          } else {
            idStr = pId.toString();
          }
          if (idStr !== TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(idStr)) {
            userId = idStr;
            break;
          }
        }
      }

      // Get user from map
      const user = userId ? usersMap.get(userId) : null;
      
      // Get last message
      const lastMessage = convo.messages && convo.messages.length > 0
        ? convo.messages[convo.messages.length - 1]
        : null;

      // Only include conversations where we found a valid user
      if (!user) {
        logger.warn(`No valid user found for conversation ${convo._id}, userId: ${userId}, participants:`, convo.participants);
        return null; // Will be filtered out
      }

      return {
        _id: convo._id,
        user: {
          _id: user._id,
          fullName: user.fullName,
          profilePic: user.profilePic,
          email: user.email,
          username: user.username
        },
        lastMessage: lastMessage ? {
          text: lastMessage.text,
          timestamp: lastMessage.timestamp,
          sender: lastMessage.sender
        } : null,
        reason: convo.relatedEntity?.type || 'support',
        refId: convo.relatedEntity?.refId || null,
        unreadCount: convo.messages?.filter(m => {
          // Count messages from user (not Taatom Official) that are unread
          const isFromUser = m.sender.toString() === user._id.toString();
          const isUnread = !m.seen;
          return isFromUser && isUnread;
        }).length || 0,
        updatedAt: convo.updatedAt,
        createdAt: convo.createdAt
      };
    }).filter(conv => conv !== null); // Filter out null conversations

    logger.debug(`Formatted ${formattedConversations.length} conversations (filtered from ${conversationsRaw.length} raw)`);

    const total = await Chat.countDocuments(query);
    logger.debug(`Total admin_support conversations in DB: ${total}`);

    return sendSuccess(res, 200, 'Support conversations fetched successfully', {
      conversations: formattedConversations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
        hasNextPage: skip + parseInt(limit) < total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error listing support conversations:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch support conversations');
  }
};

// @desc    Get a specific support conversation (admin only)
// @route   GET /admin/conversations/:conversationId
// @access  Private (SuperAdmin)
const getSupportConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return sendError(res, 'VAL_2001', 'Invalid conversation ID');
    }

    // Ensure Taatom Official user exists
    await ensureTaatomOfficialUser();
    
    const conversation = await Chat.findById(conversationId)
      .lean();

    if (!conversation) {
      return sendError(res, 'RES_3001', 'Conversation not found');
    }

    if (conversation.type !== 'admin_support') {
      return sendError(res, 'AUTH_1006', 'Not a support conversation');
    }

    // Extract user ID (not Taatom Official)
    let userId = null;
    if (conversation.participants && Array.isArray(conversation.participants)) {
      for (const pId of conversation.participants) {
        let idStr = null;
        
        try {
          // Handle different participant ID formats
          if (pId instanceof mongoose.Types.ObjectId) {
            idStr = pId.toString();
          } else if (Buffer.isBuffer(pId)) {
            // Convert buffer to ObjectId string
            const objId = new mongoose.Types.ObjectId(pId);
            idStr = objId.toString();
          } else if (pId && typeof pId === 'object') {
            // Handle ObjectId objects or objects with _id
            if (pId._id) {
              if (pId._id instanceof mongoose.Types.ObjectId) {
                idStr = pId._id.toString();
              } else if (Buffer.isBuffer(pId._id)) {
                const objId = new mongoose.Types.ObjectId(pId._id);
                idStr = objId.toString();
              } else {
                idStr = String(pId._id);
              }
            } else if (pId.toString && typeof pId.toString === 'function') {
              idStr = pId.toString();
            } else {
              continue;
            }
          } else if (pId) {
            idStr = String(pId);
          } else {
            continue;
          }
          
          // Validate the ID string
          if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) {
            continue;
          }
          
          // Skip Taatom Official user ID
          if (TAATOM_OFFICIAL_USER_ID && idStr === TAATOM_OFFICIAL_USER_ID) {
            continue;
          }
          
          userId = idStr;
          break;
        } catch (error) {
          logger.warn(`Error processing participant ID:`, error);
          continue;
        }
      }
    }

    logger.debug(`Extracted userId for conversation ${conversationId}: ${userId}`);

    if (!userId) {
      logger.warn(`No valid user ID found for conversation ${conversationId}, participants count: ${conversation.participants?.length || 0}`);
      return sendError(res, 'RES_3001', 'No valid user found in conversation participants');
    }

    // Fetch user details
    const user = await User.findById(userId)
      .select('fullName profilePic profilePicStorageKey email username isVerified')
      .lean();

    if (!user) {
      logger.warn(`User not found for conversation ${conversationId}, userId: ${userId}`);
      // Return conversation with minimal user info instead of error
      // This handles cases where user might have been deleted
      return sendSuccess(res, 200, 'Support conversation fetched successfully', {
        conversation: {
          _id: conversation._id,
          user: {
            _id: userId,
            fullName: 'Unknown User',
            profilePic: null,
            email: null,
            username: null
          },
          messages: (conversation.messages || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
          reason: conversation.relatedEntity?.type || 'support',
          refId: conversation.relatedEntity?.refId || null,
          updatedAt: conversation.updatedAt,
          createdAt: conversation.createdAt
        }
      });
    }

    // Generate signed URL for profile picture
    let profilePicUrl = null;
    if (user.profilePicStorageKey) {
      try {
        profilePicUrl = await generateSignedUrl(user.profilePicStorageKey, 'PROFILE');
      } catch (error) {
        logger.warn('Failed to generate profile picture URL:', { 
          userId: user._id, 
          error: error.message 
        });
        // Fallback to legacy URL if available
        profilePicUrl = user.profilePic || null;
      }
    } else if (user.profilePic) {
      // Legacy: use existing profilePic if no storage key
      profilePicUrl = user.profilePic;
    }

    // Sort messages by timestamp (oldest first)
    const sortedMessages = (conversation.messages || []).sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    return sendSuccess(res, 200, 'Support conversation fetched successfully', {
      conversation: {
        _id: conversation._id,
        user: {
          _id: user._id,
          fullName: user.fullName,
          profilePic: profilePicUrl,
          email: user.email,
          username: user.username
        },
        messages: sortedMessages,
        reason: conversation.relatedEntity?.type || 'support',
        refId: conversation.relatedEntity?.refId || null,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt
      }
    });
  } catch (error) {
    logger.error('Error getting support conversation:', error);
    return sendError(res, 'SRV_6001', 'Failed to fetch support conversation');
  }
};

// @desc    Send message in support conversation (admin only)
// @route   POST /admin/conversations/:conversationId/messages
// @access  Private (SuperAdmin)
const sendSupportMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return sendError(res, 'VAL_2001', 'Invalid conversation ID');
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return sendError(res, 'VAL_2001', 'Message text is required');
    }

    const conversation = await Chat.findById(conversationId);

    if (!conversation) {
      return sendError(res, 'RES_3001', 'Conversation not found');
    }

    if (conversation.type !== 'admin_support') {
      return sendError(res, 'AUTH_1006', 'Not a support conversation');
    }

    // Safety: Ensure only admins can send messages as Taatom Official
    // This is already enforced by route permissions, but adding extra check
    if (!req.superAdmin) {
      return sendError(res, 'AUTH_1006', 'Only admins can send support messages');
    }
    
    // Optional: Log admin message for audit (compliance/debug)
    logger.info('Admin support message sent', {
      adminId: req.superAdmin._id?.toString(),
      adminEmail: req.superAdmin.email,
      conversationId: conversationId.toString(),
      messageLength: text.trim().length,
      sentAt: new Date().toISOString()
    });
    
    // Send system message (from Taatom Official)
    const message = await sendSystemMessage({
      conversationId: conversationId.toString(),
      messageText: text.trim()
    });

    // Reload conversation to get updated message
    await conversation.populate('participants', 'fullName profilePic isVerified');
    const updatedConversation = await Chat.findById(conversationId).lean();

    // Get user ID (not Taatom Official)
    const user = conversation.participants.find(
      p => p._id.toString() !== TAATOM_OFFICIAL_USER_ID
    );
    const userId = user?._id?.toString();

    // Emit socket events to user and admin rooms
    try {
      const io = getIO();
      if (io && io.of('/app') && userId) {
        const nsp = io.of('/app');
        const lastMessage = updatedConversation.messages[updatedConversation.messages.length - 1];
        
        // Emit to user
        nsp.to(`user:${userId}`).emit('message:new', { 
          chatId: conversation._id, 
          message: lastMessage
        });
        nsp.to(`user:${userId}`).emit('chat:update', { 
          chatId: conversation._id, 
          lastMessage: text.trim(), 
          timestamp: lastMessage.timestamp 
        });
        
        // Emit to admin support room for real-time updates in admin panel
        nsp.to('admin_support').emit('admin_support:message:new', { 
          chatId: conversation._id, 
          message: lastMessage,
          userId: userId.toString(),
          otherUserId: TAATOM_OFFICIAL_USER_ID
        });
        nsp.to('admin_support').emit('admin_support:chat:update', { 
          chatId: conversation._id, 
          lastMessage: text.trim(), 
          timestamp: lastMessage.timestamp,
          userId: userId.toString()
        });
        
        logger.debug('Emitted socket events for admin support message:', conversation._id);
      }
    } catch (socketError) {
      logger.debug('Socket not available for support message:', socketError);
    }

    return sendSuccess(res, 200, 'Message sent successfully', {
      message: {
        ...message,
        _id: updatedConversation.messages[updatedConversation.messages.length - 1]._id
      }
    });
  } catch (error) {
    logger.error('Error sending support message:', error);
    return sendError(res, 'SRV_6001', 'Failed to send message');
  }
};

// @desc    Create or get support conversation for a user (admin only)
// @route   POST /admin/conversations
// @access  Private (SuperAdmin)
const createSupportConversation = async (req, res) => {
  try {
    // Ensure Taatom Official user exists
    await ensureTaatomOfficialUser();
    
    const { userId, reason = 'support', refId = null, initialMessage } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'VAL_2001', 'Valid userId is required');
    }

    // Validate reason
    if (reason && !['trip_verification', 'support'].includes(reason)) {
      return sendError(res, 'VAL_2001', 'Invalid reason. Must be "trip_verification" or "support"');
    }

    // Check if user exists
    const user = await User.findById(userId).select('fullName email profilePic profilePicStorageKey');
    if (!user) {
      return sendError(res, 'RES_3001', 'User not found');
    }

    // Generate signed URL for profile picture
    let profilePicUrl = null;
    if (user.profilePicStorageKey) {
      try {
        profilePicUrl = await generateSignedUrl(user.profilePicStorageKey, 'PROFILE');
      } catch (error) {
        logger.warn('Failed to generate profile picture URL:', { 
          userId: user._id, 
          error: error.message 
        });
        profilePicUrl = user.profilePic || null;
      }
    } else if (user.profilePic) {
      profilePicUrl = user.profilePic;
    }

    // Get or create conversation
    const conversation = await getOrCreateSupportConversation({
      userId,
      reason,
      refId
    });

    // Send initial message if provided
    if (initialMessage && initialMessage.trim()) {
      await sendSystemMessage({
        conversationId: conversation._id.toString(),
        messageText: initialMessage.trim()
      });
    }

    // Reload conversation with populated data
    const populatedConversation = await Chat.findById(conversation._id)
      .populate('participants', 'fullName profilePic profilePicStorageKey email username isVerified')
      .lean();

    const userParticipant = populatedConversation.participants.find(
      p => p._id.toString() !== TAATOM_OFFICIAL_USER_ID
    );

    // Generate signed URL for user participant profile picture
    let userProfilePicUrl = profilePicUrl; // Use the one we already generated
    if (!userProfilePicUrl && userParticipant?.profilePicStorageKey) {
      try {
        userProfilePicUrl = await generateSignedUrl(userParticipant.profilePicStorageKey, 'PROFILE');
      } catch (error) {
        logger.warn('Failed to generate profile picture URL for user participant:', { 
          userId: userParticipant?._id, 
          error: error.message 
        });
        userProfilePicUrl = userParticipant?.profilePic || null;
      }
    } else if (!userProfilePicUrl && userParticipant?.profilePic) {
      userProfilePicUrl = userParticipant.profilePic;
    }

    return sendSuccess(res, 200, 'Support conversation created successfully', {
      conversation: {
        _id: populatedConversation._id,
        user: {
          _id: userParticipant?._id,
          fullName: userParticipant?.fullName,
          profilePic: userProfilePicUrl,
          email: userParticipant?.email,
          username: userParticipant?.username
        },
        messages: populatedConversation.messages || [],
        reason: populatedConversation.relatedEntity?.type || 'support',
        refId: populatedConversation.relatedEntity?.refId || null,
        updatedAt: populatedConversation.updatedAt,
        createdAt: populatedConversation.createdAt
      }
    });
  } catch (error) {
    logger.error('Error creating support conversation:', error);
    return sendError(res, 'SRV_6001', 'Failed to create support conversation');
  }
};

// @desc    Mark all messages in a support conversation as read (admin only)
// @route   POST /api/v1/superadmin/conversations/:conversationId/mark-read
// @access  Private (SuperAdmin)
const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return sendError(res, 'VAL_2001', 'Invalid conversation ID')
    }

    // Ensure Taatom Official user exists
    await ensureTaatomOfficialUser()

    const conversation = await Chat.findById(conversationId)

    if (!conversation) {
      return sendError(res, 'RES_3001', 'Conversation not found')
    }

    if (conversation.type !== 'admin_support') {
      return sendError(res, 'AUTH_1006', 'Not a support conversation')
    }

    // Mark all user messages (not from Taatom Official) as seen
    let officialIdStr = null
    if (TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(TAATOM_OFFICIAL_USER_ID)) {
      try {
        const TAATOM_OFFICIAL_ID = new mongoose.Types.ObjectId(TAATOM_OFFICIAL_USER_ID)
        officialIdStr = TAATOM_OFFICIAL_ID.toString()
      } catch (error) {
        logger.warn('Invalid TAATOM_OFFICIAL_USER_ID format:', TAATOM_OFFICIAL_USER_ID)
      }
    }
    
    let updated = false

    if (conversation.messages && Array.isArray(conversation.messages)) {
      conversation.messages.forEach(msg => {
        if (!msg.sender) return
        
        // Handle different sender ID formats (ObjectId, string, buffer)
        let senderId = null
        if (msg.sender instanceof mongoose.Types.ObjectId) {
          senderId = msg.sender.toString()
        } else if (typeof msg.sender === 'object' && msg.sender.toString) {
          senderId = msg.sender.toString()
        } else if (typeof msg.sender === 'string') {
          senderId = msg.sender
        } else if (Buffer.isBuffer(msg.sender)) {
          // Convert buffer to ObjectId string
          try {
            const objId = new mongoose.Types.ObjectId(msg.sender)
            senderId = objId.toString()
          } catch (error) {
            logger.warn('Failed to convert sender buffer to ObjectId:', error)
            return
          }
        }
        
        // Mark messages from users (not Taatom Official) as seen
        if (senderId && (!officialIdStr || senderId !== officialIdStr) && !msg.seen) {
          msg.seen = true
          updated = true
        }
      })
    }

    if (updated) {
      await conversation.save()
      logger.debug(`Marked conversation ${conversationId} as read`)
    }

    return sendSuccess(res, 200, 'Conversation marked as read', { unreadCount: 0 })
  } catch (error) {
    logger.error('Error marking conversation as read:', error)
    return sendError(res, 'SRV_6001', 'Failed to mark conversation as read')
  }
}

module.exports = {
  listSupportConversations,
  getSupportConversation,
  sendSupportMessage,
  createSupportConversation,
  markConversationAsRead
};


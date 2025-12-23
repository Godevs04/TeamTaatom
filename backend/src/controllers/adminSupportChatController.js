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
    const existingUser = await User.findById(TAATOM_OFFICIAL_USER_ID);
    if (!existingUser) {
      logger.info('Creating Taatom Official user in database...');
      const { TAATOM_OFFICIAL_USER } = require('../constants/taatomOfficial');
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('system_user_no_login', 10);
      
      const officialUser = new User({
        _id: new mongoose.Types.ObjectId(TAATOM_OFFICIAL_USER_ID),
        username: TAATOM_OFFICIAL_USER.username,
        fullName: TAATOM_OFFICIAL_USER.fullName,
        email: `taatom_official@taatom.com`,
        password: hashedPassword,
        isVerified: true,
        isActive: true,
        bio: 'Official Taatom support account'
      });
      await officialUser.save();
      logger.info('Taatom Official user created successfully');
    }
  } catch (error) {
    // If user already exists (duplicate key) or other error, log but don't fail
    if (error.code === 11000) {
      logger.debug('Taatom Official user already exists');
    } else {
      logger.debug('Taatom Official user check:', error.message);
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
        .select('fullName profilePic email username isVerified')
        .lean();
      users.forEach(user => {
        usersMap.set(user._id.toString(), user);
      });
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

    // Fetch user details
    const user = userId ? await User.findById(userId)
      .select('fullName profilePic email username isVerified')
      .lean() : null;

    if (!user) {
      logger.warn(`User not found for conversation ${conversationId}, userId: ${userId}`);
      return sendError(res, 'RES_3001', 'User not found for this conversation');
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
          profilePic: user.profilePic,
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
    const user = await User.findById(userId).select('fullName email profilePic');
    if (!user) {
      return sendError(res, 'RES_3001', 'User not found');
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
      .populate('participants', 'fullName profilePic email username isVerified')
      .lean();

    const userParticipant = populatedConversation.participants.find(
      p => p._id.toString() !== TAATOM_OFFICIAL_USER_ID
    );

    return sendSuccess(res, 200, 'Support conversation created successfully', {
      conversation: {
        _id: populatedConversation._id,
        user: {
          _id: userParticipant?._id,
          fullName: userParticipant?.fullName,
          profilePic: userParticipant?.profilePic,
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

module.exports = {
  listSupportConversations,
  getSupportConversation,
  sendSupportMessage,
  createSupportConversation
};


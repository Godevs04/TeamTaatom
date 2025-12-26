const Chat = require('../models/Chat');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendError, sendSuccess, ERROR_CODES } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const { TAATOM_OFFICIAL_USER_ID, TAATOM_OFFICIAL_USER } = require('../constants/taatomOfficial');
const { generateSignedUrl } = require('../services/mediaService');

// Import socket and fetch with proper error handling
let getIO;

// Use dynamic import for fetch to handle CommonJS compatibility
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

// Function to get socket instance - will be called when needed
const getSocketInstance = () => {
  try {
    logger.debug('Getting socket instance...');
    logger.debug('global.socketIO available:', !!global.socketIO);
    
    // Try to get from global first
    if (global.socketIO) {
      logger.debug('Using global.socketIO');
      return global.socketIO;
    }
    
    logger.debug('Trying to require socket module...');
    // Try to require socket module
    const socketModule = require('../socket');
    logger.debug('Socket module required:', !!socketModule);
    logger.debug('Socket module getIO:', !!socketModule.getIO);
    
    if (socketModule.getIO) {
      const io = socketModule.getIO();
      logger.debug('getIO returned:', !!io);
      return io;
    }
    
    logger.debug('No socket instance available');
    return null;
  } catch (error) {
    logger.error('Failed to get socket instance:', error);
    return null;
  }
};

// Helper: check if user is following the other
async function canChat(userId, otherId) {
  // Check if either user has blocked the other
  const user = await User.findById(userId);
  const other = await User.findById(otherId);
  
  if (user && user.blockedUsers && user.blockedUsers.includes(otherId)) {
    return false; // User has blocked the other
  }
  if (other && other.blockedUsers && other.blockedUsers.includes(userId)) {
    return false; // Other has blocked the user
  }
  
  return true;
}

exports.listChats = async (req, res) => {
  logger.debug('Request headers:', req.headers);
  logger.debug('req.user in /chat:', req.user);
  const userId = req.user._id;
  logger.debug('Fetching chats for user:', userId, 'at', new Date().toISOString());
  
  // Get all chats (user_chat and admin_support)
  const chats = await Chat.find({ participants: userId })
    .populate('participants', 'fullName profilePic profilePicStorageKey isVerified')
    .sort('-updatedAt')
    .lean();
  
  // Ensure every message has a 'seen' property (for backward compatibility)
  // Generate signed URLs for profile pictures
  for (const chat of chats) {
    if (Array.isArray(chat.messages)) {
      chat.messages = chat.messages.map(msg => ({ ...msg, seen: typeof msg.seen === 'boolean' ? msg.seen : false }));
    }
    
    // Generate signed URLs for participant profile pictures
    if (chat.participants && Array.isArray(chat.participants)) {
      for (const participant of chat.participants) {
        // Special handling for Taatom Official user
        if (participant._id && participant._id.toString() === TAATOM_OFFICIAL_USER_ID) {
          participant.isVerified = true;
          participant.fullName = participant.fullName || TAATOM_OFFICIAL_USER.fullName;
          // Always use the constant profile picture for Taatom Official
          participant.profilePic = TAATOM_OFFICIAL_USER.profilePic;
        } else if (participant._id) {
          // Generate signed URL for regular users
          let profilePicUrl = null;
          if (participant.profilePicStorageKey) {
            try {
              profilePicUrl = await generateSignedUrl(participant.profilePicStorageKey, 'PROFILE');
            } catch (error) {
              logger.warn('Failed to generate profile picture URL for chat participant:', { 
                userId: participant._id, 
                error: error.message 
              });
              // Fallback to legacy URL if available
              profilePicUrl = participant.profilePic || null;
            }
          } else if (participant.profilePic) {
            // Legacy: use existing profilePic if no storage key
            profilePicUrl = participant.profilePic;
          }
          participant.profilePic = profilePicUrl;
        }
      }
    }
  }
  
  // Deduplicate chats: Group by participants (sorted) and keep only the most recent one
  // BUT: Keep admin_support chats separate from user_chat chats
  const chatMap = new Map();
  chats.forEach(chat => {
    // For admin_support, use type + user as key to keep separate
    // For user_chat, use participants as key
    let key;
    if (chat.type === 'admin_support') {
      // Admin support chats: key by type + user
      key = `admin_support_${userId}`;
    } else {
      // User chats: key by sorted participant IDs
      const participantIds = chat.participants
        .map(p => p._id ? p._id.toString() : p.toString())
        .sort()
        .join('_');
      key = participantIds;
    }
    
    // If chat doesn't exist or this one is more recent, keep it
    if (!chatMap.has(key) || 
        new Date(chat.updatedAt) > new Date(chatMap.get(key).updatedAt)) {
      chatMap.set(key, chat);
    }
  });
  
  // Convert map back to array
  const uniqueChats = Array.from(chatMap.values());
  
  // Sort by updatedAt descending
  uniqueChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  logger.debug('Chats found:', chats.length, 'Unique chats:', uniqueChats.length);
  return sendSuccess(res, 200, 'Chats fetched successfully', { chats: uniqueChats });
};

exports.getChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    logger.debug('Getting chat between:', userId, 'and', otherUserId);
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    
    // Check if users can chat (check for blocked users)
    const canChatResult = await canChat(userId, otherUserId);
    if (!canChatResult) {
      return sendError(res, 'AUTH_1006', 'You cannot chat with this user. One of you may have blocked the other.');
    }
    
    let chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } })
      .populate('participants', 'fullName profilePic profilePicStorageKey')
      .lean();
    
    if (!chat) {
      logger.debug('Chat not found, creating new one');
      try {
        chat = await Chat.create({ participants: [userId, otherUserId], messages: [] });
        // Populate the newly created chat
        chat = await Chat.findById(chat._id)
          .populate('participants', 'fullName profilePic profilePicStorageKey')
          .lean();
        logger.debug('Created new chat:', chat._id);
      } catch (error) {
        logger.error('Error creating chat:', error);
        return sendError(res, 'SRV_6001', 'Failed to create chat');
      }
    } else {
      logger.debug('Found existing chat:', chat._id);
    }
    
    // Generate signed URLs for participant profile pictures
    if (chat.participants && Array.isArray(chat.participants)) {
      for (const participant of chat.participants) {
        // Special handling for Taatom Official user
        if (participant._id && participant._id.toString() === TAATOM_OFFICIAL_USER_ID) {
          participant.isVerified = true;
          participant.fullName = participant.fullName || TAATOM_OFFICIAL_USER.fullName;
          participant.profilePic = TAATOM_OFFICIAL_USER.profilePic;
        } else if (participant._id) {
          // Generate signed URL for regular users
          let profilePicUrl = null;
          if (participant.profilePicStorageKey) {
            try {
              profilePicUrl = await generateSignedUrl(participant.profilePicStorageKey, 'PROFILE');
            } catch (error) {
              logger.warn('Failed to generate profile picture URL for chat participant:', { 
                userId: participant._id, 
                error: error.message 
              });
              // Fallback to legacy URL if available
              profilePicUrl = participant.profilePic || null;
            }
          } else if (participant.profilePic) {
            // Legacy: use existing profilePic if no storage key
            profilePicUrl = participant.profilePic;
          }
          participant.profilePic = profilePicUrl;
        }
      }
    }
    
    return sendSuccess(res, 200, 'Chat fetched successfully', { chat });
  } catch (error) {
    logger.error('Error in getChat:', error);
    return sendError(res, 'SRV_6001', 'Failed to get chat');
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    if (!(await canChat(userId, otherUserId))) return sendError(res, 'AUTH_1006', 'Not allowed');
    const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } })
      .select('messages')
      .lean();
    if (!chat) return sendSuccess(res, 200, 'Messages fetched successfully', { messages: [] });
    return sendSuccess(res, 200, 'Messages fetched successfully', { messages: chat.messages || [] });
  } catch (error) {
    logger.error('Error getting messages:', error);
    return sendError(res, 'SRV_6001', 'Failed to get messages');
  }
};

exports.sendMessage = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const { text } = req.body;
  
  try {
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    if (!text) return sendError(res, 'VAL_2001', 'Text required');
    
    // PRODUCTION-GRADE: Get from environment variable, no hardcoded fallback
    const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID;
    if (!TAATOM_OFFICIAL_USER_ID) {
      logger.warn('TAATOM_OFFICIAL_USER_ID not set in environment variables');
    }
    const isTaatomOfficialRecipient = otherUserId.toString() === TAATOM_OFFICIAL_USER_ID;
    
    // Safety: Prevent user from sending messages AS Taatom Official (spoofing)
    // Only system/admin can send messages as Taatom Official
    // Note: Regular users CAN send messages TO Taatom Official (for support)
    const messageSenderId = userId.toString();
    if (messageSenderId === TAATOM_OFFICIAL_USER_ID && req.user.role !== 'admin' && req.user.role !== 'system' && !req.superAdmin) {
      logger.warn(`User ${userId} attempted to send message as Taatom Official`);
      return sendError(res, 'AUTH_1006', 'Not allowed to send as system user');
    }
    
    // For admin_support chats (messages TO Taatom Official), skip blocking check
    // For user_chat, check blocking
    if (!isTaatomOfficialRecipient && !(await canChat(userId, otherUserId))) {
      return sendError(res, 'AUTH_1006', 'Not allowed');
    }
    
    // Find or create chat
    let chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
    
    if (!chat) {
      // If messaging TO Taatom Official, create admin_support chat
      if (isTaatomOfficialRecipient) {
        const { getOrCreateSupportConversation } = require('../services/adminSupportChatService');
        const convo = await getOrCreateSupportConversation({
          userId: userId.toString(),
          reason: 'support',
          refId: null
        });
        chat = await Chat.findById(convo._id);
      } else {
        // Regular user chat
        chat = await Chat.create({ 
          type: 'user_chat',
          participants: [userId, otherUserId], 
          messages: [] 
        });
      }
    } else {
      // If existing chat is admin_support and user is messaging Taatom Official, ensure it's admin_support type
      if (isTaatomOfficialRecipient && chat.type !== 'admin_support') {
        // Convert to admin_support if it exists but is wrong type
        chat.type = 'admin_support'
        if (!chat.relatedEntity) {
          chat.relatedEntity = { type: 'support', refId: null }
        }
        await chat.save()
      }
    }
    
    // Permission check: Users cannot send messages to admin_support chats if they're not the user
    if (chat.type === 'admin_support' && !chat.participants.map(p => p.toString()).includes(userId.toString())) {
      return sendError(res, 'AUTH_1006', 'Not allowed to send messages to this conversation');
    }
    
    const message = { sender: userId, text, timestamp: new Date() };
    chat.messages.push(message);
    
    // Update conversation status for admin_support chats
    if (chat.type === 'admin_support' && chat.status !== 'resolved') {
      // When user replies, set status to 'open'
      chat.status = 'open';
    }
    
    await chat.save();

    // Emit real-time socket events for immediate updates
    try {
      logger.debug('Attempting to emit socket events...');
      
      const io = getSocketInstance();
      logger.debug('Socket instance available:', !!io);
      logger.debug('Socket type:', typeof io);
      
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        logger.debug('Namespace available:', !!nsp);
        
        // Emit to recipient (all devices)
        nsp.to(`user:${otherUserId}`).emit('message:new', { chatId: chat._id, message });
        // Emit ack to sender (all devices)
        nsp.to(`user:${userId}`).emit('message:sent', { chatId: chat._id, message });
        // Emit chat list update to both users
        nsp.to(`user:${otherUserId}`).emit('chat:update', { chatId: chat._id, lastMessage: message.text, timestamp: message.timestamp });
        nsp.to(`user:${userId}`).emit('chat:update', { chatId: chat._id, lastMessage: message.text, timestamp: message.timestamp });
        
        // For admin_support conversations, also emit to admin rooms
        if (chat.type === 'admin_support') {
          // PRODUCTION-GRADE: Get from environment variable, no hardcoded fallback
    const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID;
    if (!TAATOM_OFFICIAL_USER_ID) {
      logger.warn('TAATOM_OFFICIAL_USER_ID not set in environment variables');
    }
          // Emit to admin support room for real-time updates in admin panel
          nsp.to('admin_support').emit('admin_support:message:new', { 
            chatId: chat._id, 
            message,
            userId: userId.toString(),
            otherUserId: otherUserId.toString()
          });
          nsp.to('admin_support').emit('admin_support:chat:update', { 
            chatId: chat._id, 
            lastMessage: message.text, 
            timestamp: message.timestamp,
            userId: userId.toString()
          });
          logger.debug('Emitted admin_support socket events for chat:', chat._id);
        }
        
        logger.debug('Socket events emitted successfully for message:', message._id);
        logger.debug('Emitted to users:', { sender: userId, recipient: otherUserId });
        logger.debug('Chat ID:', chat._id);
      } else {
        logger.debug('Socket not available, skipping real-time events');
      }
    } catch (socketError) {
      logger.error('Error emitting socket events:', socketError);
      // Don't fail the request if socket fails
    }

    // Send push notification to recipient
    try {
      const recipient = await User.findById(otherUserId);
      if (recipient && recipient.expoPushToken && fetch && typeof fetch === 'function') {
        logger.debug('Sending push notification...');
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient.expoPushToken,
            sound: 'default',
            title: 'New Message',
            body: `${req.user.fullName || 'Someone'}: ${text}`,
            data: { chatWith: userId }
          })
        });
        logger.debug('Push notification sent successfully');
      } else {
        logger.debug('Push notification skipped:', { 
          hasRecipient: !!recipient, 
          hasToken: !!recipient?.expoPushToken, 
          hasFetch: !!fetch,
          fetchType: typeof fetch 
        });
      }
    } catch (err) {
      logger.error('Failed to send push notification:', err);
    }

    return sendSuccess(res, 200, 'Message sent successfully', { message });
  } catch (error) {
    logger.error('Error in sendMessage:', error);
    return sendError(res, 'SRV_6001', 'Failed to send message');
  }
};

// Mark a message as seen
exports.markMessageSeen = async (chatId, messageId, userId) => {
  logger.debug('[markMessageSeen] called with:', { chatId, messageId, userId });
  if (!chatId || !messageId || !userId) return;
  const chat = await Chat.findById(chatId);
  if (!chat) {
    logger.debug('[markMessageSeen] chat not found');
    return;
  }
  // Only allow if user is a participant
  if (!chat.participants.map(id => id.toString()).includes(userId.toString())) {
    logger.debug('[markMessageSeen] user not a participant');
    return;
  }
  const msg = chat.messages.id(messageId);
  if (msg && !msg.seen) {
    msg.seen = true;
    await chat.save();
    logger.debug('[markMessageSeen] message marked as seen:', { messageId });
  } else if (!msg) {
    logger.debug('[markMessageSeen] message not found');
  } else {
    logger.debug('[markMessageSeen] message already seen');
  }
};

// Mark all messages from the other user as seen
exports.markAllMessagesSeen = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
  if (!chat) return sendError(res, 'RES_3001', 'Chat not found');
  let updated = false;
  chat.messages.forEach(msg => {
    if (msg.sender.toString() === otherUserId && !msg.seen) {
      msg.seen = true;
      updated = true;
    }
  });
  if (updated) await chat.save();
  return sendSuccess(res, 200, 'Messages marked as seen');
};

// Clear all messages in a chat
exports.clearChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    
    const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
    if (!chat) {
      return sendError(res, 'RES_3001', 'Chat not found');
    }
    
    // Clear all messages
    chat.messages = [];
    await chat.save();
    
    // Emit socket event to update chat list
    try {
      const io = getSocketInstance();
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        nsp.to(`user:${userId}`).emit('chat:cleared', { chatId: chat._id });
        nsp.to(`user:${otherUserId}`).emit('chat:cleared', { chatId: chat._id });
      }
    } catch (socketError) {
      logger.error('Error emitting socket events:', socketError);
    }
    
    return sendSuccess(res, 200, 'Chat cleared successfully');
  } catch (error) {
    logger.error('Error clearing chat:', error);
    return sendError(res, 'SRV_6001', 'Failed to clear chat');
  }
};

// Mute or unmute chat notifications
exports.toggleMuteChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    
    const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
    if (!chat) {
      return sendError(res, 'RES_3001', 'Chat not found');
    }
    
    const user = await User.findById(userId);
    const muteIndex = user.mutedChats.findIndex(
      m => m.chatId.toString() === chat._id.toString()
    );
    
    if (muteIndex >= 0) {
      // Unmute
      user.mutedChats.splice(muteIndex, 1);
      await user.save();
      return sendSuccess(res, 200, 'Chat unmuted successfully', { muted: false });
    } else {
      // Mute
      user.mutedChats.push({ chatId: chat._id, mutedAt: new Date() });
      await user.save();
      return sendSuccess(res, 200, 'Chat muted successfully', { muted: true });
    }
  } catch (error) {
    logger.error('Error toggling mute:', error);
    return sendError(res, 'SRV_6001', 'Failed to toggle mute');
  }
};

// Get mute status for a chat
exports.getMuteStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    
    const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
    if (!chat) {
      return sendError(res, 'RES_3001', 'Chat not found');
    }
    
    const user = await User.findById(userId);
    const isMuted = user.mutedChats.some(
      m => m.chatId.toString() === chat._id.toString()
    );
    
    return sendSuccess(res, 200, 'Mute status fetched successfully', { muted: isMuted });
  } catch (error) {
    logger.error('Error getting mute status:', error);
    return sendError(res, 'SRV_6001', 'Failed to get mute status');
  }
};

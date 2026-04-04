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
  // Always allow admin_support chats (communication with Taatom Official)
  const officialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
  const userIdStr = userId.toString();
  const otherIdStr = otherId.toString();
  
  if (userIdStr === officialId || otherIdStr === officialId) {
    logger.debug('✅ [canChat] Admin chat detected - allowing', {
      userIdStr,
      otherIdStr,
      officialId
    });
    return true;
  }
  
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
        const officialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
        if (participant._id && participant._id.toString() === officialId) {
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
    
    const officialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
    logger.info('🔍 [getChat] Request received', {
      userId: userId.toString(),
      otherUserId: otherUserId,
      officialId
    });
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      logger.warn('❌ [getChat] Invalid otherUserId:', otherUserId);
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    
    // For admin_support chats, always allow (skip blocking check)
    // Normalize IDs for comparison (handle both ObjectId and string formats)
    const userIdStr = userId.toString();
    const otherUserIdStr = otherUserId.toString();
    const isTaatomOfficialChat = userIdStr === officialId || otherUserIdStr === officialId;
    
    logger.info('🔍 [getChat] Chat type check', {
      isTaatomOfficialChat,
      userIdStr,
      otherUserIdStr,
      officialId,
      comparison: {
        userIdMatch: userIdStr === officialId,
        otherUserIdMatch: otherUserIdStr === officialId
      }
    });
    
    if (!isTaatomOfficialChat) {
      // Check if users can chat (check for blocked users)
      const canChatResult = await canChat(userId, otherUserId);
      if (!canChatResult) {
        logger.warn('❌ [getChat] Cannot chat - blocked');
        return sendError(res, 'AUTH_1006', 'You cannot chat with this user. One of you may have blocked the other.');
      }
    }
    
    // Convert to ObjectIds for consistent querying
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const otherUserIdObj = new mongoose.Types.ObjectId(otherUserId);
    const officialUserIdObj = new mongoose.Types.ObjectId(officialId);
    
    logger.info('🔍 [getChat] Querying chat', {
      userIdObj: userIdObj.toString(),
      otherUserIdObj: otherUserIdObj.toString(),
      officialId
    });
    
    // Check if either participant is Taatom Official
    const isOfficialParticipant = userIdStr === officialId || otherUserIdStr === officialId;
    
    let chat = null;
    
    if (isOfficialParticipant) {
      // First try to find admin_support chat
      logger.info('🔍 [getChat] Looking for admin_support chat first');
      chat = await Chat.findOne({
        type: 'admin_support',
        participants: { $all: [userIdObj, officialUserIdObj] }
      })
        .populate('participants', 'fullName profilePic profilePicStorageKey')
        .select('+messages')
        .lean();
      
      if (!chat) {
        // Try general query (might be user_chat that needs conversion)
        logger.info('🔍 [getChat] Admin support not found, trying general query');
        chat = await Chat.findOne({ participants: { $all: [userIdObj, otherUserIdObj] } })
          .populate('participants', 'fullName profilePic profilePicStorageKey')
          .select('+messages')
          .lean();
      }
    } else {
      // Regular user chat
      chat = await Chat.findOne({ participants: { $all: [userIdObj, otherUserIdObj] } })
        .populate('participants', 'fullName profilePic profilePicStorageKey')
        .select('+messages')
        .lean();
    }
    
    logger.info('🔍 [getChat] Query result', {
      found: !!chat,
      chatId: chat?._id?.toString(),
      chatType: chat?.type,
      messageCount: chat?.messages?.length || 0,
      participants: chat?.participants?.map(p => p._id ? p._id.toString() : p.toString()) || [],
      isOfficialParticipant
    });
    
    if (!chat) {
      logger.info('📝 [getChat] Chat not found, creating new one', {
        isTaatomOfficialChat,
        otherUserIdStr: otherUserId.toString()
      });
      try {
        // If messaging TO Taatom Official, create admin_support chat
        if (isTaatomOfficialChat && otherUserIdStr === officialId) {
          logger.info('📝 [getChat] Creating admin_support conversation', {
            userIdStr,
            otherUserIdStr,
            officialId
          });
          const { getOrCreateSupportConversation } = require('../services/adminSupportChatService');
          const convo = await getOrCreateSupportConversation({
            userId: userId.toString(),
            reason: 'support',
            refId: null
          });
          chat = await Chat.findById(convo._id)
            .populate('participants', 'fullName profilePic profilePicStorageKey')
            .lean();
          logger.info('✅ [getChat] Created admin_support chat', {
            chatId: chat._id.toString(),
            messageCount: chat.messages?.length || 0
          });
        } else {
          // Regular user chat
          logger.info('📝 [getChat] Creating user_chat');
          const newChat = await Chat.create({ participants: [userIdObj, otherUserIdObj], messages: [] });
          // Populate the newly created chat
          chat = await Chat.findById(newChat._id)
            .populate('participants', 'fullName profilePic profilePicStorageKey')
            .lean();
          logger.info('✅ [getChat] Created user_chat', {
            chatId: chat._id.toString()
          });
        }
        
        // Ensure messages array exists
        if (!chat.messages) {
          chat.messages = [];
        }
      } catch (error) {
        logger.error('❌ [getChat] Error creating chat:', error);
        logger.error('❌ [getChat] Error stack:', error.stack);
        return sendError(res, 'SRV_6001', 'Failed to create chat');
      }
    } else {
      logger.info('✅ [getChat] Found existing chat', {
        chatId: chat._id.toString(),
        type: chat.type,
        messageCount: chat.messages?.length || 0
      });
    }
    
    // Generate signed URLs for participant profile pictures
    if (chat.participants && Array.isArray(chat.participants)) {
      const officialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
      for (const participant of chat.participants) {
        // Special handling for Taatom Official user
        if (participant._id && participant._id.toString() === officialId) {
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
    
    // Ensure messages are properly formatted
    const rawMessages = chat.messages || [];
    logger.info('📨 [getChat] Processing messages', {
      chatId: chat._id.toString(),
      rawMessageCount: rawMessages.length,
      firstMessage: rawMessages[0] ? {
        _id: rawMessages[0]._id?.toString(),
        sender: rawMessages[0].sender?.toString(),
        text: rawMessages[0].text?.substring(0, 50)
      } : null
    });
    
    if (rawMessages.length > 0 && Array.isArray(rawMessages)) {
      chat.messages = rawMessages.map((msg, index) => {
        const formatted = {
          _id: msg._id ? msg._id.toString() : null,
          sender: msg.sender ? (msg.sender._id ? msg.sender._id.toString() : msg.sender.toString()) : null,
          text: msg.text || '',
          timestamp: msg.timestamp || new Date(),
          seen: typeof msg.seen === 'boolean' ? msg.seen : false
        };
        
        if (index < 3) {
          logger.debug(`📨 [getChat] Message ${index}:`, formatted);
        }
        
        return formatted;
      });
    } else {
      chat.messages = [];
    }
    
    logger.info('✅ [getChat] Returning chat', {
      chatId: chat._id.toString(),
      messageCount: chat.messages.length,
      type: chat.type,
      participants: chat.participants?.map(p => p._id ? p._id.toString() : p.toString()) || []
    });
    
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
    
    const officialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
    logger.info('🔍 [getMessages] Request received', {
      userId: userId.toString(),
      otherUserId: otherUserId,
      officialId
    });
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      logger.warn('❌ [getMessages] Invalid otherUserId:', otherUserId);
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    
    // For admin_support chats, always allow (skip blocking check)
    // Normalize IDs for comparison (handle both ObjectId and string formats)
    const userIdStr = userId.toString();
    const otherUserIdStr = otherUserId.toString();
    const isTaatomOfficialChat = userIdStr === officialId || otherUserIdStr === officialId;
    
    logger.info('🔍 [getMessages] Chat type check', {
      isTaatomOfficialChat,
      userIdStr,
      otherUserIdStr,
      officialId,
      comparison: {
        userIdMatch: userIdStr === officialId,
        otherUserIdMatch: otherUserIdStr === officialId
      }
    });
    
    if (!isTaatomOfficialChat && !(await canChat(userId, otherUserId))) {
      logger.warn('❌ [getMessages] Cannot chat - blocked or invalid');
      return sendError(res, 'AUTH_1006', 'Not allowed');
    }
    
    // Convert to ObjectIds for consistent querying
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const otherUserIdObj = new mongoose.Types.ObjectId(otherUserId);
    const officialUserIdObj = new mongoose.Types.ObjectId(officialId);
    
    logger.info('🔍 [getMessages] Querying chat', {
      userIdObj: userIdObj.toString(),
      otherUserIdObj: otherUserIdObj.toString(),
      officialId
    });
    
    // Check if either participant is Taatom Official
    const isOfficialParticipant = userIdStr === officialId || otherUserIdStr === officialId;
    
    let chat = null;
    
    if (isOfficialParticipant) {
      // First try to find admin_support chat
      logger.info('🔍 [getMessages] Looking for admin_support chat first');
      chat = await Chat.findOne({
        type: 'admin_support',
        participants: { $all: [userIdObj, officialUserIdObj] }
      })
        .select('messages type participants')
        .lean();
      
      if (!chat) {
        // Try general query (might be user_chat)
        logger.info('🔍 [getMessages] Admin support not found, trying general query');
        chat = await Chat.findOne({ participants: { $all: [userIdObj, otherUserIdObj] } })
          .select('messages type participants')
          .lean();
      }
    } else {
      // Regular user chat
      chat = await Chat.findOne({ participants: { $all: [userIdObj, otherUserIdObj] } })
        .select('messages type participants')
        .lean();
    }
    
    logger.info('🔍 [getMessages] Query result', {
      found: !!chat,
      chatId: chat?._id?.toString(),
      chatType: chat?.type,
      messageCount: chat?.messages?.length || 0,
      participants: chat?.participants?.map(p => p._id ? p._id.toString() : p.toString()) || [],
      isOfficialParticipant
    });
    
    if (!chat) {
      logger.warn('❌ [getMessages] No chat found', { 
        userId: userId.toString(), 
        otherUserId: otherUserId.toString(),
        isTaatomOfficialChat
      });
      return sendSuccess(res, 200, 'Messages fetched successfully', { messages: [] });
    }
    
    // Ensure messages array exists and is properly formatted
    const rawMessages = chat.messages || [];
    logger.info('📨 [getMessages] Processing messages', {
      chatId: chat._id.toString(),
      rawMessageCount: rawMessages.length,
      firstMessage: rawMessages[0] ? {
        _id: rawMessages[0]._id?.toString(),
        sender: rawMessages[0].sender?.toString(),
        text: rawMessages[0].text?.substring(0, 50)
      } : null
    });
    
    const messages = rawMessages.map((msg, index) => {
      const formatted = {
        _id: msg._id ? msg._id.toString() : null,
        sender: msg.sender ? (msg.sender._id ? msg.sender._id.toString() : msg.sender.toString()) : null,
        text: msg.text || '',
        timestamp: msg.timestamp || new Date(),
        seen: typeof msg.seen === 'boolean' ? msg.seen : false
      };
      
      if (index < 3) {
        logger.debug(`📨 [getMessages] Message ${index}:`, formatted);
      }
      
      return formatted;
    });
    
    logger.info('✅ [getMessages] Returning messages', { 
      chatId: chat._id.toString(), 
      messageCount: messages.length,
      chatType: chat.type
    });
    
    return sendSuccess(res, 200, 'Messages fetched successfully', { messages });
  } catch (error) {
    logger.error('❌ [getMessages] Error:', error);
    logger.error('❌ [getMessages] Error stack:', error.stack);
    return sendError(res, 'SRV_6001', 'Failed to get messages');
  }
};

exports.sendMessage = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const { text } = req.body;
  
  try {
    const officialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
    const userIdStr = userId.toString();
    const otherUserIdStr = otherUserId ? otherUserId.toString() : null;
    
    logger.info('📤 [sendMessage] Request received', {
      userId: userIdStr,
      otherUserId: otherUserId,
      textLength: text?.length,
      officialId,
      userRole: req.user.role,
      isSuperAdmin: !!req.superAdmin
    });
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      logger.warn('❌ [sendMessage] Invalid otherUserId:', otherUserId);
      return sendError(res, 'VAL_2001', 'Invalid user');
    }
    if (!text) {
      logger.warn('❌ [sendMessage] Text required');
      return sendError(res, 'VAL_2001', 'Text required');
    }
    
    // Use constant from imports (handles fallback logic)
    // Normalize IDs for comparison
    const isTaatomOfficialRecipient = otherUserIdStr === officialId;
    
    logger.info('🔍 [sendMessage] Recipient check', {
      isTaatomOfficialRecipient,
      otherUserIdStr,
      officialId,
      comparison: otherUserIdStr === officialId
    });
    
    // Safety: Prevent user from sending messages AS Taatom Official (spoofing)
    // Only system/admin can send messages as Taatom Official
    // Note: Regular users CAN send messages TO Taatom Official (for support)
    const messageSenderId = userId.toString();
    if (messageSenderId === officialId && req.user.role !== 'admin' && req.user.role !== 'system' && !req.superAdmin) {
      logger.warn(`❌ [sendMessage] User ${userId} attempted to send message as Taatom Official`);
      return sendError(res, 'AUTH_1006', 'Not allowed to send as system user');
    }
    
    // For admin_support chats (messages TO Taatom Official), skip blocking check
    // For user_chat, check blocking
    if (!isTaatomOfficialRecipient && !(await canChat(userId, otherUserId))) {
      logger.warn('❌ [sendMessage] Cannot chat - blocked');
      return sendError(res, 'AUTH_1006', 'Not allowed');
    }
    
    // Convert to ObjectIds for consistent querying
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const otherUserIdObj = new mongoose.Types.ObjectId(otherUserId);
    
    logger.info('🔍 [sendMessage] Querying for chat', {
      userIdObj: userIdObj.toString(),
      otherUserIdObj: otherUserIdObj.toString()
    });
    
    // Check if either participant is Taatom Official (by checking actual participant IDs)
    const officialUserIdObj = new mongoose.Types.ObjectId(officialId);
    const isOfficialParticipant = userIdStr === officialId || otherUserIdStr === officialId;
    
    logger.info('🔍 [sendMessage] Official participant check', {
      userIdStr,
      otherUserIdStr,
      officialId,
      isOfficialParticipant
    });
    
    // Find or create chat - prioritize admin_support if messaging Taatom Official
    let chat = null;
    
    if (isOfficialParticipant) {
      // First try to find admin_support chat
      logger.info('🔍 [sendMessage] Looking for admin_support chat first', {
        userIdObj: userIdObj.toString(),
        otherUserIdObj: otherUserIdObj.toString(),
        officialId
      });
      
      chat = await Chat.findOne({
        type: 'admin_support',
        participants: { $all: [userIdObj, officialUserIdObj] }
      });
      
      if (chat) {
        logger.info('✅ [sendMessage] Found admin_support chat', {
          chatId: chat._id.toString(),
          type: chat.type
        });
      } else {
        // Try general query (might be user_chat that needs conversion)
        logger.info('🔍 [sendMessage] Admin support not found, trying general query');
        chat = await Chat.findOne({ participants: { $all: [userIdObj, otherUserIdObj] } });
        
        if (chat && chat.type === 'user_chat') {
          logger.info('🔄 [sendMessage] Found user_chat with Taatom Official, converting to admin_support', {
            chatId: chat._id.toString()
          });
          chat.type = 'admin_support';
          if (!chat.relatedEntity) {
            chat.relatedEntity = { type: 'support', refId: null };
          }
          await chat.save();
          logger.info('✅ [sendMessage] Converted chat to admin_support');
        }
      }
    } else {
      // Regular user chat - find by participants only
      chat = await Chat.findOne({ participants: { $all: [userIdObj, otherUserIdObj] } });
    }
    
    logger.info('🔍 [sendMessage] Query result', {
      found: !!chat,
      chatId: chat?._id?.toString(),
      chatType: chat?.type,
      messageCount: chat?.messages?.length || 0,
      isOfficialParticipant
    });
    
    if (!chat) {
      logger.info('📝 [sendMessage] Creating new chat', { isOfficialParticipant });
      // If messaging TO/FROM Taatom Official, create admin_support chat
      if (isOfficialParticipant) {
        try {
          const { getOrCreateSupportConversation } = require('../services/adminSupportChatService');
          const actualUserId = userIdStr === officialId ? otherUserIdStr : userIdStr;
          logger.info('📝 [sendMessage] Creating admin_support conversation', {
            actualUserId,
            userIdStr,
            otherUserIdStr,
            officialId
          });
          
          const convo = await getOrCreateSupportConversation({
            userId: actualUserId,
            reason: 'support',
            refId: null
          });
          
          if (!convo || !convo._id) {
            logger.error('❌ [sendMessage] getOrCreateSupportConversation returned invalid result:', convo);
            return sendError(res, 'SRV_6001', 'Failed to create support conversation');
          }
          
          chat = await Chat.findById(convo._id);
          
          if (!chat) {
            logger.error('❌ [sendMessage] Chat not found after creation:', convo._id);
            return sendError(res, 'SRV_6001', 'Chat not found after creation');
          }
          
          logger.info('✅ [sendMessage] Created admin_support chat', {
            chatId: chat._id.toString(),
            type: chat.type
          });
        } catch (error) {
          logger.error('❌ [sendMessage] Error creating admin_support conversation:', error);
          logger.error('❌ [sendMessage] Error stack:', error.stack);
          return sendError(res, 'SRV_6001', `Failed to create support conversation: ${error.message}`);
        }
      } else {
        // Regular user chat
        logger.info('📝 [sendMessage] Creating user_chat');
        chat = await Chat.create({ 
          type: 'user_chat',
          participants: [userIdObj, otherUserIdObj], 
          messages: [] 
        });
        logger.info('✅ [sendMessage] Created user_chat', {
          chatId: chat._id.toString()
        });
      }
    } else {
      logger.info('✅ [sendMessage] Found existing chat', {
        chatId: chat._id.toString(),
        type: chat.type,
        messageCount: chat.messages.length
      });
    }
    
    // Permission check: Users cannot send messages to admin_support chats if they're not the user
    const participantIds = chat.participants.map(p => p.toString());
    logger.info('🔍 [sendMessage] Permission check', {
      chatType: chat.type,
      participantIds,
      userIdStr: userId.toString(),
      isParticipant: participantIds.includes(userId.toString())
    });
    
    if (chat.type === 'admin_support' && !participantIds.includes(userId.toString())) {
      logger.warn('❌ [sendMessage] User not in participants list');
      return sendError(res, 'AUTH_1006', 'Not allowed to send messages to this conversation');
    }
    
    logger.info('📝 [sendMessage] Creating message', {
      sender: userId.toString(),
      textLength: text.length,
      chatId: chat._id.toString()
    });
    
    const message = { sender: userId, text, timestamp: new Date() };
    chat.messages.push(message);
    
    // Update conversation status for admin_support chats
    if (chat.type === 'admin_support' && chat.status !== 'resolved') {
      // When user replies, set status to 'open'
      chat.status = 'open';
      logger.info('🔄 [sendMessage] Updated admin_support status to open');
    }
    
    logger.info('💾 [sendMessage] Saving chat', {
      chatId: chat._id.toString(),
      messageCount: chat.messages.length
    });
    
    await chat.save();
    
    logger.info('✅ [sendMessage] Chat saved successfully', {
      chatId: chat._id.toString(),
      messageCount: chat.messages.length
    });

    // CRITICAL: Get the saved message with _id from the database
    // After save(), MongoDB assigns _id to subdocuments, but we need to get it from the saved document
    logger.info('🔍 [sendMessage] Fetching saved chat to get message _id', {
      chatId: chat._id.toString()
    });
    
    const savedChat = await Chat.findById(chat._id);
    let savedMessage = savedChat.messages[savedChat.messages.length - 1]; // Get the last message (the one we just added)
    
    logger.info('📨 [sendMessage] Saved message details', {
      hasMessage: !!savedMessage,
      messageId: savedMessage?._id?.toString(),
      sender: savedMessage?.sender?.toString(),
      textLength: savedMessage?.text?.length,
      totalMessages: savedChat.messages.length
    });
    
    // Ensure message has _id - if not, create one manually (fallback)
    if (!savedMessage || !savedMessage._id) {
      logger.warn('⚠️ [sendMessage] Message _id not found after save, creating fallback ID');
      // Fallback: use the message we created and add a temporary ID
      const mongoose = require('mongoose');
      savedMessage = { ...message, _id: new mongoose.Types.ObjectId() };
    }

    // Emit real-time socket events for immediate updates
    try {
      logger.info('📡 [sendMessage] Attempting to emit socket events', {
        chatId: chat._id.toString(),
        chatType: chat.type
      });
      
      const io = getSocketInstance();
      logger.info('📡 [sendMessage] Socket instance check', {
        hasIo: !!io,
        hasNamespace: !!(io && io.of('/app'))
      });
      
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        logger.info('📡 [sendMessage] Socket namespace available');
        
        // CRITICAL: Convert chat._id to string for consistent comparison on frontend
        const chatIdStr = chat._id.toString();
        
        // CRITICAL: Ensure message has all required fields including _id
        const messageToEmit = {
          _id: savedMessage._id.toString(),
          sender: savedMessage.sender.toString(),
          text: savedMessage.text,
          timestamp: savedMessage.timestamp,
          seen: savedMessage.seen || false
        };
        
        // Emit to recipient (all devices)
        logger.info('📡 [sendMessage] Emitting message:new to recipient', {
          recipient: otherUserId.toString(),
          chatId: chatIdStr,
          messageId: messageToEmit._id,
          room: `user:${otherUserId}`
        });
        nsp.to(`user:${otherUserId}`).emit('message:new', { chatId: chatIdStr, message: messageToEmit });
        
        // Emit ack to sender (all devices)
        logger.info('📡 [sendMessage] Emitting message:sent to sender', {
          sender: userId.toString(),
          chatId: chatIdStr,
          messageId: messageToEmit._id,
          room: `user:${userId}`
        });
        nsp.to(`user:${userId}`).emit('message:sent', { chatId: chatIdStr, message: messageToEmit });
        
        // Emit chat list update to both users
        logger.info('📡 [sendMessage] Emitting chat:update to both users', {
          recipient: otherUserId.toString(),
          sender: userId.toString(),
          chatId: chatIdStr,
          lastMessage: messageToEmit.text.substring(0, 50)
        });
        nsp.to(`user:${otherUserId}`).emit('chat:update', { chatId: chatIdStr, lastMessage: messageToEmit.text, timestamp: messageToEmit.timestamp });
        nsp.to(`user:${userId}`).emit('chat:update', { chatId: chatIdStr, lastMessage: messageToEmit.text, timestamp: messageToEmit.timestamp });
        
        // For admin_support conversations, also emit to admin rooms
        if (chat.type === 'admin_support') {
          logger.info('📡 [sendMessage] Emitting admin_support events', {
            chatId: chatIdStr,
            userId: userId.toString(),
            otherUserId: otherUserId.toString()
          });
          // Emit to admin support room for real-time updates in admin panel
          nsp.to('admin_support').emit('admin_support:message:new', { 
            chatId: chatIdStr, 
            message: messageToEmit,
            userId: userId.toString(),
            otherUserId: otherUserId.toString()
          });
          nsp.to('admin_support').emit('admin_support:chat:update', { 
            chatId: chatIdStr, 
            lastMessage: messageToEmit.text, 
            timestamp: messageToEmit.timestamp,
            userId: userId.toString()
          });
          logger.info('✅ [sendMessage] Emitted admin_support socket events', { chatId: chatIdStr });
        }
        
        logger.info('✅ [sendMessage] All socket events emitted successfully', {
          messageId: messageToEmit._id,
          sender: userId.toString(),
          recipient: otherUserId.toString(),
          chatId: chatIdStr,
          chatType: chat.type
        });
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

    return sendSuccess(res, 200, 'Message sent successfully', { message: savedMessage });
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

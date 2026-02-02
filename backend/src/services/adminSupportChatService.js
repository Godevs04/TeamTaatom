const Chat = require('../models/Chat');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { TAATOM_OFFICIAL_USER_ID } = require('../constants/taatomOfficial');

/**
 * Admin Support Chat Service
 * 
 * Handles creation and management of admin support conversations.
 * These conversations are isolated from normal user chats.
 */

/**
 * Get or create a support conversation for a user
 * @param {Object} params - Parameters
 * @param {String|ObjectId} params.userId - User ID
 * @param {String} params.reason - Reason for support ('trip_verification' or 'support')
 * @param {String|ObjectId} params.refId - Optional reference ID (e.g., TripVisit ID)
 * @returns {Promise<Object>} Conversation document
 */
async function getOrCreateSupportConversation({ userId, reason, refId = null }) {
  try {
    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid userId provided');
    }

    // Validate reason
    if (!reason || !['trip_verification', 'support'].includes(reason)) {
      throw new Error('Invalid reason. Must be "trip_verification" or "support"');
    }

    // Get Taatom Official user ID - try from constant first, then find by email/username
    // The constant should already be normalized to a valid ObjectId, but validate anyway
    let officialUserId = null;
    
    // Normalize the constant (should already be done, but ensure it's valid)
    const normalizedOfficialId = TAATOM_OFFICIAL_USER_ID ? TAATOM_OFFICIAL_USER_ID.toString() : '000000000000000000000001';
    
    if (mongoose.Types.ObjectId.isValid(normalizedOfficialId)) {
      officialUserId = normalizedOfficialId;
      logger.debug('Using TAATOM_OFFICIAL_USER_ID from constant:', officialUserId);
    } else {
      // Fallback: find user by email or username
      logger.warn('TAATOM_OFFICIAL_USER_ID is not a valid ObjectId, searching database');
      const User = require('../models/User');
      const officialUser = await User.findOne({
        $or: [
          { email: 'taatom_official@taatom.com' },
          { username: 'taatom_official' }
        ]
      }).select('_id').lean();
      
      if (officialUser && officialUser._id) {
        officialUserId = officialUser._id.toString();
        logger.warn('TAATOM_OFFICIAL_USER_ID not valid, using found user ID:', officialUserId);
      } else {
        // Last resort: use the fallback ObjectId
        officialUserId = '000000000000000000000001';
        logger.warn('Taatom Official user not found, using fallback ObjectId:', officialUserId);
      }
    }
    
    if (!officialUserId || !mongoose.Types.ObjectId.isValid(officialUserId)) {
      throw new Error('Failed to resolve Taatom Official user ID');
    }

    // Convert to ObjectId
    const userIdObj = new mongoose.Types.ObjectId(userId);
    const officialUserIdObj = new mongoose.Types.ObjectId(officialUserId);

    // Find existing support conversation for this user
    // Support conversations have type 'admin_support' and include both user and official user
    let convo = await Chat.findOne({
      type: 'admin_support',
      participants: { $all: [userIdObj, officialUserIdObj] }
    });

    if (!convo) {
      // Create new support conversation
      convo = await Chat.create({
        type: 'admin_support',
        participants: [userIdObj, officialUserIdObj],
        messages: [],
        relatedEntity: {
          type: reason,
          refId: refId ? new mongoose.Types.ObjectId(refId) : null
        }
      });
      logger.info(`Created new admin support conversation for user ${userId}, reason: ${reason}`);
    } else {
      // Update relatedEntity if refId is provided and different
      if (refId && (!convo.relatedEntity || !convo.relatedEntity.refId || 
          convo.relatedEntity.refId.toString() !== refId.toString())) {
        convo.relatedEntity = {
          type: reason,
          refId: new mongoose.Types.ObjectId(refId)
        };
        await convo.save();
      }
      logger.debug(`Found existing admin support conversation for user ${userId}`);
    }

    return convo;
  } catch (error) {
    logger.error('Error in getOrCreateSupportConversation:', error);
    throw error;
  }
}

/**
 * Send a system message in a support conversation
 * @param {Object} params - Parameters
 * @param {String|ObjectId} params.conversationId - Conversation ID
 * @param {String} params.messageText - Message text
 * @returns {Promise<Object>} Created message
 */
async function sendSystemMessage({ conversationId, messageText }) {
  try {
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error('Invalid conversationId provided');
    }

    if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
      throw new Error('Message text is required');
    }

    // Get Taatom Official user ID - try from constant first, then find by email/username
    let officialUserId = null;
    
    if (TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(TAATOM_OFFICIAL_USER_ID)) {
      officialUserId = TAATOM_OFFICIAL_USER_ID;
    } else {
      // Fallback: find user by email or username
      const User = require('../models/User');
      const officialUser = await User.findOne({
        $or: [
          { email: 'taatom_official@taatom.com' },
          { username: 'taatom_official' }
        ]
      }).select('_id').lean();
      
      if (officialUser && officialUser._id) {
        officialUserId = officialUser._id.toString();
        logger.warn('TAATOM_OFFICIAL_USER_ID not set, using found user ID:', officialUserId);
      } else {
        logger.error('TAATOM_OFFICIAL_USER_ID is not configured and Taatom Official user not found in database');
        throw new Error('System configuration error: Taatom Official user not found');
      }
    }

    if (!officialUserId || !mongoose.Types.ObjectId.isValid(officialUserId)) {
      throw new Error('Invalid Taatom Official user ID');
    }

    const convo = await Chat.findById(conversationId);
    if (!convo) {
      throw new Error('Conversation not found');
    }

    if (convo.type !== 'admin_support') {
      throw new Error('Cannot send system message to non-support conversation');
    }

    // Create message with Taatom Official as sender
    const message = {
      sender: new mongoose.Types.ObjectId(officialUserId),
      text: messageText.trim(),
      timestamp: new Date(),
      seen: false
    };

    convo.messages.push(message);
    
    // Update conversation status to 'waiting_user' when admin sends message
    if (convo.status !== 'resolved') {
      convo.status = 'waiting_user';
    }
    
    await convo.save();

    logger.info(`Sent system message in support conversation ${conversationId}`);
    return message;
  } catch (error) {
    logger.error('Error in sendSystemMessage:', error);
    throw error;
  }
}

/**
 * Get support conversation for a user
 * @param {String|ObjectId} userId - User ID
 * @returns {Promise<Object|null>} Conversation document or null
 */
async function getSupportConversation(userId) {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid userId provided');
    }

    // Get Taatom Official user ID - try from constant first, then find by email/username
    let officialUserId = null;
    
    if (TAATOM_OFFICIAL_USER_ID && mongoose.Types.ObjectId.isValid(TAATOM_OFFICIAL_USER_ID)) {
      officialUserId = TAATOM_OFFICIAL_USER_ID;
    } else {
      // Fallback: find user by email or username
      const User = require('../models/User');
      const officialUser = await User.findOne({
        $or: [
          { email: 'taatom_official@taatom.com' },
          { username: 'taatom_official' }
        ]
      }).select('_id').lean();
      
      if (officialUser && officialUser._id) {
        officialUserId = officialUser._id.toString();
        logger.warn('TAATOM_OFFICIAL_USER_ID not set, using found user ID:', officialUserId);
      } else {
        throw new Error('TAATOM_OFFICIAL_USER_ID is not configured and Taatom Official user not found in database');
      }
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const officialUserIdObj = new mongoose.Types.ObjectId(officialUserId);

    const convo = await Chat.findOne({
      type: 'admin_support',
      participants: { $all: [userIdObj, officialUserIdObj] }
    });

    return convo;
  } catch (error) {
    logger.error('Error in getSupportConversation:', error);
    throw error;
  }
}

/**
 * Get support conversation by TripVisit ID
 * Finds admin_support conversation linked to a specific TripVisit
 * @param {String|ObjectId} tripVisitId - TripVisit ID
 * @returns {Promise<Object|null>} Conversation document or null
 */
async function getSupportChatByTripVisit(tripVisitId) {
  try {
    if (!tripVisitId || !mongoose.Types.ObjectId.isValid(tripVisitId)) {
      throw new Error('Invalid tripVisitId provided');
    }

    const tripVisitIdObj = new mongoose.Types.ObjectId(tripVisitId);

    const convo = await Chat.findOne({
      type: 'admin_support',
      'relatedEntity.type': 'trip_verification',
      'relatedEntity.refId': tripVisitIdObj
    });

    return convo;
  } catch (error) {
    logger.error('Error in getSupportChatByTripVisit:', error);
    throw error;
  }
}

module.exports = {
  getOrCreateSupportConversation,
  sendSystemMessage,
  getSupportConversation,
  getSupportChatByTripVisit
};


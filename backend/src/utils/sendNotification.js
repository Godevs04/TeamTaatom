const { getAdmin, isInitialized } = require('../config/firebase');
const User = require('../models/User');
const logger = require('./logger');
const fetch = (...args) => import("node-fetch").then(m => m.default(...args));

/**
 * Taatom Notification Payload Standard
 * 
 * Unified notification structure for deep linking compatibility with Expo Router:
 * {
 *   title: string,
 *   body: string,
 *   data: {
 *     type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_approved' | 'trip_created' | 'trip_approved',
 *     screen: string, // Expo Router screen path
 *     entityId: string, // Post ID, User ID, etc.
 *     senderId: string // User ID of the sender
 *   }
 * }
 */

/**
 * Dynamically determine Expo Router screen path based on notification type and data
 * Matches frontend navigation logic in frontend/services/notifications.ts
 * 
 * @param {string} type - Notification type
 * @param {Object} notificationData - Notification data object containing post, fromUser, etc.
 * @returns {string} Screen path for Expo Router navigation
 */
const getScreenForType = (type, notificationData = {}) => {
  // Extract IDs from notification data
  // Support both direct IDs and populated objects
  const postId = notificationData.postId || 
                  notificationData.post?._id?.toString() || 
                  notificationData.post?.toString() ||
                  notificationData.entityId; // Fallback to entityId for post-related
  
  const fromUserId = notificationData.fromUserId || 
                     notificationData.fromUser?._id?.toString() || 
                     notificationData.fromUser?.toString() ||
                     notificationData.senderId; // Fallback to senderId for user-related

  // Determine screen based on notification type and available data
  switch (type) {
    case 'like':
    case 'comment':
    case 'post_mention':
      // Post-related notifications: navigate to post detail
      // Frontend expects: notification.postId -> /post/${postId}
      if (postId) {
        return `/post/${postId}`;
      }
      // If no post ID, fallback to home
      logger.warn(`No post ID found for ${type} notification`);
      return '/home';
    
    case 'follow':
    case 'follow_request':
    case 'follow_approved':
      // User-related notifications: navigate to sender's profile
      // Frontend expects: notification.fromUserId -> /profile/${fromUserId}
      if (fromUserId) {
        return `/profile/${fromUserId}`;
      }
      // If no fromUser ID, fallback to home
      logger.warn(`No fromUser ID found for ${type} notification`);
      return '/home';
    
    case 'trip_created':
    case 'trip_approved':
      // Trip-related notifications: navigate to associated post if available
      if (postId) {
        return `/post/${postId}`;
      }
      // If no post, navigate to tripscore or home
      return '/home';
    
    default:
      // Unknown notification type: default to home
      logger.warn(`Unknown notification type: ${type}`);
      return '/home';
  }
};

/**
 * Check if token is an Expo Push Token
 * Expo tokens start with "ExponentPushToken[" or "ExpoPushToken["
 */
const isExpoToken = (token) => {
  return token && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
};

/**
 * Send push notification via Expo Push Notification Service
 * Used for Expo tokens (ExponentPushToken[...])
 */
const sendViaExpo = async ({ pushToken, title, body, data }) => {
  try {
    // Determine screen path from notification type and data
    const screen = getScreenForType(data.type, {
      postId: data.postId || (['like', 'comment', 'post_mention'].includes(data.type) ? data.entityId : null),
      fromUserId: data.fromUserId || (['follow', 'follow_request', 'follow_approved'].includes(data.type) ? data.entityId || data.senderId : null),
      post: data.post,
      fromUser: data.fromUser,
      entityId: data.entityId,
      senderId: data.senderId
    });

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: {
          type: data.type,
          screen,
          entityId: String(data.entityId || ''),
          senderId: String(data.senderId || ''),
          ...(data.metadata ? { metadata: JSON.stringify(data.metadata) } : {})
        },
        priority: 'high',
        channelId: 'taatom_notifications'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Expo push notification failed: ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json();
    if (result.data?.status === 'error') {
      logger.error(`Expo push notification error: ${result.data.message}`);
      return false;
    }

    logger.debug(`✅ Expo push notification sent successfully`);
    return true;
  } catch (error) {
    logger.error('❌ Error sending Expo push notification:', error.message);
    return false;
  }
};

/**
 * Send push notification via Firebase Cloud Messaging
 * Used for native FCM tokens
 */
const sendViaFCM = async ({ pushToken, title, body, data }) => {
  // Check if Firebase is initialized
  if (!isInitialized()) {
    logger.warn('Firebase Admin SDK not initialized. Skipping FCM push notification.');
    return false;
  }

  try {
    const admin = getAdmin();
    if (!admin) {
      logger.warn('Firebase Admin SDK not available. Skipping FCM push notification.');
      return false;
    }

    // Determine screen path from notification type and data
    const screen = getScreenForType(data.type, {
      postId: data.postId || (['like', 'comment', 'post_mention'].includes(data.type) ? data.entityId : null),
      fromUserId: data.fromUserId || (['follow', 'follow_request', 'follow_approved'].includes(data.type) ? data.entityId || data.senderId : null),
      post: data.post,
      fromUser: data.fromUser,
      entityId: data.entityId,
      senderId: data.senderId
    });

    // Construct notification payload following Taatom standard
    const message = {
      token: pushToken,
      notification: {
        title,
        body
      },
      data: {
        type: data.type,
        screen,
        entityId: String(data.entityId || ''),
        senderId: String(data.senderId || ''),
        // Include any additional metadata as JSON strings
        ...(data.metadata ? { metadata: JSON.stringify(data.metadata) } : {})
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'taatom_notifications',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            priority: 10
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    logger.debug(`✅ FCM push notification sent successfully: ${response}`);
    return true;
  } catch (error) {
    // Handle invalid token errors gracefully
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      logger.warn(`Invalid FCM token detected. Token: ${pushToken.substring(0, 20)}...`);
      return false;
    }
    
    logger.error('❌ Error sending FCM push notification:', error.message);
    logger.error('Error details:', {
      code: error.code,
      message: error.message
    });
    return false;
  }
};

/**
 * Send push notification to a user
 * Automatically detects token type (Expo vs FCM) and uses appropriate service
 * 
 * @param {Object} options
 * @param {string} options.pushToken - Expo or FCM push token
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Notification data payload
 * @param {string} options.data.type - Notification type
 * @param {string} options.data.entityId - Related entity ID (post, user, etc.)
 * @param {string} options.data.senderId - Sender user ID
 * @returns {Promise<boolean>} Success status
 */
const sendPushNotification = async ({ pushToken, title, body, data }) => {
  if (!pushToken) {
    logger.debug('No push token provided. Skipping push notification.');
    return false;
  }

  // Detect token type and route to appropriate service
  if (isExpoToken(pushToken)) {
    // Expo Push Token - use Expo Push Notification Service
    logger.debug('Detected Expo push token, using Expo Push Service');
    return await sendViaExpo({ pushToken, title, body, data });
  } else {
    // Assume FCM token - use Firebase Admin SDK
    logger.debug('Detected FCM token, using Firebase Admin SDK');
    return await sendViaFCM({ pushToken, title, body, data });
  }
};

/**
 * Send notification to a user by their user ID
 * Fetches push token from user record and sends notification
 * 
 * @param {Object} options
 * @param {string} options.userId - Recipient user ID
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Notification data payload
 * @param {string} options.data.type - Notification type
 * @param {string} options.data.entityId - Related entity ID
 * @param {string} options.data.senderId - Sender user ID
 * @returns {Promise<boolean>} Success status
 */
const sendNotificationToUser = async ({ userId, title, body, data }) => {
  try {
    // Fetch user with push token and notification settings
    const user = await User.findById(userId)
      .select('expoPushToken settings.notifications')
      .lean();

    if (!user) {
      logger.warn(`User not found for notification: ${userId}`);
      return false;
    }

    // Check if user has push token
    if (!user.expoPushToken) {
      logger.debug(`User ${userId} has no push token. Skipping notification.`);
      return false;
    }

    // Check user's notification preferences
    const notificationSettings = user.settings?.notifications || {};
    const notificationType = data.type;

    // Map notification types to settings
    const settingMap = {
      like: 'likesNotifications',
      comment: 'commentsNotifications',
      follow: 'followsNotifications',
      follow_request: 'followRequestNotifications',
      follow_approved: 'followApprovalNotifications',
      trip_created: 'tripNotifications',
      trip_approved: 'tripNotifications',
      post_mention: 'mentionsNotifications'
    };

    const settingKey = settingMap[notificationType];
    
    // Default to true if setting doesn't exist (backward compatibility)
    if (settingKey && notificationSettings[settingKey] === false) {
      logger.debug(`User ${userId} has disabled ${settingKey}. Skipping notification.`);
      return false;
    }

    // Send push notification
    return await sendPushNotification({
      pushToken: user.expoPushToken,
      title,
      body,
      data
    });
  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error);
    return false;
  }
};

module.exports = {
  sendPushNotification,
  sendNotificationToUser,
  getScreenForType
};


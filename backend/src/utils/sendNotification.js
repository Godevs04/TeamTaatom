const { getAdmin, isInitialized } = require('../config/firebase');
const User = require('../models/User');
const logger = require('./logger');
const fetch = (...args) => (typeof globalThis.fetch === 'function'
  ? globalThis.fetch(...args)
  : import("node-fetch").then(m => m.default(...args)));

/**
 * Taatom Notification Payload Standard
 *
 * Unified notification structure for deep linking compatibility with Expo Router:
 * {
 *   title: string,
 *   body: string,
 *   data: {
 *     type: 'like' | 'comment' | 'post_mention' | 'follow' | 'follow_request' | 'follow_approved'
 *         | 'trip_created' | 'trip_approved' | 'route_access_request' | 'route_access_approved'
 *         | 'subscription_active' | 'creator_program' | 'message',
 *     screen: string,     // Expo Router path the tap should open
 *     entityId: string,   // Post ID, User ID, etc.
 *     senderId: string,   // User ID of the sender
 *     postId?, postType?, chatWith?, chatId?, metadata?
 *   }
 * }
 */

const POST_NOTIFICATION_TYPES = ['like', 'comment', 'post_mention', 'trip_created', 'trip_approved'];
const USER_NOTIFICATION_TYPES = ['follow', 'follow_request', 'follow_approved', 'route_access_approved'];

const SETTING_FOR_TYPE = {
  like: 'likesNotifications',
  comment: 'commentsNotifications',
  follow: 'followsNotifications',
  follow_request: 'followRequestNotifications',
  follow_approved: 'followApprovalNotifications',
  trip_created: 'tripNotifications',
  trip_approved: 'tripNotifications',
  post_mention: 'mentionsNotifications',
  message: 'messagesNotifications',
};

const WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const toId = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && value._id != null) return String(value._id);
  const str = String(value);
  return str && str !== '[object Object]' ? str : null;
};

/**
 * Route for a piece of content: long videos open the watch screen, shorts open the
 * creator's shorts viewer on that short, everything else opens the post screen.
 */
const contentScreen = (postId, postType, ownerId, { openComments = false } = {}) => {
  const commentsQuery = openComments ? 'comments=1' : '';
  if (postType === 'long_video') {
    return `/watch/${postId}${commentsQuery ? `?${commentsQuery}` : ''}`;
  }
  if (postType === 'short' && ownerId) {
    return `/user-shorts/${ownerId}?shortId=${postId}&single=true${commentsQuery ? `&${commentsQuery}` : ''}`;
  }
  return `/post/${postId}${commentsQuery ? `?${commentsQuery}` : ''}`;
};

/**
 * Determine the Expo Router path a notification tap should open.
 * Matches frontend navigation logic in frontend/services/notifications.ts
 *
 * @param {string} type - Notification type
 * @param {Object} notificationData - postId/post, postType, postOwnerId, fromUserId/fromUser, chatWith, chatId, etc.
 * @returns {string} Screen path for Expo Router navigation
 */
const getScreenForType = (type, notificationData = {}) => {
  if (notificationData.screen) return notificationData.screen;

  const postId = notificationData.postId ||
    toId(notificationData.post) ||
    (POST_NOTIFICATION_TYPES.includes(type) ? notificationData.entityId : null);

  const fromUserId = notificationData.fromUserId ||
    toId(notificationData.fromUser) ||
    notificationData.senderId;

  if (POST_NOTIFICATION_TYPES.includes(type)) {
    if (postId) {
      const openComments = type === 'comment' || (type === 'post_mention' && !!notificationData.commentId);
      return contentScreen(postId, notificationData.postType, notificationData.postOwnerId, { openComments });
    }
    logger.warn(`No post ID found for ${type} notification`);
    return '/home';
  }

  if (USER_NOTIFICATION_TYPES.includes(type)) {
    if (fromUserId) return `/profile/${fromUserId}`;
    logger.warn(`No fromUser ID found for ${type} notification`);
    return '/home';
  }

  switch (type) {
    case 'message':
      if (notificationData.chatWith) return `/chat/thread?userId=${notificationData.chatWith}`;
      if (notificationData.chatId) return `/chat/thread?chatId=${notificationData.chatId}`;
      return '/chat';

    case 'route_access_request':
      return '/settings/route-access-requests';

    case 'creator_program':
      return '/creator-monetization';

    case 'subscription_active': {
      const connectPageId = notificationData.connectPageId ||
        notificationData.entityId ||
        (notificationData.metadata && typeof notificationData.metadata === 'object' ? notificationData.metadata.connectPageId : null);
      return connectPageId ? `/connect/page/${connectPageId}` : '/home';
    }

    default:
      logger.warn(`Unknown notification type: ${type}`);
      return '/home';
  }
};

/** Data sent with the push; every value is a string so the same shape works for FCM. */
const buildPushData = (data) => {
  const payload = {
    type: String(data.type || ''),
    screen: getScreenForType(data.type, data),
    entityId: String(data.entityId || ''),
    senderId: String(data.senderId || ''),
  };
  for (const key of ['postId', 'postType', 'chatWith', 'chatId', 'connectPageId']) {
    if (data[key]) payload[key] = String(data[key]);
  }
  if (data.metadata) payload.metadata = JSON.stringify(data.metadata);
  return payload;
};

const timeToMinutes = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * Whether `now` falls inside the user's quiet hours, evaluated in their own timezone.
 * Overnight ranges (e.g. 22:00–08:00) count toward the day they start on.
 * Without a stored timezone the local time can't be known, so nothing is silenced.
 */
const isWithinQuietHours = (quietHours, now = new Date()) => {
  if (!quietHours || !quietHours.enabled || !quietHours.timezone) return false;
  const start = timeToMinutes(quietHours.startTime);
  const end = timeToMinutes(quietHours.endTime);
  if (start == null || end == null || start === end) return false;

  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: quietHours.timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return false;
  }
  const part = (name) => parts.find((p) => p.type === name)?.value;
  const day = String(part('weekday') || '').toLowerCase();
  const minutes = (Number(part('hour')) % 24) * 60 + Number(part('minute'));
  const days = Array.isArray(quietHours.days) && quietHours.days.length > 0 ? quietHours.days : WEEK_DAYS;

  if (start < end) {
    return days.includes(day) && minutes >= start && minutes < end;
  }
  if (minutes >= start) return days.includes(day);
  if (minutes < end) {
    const previousDay = WEEK_DAYS[(WEEK_DAYS.indexOf(day) + 6) % 7];
    return days.includes(previousDay);
  }
  return false;
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
const sendViaExpo = async ({ pushToken, title, body, data, badge }) => {
  try {
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
        data: buildPushData(data),
        ...(typeof badge === 'number' ? { badge } : {}),
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
const sendViaFCM = async ({ pushToken, title, body, data, badge }) => {
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

    // Construct notification payload following Taatom standard
    const message = {
      token: pushToken,
      notification: {
        title,
        body
      },
      data: buildPushData(data),
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
            badge: typeof badge === 'number' ? badge : 1,
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
 * @param {number} [options.badge] - App icon badge count
 * @returns {Promise<boolean>} Success status
 */
const sendPushNotification = async ({ pushToken, title, body, data, badge }) => {
  if (!pushToken) {
    logger.debug('No push token provided. Skipping push notification.');
    return false;
  }

  // Detect token type and route to appropriate service
  if (isExpoToken(pushToken)) {
    logger.debug('Detected Expo push token, using Expo Push Service');
    return await sendViaExpo({ pushToken, title, body, data, badge });
  }
  logger.debug('Detected FCM token, using Firebase Admin SDK');
  return await sendViaFCM({ pushToken, title, body, data, badge });
};

/**
 * Send notification to a user by their user ID.
 * Respects the user's push master switch, per-type switches and quiet hours.
 *
 * @param {Object} options
 * @param {string} options.userId - Recipient user ID
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body
 * @param {Object} options.data - Notification data payload (see payload standard above)
 * @returns {Promise<boolean>} Success status
 */
const sendNotificationToUser = async ({ userId, title, body, data }) => {
  try {
    const user = await User.findById(userId)
      .select('expoPushToken fcmToken settings.notifications')
      .lean();

    if (!user) {
      logger.warn(`User not found for notification: ${userId}`);
      return false;
    }

    const pushToken = user.expoPushToken || user.fcmToken;
    if (!pushToken) {
      logger.debug(`User ${userId} has no push token. Skipping notification.`);
      return false;
    }

    // Missing settings default to enabled (backward compatibility)
    const notificationSettings = user.settings?.notifications || {};
    if (notificationSettings.pushNotifications === false) {
      logger.debug(`User ${userId} has turned off push notifications. Skipping notification.`);
      return false;
    }

    const settingKey = SETTING_FOR_TYPE[data.type];
    if (settingKey && notificationSettings[settingKey] === false) {
      logger.debug(`User ${userId} has disabled ${settingKey}. Skipping notification.`);
      return false;
    }

    if (isWithinQuietHours(notificationSettings.quietHours)) {
      logger.debug(`User ${userId} is in quiet hours. Skipping push notification.`);
      return false;
    }

    // Chat unread counts live in the chat list, so only activity notifications drive the badge
    let badge;
    if (data.type !== 'message') {
      try {
        const Notification = require('../models/Notification');
        badge = await Notification.countDocuments({ toUser: userId, isRead: false });
      } catch (countError) {
        logger.debug('Could not compute badge count:', countError.message);
      }
    }

    return await sendPushNotification({ pushToken, title, body, data, badge });
  } catch (error) {
    logger.error(`Error sending notification to user ${userId}:`, error);
    return false;
  }
};

module.exports = {
  sendPushNotification,
  sendNotificationToUser,
  getScreenForType,
  isWithinQuietHours,
};

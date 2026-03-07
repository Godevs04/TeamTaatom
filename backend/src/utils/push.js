const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send a push notification via Expo Push API (production-safe).
 * @param {string} token - Expo push token (ExponentPushToken[...])
 * @param {Object} [options] - Optional overrides
 * @param {string} [options.title] - Notification title (default: 'Taatom')
 * @param {string} [options.body] - Notification body (default: 'New travel update available!')
 * @param {Object} [options.data] - Custom data payload (default: { type: 'update' })
 */
async function sendPushNotification(token, options = {}) {
  if (!token) return;
  if (!Expo.isExpoPushToken(token)) {
    console.error('Invalid Expo push token');
    return;
  }

  const message = {
    to: token,
    sound: 'default',
    title: options.title ?? 'Taatom',
    body: options.body ?? 'New travel update available!',
    data: options.data ?? { type: 'update' },
  };

  await expo.sendPushNotificationsAsync([message]);
}

module.exports = { sendPushNotification, Expo };

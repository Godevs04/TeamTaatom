const express = require('express');
const router = express.Router();
const { sendSuccess } = require('../utils/errorCodes');

/**
 * Mobile store version config — used by the app to prompt App Store / Play updates.
 * Env overrides (optional):
 *   MOBILE_IOS_LATEST, MOBILE_IOS_MINIMUM, MOBILE_IOS_STORE_URL
 *   MOBILE_ANDROID_LATEST, MOBILE_ANDROID_MINIMUM, MOBILE_ANDROID_STORE_URL
 *   MOBILE_UPDATE_MESSAGE
 *
 * GET /api/v1/app-config/mobile-version
 */
router.get('/mobile-version', (req, res) => {
  const message =
    process.env.MOBILE_UPDATE_MESSAGE ||
    'A new version of Taatom is available. Update for the latest features and fixes.';

  const payload = {
    ios: {
      latest: process.env.MOBILE_IOS_LATEST || '26.4.32',
      minimum: process.env.MOBILE_IOS_MINIMUM || '26.0.0',
      storeUrl:
        process.env.MOBILE_IOS_STORE_URL ||
        'https://apps.apple.com/app/id6757185352',
      message,
    },
    android: {
      latest: process.env.MOBILE_ANDROID_LATEST || '26.4.32',
      minimum: process.env.MOBILE_ANDROID_MINIMUM || '26.0.0',
      storeUrl:
        process.env.MOBILE_ANDROID_STORE_URL ||
        'https://play.google.com/store/apps/details?id=com.taatom.app',
      message,
    },
  };

  return sendSuccess(res, 200, 'Mobile version config', payload);
});

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const connectController = require('../controllers/connectController');
const subscriptionController = require('../controllers/subscriptionController');
const payoutController = require('../controllers/payoutController');

// Multer config for connect page image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Separate multer for canvas video uploads (mp4/mov/etc)
const videoUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// ─────────────────────────────────────────────
// Connect Pages — CRUD
// ─────────────────────────────────────────────
const connectUpload = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 },
]);
router.post('/create', authMiddleware, connectUpload, connectController.createPage);
router.get('/my-pages', authMiddleware, connectController.getMyPages);
router.get('/page/:pageId', optionalAuth, connectController.getPageDetail);
router.put('/page/:pageId', authMiddleware, connectUpload, connectController.updatePage);
router.delete('/page/:pageId', authMiddleware, connectController.deletePage);

// ─────────────────────────────────────────────
// Discovery
// ─────────────────────────────────────────────
router.get('/communities', optionalAuth, connectController.getCommunities);
router.get('/connect-pages', optionalAuth, connectController.getConnectPages);
router.get('/search-by-name', optionalAuth, connectController.searchByName);
router.get('/find-users', authMiddleware, connectController.findUsers);

// ─────────────────────────────────────────────
// Follow System (ConnectFollow)
// ─────────────────────────────────────────────
router.post('/follow', authMiddleware, connectController.followPage);
router.post('/unfollow', authMiddleware, connectController.unfollowPage);
router.post('/archive', authMiddleware, connectController.archivePage);
router.post('/unarchive', authMiddleware, connectController.unarchivePage);
router.get('/following', authMiddleware, connectController.getFollowing);
router.get('/archived', authMiddleware, connectController.getArchived);
router.get('/page/:pageId/followers', optionalAuth, connectController.getPageFollowers);

// ─────────────────────────────────────────────
// Website & Subscription Content
// ─────────────────────────────────────────────
router.put('/page/:pageId/website', authMiddleware, connectController.updateWebsiteContent);
router.get('/page/:pageId/website', optionalAuth, connectController.getWebsiteContent);
router.put('/page/:pageId/subscription', authMiddleware, connectController.updateSubscriptionContent);
router.get('/page/:pageId/subscription', optionalAuth, connectController.getSubscriptionContent);
router.post('/page/:pageId/content-image', authMiddleware, upload.single('image'), connectController.uploadContentImage);

// ─────────────────────────────────────────────
// Canvas Content (free-form Stories/Shorts-style layout)
// ─────────────────────────────────────────────
router.put('/page/:pageId/canvas', authMiddleware, connectController.updateCanvasContent);
router.get('/page/:pageId/canvas', optionalAuth, connectController.getCanvasContent);
router.post('/page/:pageId/content-video', authMiddleware, videoUpload.single('video'), connectController.uploadContentVideo);

// ─────────────────────────────────────────────
// Subscriptions (Payment)
// ─────────────────────────────────────────────
router.post('/subscribe', authMiddleware, subscriptionController.createSubscription);
router.get('/subscription/status/:connectPageId', authMiddleware, subscriptionController.getSubscriptionStatus);
router.post('/subscription/cancel', authMiddleware, subscriptionController.cancelSubscription);
router.get('/my-subscriptions', authMiddleware, subscriptionController.getMySubscriptions);
router.get('/page/:pageId/subscribers', authMiddleware, subscriptionController.getPageSubscribers);
router.post('/subscription/webhook', subscriptionController.handleWebhook); // No auth — Cashfree calls this
router.post('/payout/webhook', payoutController.handlePayoutWebhook); // No auth — Cashfree Payouts calls this
router.get('/subscription/payout-preview/:connectPageId', authMiddleware, subscriptionController.getPayoutPreview);
router.get('/my-payouts', authMiddleware, payoutController.getMyPayouts);

// Dev-only simulators — the handlers themselves refuse to run when
// NODE_ENV === 'production'. Lets you flip subscription state without
// wiring up an ngrok tunnel for the Cashfree webhook on a local box.
router.post('/subscription/_dev/manual-activate', authMiddleware, subscriptionController.devManualActivate);
router.post('/subscription/_dev/manual-cancel', authMiddleware, subscriptionController.devManualCancel);

// ─────────────────────────────────────────────
// Currency Config (public)
// ─────────────────────────────────────────────
router.get('/currency-config', (req, res) => {
  const { CURRENCIES, COUNTRY_TO_CURRENCY, SUPPORTED_CURRENCIES } = require('../utils/currencyConfig');
  res.json({ success: true, data: { currencies: CURRENCIES, countryToCurrency: COUNTRY_TO_CURRENCY, supportedCurrencies: SUPPORTED_CURRENCIES } });
});

// ─────────────────────────────────────────────
// Views & Analytics
// ─────────────────────────────────────────────
router.post('/page/:pageId/view', authMiddleware, connectController.recordView);
router.get('/page/:pageId/analytics', authMiddleware, connectController.getPageAnalytics);

module.exports = router;

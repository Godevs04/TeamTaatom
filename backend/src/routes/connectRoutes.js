const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { commonValidations, handleValidationErrors } = require('../middleware/validation');
const { endpointLimiters } = require('../middleware/rateLimit');
const connectController = require('../controllers/connectController');
const subscriptionController = require('../controllers/subscriptionController');
const payoutController = require('../controllers/payoutController');

// Reusable param validators. Attaching at the route boundary stops bogus
// ObjectIds before any controller logic runs (Mongoose silently returns null
// on invalid ids, masking the error path and leaving a NoSQL injection
// surface on aggregation pipelines).
const validatePageId = [commonValidations.mongoId('pageId'), handleValidationErrors];
const validateConnectPageId = [commonValidations.mongoId('connectPageId'), handleValidationErrors];

// Multer config for connect page image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  // Cap image uploads at 10 MB. Without this, a bad/malicious client could
  // exhaust server memory by streaming gigabytes through memoryStorage.
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
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
router.get('/page/:pageId', validatePageId, optionalAuth, connectController.getPageDetail);
router.put('/page/:pageId', validatePageId, authMiddleware, connectUpload, connectController.updatePage);
router.delete('/page/:pageId', validatePageId, authMiddleware, connectController.deletePage);

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
router.get('/page/:pageId/followers', validatePageId, optionalAuth, connectController.getPageFollowers);

// ─────────────────────────────────────────────
// Website & Subscription Content
// ─────────────────────────────────────────────
router.put('/page/:pageId/website', validatePageId, authMiddleware, connectController.updateWebsiteContent);
router.get('/page/:pageId/website', validatePageId, optionalAuth, connectController.getWebsiteContent);
router.put('/page/:pageId/subscription', validatePageId, authMiddleware, connectController.updateSubscriptionContent);
router.get('/page/:pageId/subscription', validatePageId, optionalAuth, connectController.getSubscriptionContent);
router.post('/page/:pageId/content-image', validatePageId, authMiddleware, upload.single('image'), connectController.uploadContentImage);
router.post('/page/:pageId/buy', validatePageId, authMiddleware, connectController.buyItem);

// ─────────────────────────────────────────────
// Subscriptions (Payment)
// ─────────────────────────────────────────────
router.post('/subscribe', authMiddleware, endpointLimiters.subscriptionWrite, subscriptionController.createSubscription);
router.get('/subscription/return', subscriptionController.subscriptionReturnRedirect);
router.post('/subscription/return', subscriptionController.subscriptionReturnRedirect);
router.get('/subscription/status/:connectPageId', validateConnectPageId, authMiddleware, endpointLimiters.subscriptionRead, subscriptionController.getSubscriptionStatus);
router.post('/subscription/cancel', authMiddleware, endpointLimiters.subscriptionWrite, subscriptionController.cancelSubscription);
router.get('/my-subscriptions', authMiddleware, subscriptionController.getMySubscriptions);
router.get('/page/:pageId/subscribers', validatePageId, authMiddleware, subscriptionController.getPageSubscribers);
router.post('/subscription/webhook', subscriptionController.handleWebhook); // No auth — Cashfree calls this
router.get('/subscription/payout-preview/:connectPageId', validateConnectPageId, authMiddleware, endpointLimiters.subscriptionRead, subscriptionController.getPayoutPreview);
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
router.post('/page/:pageId/view', validatePageId, authMiddleware, connectController.recordView);
router.get('/page/:pageId/analytics', validatePageId, authMiddleware, connectController.getPageAnalytics);

module.exports = router;

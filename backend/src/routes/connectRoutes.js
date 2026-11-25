const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const { commonValidations, handleValidationErrors } = require('../middleware/validation');
const { endpointLimiters } = require('../middleware/rateLimit');
const connectController = require('../controllers/connectController');
const subscriptionController = require('../controllers/subscriptionController');
const payoutController = require('../controllers/payoutController');
const communityController = require('../controllers/communityController');

// Reusable param validators. Attaching at the route boundary stops bogus
// ObjectIds before any controller logic runs (Mongoose silently returns null
// on invalid ids, masking the error path and leaving a NoSQL injection
// surface on aggregation pipelines).
const validatePageId = [commonValidations.mongoId('pageId'), handleValidationErrors];
const validateConnectPageId = [commonValidations.mongoId('connectPageId'), handleValidationErrors];
const validateEventId = [commonValidations.mongoId('eventId'), handleValidationErrors];
const validateGroupChatId = [commonValidations.mongoId('groupChatId'), handleValidationErrors];
const validateRequestId = [commonValidations.mongoId('requestId'), handleValidationErrors];
const validateTeamId = [commonValidations.mongoId('teamId'), handleValidationErrors];
const validateSubmissionId = [commonValidations.mongoId('submissionId'), handleValidationErrors];
const validateUserIdParam = [commonValidations.mongoId('userId'), handleValidationErrors];

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
router.post('/follow/accept', authMiddleware, connectController.acceptFollowRequest);
router.post('/follow/reject', authMiddleware, connectController.rejectFollowRequest);
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
router.post('/page/:pageId/buy-order', validatePageId, authMiddleware, connectController.createBuyOrder);
router.post('/page/:pageId/buy-verify', validatePageId, authMiddleware, connectController.verifyBuyOrder);
router.get('/page/:pageId/orders', validatePageId, authMiddleware, connectController.getPageOrders);

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

// ─────────────────────────────────────────────
// Community — Find, Roles, Group Chats, Events, Competitions
// ─────────────────────────────────────────────
router.get(
  '/page/:pageId/members/search',
  validatePageId,
  authMiddleware,
  communityController.searchCommunityMembers
);
router.get(
  '/page/:pageId/roles',
  validatePageId,
  authMiddleware,
  communityController.listCommunityRoles
);
router.post(
  '/page/:pageId/roles',
  validatePageId,
  authMiddleware,
  communityController.assignCommunityRole
);
router.delete(
  '/page/:pageId/roles/:userId',
  validatePageId,
  validateUserIdParam,
  authMiddleware,
  communityController.revokeCommunityRole
);

router.get(
  '/page/:pageId/group-chats',
  validatePageId,
  authMiddleware,
  communityController.listGroupChats
);
router.post(
  '/page/:pageId/group-chats',
  validatePageId,
  authMiddleware,
  communityController.createGroupChat
);
router.post(
  '/group-chats/:groupChatId/join',
  validateGroupChatId,
  authMiddleware,
  communityController.joinGroupChat
);
router.post(
  '/group-chats/:groupChatId/invite',
  validateGroupChatId,
  authMiddleware,
  communityController.inviteToGroupChat
);
router.get(
  '/group-chats/:groupChatId/join-requests',
  validateGroupChatId,
  authMiddleware,
  communityController.listGroupJoinRequests
);
router.post(
  '/group-join-requests/:requestId/review',
  validateRequestId,
  authMiddleware,
  communityController.reviewGroupJoinRequest
);

router.get(
  '/page/:pageId/events',
  validatePageId,
  authMiddleware,
  communityController.listEvents
);
router.post(
  '/page/:pageId/events',
  validatePageId,
  authMiddleware,
  communityController.createEvent
);
router.get(
  '/events/:eventId',
  validateEventId,
  authMiddleware,
  communityController.getEvent
);
router.patch(
  '/events/:eventId',
  validateEventId,
  authMiddleware,
  communityController.updateEvent
);
router.post(
  '/events/:eventId/register',
  validateEventId,
  authMiddleware,
  communityController.registerForEvent
);
router.delete(
  '/events/:eventId/register',
  validateEventId,
  authMiddleware,
  communityController.leaveEvent
);
router.post(
  '/events/:eventId/teams',
  validateEventId,
  authMiddleware,
  communityController.createEventTeam
);
router.post(
  '/event-teams/:teamId/accept',
  validateTeamId,
  authMiddleware,
  communityController.acceptTeamInvite
);
router.post(
  '/events/:eventId/host-dm',
  validateEventId,
  authMiddleware,
  communityController.openEventHostDm
);

router.post(
  '/events/:eventId/competition',
  validateEventId,
  authMiddleware,
  communityController.upsertCompetition
);
router.patch(
  '/events/:eventId/competition',
  validateEventId,
  authMiddleware,
  communityController.upsertCompetition
);
router.post(
  '/events/:eventId/competition/submissions',
  validateEventId,
  authMiddleware,
  communityController.submitCompetitionEntry
);
router.delete(
  '/events/:eventId/competition/submissions/:submissionId',
  validateEventId,
  validateSubmissionId,
  authMiddleware,
  communityController.removeCompetitionSubmission
);
router.get(
  '/events/:eventId/competition/leaderboard',
  validateEventId,
  authMiddleware,
  communityController.getCompetitionLeaderboard
);
router.put(
  '/events/:eventId/competition/submissions/:submissionId/score',
  validateEventId,
  validateSubmissionId,
  authMiddleware,
  communityController.scoreCompetitionSubmission
);
router.post(
  '/events/:eventId/competition/showcase',
  validateEventId,
  authMiddleware,
  communityController.publishCompetitionShowcase
);
router.get(
  '/events/:eventId/competition/showcase',
  validateEventId,
  authMiddleware,
  communityController.getCompetitionShowcase
);

module.exports = router;

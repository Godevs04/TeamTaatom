const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const connectController = require('../controllers/connectController');

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

// ─────────────────────────────────────────────
// Views & Analytics
// ─────────────────────────────────────────────
router.post('/page/:pageId/view', authMiddleware, connectController.recordView);
router.get('/page/:pageId/analytics', authMiddleware, connectController.getPageAnalytics);

module.exports = router;

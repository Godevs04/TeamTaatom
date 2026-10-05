const express = require('express');
const { checkPermission } = require('../controllers/superAdminController');
const controller = require('../controllers/creatorMonetizationAdminController');

const router = express.Router();
const canManage = checkPermission('canManageContent');

router.get('/settings', canManage, controller.getSettings);
router.put('/settings', canManage, controller.updateSettings);
router.get('/creators', canManage, controller.listCreators);
router.get('/creators/:userId', canManage, controller.getCreator);
router.post('/creators/:userId/status', canManage, controller.setStatus);
router.post('/creators/:userId/hold', canManage, controller.setHold);
router.get('/videos', canManage, controller.searchVideos);
router.post('/videos/:postId/eligibility', canManage, controller.setVideoEligibility);
router.get('/verifications', canManage, controller.listVerifications);
router.post('/verifications/:userId', canManage, controller.reviewVerification);
router.get('/withdrawals', canManage, controller.listWithdrawals);
router.post('/withdrawals/:id', canManage, controller.withdrawalAction);
router.get('/adjustments', canManage, controller.listAdjustments);
router.post('/adjustments', canManage, controller.adjust);

module.exports = router;

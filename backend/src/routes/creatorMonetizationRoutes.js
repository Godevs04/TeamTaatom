const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const controller = require('../controllers/creatorMonetizationController');

const router = express.Router();

router.use(authMiddleware);
router.get('/dashboard', controller.getDashboard);
router.post('/activate', controller.activate);
router.get('/ifsc/:code', controller.lookupIfsc);
router.put('/payout-profile', controller.savePayoutProfile);
router.post('/verification', controller.submitVerification);
router.post('/withdrawals', controller.requestWithdrawal);
router.get('/withdrawals', controller.listWithdrawals);

module.exports = router;

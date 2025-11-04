const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, chatController.listChats);
// Specific routes must come before parameterized routes
router.get('/:otherUserId/messages', authMiddleware, chatController.getMessages);
router.get('/:otherUserId/mute-status', authMiddleware, chatController.getMuteStatus);
router.post('/:otherUserId/messages', authMiddleware, chatController.sendMessage);
router.post('/:otherUserId/mark-all-seen', authMiddleware, chatController.markAllMessagesSeen);
router.delete('/:otherUserId/messages', authMiddleware, chatController.clearChat);
router.post('/:otherUserId/mute', authMiddleware, chatController.toggleMuteChat);
// Parameterized route comes last
router.get('/:otherUserId', authMiddleware, chatController.getChat);

module.exports = router;

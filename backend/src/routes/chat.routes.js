const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, chatController.listChats);
router.get('/:otherUserId', authMiddleware, chatController.getChat);
router.get('/:otherUserId/messages', authMiddleware, chatController.getMessages);
router.post('/:otherUserId/messages', authMiddleware, chatController.sendMessage);

module.exports = router;

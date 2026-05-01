const express = require('express');
const router = express.Router();
const multer = require('multer');
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/authMiddleware');

// Multer configuration for chat attachments
const storage = multer.memoryStorage();
const chatUpload = multer({
  storage,
  limits: {
    files: 5, // Maximum 5 files per message
    fileSize: 10 * 1024 * 1024, // 10MB per file
    fieldSize: 10 * 1024 * 1024, // 10MB for field values
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported for chat attachments'), false);
    }
  }
});

/**
 * @swagger
 * /api/v1/chat:
 *   get:
 *     summary: List direct message threads for current user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Chat thread list
 */
router.get('/', authMiddleware, chatController.listChats);

/**
 * @swagger
 * /api/v1/chat/upload:
 *   post:
 *     summary: Upload media/files for chat attachments
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Upload successful, returns attachment metadata array
 */
router.post('/upload', authMiddleware, chatUpload.array('files', 5), chatController.uploadChatMedia);

/**
 * @swagger
 * /api/v1/chat/share-post:
 *   post:
 *     summary: Share a post to a chat (1:1 or group)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 *               chatId:
 *                 type: string
 *                 description: For group chats (room ID)
 *               otherUserId:
 *                 type: string
 *                 description: For 1:1 chats (recipient user ID)
 *     responses:
 *       201:
 *         description: Post shared successfully
 */
router.post('/share-post', authMiddleware, chatController.sharePost);

// Chat-by-ID routes (for connect_page group chats) — must come before /:otherUserId
router.get('/room/:chatId', authMiddleware, chatController.getChatByRoomId);
router.get('/room/:chatId/messages', authMiddleware, chatController.getMessagesByRoomId);
router.post('/room/:chatId/messages', authMiddleware, chatController.sendMessageToRoom);
router.post('/room/:chatId/mark-all-seen', authMiddleware, chatController.markAllMessagesSeenInRoom);
router.delete('/room/:chatId', authMiddleware, chatController.deleteChatById);

// Specific routes must come before parameterized routes
/**
 * @swagger
 * /api/v1/chat/{otherUserId}/messages:
 *   get:
 *     summary: Fetch message history with another user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: otherUserId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated messages
 */
router.get('/:otherUserId/messages', authMiddleware, chatController.getMessages);
/**
 * @swagger
 * /api/v1/chat/{otherUserId}/mute-status:
 *   get:
 *     summary: Get mute status for a chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: otherUserId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mute status response
 */
router.get('/:otherUserId/mute-status', authMiddleware, chatController.getMuteStatus);
/**
 * @swagger
 * /api/v1/chat/{otherUserId}/messages:
 *   post:
 *     summary: Send a direct message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: otherUserId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Message sent
 */
router.post('/:otherUserId/messages', authMiddleware, chatController.sendMessage);
/**
 * @swagger
 * /api/v1/chat/{otherUserId}/mark-all-seen:
 *   post:
 *     summary: Mark all messages in a chat as seen
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Messages marked as seen
 */
router.post('/:otherUserId/mark-all-seen', authMiddleware, chatController.markAllMessagesSeen);
/**
 * @swagger
 * /api/v1/chat/{otherUserId}/messages:
 *   delete:
 *     summary: Clear an entire chat history
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Chat cleared
 */
router.delete('/:otherUserId/messages', authMiddleware, chatController.clearChat);
/**
 * @swagger
 * /api/v1/chat/{otherUserId}/mute:
 *   post:
 *     summary: Toggle mute state for chat notifications
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated mute status
 */
router.post('/:otherUserId/mute', authMiddleware, chatController.toggleMuteChat);
// Parameterized route comes last
/**
 * @swagger
 * /api/v1/chat/{otherUserId}:
 *   get:
 *     summary: Get chat metadata (participants, status)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Chat metadata
 */
router.get('/:otherUserId', authMiddleware, chatController.getChat);

module.exports = router;

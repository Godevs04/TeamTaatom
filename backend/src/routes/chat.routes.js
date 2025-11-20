const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware } = require('../middleware/authMiddleware');

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

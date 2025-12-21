const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  getAccountActivity,
  getActiveSessions,
  logoutFromSession,
  getBlockedUsers,
  unblockUser,
  resendVerificationEmail,
  syncUserData,
  deleteAccount,
  exportUserData
} = require('../controllers/userManagementController');

const router = express.Router();
const syncRouter = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/v1/users/me/activity:
 *   get:
 *     summary: Get user account activity
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Account activity fetched successfully
 */
router.get('/me/activity', getAccountActivity);

/**
 * @swagger
 * /api/v1/users/me/sessions:
 *   get:
 *     summary: Get active sessions
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active sessions fetched successfully
 */
router.get('/me/sessions', getActiveSessions);

/**
 * @swagger
 * /api/v1/users/me/sessions/:sessionId:
 *   delete:
 *     summary: Logout from a session
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Session logout initiated
 */
router.delete('/me/sessions/:sessionId', logoutFromSession);

/**
 * @swagger
 * /api/v1/users/me/blocked:
 *   get:
 *     summary: Get blocked users list
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Blocked users fetched successfully
 */
router.get('/me/blocked', getBlockedUsers);

/**
 * @swagger
 * /api/v1/users/me/blocked/:userId:
 *   delete:
 *     summary: Unblock a user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User unblocked successfully
 */
router.delete('/me/blocked/:userId', unblockUser);

/**
 * @swagger
 * /api/v1/users/me/verify-email:
 *   post:
 *     summary: Resend verification email
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 */
router.post('/me/verify-email', resendVerificationEmail);

/**
 * @swagger
 * /api/v1/users/me:
 *   delete:
 *     summary: Delete user account (GDPR/DPDP compliance)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account deleted successfully
 */
// DELETE /me must come AFTER all /me/* routes (more specific routes first)
router.delete('/me', deleteAccount);

/**
 * @swagger
 * /api/v1/users/me/export:
 *   get:
 *     summary: Export user data (GDPR compliance)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/me/export', exportUserData);

// Sync route mounted at root level
syncRouter.post('/sync', authMiddleware, syncUserData);

module.exports = router;
module.exports.syncRoute = syncRouter;


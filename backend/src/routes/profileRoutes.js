const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  toggleFollow,
  searchUsers,
  getFollowersList,
  getFollowingList,
  getFollowRequests,
  approveFollowRequest,
  rejectFollowRequest,
  getTripScoreContinents,
  getTripScoreCountries,
  getTripScoreCountryDetails,
  getTripScoreLocations,
  getTravelMapData,
  toggleBlockUser,
  getBlockStatus,
  getSuggestedUsers,
  saveInterests,
} = require('../controllers/profileController');

const router = express.Router();

// Multer configuration for profile picture uploads
// No file size limits - unlimited uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // fileSize removed - unlimited file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation rules
const updateProfileValidation = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
];

// Routes
/**
 * @swagger
 * /api/v1/profile/search:
 *   get:
 *     summary: Search users by name or username
 *     description: |
 *       Searches for users by username or full name. Supports case-insensitive partial matching.
 *       
 *       **Search Behavior:**
 *       - Searches both username and fullName fields
 *       - Returns paginated results
 *       - Authentication optional (public search)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: Search query (username or full name)
 *         example: "john"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of results per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/search', optionalAuth, searchUsers);
/**
 * @swagger
 * /api/v1/profile/suggested-users:
 *   get:
 *     summary: Get AI-powered suggested users to follow
 *     description: |
 *       Returns personalized user suggestions based on:
 *       - Mutual connections
 *       - Similar interests
 *       - Location proximity
 *       - Activity patterns
 *       
 *       **Authentication Required:** Yes
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of suggestions to return
 *         example: 10
 *     responses:
 *       200:
 *         description: Suggested users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/suggested-users', authMiddleware, getSuggestedUsers);
/**
 * @swagger
 * /api/v1/profile/interests:
 *   post:
 *     summary: Save user interests
 *     description: |
 *       Saves or updates user interests. Used for personalized content recommendations and user matching.
 *       
 *       **Interest Categories:**
 *       - Travel destinations (beach, mountains, cities, etc.)
 *       - Activities (adventure, photography, food, etc.)
 *       - Hobbies and preferences
 *     tags: [Profile]
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
 *               - interests
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 1
 *                 maxItems: 20
 *                 description: Array of interest tags
 *                 example: ["adventure", "beach", "mountains", "photography", "food"]
 *     responses:
 *       200:
 *         description: Interests saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Interests saved successfully"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/interests', authMiddleware, saveInterests);
/**
 * @swagger
 * /api/v1/profile/follow-requests:
 *   get:
 *     summary: Get pending follow requests
 *     description: |
 *       Retrieves all pending follow requests for the authenticated user.
 *       
 *       **Follow Request Flow:**
 *       1. User with private profile receives follow requests
 *       2. Requests appear in this endpoint
 *       3. User can approve or reject requests
 *       4. Approved users can see private content
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Follow requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 followRequests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Follow request ID
 *                       user:
 *                         $ref: '#/components/schemas/User'
 *                         description: User who sent the follow request
 *                       requestedAt:
 *                         type: string
 *                         format: date-time
 *                         description: When the request was sent
 *                       status:
 *                         type: string
 *                         enum: [pending, approved, rejected]
 *                         example: "pending"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/follow-requests', authMiddleware, getFollowRequests);
router.get('/follow-requests/debug', authMiddleware, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id);
    
    // Clean up any incorrect follow requests (where user ID matches current user ID)
    let cleaned = false;
    const originalLength = user.followRequests.length;
    
    logger.debug('🧹 Before cleanup - Follow requests:', user.followRequests.map(req => ({
      user: req.user.toString(),
      status: req.status
    })));
    
    user.followRequests = user.followRequests.filter(req => {
      if (req.user.toString() === user._id.toString()) {
        logger.debug('🧹 Removing incorrect follow request with self ID:', req.user.toString());
        cleaned = true;
        return false;
      }
      return true;
    });
    
    if (cleaned) {
      await user.save();
      logger.debug(`🧹 Cleaned up follow requests: ${originalLength} -> ${user.followRequests.length}`);
    }
    
    logger.debug('🧹 After cleanup - Follow requests:', user.followRequests.map(req => ({
      user: req.user.toString(),
      status: req.status
    })));
    
    res.json({
      userId: req.user._id,
      followRequests: user.followRequests.map(req => ({
        user: req.user.toString(),
        status: req.status,
        requestedAt: req.requestedAt
      })),
      cleaned: cleaned,
      originalLength: originalLength,
      newLength: user.followRequests.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/follow-requests/cleanup-all', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const users = await User.find({});
    let totalCleaned = 0;
    
    for (const user of users) {
      const originalLength = user.followRequests.length;
      user.followRequests = user.followRequests.filter(req => {
        if (req.user.toString() === user._id.toString()) {
          totalCleaned++;
          return false;
        }
        return true;
      });
      
      if (user.followRequests.length !== originalLength) {
        await user.save();
        logger.debug(`🧹 Cleaned user ${user.fullName}: ${originalLength} -> ${user.followRequests.length}`);
      }
    }
    
    res.json({
      message: 'Cleanup completed',
      totalCleaned: totalCleaned,
      usersProcessed: users.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/**
 * @swagger
 * /api/v1/profile/follow-requests/{requestId}/approve:
 *   post:
 *     summary: Approve a follow request
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Follow request approved
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Approve follow request - must be before /:id route to avoid conflicts
router.post('/follow-requests/:requestId/approve', authMiddleware, approveFollowRequest);
/**
 * @swagger
 * /api/v1/profile/follow-requests/{requestId}/reject:
 *   post:
 *     summary: Reject a follow request
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
router.post('/follow-requests/:requestId/reject', authMiddleware, rejectFollowRequest);
/**
 * @swagger
 * /api/v1/profile/{id}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', optionalAuth, getProfile);
/**
 * @swagger
 * /api/v1/profile/{id}:
 *   put:
 *     summary: Update profile details
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               bio:
 *                 type: string
 *               profilePic:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/:id', authMiddleware, upload.single('profilePic'), updateProfileValidation, updateProfile);
/**
 * @swagger
 * /api/v1/profile/{id}/follow:
 *   post:
 *     summary: Follow or unfollow a user
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Follow status updated
 */
router.post('/:id/follow', authMiddleware, toggleFollow);
/**
 * @swagger
 * /api/v1/profile/{id}/block:
 *   post:
 *     summary: Block or unblock a user
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
router.post('/:id/block', authMiddleware, toggleBlockUser);
/**
 * @swagger
 * /api/v1/profile/{id}/block-status:
 *   get:
 *     summary: Check block status between authenticated user and target user
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Block status info
 */
router.get('/:id/block-status', authMiddleware, getBlockStatus);
/**
 * @swagger
 * /api/v1/profile/{id}/followers:
 *   get:
 *     summary: Get followers of a user
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Followers list
 */
router.get('/:id/followers', optionalAuth, getFollowersList);
/**
 * @swagger
 * /api/v1/profile/{id}/following:
 *   get:
 *     summary: Get users followed by a user
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Following list
 */
router.get('/:id/following', optionalAuth, getFollowingList);

// TripScore routes
/**
 * @swagger
 * /api/v1/profile/{id}/tripscore/continents:
 *   get:
 *     summary: Get TripScore summary by continent
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: TripScore continent stats
 */
router.get('/:id/tripscore/continents', optionalAuth, getTripScoreContinents);
/**
 * @swagger
 * /api/v1/profile/{id}/tripscore/continents/{continent}/countries:
 *   get:
 *     summary: Get TripScore countries within a continent
 *     tags: [Profile]
 */
router.get('/:id/tripscore/continents/:continent/countries', optionalAuth, getTripScoreCountries);
/**
 * @swagger
 * /api/v1/profile/{id}/tripscore/countries/{country}:
 *   get:
 *     summary: Get TripScore stats for a country
 *     tags: [Profile]
 */
router.get('/:id/tripscore/countries/:country', optionalAuth, getTripScoreCountryDetails);
/**
 * @swagger
 * /api/v1/profile/{id}/tripscore/countries/{country}/locations:
 *   get:
 *     summary: Get TripScore locations within a country
 *     tags: [Profile]
 */
router.get('/:id/tripscore/countries/:country/locations', optionalAuth, getTripScoreLocations);

// Travel Map route
/**
 * @swagger
 * /api/v1/profile/{id}/travel-map:
 *   get:
 *     summary: Get travel map geo-coordinates for a user
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Travel map dataset
 */
router.get('/:id/travel-map', optionalAuth, getTravelMapData);

/**
 * @swagger
 * /api/v1/profile/{id}/push-token:
 *   put:
 *     summary: Register Expo push token for notifications
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *               - expoPushToken
 *             properties:
 *               expoPushToken:
 *                 type: string
 *                 example: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *     responses:
 *       200:
 *         description: Push token updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/:id/push-token', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { expoPushToken } = req.body;
    if (!expoPushToken) return res.status(400).json({ error: 'expoPushToken is required' });
    if (req.user._id.toString() !== id) return res.status(403).json({ error: 'Unauthorized' });
    await require('../models/User').findByIdAndUpdate(id, { expoPushToken });
    res.status(200).json({ message: 'Expo push token updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update push token' });
  }
});

module.exports = router;

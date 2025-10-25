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
} = require('../controllers/profileController');

const router = express.Router();

// Multer configuration for profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
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
router.get('/search', optionalAuth, searchUsers);
router.get('/follow-requests', authMiddleware, getFollowRequests);
router.get('/follow-requests/debug', authMiddleware, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id);
    
    // Clean up any incorrect follow requests (where user ID matches current user ID)
    let cleaned = false;
    const originalLength = user.followRequests.length;
    
    console.log('🧹 Before cleanup - Follow requests:', user.followRequests.map(req => ({
      user: req.user.toString(),
      status: req.status
    })));
    
    user.followRequests = user.followRequests.filter(req => {
      if (req.user.toString() === user._id.toString()) {
        console.log('🧹 Removing incorrect follow request with self ID:', req.user.toString());
        cleaned = true;
        return false;
      }
      return true;
    });
    
    if (cleaned) {
      await user.save();
      console.log(`🧹 Cleaned up follow requests: ${originalLength} -> ${user.followRequests.length}`);
    }
    
    console.log('🧹 After cleanup - Follow requests:', user.followRequests.map(req => ({
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
        console.log(`🧹 Cleaned user ${user.fullName}: ${originalLength} -> ${user.followRequests.length}`);
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
router.post('/follow-requests/:requestId/approve', authMiddleware, approveFollowRequest);
router.post('/follow-requests/:requestId/reject', authMiddleware, rejectFollowRequest);
router.get('/:id', optionalAuth, getProfile);
router.put('/:id', authMiddleware, upload.single('profilePic'), updateProfileValidation, updateProfile);
router.post('/:id/follow', authMiddleware, toggleFollow);
router.get('/:id/followers', optionalAuth, getFollowersList);
router.get('/:id/following', optionalAuth, getFollowingList);

// TripScore routes
router.get('/:id/tripscore/continents', optionalAuth, getTripScoreContinents);
router.get('/:id/tripscore/continents/:continent/countries', optionalAuth, getTripScoreCountries);
router.get('/:id/tripscore/countries/:country', optionalAuth, getTripScoreCountryDetails);
router.get('/:id/tripscore/countries/:country/locations', optionalAuth, getTripScoreLocations);

// Travel Map route
router.get('/:id/travel-map', optionalAuth, getTravelMapData);

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

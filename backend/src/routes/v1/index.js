const express = require('express');
const authRoutes = require('../authRoutes');
const postRoutes = require('../postRoutes');
const profileRoutes = require('../profileRoutes');
const chatRoutes = require('../chat.routes');
const shortsRoutes = require('../shortsRoutes');
const settingsRoutes = require('../settingsRoutes');
const enhancedSuperAdminRoutes = require('../enhancedSuperAdminRoutes');
const notificationRoutes = require('../notificationRoutes');
const analyticsRoutes = require('../analyticsRoutes');
const featureFlagsRoutes = require('../featureFlagsRoutes');
const hashtagRoutes = require('../hashtagRoutes');
const collectionRoutes = require('../collectionRoutes');
const mentionRoutes = require('../mentionRoutes');
const searchRoutes = require('../searchRoutes');
const activityRoutes = require('../activityRoutes');
const reportRoutes = require('../reportRoutes');
const healthRoutes = require('../healthRoutes');
const userManagementRoutes = require('../userManagementRoutes');

const router = express.Router();

// Health check routes (mounted under /api/v1/health)
router.use('/health', healthRoutes);

// Mount all routes under v1
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/profile', profileRoutes);
router.use('/chat', chatRoutes);
router.use('/shorts', shortsRoutes);
router.use('/settings', settingsRoutes);
router.use('/superadmin', enhancedSuperAdminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/feature-flags', featureFlagsRoutes);
router.use('/hashtags', hashtagRoutes);
router.use('/collections', collectionRoutes);
router.use('/mentions', mentionRoutes);
router.use('/search', searchRoutes);
router.use('/activity', activityRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userManagementRoutes);
router.use('/', userManagementRoutes.syncRoute); // For /sync route

module.exports = router;


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

const router = express.Router();

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

module.exports = router;


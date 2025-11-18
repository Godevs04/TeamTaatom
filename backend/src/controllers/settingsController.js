const User = require('../models/User');
const Activity = require('../models/Activity');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');

// @desc    Get user settings
// @route   GET /settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('settings');
    if (!user) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    return sendSuccess(res, 200, 'Settings fetched successfully', { settings: user.settings });
  } catch (error) {
    logger.error('Get settings error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching settings');
  }
};

// @desc    Update user settings
// @route   PUT /settings
// @access  Private
const updateSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { settings } = req.body;

    if (!settings) {
      return sendError(res, 'VAL_2001', 'Settings data is required');
    }

    // Validate settings structure
    const validSettings = {};
    
    // Privacy settings
    if (settings.privacy) {
      validSettings['settings.privacy'] = {};
      if (settings.privacy.profileVisibility && ['public', 'followers', 'private'].includes(settings.privacy.profileVisibility)) {
        validSettings['settings.privacy.profileVisibility'] = settings.privacy.profileVisibility;
      }
      if (typeof settings.privacy.showEmail === 'boolean') {
        validSettings['settings.privacy.showEmail'] = settings.privacy.showEmail;
      }
      if (typeof settings.privacy.showLocation === 'boolean') {
        validSettings['settings.privacy.showLocation'] = settings.privacy.showLocation;
      }
      if (settings.privacy.allowMessages && ['everyone', 'followers', 'none'].includes(settings.privacy.allowMessages)) {
        validSettings['settings.privacy.allowMessages'] = settings.privacy.allowMessages;
      }
      if (typeof settings.privacy.requireFollowApproval === 'boolean') {
        validSettings['settings.privacy.requireFollowApproval'] = settings.privacy.requireFollowApproval;
      }
      if (typeof settings.privacy.allowFollowRequests === 'boolean') {
        validSettings['settings.privacy.allowFollowRequests'] = settings.privacy.allowFollowRequests;
      }
    }

    // Notification settings
    if (settings.notifications) {
      validSettings['settings.notifications'] = {};
      if (typeof settings.notifications.pushNotifications === 'boolean') {
        validSettings['settings.notifications.pushNotifications'] = settings.notifications.pushNotifications;
      }
      if (typeof settings.notifications.emailNotifications === 'boolean') {
        validSettings['settings.notifications.emailNotifications'] = settings.notifications.emailNotifications;
      }
      if (typeof settings.notifications.likesNotifications === 'boolean') {
        validSettings['settings.notifications.likesNotifications'] = settings.notifications.likesNotifications;
      }
      if (typeof settings.notifications.commentsNotifications === 'boolean') {
        validSettings['settings.notifications.commentsNotifications'] = settings.notifications.commentsNotifications;
      }
      if (typeof settings.notifications.followsNotifications === 'boolean') {
        validSettings['settings.notifications.followsNotifications'] = settings.notifications.followsNotifications;
      }
      if (typeof settings.notifications.messagesNotifications === 'boolean') {
        validSettings['settings.notifications.messagesNotifications'] = settings.notifications.messagesNotifications;
      }
    }

    // Account settings
    if (settings.account) {
      validSettings['settings.account'] = {};
      if (settings.account.language && typeof settings.account.language === 'string') {
        validSettings['settings.account.language'] = settings.account.language;
      }
      if (settings.account.theme && ['light', 'dark', 'auto'].includes(settings.account.theme)) {
        validSettings['settings.account.theme'] = settings.account.theme;
      }
      if (settings.account.dataUsage && ['low', 'medium', 'high'].includes(settings.account.dataUsage)) {
        validSettings['settings.account.dataUsage'] = settings.account.dataUsage;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: validSettings },
      { new: true, runValidators: true }
    ).select('settings');

    if (!updatedUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    return sendSuccess(res, 200, 'Settings updated successfully', { settings: updatedUser.settings });
  } catch (error) {
    logger.error('Update settings error:', error);
    return sendError(res, 'SRV_6001', 'Error updating settings');
  }
};

// @desc    Reset settings to default
// @route   POST /settings/reset
// @access  Private
const resetSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const defaultSettings = {
      privacy: {
        profileVisibility: 'public',
        showEmail: false,
        showLocation: true,
        allowMessages: 'everyone',
        requireFollowApproval: false,
        allowFollowRequests: true
      },
      notifications: {
        pushNotifications: true,
        emailNotifications: true,
        likesNotifications: true,
        commentsNotifications: true,
        followsNotifications: true,
        messagesNotifications: true
      },
      account: {
        language: 'en',
        theme: 'auto',
        dataUsage: 'medium'
      }
    };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { settings: defaultSettings } },
      { new: true, runValidators: true }
    ).select('settings');

    if (!updatedUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    return sendSuccess(res, 200, 'Settings reset to default successfully', { settings: updatedUser.settings });
  } catch (error) {
    logger.error('Reset settings error:', error);
    return sendError(res, 'SRV_6001', 'Error resetting settings');
  }
};

// @desc    Update specific setting category
// @route   PUT /settings/:category
// @access  Private
const updateSettingCategory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { category } = req.params;
    const settingsData = req.body;

    logger.debug('UpdateSettingCategory called:', { userId, category, settingsData });

    if (!['privacy', 'notifications', 'account'].includes(category)) {
      return sendError(res, 'VAL_2001', 'Category must be privacy, notifications, or account');
    }

    const updateQuery = {};
    Object.keys(settingsData).forEach(key => {
      updateQuery[`settings.${category}.${key}`] = settingsData[key];
    });

    logger.debug('Update query:', updateQuery);

    // If shareActivity is being updated, also update all user's activities
    if (category === 'privacy' && 'shareActivity' in settingsData) {
      const shareActivity = settingsData.shareActivity !== false; // Default to true if not set
      await Activity.updateMany(
        { user: userId },
        { isPublic: shareActivity }
      ).catch(err => logger.error('Error updating activity privacy:', err));
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateQuery },
      { new: true, runValidators: true }
    ).select('settings');

    logger.debug('Updated user settings:', updatedUser.settings);

    if (!updatedUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }

    return sendSuccess(res, 200, `${category} settings updated successfully`, { settings: updatedUser.settings });
  } catch (error) {
    logger.error('Update setting category error:', error);
    return sendError(res, 'SRV_6001', 'Error updating settings');
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  updateSettingCategory,
};

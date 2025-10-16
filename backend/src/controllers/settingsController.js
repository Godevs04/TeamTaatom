const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get user settings
// @route   GET /settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('settings');
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.status(200).json({ settings: user.settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error fetching settings'
    });
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
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Settings data is required'
      });
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
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.status(200).json({
      message: 'Settings updated successfully',
      settings: updatedUser.settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating settings'
    });
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
        allowMessages: 'everyone'
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
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.status(200).json({
      message: 'Settings reset to default successfully',
      settings: updatedUser.settings
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error resetting settings'
    });
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

    if (!['privacy', 'notifications', 'account'].includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        message: 'Category must be privacy, notifications, or account'
      });
    }

    const updateQuery = {};
    Object.keys(settingsData).forEach(key => {
      updateQuery[`settings.${category}.${key}`] = settingsData[key];
    });

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateQuery },
      { new: true, runValidators: true }
    ).select('settings');

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.status(200).json({
      message: `${category} settings updated successfully`,
      settings: updatedUser.settings
    });
  } catch (error) {
    console.error('Update setting category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error updating settings'
    });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  updateSettingCategory,
};

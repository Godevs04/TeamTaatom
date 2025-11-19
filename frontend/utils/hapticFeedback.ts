/**
 * Haptic Feedback Utility
 * Provides haptic feedback for better UX on mobile devices
 */

import { Platform } from 'react-native';
import logger from './logger';

// Optional haptics import (may not be available in all environments)
let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  // Haptics not available
}

/**
 * Trigger haptic feedback
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
  if (Platform.OS === 'web' || !Haptics) {
    // Web doesn't support haptics, but we can use visual feedback
    return;
  }

  try {
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch (error) {
    // Haptics might not be available on all devices
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Haptic feedback not available:', error);
    }
  }
};

/**
 * Trigger haptic feedback for pull-to-refresh
 */
export const triggerRefreshHaptic = () => {
  triggerHaptic('medium');
};

/**
 * Trigger haptic feedback for like action
 */
export const triggerLikeHaptic = (isLiked: boolean) => {
  triggerHaptic(isLiked ? 'success' : 'light');
};

/**
 * Trigger haptic feedback for comment action
 */
export const triggerCommentHaptic = () => {
  triggerHaptic('light');
};

/**
 * Trigger haptic feedback for follow action
 */
export const triggerFollowHaptic = (isFollowing: boolean) => {
  triggerHaptic(isFollowing ? 'success' : 'medium');
};


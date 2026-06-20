import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { toggleFollow } from '../../services/profile';
import logger from '../../utils/logger';
import { savedEvents } from '../../utils/savedEvents';

export type FollowState = 'FOLLOWING' | 'REQUESTED' | 'NOT_FOLLOWING';

interface FollowButtonProps {
  userId: string;
  initialState?: FollowState;
  initialIsFollowing?: boolean; // For backwards compatibility
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  onToggle?: (newState: FollowState) => void;
  onSuccess?: (result: any) => void;
  size?: 'small' | 'medium' | 'large';
  isPrivate?: boolean;
}

export default function FollowButton({ 
  userId, 
  initialState,
  initialIsFollowing, 
  style, 
  textStyle, 
  onToggle,
  onSuccess,
  size = 'medium',
  isPrivate = false
}: FollowButtonProps) {
  const { theme, isDark } = useTheme();
  const { showError, showSuccess, showConfirm } = useAlert();
  
  const getInitialState = (): FollowState => {
    if (initialState) return initialState;
    return initialIsFollowing ? 'FOLLOWING' : 'NOT_FOLLOWING';
  };

  const [followState, setFollowState] = useState<FollowState>(getInitialState());
  const [loading, setLoading] = useState(false);

  // Sync state if prop changes externally
  useEffect(() => {
    setFollowState(getInitialState());
  }, [initialState, initialIsFollowing]);

  // Sync state with global follow action emitter
  useEffect(() => {
    const unsubscribe = savedEvents.addFollowActionListener((targetUserId, state) => {
      if (targetUserId === userId) {
        setFollowState(state);
      }
    });
    return unsubscribe;
  }, [userId]);

  const executeToggle = async () => {
    // Optimistic update
    const previousState = followState;
    const optimisticState = followState === 'FOLLOWING' || followState === 'REQUESTED'
      ? 'NOT_FOLLOWING'
      : (isPrivate ? 'REQUESTED' : 'FOLLOWING');
    setFollowState(optimisticState);
    if (onToggle) onToggle(optimisticState);
    savedEvents.emitFollowAction(userId, optimisticState);

    try {
      setLoading(true);
      const result = await toggleFollow(userId);
      
      let actualState: FollowState = result.isFollowing ? 'FOLLOWING' : 'NOT_FOLLOWING';
      if (result.followRequestSent) {
        actualState = 'REQUESTED';
        showSuccess('Follow request sent');
      }

      // Ensure state matches server
      if (actualState !== optimisticState) {
        setFollowState(actualState);
        if (onToggle) onToggle(actualState);
        savedEvents.emitFollowAction(userId, actualState);
      }

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error: any) {
      // Revert on error
      setFollowState(previousState);
      if (onToggle) onToggle(previousState);
      savedEvents.emitFollowAction(userId, previousState);
      
      if (error.isConflict) {
        showError('Follow request already pending');
      } else {
        showError(error.message || 'Failed to update follow status');
      }
      logger.error('Error toggling follow status', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (loading) return;

    if (followState === 'FOLLOWING') {
      showConfirm(
        'Are you sure you want to unfollow this user?',
        executeToggle,
        'Unfollow User',
        'Unfollow',
        'Cancel'
      );
      return;
    }

    if (followState === 'REQUESTED') {
      showConfirm(
        'Are you sure you want to cancel your follow request?',
        executeToggle,
        'Cancel Follow Request',
        'Cancel Request',
        'Cancel'
      );
      return;
    }

    executeToggle();
  };

  const getPadding = () => {
    switch (size) {
      case 'small': return { paddingVertical: 4, paddingHorizontal: 12 };
      case 'large': return { paddingVertical: 10, paddingHorizontal: 24 };
      default: return { paddingVertical: 6, paddingHorizontal: 16 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small': return 12;
      case 'large': return 16;
      default: return 14;
    }
  };

  if (followState === 'FOLLOWING' || followState === 'REQUESTED') {
    return (
      <TouchableOpacity 
        style={[
          styles.followingButton, 
          { 
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)', 
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          },
          getPadding(),
          style
        ]}
        onPress={handleToggle}
        disabled={loading}
      >
        <Text style={[styles.followingText, { color: theme.colors.text, fontSize: getFontSize() }, textStyle]}>
          {followState === 'FOLLOWING' ? 'Following' : 'Request Sent'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handleToggle} disabled={loading} style={style}>
      <LinearGradient
        colors={['#1C73B4', '#50C878']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.followButton, getPadding()]}
      >
        <Text style={[styles.followText, { fontSize: getFontSize() }, textStyle]}>
          Follow
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  followingButton: {
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  followButton: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  followingText: {
    fontWeight: '600',
  },
  followText: {
    color: 'white',
    fontWeight: '600',
  },
});

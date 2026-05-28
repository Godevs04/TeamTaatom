import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface PostActionsProps {
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  showBookmark?: boolean;
  isLoading?: boolean;
}

function GradientIcon({ name, size }: { name: any; size: number }) {
  return (
    <MaskedView
      style={{ width: size, height: size }}
      maskElement={
        <Ionicons name={name} size={size} color="#000000" style={styles.iconReset} />
      }
    >
      <LinearGradient
        colors={['#1C73B4', '#50C878']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </MaskedView>
  );
}

export default function PostActions({
  isLiked: initialIsLiked,
  isSaved,
  onLike,
  onComment,
  onShare,
  onSave,
  showBookmark = true,
  isLoading = false,
}: PostActionsProps) {
  const { isDark } = useTheme();

  // Localized like state for optimistic UI updates
  const [localIsLiked, setLocalIsLiked] = useState(initialIsLiked);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestLocalIsLiked = useRef(initialIsLiked);

  // Sync state if initialIsLiked prop changes from external source
  useEffect(() => {
    setLocalIsLiked(initialIsLiked);
    latestLocalIsLiked.current = initialIsLiked;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, [initialIsLiked]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleLikePress = () => {
    const nextLiked = !latestLocalIsLiked.current;
    latestLocalIsLiked.current = nextLiked;
    
    // Optimistically toggle local state first
    setLocalIsLiked(nextLiked);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    // Clamp: if target state matches settled parent state, no API call is needed
    if (nextLiked === initialIsLiked) {
      return;
    }

    // Call parent handler to dispatch API/persist after debounce
    debounceTimer.current = setTimeout(() => {
      onLike();
    }, 300);
  };

  const activeIconColor = isDark ? '#38BDF8' : '#1C73B4'; // Sky Blue (Dark) / Ocean Blue (Light)

  return (
    <View style={styles.actions}>
      <View style={styles.leftActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleLikePress}
          disabled={isLoading}
          accessibilityLabel={localIsLiked ? 'Unlike post' : 'Like post'}
          accessibilityRole="button"
          accessibilityHint="Double tap to like or unlike this post"
        >
          {localIsLiked ? (
            <GradientIcon name="heart" size={24} />
          ) : (
            <Ionicons
              name="heart-outline"
              size={24}
              color={activeIconColor}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onComment}
          disabled={isLoading}
          accessibilityLabel="Comment on post"
          accessibilityRole="button"
          accessibilityHint="Double tap to add a comment"
        >
          <Ionicons name="chatbubble-outline" size={24} color={activeIconColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onShare}
          disabled={isLoading}
          accessibilityLabel="Share post"
          accessibilityRole="button"
          accessibilityHint="Double tap to share this post"
        >
          <Ionicons name="paper-plane-outline" size={24} color={activeIconColor} />
        </TouchableOpacity>
      </View>

      {showBookmark && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onSave}
          disabled={isLoading}
          accessibilityLabel={isSaved ? 'Remove from saved' : 'Save post'}
          accessibilityRole="button"
          accessibilityHint="Double tap to save or unsave this post"
        >
          {isSaved ? (
            <GradientIcon name="bookmark" size={24} />
          ) : (
            <Ionicons 
              name="bookmark-outline" 
              size={24} 
              color={activeIconColor} 
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconReset: {
    backgroundColor: 'transparent',
  },
});

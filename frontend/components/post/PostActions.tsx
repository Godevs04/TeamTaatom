import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface PostActionsProps {
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
}

export default function PostActions({
  isLiked,
  isSaved,
  onLike,
  onComment,
  onShare,
  onSave,
}: PostActionsProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.actions}>
      <View style={styles.leftActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={onLike}
          accessibilityLabel={isLiked ? 'Unlike post' : 'Like post'}
          accessibilityRole="button"
          accessibilityHint="Double tap to like or unlike this post"
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? '#ff3040' : theme.colors.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onComment}
          accessibilityLabel="Comment on post"
          accessibilityRole="button"
          accessibilityHint="Double tap to add a comment"
        >
          <Ionicons name="chatbubble-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onShare}
          accessibilityLabel="Share post"
          accessibilityRole="button"
          accessibilityHint="Double tap to share this post"
        >
          <Ionicons name="paper-plane-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onSave}
        accessibilityLabel={isSaved ? 'Remove from saved' : 'Save post'}
        accessibilityRole="button"
        accessibilityHint="Double tap to save or unsave this post"
      >
        <Ionicons 
          name={isSaved ? 'bookmark' : 'bookmark-outline'} 
          size={24} 
          color={theme.colors.text} 
        />
      </TouchableOpacity>
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
  },
});


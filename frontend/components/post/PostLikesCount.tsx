import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface PostLikesCountProps {
  likesCount: number;
}

export default function PostLikesCount({ likesCount }: PostLikesCountProps) {
  const { theme } = useTheme();

  if (likesCount <= 0) return null;

  return (
    <View style={styles.likesContainer}>
      <Text style={[styles.likesText, { color: theme.colors.text }]}>
        {likesCount} {likesCount === 1 ? 'like' : 'likes'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  likesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


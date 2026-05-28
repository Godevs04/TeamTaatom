import React from 'react';
import { View, StyleSheet } from 'react-native';
import GradientText from '../ui/GradientText';

interface PostLikesCountProps {
  likesCount: number;
}

export default function PostLikesCount({ likesCount }: PostLikesCountProps) {
  if (likesCount <= 0) return null;

  return (
    <View style={styles.likesContainer}>
      <GradientText
        text={`${likesCount} ${likesCount === 1 ? 'like' : 'likes'}`}
        style={styles.likesText}
      />
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


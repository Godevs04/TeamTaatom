import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

interface HashtagTextProps {
  text: string;
  onHashtagPress?: (hashtag: string) => void;
  style?: any;
}

/**
 * Component that renders text with clickable hashtags
 * Extracts hashtags from text and makes them clickable
 */
export const HashtagText: React.FC<HashtagTextProps> = ({
  text,
  onHashtagPress,
  style,
}) => {
  const { theme } = useTheme();
  const router = useRouter();

  const handleHashtagPress = (hashtag: string) => {
    if (onHashtagPress) {
      onHashtagPress(hashtag);
    } else {
      // Default behavior: navigate to hashtag page
      router.push(`/hashtag/${hashtag.replace(/^#/, '')}`);
    }
  };

  // Split text into parts (hashtags and regular text)
  const parts: Array<{ text: string; isHashtag: boolean }> = [];
  const hashtagRegex = /#[\w\u{1F300}-\u{1F9FF}]+/gu;
  let lastIndex = 0;
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    // Add text before hashtag
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isHashtag: false,
      });
    }
    // Add hashtag
    parts.push({
      text: match[0],
      isHashtag: true,
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isHashtag: false,
    });
  }

  // If no hashtags found, return plain text
  if (parts.length === 0 || parts.every(p => !p.isHashtag)) {
    return <Text style={[styles.text, { color: theme.colors.text }, style]}>{text}</Text>;
  }

  return (
    <Text style={[styles.text, { color: theme.colors.text }, style]}>
      {parts.map((part, index) => {
        if (part.isHashtag) {
          return (
            <Text
              key={index}
              onPress={() => handleHashtagPress(part.text)}
              style={[styles.hashtag, { color: theme.colors.primary }]}
            >
              {part.text}
            </Text>
          );
        }
        return <Text key={index}>{part.text}</Text>;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  hashtag: {
    fontWeight: '600',
  },
});

export default HashtagText;


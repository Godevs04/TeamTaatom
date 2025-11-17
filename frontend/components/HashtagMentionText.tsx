import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

interface HashtagMentionTextProps {
  text: string;
  onHashtagPress?: (hashtag: string) => void;
  onMentionPress?: (username: string) => void;
  style?: any;
}

/**
 * Component that renders text with clickable hashtags and mentions
 * Extracts both hashtags (#tag) and mentions (@username) from text
 */
export const HashtagMentionText: React.FC<HashtagMentionTextProps> = ({
  text,
  onHashtagPress,
  onMentionPress,
  style,
}) => {
  const { theme } = useTheme();
  const router = useRouter();

  const handleHashtagPress = (hashtag: string) => {
    if (onHashtagPress) {
      onHashtagPress(hashtag);
    } else {
      router.push(`/hashtag/${hashtag.replace(/^#/, '')}`);
    }
  };

  const handleMentionPress = (username: string) => {
    if (onMentionPress) {
      onMentionPress(username);
    } else {
      router.push(`/search?q=${encodeURIComponent(username)}`);
    }
  };

  // Split text into parts (hashtags, mentions, and regular text)
  const parts: Array<{ text: string; type: 'text' | 'hashtag' | 'mention'; value?: string }> = [];
  const combinedRegex = /(@[\w]+|#[\w\u{1F300}-\u{1F9FF}]+)/gu;
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        type: 'text',
      });
    }
    // Add hashtag or mention
    const matchedText = match[0];
    if (matchedText.startsWith('#')) {
      parts.push({
        text: matchedText,
        type: 'hashtag',
        value: matchedText.replace(/^#/, ''),
      });
    } else if (matchedText.startsWith('@')) {
      parts.push({
        text: matchedText,
        type: 'mention',
        value: matchedText.substring(1), // Remove @
      });
    }
    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      type: 'text',
    });
  }

  // If no hashtags or mentions found, return plain text
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <Text style={[styles.text, { color: theme.colors.text }, style]}>{text}</Text>;
  }

  return (
    <Text style={[styles.text, { color: theme.colors.text }, style]}>
      {parts.map((part, index) => {
        if (part.type === 'hashtag' && part.value) {
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleHashtagPress(part.text)}
              activeOpacity={0.7}
            >
              <Text style={[styles.hashtag, { color: theme.colors.primary }]}>
                {part.text}
              </Text>
            </TouchableOpacity>
          );
        }
        if (part.type === 'mention' && part.value) {
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleMentionPress(part.value!)}
              activeOpacity={0.7}
            >
              <Text style={[styles.mention, { color: theme.colors.primary }]}>
                {part.text}
              </Text>
            </TouchableOpacity>
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
  mention: {
    fontWeight: '600',
  },
});

export default HashtagMentionText;


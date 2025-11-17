import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';

interface MentionTextProps {
  text: string;
  onMentionPress?: (username: string) => void;
  style?: any;
}

/**
 * Component that renders text with clickable mentions (@username)
 * Extracts mentions from text and makes them clickable
 */
export const MentionText: React.FC<MentionTextProps> = ({
  text,
  onMentionPress,
  style,
}) => {
  const { theme } = useTheme();
  const router = useRouter();

  const handleMentionPress = (username: string) => {
    if (onMentionPress) {
      onMentionPress(username);
    } else {
      // Default behavior: navigate to user profile
      // Note: We need to search for user by username first
      // For now, just show an alert or handle gracefully
      router.push(`/search?q=${encodeURIComponent(username)}`);
    }
  };

  // Split text into parts (mentions and regular text)
  const parts: Array<{ text: string; isMention: boolean; username?: string }> = [];
  const mentionRegex = /@[\w]+/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isMention: false,
      });
    }
    // Add mention
    const username = match[0].substring(1); // Remove @
    parts.push({
      text: match[0],
      isMention: true,
      username,
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isMention: false,
    });
  }

  // If no mentions found, return plain text
  if (parts.length === 0 || parts.every(p => !p.isMention)) {
    return <Text style={[styles.text, { color: theme.colors.text }, style]}>{text}</Text>;
  }

  return (
    <Text style={[styles.text, { color: theme.colors.text }, style]}>
      {parts.map((part, index) => {
        if (part.isMention && part.username) {
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleMentionPress(part.username!)}
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
  mention: {
    fontWeight: '600',
  },
});

export default MentionText;


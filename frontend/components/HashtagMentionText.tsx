import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { searchUsers } from '../services/profile';
import { sanitizeTextContent, sanitizeHashtag, sanitizeMention } from '../utils/sanitize';
import logger from '../utils/logger';

interface HashtagMentionTextProps {
  text: string;
  onHashtagPress?: (hashtag: string) => void;
  onMentionPress?: (username: string) => void;
  style?: any;
  postId?: string; // Optional post ID for context
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
  postId,
}) => {
  const { theme } = useTheme();
  const router = useRouter();
  const [loadingMention, setLoadingMention] = useState<string | null>(null);

  const handleHashtagPress = (hashtag: string) => {
    // Sanitize hashtag before processing
    const sanitized = sanitizeHashtag(hashtag);
    if (!sanitized || sanitized.length <= 1) {
      logger.warn('Invalid hashtag:', hashtag);
      return;
    }
    
    if (onHashtagPress) {
      onHashtagPress(sanitized);
    } else {
      router.push(`/hashtag/${sanitized.replace(/^#/, '')}`);
    }
  };

  const handleMentionPress = async (username: string) => {
    // Sanitize mention before processing
    const sanitized = sanitizeMention(username);
    if (!sanitized || sanitized.length === 0) {
      logger.warn('Invalid mention:', username);
      return;
    }
    
    if (onMentionPress) {
      onMentionPress(sanitized);
      return;
    }

    try {
      setLoadingMention(sanitized);
      // Search for user by username
      const response = await searchUsers(sanitized, 1, 1);
      
      if (response.users && response.users.length > 0) {
        // Use the first result since searchUsers should already filter by username
        const user = response.users[0];
        
        if (user && user._id) {
          router.push(`/profile/${user._id}`);
        } else {
          // Fallback to search if user not found
          router.push(`/search?q=${encodeURIComponent(sanitized)}`);
        }
    } else {
        // Fallback to search if no users found
        router.push(`/search?q=${encodeURIComponent(sanitized)}`);
      }
    } catch (error) {
      logger.error('Error searching for user:', error);
      // Fallback to search on error
      router.push(`/search?q=${encodeURIComponent(sanitized)}`);
    } finally {
      setLoadingMention(null);
    }
  };

  // Sanitize text before processing
  const sanitizedText = sanitizeTextContent(text);
  
  // Split text into parts (hashtags, mentions, and regular text)
  const parts: Array<{ text: string; type: 'text' | 'hashtag' | 'mention'; value?: string }> = [];
  const combinedRegex = /(@[\w.]+|#[\w]+)/gu;
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(sanitizedText)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push({
        text: sanitizedText.substring(lastIndex, match.index),
        type: 'text',
      });
    }
    // Add hashtag or mention (sanitize values)
    const matchedText = match[0];
    if (matchedText.startsWith('#')) {
      const sanitizedHashtag = sanitizeHashtag(matchedText);
      if (sanitizedHashtag && sanitizedHashtag.length > 1) {
        parts.push({
          text: sanitizedHashtag,
          type: 'hashtag',
          value: sanitizedHashtag.replace(/^#/, ''),
        });
      }
    } else if (matchedText.startsWith('@')) {
      const sanitizedMention = sanitizeMention(matchedText);
      if (sanitizedMention && sanitizedMention.length > 0) {
        parts.push({
          text: `@${sanitizedMention}`,
          type: 'mention',
          value: sanitizedMention,
        });
      }
    }
    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < sanitizedText.length) {
    parts.push({
      text: sanitizedText.substring(lastIndex),
      type: 'text',
    });
  }

  // If no hashtags or mentions found, return plain text
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <Text style={[styles.text, { color: theme.colors.text }, style]}>{sanitizedText}</Text>;
  }

  return (
    <Text style={[styles.text, { color: theme.colors.text }, style]}>
      {parts.map((part, index) => {
        if (part.type === 'hashtag' && part.value) {
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
        if (part.type === 'mention' && part.value) {
          const isLoading = loadingMention === part.value;
          // For mentions, use Text with onPress for proper text flow
          // Note: ActivityIndicator cannot be used inline, so we disable interaction during loading
          return (
            <Text
              key={index}
              onPress={() => !isLoading && handleMentionPress(part.value!)}
              style={[
                styles.mention,
                { color: theme.colors.primary },
                isLoading && styles.mentionLoading
              ]}
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
  mention: {
    fontWeight: '600',
  },
  mentionLoading: {
    opacity: 0.6,
  },
});

export default HashtagMentionText;


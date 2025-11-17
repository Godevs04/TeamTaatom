import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { searchUsersForMention, MentionUser } from '../services/mentions';

interface MentionSuggestProps {
  text: string;
  cursorPosition?: number;
  onSelectMention: (username: string) => void;
  visible?: boolean;
}

/**
 * Component that shows mention suggestions while typing
 * Appears when user types @ followed by text
 */
export const MentionSuggest: React.FC<MentionSuggestProps> = ({
  text,
  cursorPosition,
  onSelectMention,
  visible = true,
}) => {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMention, setCurrentMention] = useState<string>('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) {
      setSuggestions([]);
      return;
    }

    // Find the mention being typed (text before cursor that starts with @)
    const textBeforeCursor = cursorPosition !== undefined 
      ? text.substring(0, cursorPosition)
      : text;

    // Find the last @ symbol and extract the mention being typed
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
      setSuggestions([]);
      setCurrentMention('');
      return;
    }

    // Extract text after @ (until space, newline, or end)
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    const match = textAfterAt.match(/^([\w]*)/);
    const mentionQuery = match ? match[1] : '';

    // If there's a space or newline after @, don't show suggestions
    if (textAfterAt.length > 0 && !match) {
      setSuggestions([]);
      setCurrentMention('');
      return;
    }

    setCurrentMention(mentionQuery);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce search
    debounceTimer.current = setTimeout(async () => {
      if (mentionQuery.length >= 1) {
        // Search users for mention
        try {
          setLoading(true);
          const results = await searchUsersForMention(mentionQuery, 10);
          setSuggestions(results);
        } catch (error) {
          console.error('Error searching users for mention:', error);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [text, cursorPosition, visible]);

  const handleSelectMention = (user: MentionUser) => {
    onSelectMention(user.username);
    setSuggestions([]);
  };

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : (
        <>
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Ionicons name="at" size={16} color={theme.colors.primary} />
            <Text style={[styles.headerText, { color: theme.colors.text }]}>
              Mentions
            </Text>
          </View>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleSelectMention(item)}
              >
                <Image
                  source={{ uri: item.profilePic || 'https://via.placeholder.com/40' }}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={[styles.username, { color: theme.colors.text }]}>
                    @{item.username}
                  </Text>
                  <Text style={[styles.fullName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  list: {
    maxHeight: 150,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
  },
  fullName: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default MentionSuggest;


import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { searchHashtags, getTrendingHashtags, Hashtag } from '../services/hashtags';

interface HashtagSuggestProps {
  text: string;
  cursorPosition?: number;
  onSelectHashtag: (hashtag: string) => void;
  visible?: boolean;
}

/**
 * Component that shows hashtag suggestions while typing
 * Appears when user types # followed by text
 */
export const HashtagSuggest: React.FC<HashtagSuggestProps> = ({
  text,
  cursorPosition,
  onSelectHashtag,
  visible = true,
}) => {
  const { theme } = useTheme();
  const [suggestions, setSuggestions] = useState<Hashtag[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentHashtag, setCurrentHashtag] = useState<string>('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) {
      setSuggestions([]);
      return;
    }

    // Find the hashtag being typed (text before cursor that starts with #)
    const textBeforeCursor = cursorPosition !== undefined 
      ? text.substring(0, cursorPosition)
      : text;

    // Find the last # symbol and extract the hashtag being typed
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    
    if (lastHashIndex === -1) {
      setSuggestions([]);
      setCurrentHashtag('');
      return;
    }

    // Extract text after # up to cursor position
    const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
    
    // Check if there's a space or newline immediately after # (no hashtag being typed)
    if (textAfterHash.length === 0) {
      // Cursor is right after #, show trending hashtags
      setCurrentHashtag('');
    } else if (textAfterHash[0] === ' ' || textAfterHash[0] === '\n') {
      // Space immediately after # means hashtag is complete, don't show suggestions
      setSuggestions([]);
      setCurrentHashtag('');
      return;
    } else {
      // Check if there's a space or newline in the text after # (completed hashtag)
      const spaceIndex = textAfterHash.search(/[\s\n]/);
      if (spaceIndex !== -1) {
        // There's a space/newline, meaning the hashtag is already completed
        setSuggestions([]);
        setCurrentHashtag('');
        return;
      }
      
      // Extract the hashtag query (word characters and emojis)
      const match = textAfterHash.match(/^([\w\u{1F300}-\u{1F9FF}]*)/u);
      const hashtagQuery = match ? match[1] : '';
      setCurrentHashtag(hashtagQuery);
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce search
    debounceTimer.current = setTimeout(async () => {
      const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);
      
      // Check if hashtag is already completed (has space/newline)
      if (textAfterHash.length > 0 && (textAfterHash[0] === ' ' || textAfterHash[0] === '\n')) {
        setSuggestions([]);
        return;
      }
      
      const spaceIndex = textAfterHash.search(/[\s\n]/);
      if (spaceIndex !== -1) {
        // Hashtag is completed, don't show suggestions
        setSuggestions([]);
        return;
      }
      
      const match = textAfterHash.match(/^([\w\u{1F300}-\u{1F9FF}]*)/u);
      const hashtagQuery = match ? match[1] : '';
      
      if (hashtagQuery.length === 0 && textAfterHash.length === 0) {
        // Show trending hashtags if cursor is right after #
        try {
          setLoading(true);
          const trending = await getTrendingHashtags(10);
          setSuggestions(trending);
        } catch (error) {
          console.error('Error fetching trending hashtags:', error);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      } else if (hashtagQuery.length >= 1) {
        // Search hashtags
        try {
          setLoading(true);
          const results = await searchHashtags(hashtagQuery, 10);
          setSuggestions(results);
        } catch (error) {
          console.error('Error searching hashtags:', error);
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

  const handleSelectHashtag = (hashtag: Hashtag) => {
    onSelectHashtag(hashtag.name);
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
            <Ionicons name="pricetag" size={16} color={theme.colors.primary} />
            <Text style={[styles.headerText, { color: theme.colors.text }]}>
              {currentHashtag.length === 0 ? 'Trending' : 'Suggestions'}
            </Text>
          </View>
          <View style={styles.list}>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={[styles.suggestionItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleSelectHashtag(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.hashtagText, { color: theme.colors.primary }]}>
                  #{item.name}
                </Text>
                <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
                  {item.postCount} {item.postCount === 1 ? 'post' : 'posts'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hashtagText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countText: {
    fontSize: 12,
  },
});

export default HashtagSuggest;


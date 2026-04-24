import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import ConnectCard from '../../components/ConnectCard';
import EmptyState from '../../components/EmptyState';
import {
  searchByName,
  followConnectPage,
  unfollowConnectPage,
  ConnectPageType,
} from '../../services/connect';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function ConnectSearchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConnectPageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string, pageNum = 1) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await searchByName(searchQuery.trim(), pageNum, 20);
      if (pageNum === 1) {
        setResults(response.pages);
      } else {
        setResults(prev => [...prev, ...response.pages]);
      }
      setHasMore(response.pagination.page < response.pagination.totalPages);
      setPage(pageNum);
      setSearched(true);
    } catch (error) {
      logger.error('Error searching connect pages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    // Debounced search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(text, 1);
    }, 400);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading && query.trim()) {
      performSearch(query, page + 1);
    }
  };

  const handleFollowToggle = async (pageItem: ConnectPageType) => {
    try {
      const isCurrentlyFollowing = pageItem.isFollowing;
      setResults(prev =>
        prev.map(p =>
          p._id === pageItem._id
            ? {
                ...p,
                isFollowing: !isCurrentlyFollowing,
                followerCount: p.followerCount + (isCurrentlyFollowing ? -1 : 1),
              }
            : p
        )
      );

      if (isCurrentlyFollowing) {
        await unfollowConnectPage(pageItem._id);
      } else {
        await followConnectPage(pageItem._id);
      }
    } catch (error) {
      setResults(prev =>
        prev.map(p =>
          p._id === pageItem._id
            ? {
                ...p,
                isFollowing: pageItem.isFollowing,
                followerCount: pageItem.followerCount,
              }
            : p
        )
      );
      logger.error('Error toggling follow:', error);
    }
  };

  const renderItem = ({ item }: { item: ConnectPageType }) => (
    <ConnectCard
      page={item}
      onPress={() => router.push(`/connect/page/${item._id}`)}
      onFollowPress={() => handleFollowToggle(item)}
      isFollowing={item.isFollowing}
    />
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search Connect pages..."
            placeholderTextColor={theme.colors.textSecondary}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              performSearch(query, 1);
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
                searchInputRef.current?.focus();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : searched && results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No pages found"
          description={`No Connect pages match "${query}". Try a different search term.`}
        />
      ) : results.length > 0 ? (
        <FlashList
          data={results}
          renderItem={renderItem}
          estimatedItemSize={100}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent as any}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
        />
      ) : (
        <View style={styles.hintContainer}>
          <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary + '40'} />
          <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
            Search for Connect pages by name
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingVertical: isTablet ? themeConstants.spacing.md : 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('400'),
    padding: 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: themeConstants.spacing.sm,
    paddingBottom: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  hintText: {
    fontSize: 16,
    textAlign: 'center',
  },
});

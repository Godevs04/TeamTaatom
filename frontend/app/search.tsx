import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { searchUsers } from '../services/profile';
import { getPosts } from '../services/posts';
import { searchHashtags, Hashtag } from '../services/hashtags';
import { searchPosts as advancedSearchPosts } from '../services/search';
import { UserType } from '../types/user';
import { PostType } from '../types/post';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families for each platform
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

interface SearchResult {
  users: UserType[];
  posts: PostType[];
  hashtags: Hashtag[];
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({ users: [], posts: [], hashtags: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'posts' | 'hashtags'>('users');
  const [searchHistory, setSearchHistory] = useState<{ type: 'users' | 'posts'; query: string }[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    hashtag: '',
    location: '',
    startDate: '',
    endDate: '',
    type: '' as 'photo' | 'short' | '',
  });
  const { theme, mode } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();

  useEffect(() => {
    loadSearchHistory();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      performSearch();
    } else {
      setSearchResults({ users: [], posts: [], hashtags: [] });
    }
  }, [searchQuery]);

  const loadSearchHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('searchHistory');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const saveSearchHistory = async (type: 'users' | 'posts', query: string) => {
    try {
      const newHistoryItem = { type, query };
      const updatedHistory = [
        newHistoryItem,
        ...searchHistory.filter(item => !(item.type === type && item.query === query))
      ].slice(0, 10); // Keep only last 10 searches
      
      await AsyncStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
      setSearchHistory(updatedHistory);
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const deleteSearchHistory = async (index: number) => {
    try {
      const updatedHistory = searchHistory.filter((_, i) => i !== index);
      await AsyncStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
      setSearchHistory(updatedHistory);
    } catch (error) {
      console.error('Error deleting search history:', error);
    }
  };

  const clearAllHistory = async () => {
    try {
      await AsyncStorage.removeItem('searchHistory');
      setSearchHistory([]);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  };

  const selectFromHistory = (query: string, type: 'users' | 'posts') => {
    setSearchQuery(query);
    setActiveTab(type);
  };

  const performSearch = async () => {
    if (searchQuery.trim().length < 2 && activeTab !== 'posts') return;
    
    try {
      setLoading(true);
      
      if (activeTab === 'posts' && (advancedFilters.hashtag || advancedFilters.location || advancedFilters.startDate || advancedFilters.endDate || advancedFilters.type)) {
        // Use advanced search for posts with filters
        const response = await advancedSearchPosts({
          q: searchQuery || undefined,
          hashtag: advancedFilters.hashtag || undefined,
          location: advancedFilters.location || undefined,
          startDate: advancedFilters.startDate || undefined,
          endDate: advancedFilters.endDate || undefined,
          type: advancedFilters.type || undefined,
          page: 1,
          limit: 50,
        }).catch(() => ({ posts: [], pagination: { hasNextPage: false } }));
        
        setSearchResults({
          users: [],
          posts: response.posts || [],
          hashtags: [],
        });
      } else {
        // Regular search
        const [usersResponse, postsResponse, hashtagsResponse] = await Promise.all([
          searchUsers(searchQuery, 1, 20).catch(() => ({ users: [] })),
          getPosts(1, 50).catch(() => ({ posts: [] })),
          searchHashtags(searchQuery, 20).catch(() => []),
        ]);
        
        const filteredPosts = postsResponse.posts.filter(post => 
          post.caption.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        setSearchResults({
          users: usersResponse.users || [],
          posts: filteredPosts,
          hashtags: hashtagsResponse || [],
        });

        // Save to history
        if (activeTab === 'users' && usersResponse.users.length > 0) {
          await saveSearchHistory('users', searchQuery);
        } else if (activeTab === 'posts' && filteredPosts.length > 0) {
          await saveSearchHistory('posts', searchQuery);
        }
      }
    } catch (error: any) {
      showError('Failed to search');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: UserType }) => (
    <TouchableOpacity 
      style={[styles.userItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      onPress={() => router.push(`/profile/${item._id}`)}
    >
      <Image 
        source={{ uri: item.profilePic || 'https://via.placeholder.com/50' }} 
        style={styles.userAvatar} 
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.colors.text }]}>{item.fullName}</Text>
        <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>{item.email}</Text>
        <View style={styles.userStats}>
          <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
            {item.followers?.length || 0} followers
          </Text>
          <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
            • {item.totalLikes || 0} likes
          </Text>
        </View>
      </View>
      {item.isFollowing ? (
        <TouchableOpacity style={[styles.followButton, { backgroundColor: theme.colors.border }]}>
          <Text style={[styles.followButtonText, { color: theme.colors.text }]}>Following</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.followButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.followButtonText, { color: 'white' }]}>Follow</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderPostItem = ({ item }: { item: PostType }) => (
    <TouchableOpacity 
      style={[styles.postItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      onPress={() => router.push(`/post/${item._id}`)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      <View style={styles.postInfo}>
        <Text style={[styles.postCaption, { color: theme.colors.text }]} numberOfLines={2}>
          {item.caption}
        </Text>
        <View style={styles.postMeta}>
          <Text style={[styles.postAuthor, { color: theme.colors.textSecondary }]}>
            by {item.user.fullName}
          </Text>
          <View style={styles.postStats}>
            <Ionicons name="heart-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.postStatText, { color: theme.colors.textSecondary }]}>
              {item.likesCount || 0}
            </Text>
            <Ionicons name="chatbubble-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.postStatText, { color: theme.colors.textSecondary }]}>
              {item.commentsCount || 0}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons 
        name={activeTab === 'users' ? 'people-outline' : 'image-outline'} 
        size={60} 
        color={theme.colors.textSecondary} 
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
        No {activeTab} found
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        Try searching for something else
      </Text>
    </View>
  );

  const renderSearchHistory = () => {
    const filteredHistory = searchHistory.filter(item => item.type === activeTab);
    
    if (filteredHistory.length === 0) return null;

    return (
      <View style={[styles.historyContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, { color: theme.colors.text }]}>Recent Searches</Text>
          <TouchableOpacity onPress={clearAllHistory}>
            <Text style={[styles.clearAllText, { color: theme.colors.primary }]}>Clear All</Text>
          </TouchableOpacity>
        </View>
        {filteredHistory.map((item, index) => (
          <TouchableOpacity
            key={`${item.type}-${index}-${item.query}`}
            style={[styles.historyItem, { borderBottomColor: theme.colors.border }]}
            onPress={() => selectFromHistory(item.query, item.type)}
          >
            <Ionicons 
              name="time-outline" 
              size={20} 
              color={theme.colors.textSecondary} 
              style={styles.historyIcon}
            />
            <Text style={[styles.historyText, { color: theme.colors.text }]} numberOfLines={1}>
              {item.query}
            </Text>
            <TouchableOpacity
              onPress={() => deleteSearchHistory(searchHistory.indexOf(item))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      
      {/* Elegant Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search users and posts..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'users' && { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'users' ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'posts' && { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'posts' ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            Posts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'hashtags' && { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('hashtags')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'hashtags' ? theme.colors.primary : theme.colors.textSecondary }
          ]}>
            Hashtags
          </Text>
        </TouchableOpacity>
        {activeTab === 'posts' && (
          <TouchableOpacity
            style={[
              styles.filterButton,
              (advancedFilters.hashtag || advancedFilters.location || advancedFilters.startDate || advancedFilters.endDate || advancedFilters.type) && {
                backgroundColor: theme.colors.primary + '20',
              }
            ]}
            onPress={() => setShowAdvancedFilters(true)}
          >
            <Ionicons 
              name="options-outline" 
              size={20} 
              color={
                (advancedFilters.hashtag || advancedFilters.location || advancedFilters.startDate || advancedFilters.endDate || advancedFilters.type)
                  ? theme.colors.primary
                  : theme.colors.textSecondary
              } 
            />
            {(advancedFilters.hashtag || advancedFilters.location || advancedFilters.startDate || advancedFilters.endDate || advancedFilters.type) && (
              <View style={[styles.filterBadge, { backgroundColor: theme.colors.primary }]} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Search History or Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : searchQuery.length === 0 ? (
        renderSearchHistory()
      ) : activeTab === 'users' ? (
        <FlatList
          data={searchResults.users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={searchQuery.length >= 2 ? renderEmptyState : null}
          contentContainerStyle={searchResults.users.length === 0 ? styles.emptyListContainer : undefined}
        />
      ) : activeTab === 'hashtags' ? (
        <FlatList
          data={searchResults.hashtags}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.hashtagItem, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
              onPress={() => router.push(`/hashtag/${item.name}`)}
            >
              <Ionicons name="pricetag" size={24} color={theme.colors.primary} style={styles.hashtagIcon} />
              <View style={styles.hashtagInfo}>
                <Text style={[styles.hashtagName, { color: theme.colors.text }]}>#{item.name}</Text>
                <Text style={[styles.hashtagCount, { color: theme.colors.textSecondary }]}>
                  {item.postCount} {item.postCount === 1 ? 'post' : 'posts'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.name}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={searchQuery.length >= 2 ? renderEmptyState : null}
          contentContainerStyle={searchResults.hashtags.length === 0 ? styles.emptyListContainer : undefined}
        />
      ) : (
        <FlatList
          data={searchResults.posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={searchQuery.length >= 2 ? renderEmptyState : null}
          contentContainerStyle={searchResults.posts.length === 0 ? styles.emptyListContainer : undefined}
        />
      )}

      {/* Advanced Filters Modal */}
      <Modal
        visible={showAdvancedFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAdvancedFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Advanced Filters</Text>
              <TouchableOpacity onPress={() => setShowAdvancedFilters(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Hashtag</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="e.g., travel"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.hashtag}
                  onChangeText={(text) => setAdvancedFilters({ ...advancedFilters, hashtag: text })}
                />
              </View>

              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Location</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="e.g., New York"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.location}
                  onChangeText={(text) => setAdvancedFilters({ ...advancedFilters, location: text })}
                />
              </View>

              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Post Type</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      advancedFilters.type === 'photo' && { backgroundColor: theme.colors.primary },
                      { borderColor: theme.colors.border }
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, type: advancedFilters.type === 'photo' ? '' : 'photo' })}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      { color: advancedFilters.type === 'photo' ? 'white' : theme.colors.text }
                    ]}>
                      Photo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.typeButton,
                      advancedFilters.type === 'short' && { backgroundColor: theme.colors.primary },
                      { borderColor: theme.colors.border }
                    ]}
                    onPress={() => setAdvancedFilters({ ...advancedFilters, type: advancedFilters.type === 'short' ? '' : 'short' })}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      { color: advancedFilters.type === 'short' ? 'white' : theme.colors.text }
                    ]}>
                      Short
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>Start Date</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.startDate}
                  onChangeText={(text) => setAdvancedFilters({ ...advancedFilters, startDate: text })}
                />
              </View>

              <View style={styles.filterSection}>
                <Text style={[styles.filterLabel, { color: theme.colors.text }]}>End Date</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={advancedFilters.endDate}
                  onChangeText={(text) => setAdvancedFilters({ ...advancedFilters, endDate: text })}
                />
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                onPress={() => {
                  setAdvancedFilters({ hashtag: '', location: '', startDate: '', endDate: '', type: '' });
                  setShowAdvancedFilters(false);
                  performSearch();
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  setShowAdvancedFilters(false);
                  performSearch();
                }}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: isAndroid ? 48 : 44,
    minHeight: isAndroid ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isTablet ? theme.spacing.md : 12,
    padding: isTablet ? theme.spacing.sm : 8,
    ...(isWeb && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.lg : 16,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: isTablet ? theme.spacing.md : 12,
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: isTablet ? theme.spacing.lg : 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 32,
  },
  emptyTitle: {
    fontSize: isTablet ? theme.typography.h2.fontSize : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginTop: isTablet ? theme.spacing.lg : 16,
    marginBottom: isTablet ? theme.spacing.md : 8,
    textAlign: 'center',
    letterSpacing: isIOS ? -0.3 : 0,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('400'),
    textAlign: 'center',
    lineHeight: isTablet ? 26 : 24,
    maxWidth: isTablet ? 500 : 300,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyListContainer: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: isTablet ? theme.spacing.md : 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: isTablet ? 60 : 50,
    height: isTablet ? 60 : 50,
    borderRadius: isTablet ? 30 : 25,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  userEmail: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  userStats: {
    flexDirection: 'row',
  },
  statText: {
    fontSize: 12,
    marginRight: 8,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  postItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  postImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  postInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  postCaption: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postAuthor: {
    fontSize: 14,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatText: {
    fontSize: 12,
    marginLeft: 4,
    marginRight: 12,
  },
  historyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyText: {
    flex: 1,
    fontSize: 16,
  },
  hashtagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  hashtagIcon: {
    marginRight: 12,
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hashtagCount: {
    fontSize: 14,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderRadius: 8,
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
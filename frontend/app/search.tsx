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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { searchUsers } from '../services/profile';
import { getPosts } from '../services/posts';
import { UserType } from '../types/user';
import { PostType } from '../types/post';
import { useRouter } from 'expo-router';

interface SearchResult {
  users: UserType[];
  posts: PostType[];
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'posts'>('users');
  const { theme, mode } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      performSearch();
    } else {
      setSearchResults({ users: [], posts: [] });
    }
  }, [searchQuery]);

  const performSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    
    try {
      setLoading(true);
      
      // Search users
      const usersResponse = await searchUsers(searchQuery, 1, 20);
      
      // Search posts (we'll filter posts by caption for now)
      const postsResponse = await getPosts(1, 50);
      const filteredPosts = postsResponse.posts.filter(post => 
        post.caption.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      setSearchResults({
        users: usersResponse.users,
        posts: filteredPosts,
      });
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
      </View>

      {/* Search Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : activeTab === 'users' ? (
        <FlatList
          data={searchResults.users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={searchQuery.length >= 2 ? renderEmptyState : null}
          contentContainerStyle={searchResults.users.length === 0 ? styles.emptyListContainer : undefined}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyListContainer: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 4,
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
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Share,
  Linking,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getPostShareUrl, getJourneyShareUrl } from '../utils/config';
import { getShortUrl, getJourneyShortUrl } from '../services/shortUrl';
import { sendMessage } from '../services/chat';
import { searchUsers, getSuggestedUsers } from '../services/profile';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  post?: {
    _id: string;
    caption?: string;
    imageUrl?: string;
    images?: string[];
    mediaUrl?: string;
    videoUrl?: string;
    user?: {
      fullName: string;
    };
  };
  journey?: {
    _id: string;
    title?: string;
    distanceTraveled?: number;
    startedAt?: string;
    completedAt?: string;
    status?: string;
  };
  shareUrl?: string;
}

export default function ShareModal({
  visible,
  onClose,
  post,
  journey,
  shareUrl,
}: ShareModalProps) {
  const isJourneyShare = !!journey;
  const { theme } = useTheme();
  const [shortUrl, setShortUrl] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [sendingToUserId, setSendingToUserId] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch short URL when modal opens (non-blocking)
  useEffect(() => {
    if (visible && shareUrl) {
      setShortUrl(shareUrl);
      setIsLoadingUrl(false);
    } else if (visible && journey?._id) {
      // Journey share
      const fallbackUrl = getJourneyShareUrl(journey._id);
      setShortUrl(fallbackUrl);
      setIsLoadingUrl(true);
      getJourneyShortUrl(journey._id)
        .then((url) => {
          setShortUrl(url);
          setIsLoadingUrl(false);
        })
        .catch((error) => {
          logger.error('Failed to get journey short URL, using fallback:', error);
          setIsLoadingUrl(false);
        });
    } else if (visible && post?._id) {
      // Post share
      const fallbackUrl = getPostShareUrl(post._id);
      setShortUrl(fallbackUrl);
      setIsLoadingUrl(true);
      getShortUrl(post._id)
        .then((url) => {
          setShortUrl(url);
          setIsLoadingUrl(false);
        })
        .catch((error) => {
          logger.error('Failed to get short URL, using fallback:', error);
          setIsLoadingUrl(false);
        });
    } else if (!visible) {
      setShortUrl('');
      setIsLoadingUrl(false);
    }
  }, [visible, post?._id, journey?._id, shareUrl]);

  // Generate share URL (use short URL if available, otherwise fallback)
  const getShareUrl = () => {
    if (shortUrl) return shortUrl;
    if (shareUrl) return shareUrl;
    if (post?._id) {
      return getPostShareUrl(post._id);
    }
    return '';
  };

  // Generate share text
  const getShareText = () => {
    if (isJourneyShare && journey?.title) {
      const dist = journey.distanceTraveled
        ? journey.distanceTraveled >= 1000
          ? `${(journey.distanceTraveled / 1000).toFixed(1)} km`
          : `${Math.round(journey.distanceTraveled)} m`
        : '';
      return `${journey.title}${dist ? ` • ${dist}` : ''}\n\n${getShareUrl()}`;
    }
    if (post?.caption) {
      return `${post.caption}\n\n${getShareUrl()}`;
    }
    return getShareUrl();
  };

  // Share to native share sheet
  const handleNativeShare = async () => {
    try {
      const shareTitle = isJourneyShare
        ? journey?.title || 'Check out my journey on Taatom'
        : post?.caption || 'Check out this post on Taatom';
      const result = await Share.share({
        message: getShareText(),
        url: getShareUrl(),
        title: shareTitle,
      });

      if (result.action === Share.sharedAction) {
        onClose();
      }
    } catch (error: any) {
      logger.error('Error sharing:', error);
    }
  };

  // Share to Instagram
  const handleInstagramShare = async () => {
    try {
      const url = `instagram://library?AssetPath=${encodeURIComponent(post?.imageUrl || '')}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to web
        await Linking.openURL('https://www.instagram.com/');
      }
      onClose();
    } catch (error: any) {
      logger.error('Error sharing to Instagram:', error);
    }
  };

  // Share to Facebook
  const handleFacebookShare = async () => {
    try {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
      await Linking.openURL(url);
      onClose();
    } catch (error: any) {
      logger.error('Error sharing to Facebook:', error);
    }
  };

  // Share to Twitter
  const handleTwitterShare = async () => {
    try {
      const text = post?.caption ? encodeURIComponent(post.caption.substring(0, 200)) : '';
      const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(getShareUrl())}`;
      await Linking.openURL(url);
      onClose();
    } catch (error: any) {
      logger.error('Error sharing to Twitter:', error);
    }
  };

  // Handle send to chat
  const handleSendToChat = () => {
    setShowUserPicker(true);
    setSearchQuery(''); // Reset search when opening
    setUsers([]); // Clear previous users
    // loadUsers will be called by useEffect when showUserPicker becomes true
  };

  // Cleanup when modal closes
  useEffect(() => {
    if (!showUserPicker) {
      setSearchQuery('');
      setUsers([]);
      if (searchTimeout) {
        clearTimeout(searchTimeout);
        setSearchTimeout(null);
      }
    }
  }, [showUserPicker]);

  // Load users for chat - search across all users in the app
  const loadUsers = async (query: string = '') => {
    setIsLoadingUsers(true);
    try {
      const trimmedQuery = query.trim();
      
      // If query is empty or less than 2 characters, use suggested users or following users
      if (!trimmedQuery || trimmedQuery.length < 2) {
        // Try to get suggested users first
        try {
          const suggestedResponse = await getSuggestedUsers(50);
          if (suggestedResponse.users && suggestedResponse.users.length > 0) {
            setUsers(suggestedResponse.users);
            return;
          }
        } catch (suggestedError) {
          logger.debug('Could not get suggested users, trying following users:', suggestedError);
        }
        
        // Fallback: get following users
        try {
          const userData = await AsyncStorage.getItem('userData');
          if (userData) {
            const parsed = JSON.parse(userData);
            const response = await api.get(`/api/v1/profile/${parsed._id}/following`);
            const followingUsers = response.data.users || [];
            if (followingUsers.length > 0) {
              setUsers(followingUsers);
              return;
            }
          }
        } catch (followingError) {
          logger.debug('Could not get following users:', followingError);
        }
        
        // If both fail, set empty array
        setUsers([]);
      } else {
        // Query is 2+ characters, use search API
        const response = await searchUsers(trimmedQuery, 1, 100);
        setUsers(response.users || []);
      }
    } catch (error: any) {
      logger.error('Error loading users:', error);
      // Final fallback: try to get following users
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          const response = await api.get(`/api/v1/profile/${parsed._id}/following`);
          setUsers(response.data.users || []);
        } else {
          setUsers([]);
        }
      } catch (fallbackError) {
        logger.error('Error loading following users:', fallbackError);
        setUsers([]);
      }
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Debounced search - load users when search query changes
  useEffect(() => {
    if (!showUserPicker) return;

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      loadUsers(searchQuery);
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);

    // Cleanup
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [searchQuery, showUserPicker]);

  // Load initial users when modal opens
  useEffect(() => {
    if (showUserPicker && !searchQuery) {
      loadUsers('');
    }
  }, [showUserPicker]);

  // Send post or journey to selected user
  const handleSendToUser = async (userId: string) => {
    if (!post?._id && !journey?._id) return;

    setIsSendingMessage(true);
    setSendingToUserId(userId);
    try {
      const currentShareUrl = getShareUrl();
      let messageText = '';

      if (isJourneyShare && journey?._id) {
        // Format: [JOURNEY_SHARE]journeyId|shareUrl|title|distance|status
        const dist = journey.distanceTraveled
          ? journey.distanceTraveled >= 1000
            ? `${(journey.distanceTraveled / 1000).toFixed(1)} km`
            : `${Math.round(journey.distanceTraveled)} m`
          : '';
        const journeyData = [
          journey._id,
          currentShareUrl,
          journey.title || 'Journey',
          dist,
          journey.status || 'completed'
        ].join('|');
        messageText = `[JOURNEY_SHARE]${journeyData}`;
      } else if (post?._id) {
        // Extract image URL - try multiple sources
        let imageUrl = '';
        if (post.imageUrl) {
          imageUrl = post.imageUrl;
        } else if (post.images && Array.isArray(post.images) && post.images.length > 0) {
          imageUrl = post.images[0];
        } else if (post.mediaUrl) {
          imageUrl = post.mediaUrl;
        } else if (post.videoUrl) {
          imageUrl = post.videoUrl;
        }

        // Format: [POST_SHARE]postId|imageUrl|shareUrl|caption|authorName
        const postData = [
          post._id,
          imageUrl || '',
          currentShareUrl,
          post.caption || '',
          post.user?.fullName || ''
        ].join('|');
        messageText = `[POST_SHARE]${postData}`;
      }

      await sendMessage(userId, messageText);

      setIsSendingMessage(false);
      setSendingToUserId(null);
      setShowUserPicker(false);

      setTimeout(() => {
        onClose();
        setTimeout(() => {
          Alert.alert('Success', isJourneyShare ? 'Journey sent successfully!' : 'Post sent successfully!');
        }, 200);
      }, 150);
    } catch (error: any) {
      logger.error('Error sending message:', error);
      setIsSendingMessage(false);
      setSendingToUserId(null);
      Alert.alert('Error', error.message || 'Failed to send. Please try again.');
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    try {
      const url = getShareUrl();
      
      if (Platform.OS === 'web') {
        // Web: Use navigator.clipboard API
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else {
        // Mobile: Try to use expo-clipboard if available, otherwise use Share API
        try {
          // Try expo-clipboard first (if installed)
          const Clipboard = require('expo-clipboard').default;
          await Clipboard.setStringAsync(url);
        } catch (expoClipboardError) {
          // Fallback: Use Share API (will show share sheet)
          await Share.share({
            message: url,
            title: 'Copy Link',
          });
        }
      }
      onClose();
    } catch (error: any) {
      logger.error('Error copying link:', error);
      // Fallback: show the URL in an alert so user can manually copy
      Alert.alert('Copy Link', `Link: ${getShareUrl()}`, [
        { text: 'OK', onPress: onClose }
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {isJourneyShare ? 'Share Journey' : 'Share Post'}
          </Text>

          {/* Journey Preview Card */}
          {isJourneyShare && journey && (
            <View style={[styles.previewCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <View style={[styles.journeyPreviewIcon, { backgroundColor: '#22C55E20' }]}>
                <Ionicons name="navigate" size={28} color="#22C55E" />
              </View>
              <View style={styles.previewContent}>
                <Text style={[styles.previewAuthor, { color: theme.colors.text }]}>
                  {journey.title || 'Journey'}
                </Text>
                <Text style={[styles.previewCaption, { color: theme.colors.textSecondary }]}>
                  {journey.distanceTraveled
                    ? journey.distanceTraveled >= 1000
                      ? `${(journey.distanceTraveled / 1000).toFixed(1)} km`
                      : `${Math.round(journey.distanceTraveled)} m`
                    : ''}
                  {journey.status ? ` • ${journey.status.charAt(0).toUpperCase() + journey.status.slice(1)}` : ''}
                </Text>
                <View style={styles.urlContainer}>
                  <Text style={[styles.previewUrl, { color: theme.colors.primary }]} numberOfLines={1}>
                    {getShareUrl()}
                  </Text>
                  {isLoadingUrl && (
                    <View style={styles.loadingIndicator}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Post Preview Card */}
          {!isJourneyShare && post && (
            <View style={[styles.previewCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              {post.imageUrl && (
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.previewContent}>
                {post.user && (
                  <Text style={[styles.previewAuthor, { color: theme.colors.text }]}>
                    {post.user.fullName}
                  </Text>
                )}
                {post.caption && (
                  <Text
                    style={[styles.previewCaption, { color: theme.colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {post.caption}
                  </Text>
                )}
                <View style={styles.urlContainer}>
                  <Text style={[styles.previewUrl, { color: theme.colors.primary }]} numberOfLines={1}>
                    {getShareUrl()}
                  </Text>
                  {isLoadingUrl && (
                    <View style={styles.loadingIndicator}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          <View style={styles.shareOptions}>
            {/* Native Share */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleNativeShare}
            >
              <Ionicons name="share-outline" size={32} color={theme.colors.primary} />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                {Platform.OS === 'ios' ? 'Share' : 'Share'}
              </Text>
            </TouchableOpacity>

            {/* Instagram */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleInstagramShare}
            >
              <Ionicons name="logo-instagram" size={32} color="#E4405F" />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Instagram
              </Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleFacebookShare}
            >
              <Ionicons name="logo-facebook" size={32} color="#1877F2" />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Facebook
              </Text>
            </TouchableOpacity>

            {/* Twitter */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleTwitterShare}
            >
              <Ionicons name="logo-twitter" size={32} color="#1DA1F2" />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Twitter
              </Text>
            </TouchableOpacity>

            {/* Copy Link */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link-outline" size={32} color={theme.colors.primary} />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Copy Link
              </Text>
            </TouchableOpacity>

            {/* Send to Chat */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleSendToChat}
            >
              <Ionicons name="chatbubble-outline" size={32} color={theme.colors.primary} />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Send to Chat
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.colors.background }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User Picker Modal */}
      <Modal
        visible={showUserPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserPicker(false)}
      >
        <View style={styles.userPickerOverlay}>
          <TouchableOpacity
            style={styles.userPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowUserPicker(false)}
          />
          <View style={[styles.userPickerContent, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            
            <View style={styles.userPickerHeader}>
              <Text style={[styles.userPickerTitle, { color: theme.colors.text }]}>
                Send to Chat
              </Text>
              <TouchableOpacity
                onPress={() => setShowUserPicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchBar, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search users..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Users List */}
            {isLoadingUsers ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : (
              <FlatList
                data={users}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.userItem, { backgroundColor: theme.colors.background }]}
                    onPress={() => handleSendToUser(item._id)}
                    disabled={isSendingMessage}
                  >
                    {item.profilePic ? (
                      <Image
                        source={{ uri: item.profilePic }}
                        style={styles.userAvatar}
                      />
                    ) : (
                      <View style={[styles.userAvatar, { backgroundColor: theme.colors.border }]}>
                        <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: theme.colors.text }]}>
                        {item.fullName || item.username || 'User'}
                      </Text>
                      {item.username && item.username !== item.fullName && (
                        <Text style={[styles.userUsername, { color: theme.colors.textSecondary }]}>
                          @{item.username}
                        </Text>
                      )}
                    </View>
                    {isSendingMessage && sendingToUserId === item._id && (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                      {searchQuery ? 'No users found' : 'No users available'}
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  shareOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  shareOption: {
    width: '30%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  shareOptionText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  previewImage: {
    width: 80,
    height: 80,
  },
  journeyPreviewIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  previewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewCaption: {
    fontSize: 12,
    marginBottom: 4,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewUrl: {
    fontSize: 10,
    flex: 1,
  },
  loadingIndicator: {
    marginLeft: 4,
  },
  userPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  userPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  userPickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  userPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userPickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
});


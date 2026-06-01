import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  FlatList,
  TextInput,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import LoadingGlobe from '../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getPostShareUrl, getJourneyShareUrl } from '../utils/config';
import { getShortUrl, getJourneyShortUrl } from '../services/shortUrl';
import { sendMessage, sharePostToChat, listChats, sendMessageToRoom } from '../services/chat';
import { searchUsers, getSuggestedUsers } from '../services/profile';
import api from '../services/api';
import { incrementShareCount } from '../services/posts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
import { FILTER_PREVIEW_OVERLAY, ImageFilterType } from './ImageEditModal';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { showGlobalAlert } from '../utils/globalAlertHandler';
import { LinearGradient } from 'expo-linear-gradient';

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

interface RecipientItem {
  _id: string;
  fullName: string;
  profilePic?: string;
  username?: string;
  isGroup: boolean;
  subtitle?: string;
  chatId?: string;
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
  const { height: screenHeight } = Dimensions.get('window');

  const isPrimaryWhite = theme.colors.primary.toLowerCase() === '#ffffff' || theme.colors.primary.toLowerCase() === '#fff';
  const buttonTextColor = isPrimaryWhite ? '#000000' : '#ffffff';

  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  const [shortUrl, setShortUrl] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mostInteracted, setMostInteracted] = useState<RecipientItem[]>([]);
  const [otherRecipients, setOtherRecipients] = useState<RecipientItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    if (visible) {
      translateY.setValue(screenHeight);
      opacity.setValue(0);
      scale.setValue(0.95);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity, scale, screenHeight]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeight,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

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

  // Track share count
  const trackShare = async () => {
    if (post?._id && !isJourneyShare) {
      try {
        await incrementShareCount(post._id);
      } catch (err) {
        logger.error('Failed to increment share count:', err);
      }
    }
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
        await trackShare();
        handleClose();
      }
    } catch (error: any) {
      logger.error('Error sharing:', error);
      showGlobalAlert({
        title: 'Share Error',
        message: error.message || 'Failed to open native share sheet.',
        type: 'error',
      });
    }
  };

  // Share to Instagram
  const handleInstagramShare = async () => {
    try {
      const hasInstagram = await Linking.canOpenURL('instagram://');
      
      if (hasInstagram) {
        let finalImageUrl = post?.imageUrl || '';
        
        if (finalImageUrl && (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://'))) {
          // Download to local cache directory first
          const filename = finalImageUrl.split('/').pop()?.split('?')[0] || 'instagram_share.jpg';
          const localUri = `${FileSystem.cacheDirectory}${filename}`;
          const downloadResult = await FileSystem.downloadAsync(finalImageUrl, localUri);
          finalImageUrl = downloadResult.uri;
        }
        
        const url = `instagram://library?AssetPath=${encodeURIComponent(finalImageUrl)}`;
        await Linking.openURL(url);
      } else {
        // Fallback to web
        await Linking.openURL('https://www.instagram.com/');
      }
      await trackShare();
      handleClose();
    } catch (error: any) {
      logger.error('Error sharing to Instagram:', error);
      showGlobalAlert({
        title: 'Share Error',
        message: error.message || 'Failed to share to Instagram. Please try again.',
        type: 'error',
      });
    }
  };

  // Share to Instagram Chat (Direct)
  const handleInstagramChatShare = async () => {
    try {
      const url = getShareUrl();
      const message = `Check this out: ${url}`;
      
      // Copy link to clipboard so they can paste it easily
      await Clipboard.setStringAsync(url);
      
      const hasInstagram = await Linking.canOpenURL('instagram://');
      if (hasInstagram) {
        // Try opening direct messages sharesheet
        const directUrl = 'instagram://direct-inbox';
        const canOpenDirect = await Linking.canOpenURL(directUrl);
        if (canOpenDirect) {
          await Linking.openURL(directUrl);
        } else {
          await Linking.openURL('instagram://sharesheet?text=' + encodeURIComponent(message));
        }
      } else {
        // Fallback to web direct
        await Linking.openURL('https://www.instagram.com/direct/inbox/');
      }
      await trackShare();
      handleClose();
    } catch (error: any) {
      logger.error('Error sharing to Instagram direct chat:', error);
      handleNativeShare();
    }
  };

  // Share to Facebook
  const handleFacebookShare = async () => {
    try {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
      await Linking.openURL(url);
      await trackShare();
      handleClose();
    } catch (error: any) {
      logger.error('Error sharing to Facebook:', error);
      showGlobalAlert({
        title: 'Share Error',
        message: error.message || 'Failed to share to Facebook. Please try again.',
        type: 'error',
      });
    }
  };

  // Share to Twitter
  const handleTwitterShare = async () => {
    try {
      const text = post?.caption ? encodeURIComponent(post.caption.substring(0, 200)) : '';
      const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(getShareUrl())}`;
      await Linking.openURL(url);
      await trackShare();
      handleClose();
    } catch (error: any) {
      logger.error('Error sharing to Twitter:', error);
      showGlobalAlert({
        title: 'Share Error',
        message: error.message || 'Failed to share to Twitter. Please try again.',
        type: 'error',
      });
    }
  };

  // Share to WhatsApp Direct
  const handleWhatsAppDirectShare = async () => {
    try {
      const url = getShareUrl();
      const message = `Check this out: ${url}`;
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
      await trackShare();
      handleClose();
    } catch {
      handleNativeShare();
    }
  };

  // Share to WhatsApp Status
  const handleWhatsAppStatusShare = async () => {
    try {
      const url = getShareUrl();
      const message = `Check this out: ${url}`;
      await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
      await trackShare();
      handleClose();
    } catch {
      handleNativeShare();
    }
  };

  // Handle send to chat
  const handleSendToChat = () => {
    setShowUserPicker(true);
    setSearchQuery('');
    setRecipients([]);
    setMostInteracted([]);
    setOtherRecipients([]);
    setSelectedUsers([]);
  };

  // Cleanup when modal closes
  useEffect(() => {
    if (!showUserPicker) {
      setSearchQuery('');
      setRecipients([]);
      setMostInteracted([]);
      setOtherRecipients([]);
      setSelectedUsers([]);
      setActiveChats([]);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    }
  }, [showUserPicker]);

  // Load recipients - merges active group chats with suggested/searched users
  const loadUsers = async (query: string = '', chats?: any[]) => {
    setIsLoadingUsers(true);
    const effectiveChats = chats !== undefined ? chats : activeChats;
    try {
      const trimmedQuery = query.trim().toLowerCase();

      // Retrieve current logged in user ID from AsyncStorage if not set
      let myId = currentUserId;
      if (!myId) {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            myId = parsed._id || '';
            setCurrentUserId(myId);
          } catch {}
        }
      }

      // Build active chat recipients
      const activeRecipients: RecipientItem[] = [];
      const activeIds = new Set<string>();

      effectiveChats.forEach((c: any) => {
        if (c.type === 'connect_page' && c.connectPageId) {
          activeRecipients.push({
            _id: c._id,
            fullName: c.connectPageId.name,
            profilePic: c.connectPageId.profileImage,
            isGroup: true,
            subtitle: 'Connect Group',
            chatId: c._id,
          });
          activeIds.add(c._id);
        } else {
          // 1-on-1 chat
          const otherParticipant = c.participants?.find((p: any) => p._id !== myId);
          if (otherParticipant) {
            activeRecipients.push({
              _id: otherParticipant._id,
              fullName: otherParticipant.fullName || otherParticipant.username || 'User',
              profilePic: otherParticipant.profilePic,
              username: otherParticipant.username,
              isGroup: false,
              chatId: c._id,
            });
            activeIds.add(otherParticipant._id);
          }
        }
      });

      if (trimmedQuery.length > 0) {
        // Search query: search users via API
        let searchResults: RecipientItem[] = [];
        try {
          const response = await searchUsers(trimmedQuery, 1, 100);
          searchResults = (response.users || []).map((u: any): RecipientItem => ({
            _id: u._id,
            fullName: u.fullName || u.username || 'User',
            profilePic: u.profilePic,
            username: u.username,
            isGroup: false,
          }));
        } catch (err) {
          logger.error('Search failed', err);
        }

        // Also search within active chats and prepend them if they match the query
        const matchingActive = activeRecipients.filter(r => 
          r.fullName.toLowerCase().includes(trimmedQuery) || 
          (r.username && r.username.toLowerCase().includes(trimmedQuery))
        );

        // Deduplicate: merge matching active and search results
        const mergedResults = [...matchingActive];
        const mergedIds = new Set(matchingActive.map(r => r._id));

        searchResults.forEach(r => {
          if (!mergedIds.has(r._id)) {
            mergedResults.push(r);
            mergedIds.add(r._id);
          }
        });

        setRecipients(mergedResults);
        setMostInteracted([]);
        setOtherRecipients([]);
      } else {
        // No search query: load suggested users and split into horizontal (most interacted) & vertical (others)
        let suggestedUsers: RecipientItem[] = [];
        try {
          const suggestedResponse = await getSuggestedUsers(50);
          if (suggestedResponse.users && suggestedResponse.users.length > 0) {
            suggestedUsers = suggestedResponse.users.map((u: any): RecipientItem => ({
              _id: u._id,
              fullName: u.fullName || u.username || 'User',
              profilePic: u.profilePic,
              username: u.username,
              isGroup: false,
            }));
          }
        } catch {
          // Fallback: following users
          try {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
              const parsed = JSON.parse(userData);
              const response = await api.get(`/api/v1/profile/${parsed._id}/following`);
              suggestedUsers = (response.data.users || []).map((u: any): RecipientItem => ({
                _id: u._id,
                fullName: u.fullName || u.username || 'User',
                profilePic: u.profilePic,
                username: u.username,
                isGroup: false,
              }));
            }
          } catch {}
        }

        // Horizontal Row (Most Interacted):
        // 1. All activeRecipients (which are user's actual chats)
        // 2. If activeRecipients has < 12 items, fill up with suggested users
        const horizontalItems = [...activeRecipients];
        const horizontalIds = new Set(activeRecipients.map(r => r._id));

        suggestedUsers.forEach(u => {
          if (horizontalItems.length < 12 && !horizontalIds.has(u._id)) {
            horizontalItems.push(u);
            horizontalIds.add(u._id);
          }
        });

        // Vertical List (Others):
        // Suggested users that are NOT in the horizontal list
        const verticalItems = suggestedUsers.filter(u => !horizontalIds.has(u._id));

        setMostInteracted(horizontalItems);
        setOtherRecipients(verticalItems);
        setRecipients([]);
      }
    } catch (error: any) {
      logger.error('Error loading recipients:', error);
      setRecipients([]);
      setMostInteracted([]);
      setOtherRecipients([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Debounced search when query changes
  useEffect(() => {
    if (!visible) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadUsers(searchQuery, activeChats);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, visible]);

  // Fetch chats + load initial recipients when modal opens
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setRecipients([]);
      setMostInteracted([]);
      setOtherRecipients([]);
      setSelectedUsers([]);
      setActiveChats([]);
      return;
    }
    let cancelled = false;
    const init = async () => {
      try {
        const chatResponse = await listChats();
        if (cancelled) return;
        const chats = chatResponse.chats || [];
        setActiveChats(chats);
        await loadUsers('', chats);
      } catch {
        if (!cancelled) await loadUsers('', []);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [visible]);

  // Toggle a recipient in/out of the selection
  const toggleRecipient = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Send post or journey to ALL selected recipients in parallel
  const handleSendToRecipients = async () => {
    if (selectedUsers.length === 0 || (!post?._id && !journey?._id)) return;
    setIsSendingMessage(true);
    try {
      const currentShareUrl = getShareUrl();
      let messageText = '';

      if (isJourneyShare && journey?._id) {
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
          journey.status || 'completed',
        ].join('|');
        messageText = `[JOURNEY_SHARE]${journeyData}`;
      } else if (post?._id) {
        const imageUrl =
          post.imageUrl ||
          (post.images && post.images.length > 0 ? post.images[0] : '') ||
          post.mediaUrl ||
          post.videoUrl ||
          '';
        const postData = [
          post._id,
          imageUrl,
          currentShareUrl,
          post.caption || '',
          post.user?.fullName || '',
        ].join('|');
        messageText = `[POST_SHARE]${postData}`;
      }
      const allPossibleRecipients = [...mostInteracted, ...otherRecipients, ...recipients];
      const recipientMap = new Map<string, RecipientItem>();
      allPossibleRecipients.forEach(r => {
        if (r && r._id) {
          recipientMap.set(r._id, r);
        }
      });
      const targets = Array.from(recipientMap.values()).filter((r) => selectedUsers.includes(r._id));

      await Promise.all(
        targets.map(async (recipient) => {
          if (recipient.isGroup && recipient.chatId) {
            // Group chat
            if (post?._id && !isJourneyShare) {
              try {
                await sharePostToChat(post._id, { chatId: recipient.chatId });
              } catch {
                await sendMessageToRoom(recipient.chatId, messageText);
              }
            } else {
              await sendMessageToRoom(recipient.chatId, messageText);
            }
          } else {
            // 1-on-1 user
            if (post?._id && !isJourneyShare) {
              try {
                await sharePostToChat(post._id, { otherUserId: recipient._id });
              } catch {
                await sendMessage(recipient._id, messageText);
              }
            } else {
              await sendMessage(recipient._id, messageText);
            }
          }
        })
      );

      setIsSendingMessage(false);
      setShowUserPicker(false);
      setSelectedUsers([]);

      setTimeout(async () => {
        await trackShare();
        handleClose();
        setTimeout(() => {
          Alert.alert(
            'Sent!',
            `Post sent to ${selectedUsers.length} recipient${selectedUsers.length !== 1 ? 's' : ''}!`
          );
        }, 200);
      }, 150);
    } catch (error: any) {
      logger.error('Error sending to recipients:', error);
      setIsSendingMessage(false);
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
        // Mobile: Use expo-clipboard to copy, fall back to Share sheet if unavailable
        try {
          await Clipboard.setStringAsync(url);
        } catch (expoClipboardError) {
          await Share.share({
            message: url,
            title: 'Copy Link',
          });
        }
      }
      await trackShare();
      handleClose();
    } catch (error: any) {
      logger.error('Error copying link:', error);
      // Fallback: show the URL in an alert so user can manually copy
      Alert.alert('Copy Link', `Link: ${getShareUrl()}`, [
        { text: 'OK', onPress: handleClose }
      ]);
    }
  };

  const renderHorizontalSuggested = () => {
    if (mostInteracted.length === 0) return null;
    return (
      <View style={styles.horizontalSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Recent Chats</Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={mostInteracted}
          keyExtractor={(item) => `horizontal_${item._id}`}
          contentContainerStyle={styles.horizontalListContent}
          renderItem={({ item }) => {
            const isSelected = selectedUsers.includes(item._id);
            const displayName = item.fullName.split(' ')[0];
            
            return (
              <TouchableOpacity
                style={styles.horizontalItem}
                onPress={() => toggleRecipient(item._id)}
                disabled={isSendingMessage}
                activeOpacity={0.7}
              >
                <View style={styles.horizontalAvatarContainer}>
                  {item.isGroup ? (
                    <View style={[styles.horizontalAvatar, { backgroundColor: theme.colors.primary + '22' }]}>
                      <Ionicons name="chatbubbles" size={24} color={theme.colors.primary} />
                    </View>
                  ) : item.profilePic ? (
                    <Image source={{ uri: item.profilePic }} style={styles.horizontalAvatar} />
                  ) : (
                    <View style={[styles.horizontalAvatar, { backgroundColor: theme.colors.border }]}>
                      <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
                    </View>
                  )}
                  
                  {isSelected && (
                    <LinearGradient
                      colors={['#50C878', '#1C73B4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        styles.horizontalCheckCircle,
                        {
                          borderColor: theme.colors.background,
                          borderWidth: 1.5,
                        },
                      ]}
                    >
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </LinearGradient>
                  )}
                </View>
                <Text 
                  style={[styles.horizontalName, { color: theme.colors.text }]} 
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        {otherRecipients.length > 0 && (
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 12 }]}>Suggested</Text>
        )}
      </View>
    );
  };

  const allUsers = searchQuery.trim().length > 0 ? recipients : [...mostInteracted, ...otherRecipients];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ translateY }, { scale }],
              opacity,
            },
          ]}
        >
          {/* Drag Handle Indicator */}
          <View style={styles.handleBar}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          {/* Header Title and Close button */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Share</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Row */}
          <View style={styles.searchRow}>
            <View style={[styles.searchBar, { flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search"
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={[styles.searchRightButton, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Contacts Grid */}
          {isLoadingUsers ? (
            <View style={styles.loadingContainer}>
              <LoadingGlobe size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={allUsers}
              keyExtractor={(item) => item._id}
              numColumns={3}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={searchQuery.trim().length === 0 ? renderHorizontalSuggested : null}
              renderItem={({ item }) => {
                const isSelected = selectedUsers.includes(item._id);
                const displayName = item.fullName.split(' ')[0];
                
                return (
                  <TouchableOpacity
                    style={styles.gridItem}
                    onPress={() => toggleRecipient(item._id)}
                    disabled={isSendingMessage}
                    activeOpacity={0.7}
                  >
                    <View style={styles.gridAvatarContainer}>
                      {item.isGroup ? (
                        <View style={[styles.gridAvatar, { backgroundColor: theme.colors.primary + '22' }]}>
                          <Ionicons name="chatbubbles" size={26} color={theme.colors.primary} />
                        </View>
                      ) : item.profilePic ? (
                        <Image source={{ uri: item.profilePic }} style={styles.gridAvatar} />
                      ) : (
                        <View style={[styles.gridAvatar, { backgroundColor: theme.colors.border }]}>
                          <Ionicons name="person" size={26} color={theme.colors.textSecondary} />
                        </View>
                      )}
                      
                      {isSelected && (
                        <LinearGradient
                          colors={['#50C878', '#1C73B4']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.gridCheckCircle,
                            {
                              borderColor: theme.colors.surface,
                              borderWidth: 1.5,
                            },
                          ]}
                        >
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        </LinearGradient>
                      )}
                    </View>
                    <Text 
                      style={[styles.gridName, { color: theme.colors.text }]} 
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    {searchQuery ? 'No results found' : 'No contacts available'}
                  </Text>
                </View>
              }
              style={styles.gridScroll}
              contentContainerStyle={{ paddingBottom: selectedUsers.length > 0 ? 100 : 20 }}
            />
          )}

          {/* Bottom Actions */}
          {selectedUsers.length > 0 ? (
            <TouchableOpacity
              style={[styles.sendButton, { position: 'absolute', bottom: 20, left: 20, right: 20, overflow: 'hidden' }]}
              onPress={handleSendToRecipients}
              disabled={isSendingMessage}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#50C878', '#1C73B4']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              {isSendingMessage ? (
                <LoadingGlobe size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#ffffff" />
                  <Text style={[styles.sendButtonText, { color: '#ffffff' }]}>
                    Send{selectedUsers.length > 1 ? ` to ${selectedUsers.length}` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.bottomRailContainer, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bottomRailContent}
              >
                <TouchableOpacity style={styles.bottomRailItem} onPress={handleInstagramChatShare}>
                  <View style={[styles.bottomRailIconCircle, { backgroundColor: '#E4405F' }]}>
                    <Ionicons name="logo-instagram" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.bottomRailText, { color: theme.colors.text }]} numberOfLines={2}>
                    Instagram
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.bottomRailItem} onPress={handleCopyLink}>
                  <View style={[styles.bottomRailIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                    <Ionicons name="link-outline" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.bottomRailText, { color: theme.colors.text }]} numberOfLines={2}>
                    Copy link
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.bottomRailItem} onPress={handleWhatsAppDirectShare}>
                  <View style={[styles.bottomRailIconCircle, { backgroundColor: '#25D366' }]}>
                    <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.bottomRailText, { color: theme.colors.text }]} numberOfLines={2}>
                    WhatsApp
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.bottomRailItem} onPress={handleWhatsAppStatusShare}>
                  <View style={[styles.bottomRailIconCircle, { backgroundColor: '#128C7E' }]}>
                    <Ionicons name="sync" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.bottomRailText, { color: theme.colors.text }]} numberOfLines={2}>
                    WhatsApp Status
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.bottomRailItem} onPress={handleNativeShare}>
                  <View style={[styles.bottomRailIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                    <Ionicons name="share-social-outline" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.bottomRailText, { color: theme.colors.text }]} numberOfLines={2}>
                    Share
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    maxHeight: '90%',
    minHeight: 450,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 999,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 4,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  shareOption: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  shareOptionText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  copyLinkText: {
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    height: '100%',
    padding: 0,
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
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  horizontalSection: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  horizontalListContent: {
    paddingHorizontal: 4,
    gap: 16,
  },
  horizontalItem: {
    alignItems: 'center',
    width: 68,
  },
  horizontalAvatarContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  horizontalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalName: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '400',
  },
  horizontalCheckCircle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
    gap: 12,
  },
  searchRightButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  gridScroll: {
    flex: 1,
    marginTop: 8,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 0,
  },
  gridItem: {
    flex: 1 / 3,
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  gridAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  gridAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridName: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '400',
  },
  gridCheckCircle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  bottomRailContainer: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  bottomRailContent: {
    gap: 14,
    paddingHorizontal: 8,
  },
  bottomRailItem: {
    alignItems: 'center',
    width: 68,
  },
  bottomRailIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bottomRailText: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '400',
  },
});

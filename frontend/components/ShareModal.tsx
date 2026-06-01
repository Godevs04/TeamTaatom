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
} from 'react-native';
import LoadingGlobe from '../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getPostShareUrl, getJourneyShareUrl } from '../utils/config';
import { getShortUrl, getJourneyShortUrl } from '../services/shortUrl';
import { sendMessage, sharePostToChat, listChats, sendMessageToRoom } from '../services/chat';
import { searchUsers, getSuggestedUsers } from '../services/profile';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from '../utils/logger';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';

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
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['65%'], []);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const [shortUrl, setShortUrl] = useState<string>('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
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
    setSearchQuery('');
    setRecipients([]);
    setSelectedIds([]);
  };

  // Cleanup when modal closes
  useEffect(() => {
    if (!showUserPicker) {
      setSearchQuery('');
      setRecipients([]);
      setSelectedIds([]);
      setActiveChats([]);
      if (searchTimeout) {
        clearTimeout(searchTimeout);
        setSearchTimeout(null);
      }
    }
  }, [showUserPicker]);

  // Load recipients - merges active group chats with suggested/searched users
  const loadUsers = async (query: string = '', chats?: any[]) => {
    setIsLoadingUsers(true);
    const effectiveChats = chats !== undefined ? chats : activeChats;
    try {
      const trimmedQuery = query.trim().toLowerCase();

      // Build group chat items, filtered by query if present
      const groupItems: RecipientItem[] = effectiveChats
        .filter((c: any) => c.type === 'connect_page' && c.connectPageId)
        .filter((c: any) =>
          !trimmedQuery || c.connectPageId.name.toLowerCase().includes(trimmedQuery)
        )
        .map((c: any): RecipientItem => ({
          _id: c._id,
          fullName: c.connectPageId.name,
          profilePic: c.connectPageId.profileImage,
          isGroup: true,
          subtitle: 'Connect Group',
          chatId: c._id,
        }));

      let userItems: RecipientItem[] = [];

      if (!trimmedQuery || trimmedQuery.length < 2) {
        // No/short query: show suggested users
        try {
          const suggestedResponse = await getSuggestedUsers(50);
          if (suggestedResponse.users && suggestedResponse.users.length > 0) {
            userItems = suggestedResponse.users.map((u: any): RecipientItem => ({
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
              userItems = (response.data.users || []).map((u: any): RecipientItem => ({
                _id: u._id,
                fullName: u.fullName || u.username || 'User',
                profilePic: u.profilePic,
                username: u.username,
                isGroup: false,
              }));
            }
          } catch {
            // ignore
          }
        }
      } else {
        // Search query: search users via API
        try {
          const response = await searchUsers(trimmedQuery, 1, 100);
          userItems = (response.users || []).map((u: any): RecipientItem => ({
            _id: u._id,
            fullName: u.fullName || u.username || 'User',
            profilePic: u.profilePic,
            username: u.username,
            isGroup: false,
          }));
        } catch {
          // ignore
        }
      }

      setRecipients([...groupItems, ...userItems]);
    } catch (error: any) {
      logger.error('Error loading recipients:', error);
      setRecipients([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Debounced search when query changes
  useEffect(() => {
    if (!showUserPicker) return;
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      loadUsers(searchQuery, activeChats);
    }, 300);
    setSearchTimeout(timeout);
    return () => { clearTimeout(timeout); };
  }, [searchQuery, showUserPicker]);

  // Fetch chats + load initial recipients when picker opens
  useEffect(() => {
    if (!showUserPicker) return;
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
  }, [showUserPicker]);

  // Toggle a recipient in/out of the selection
  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Send post or journey to ALL selected recipients in parallel
  const handleSendToRecipients = async () => {
    if (selectedIds.length === 0 || (!post?._id && !journey?._id)) return;
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

      const targets = recipients.filter((r) => selectedIds.includes(r._id));

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
      setSelectedIds([]);

      setTimeout(() => {
        onClose();
        setTimeout(() => {
          Alert.alert(
            'Sent!',
            `${isJourneyShare ? 'Journey' : 'Post'} sent to ${targets.length} ${
              targets.length === 1 ? 'recipient' : 'recipients'
            }!`
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
      animationType="none"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheet
          ref={bottomSheetRef}
          index={visible ? 0 : -1}
          snapPoints={snapPoints}
          enablePanDownToClose
          onChange={handleSheetChanges}
          backdropComponent={renderBackdrop}
          backgroundStyle={{ backgroundColor: theme.colors.surface }}
          handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
        >
          <BottomSheetView style={styles.modalContent}>
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
                        <LoadingGlobe size="small" color={theme.colors.primary} />
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
                        <LoadingGlobe size="small" color={theme.colors.primary} />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            <View style={styles.shareGrid}>
              {/* Native Share */}
              <TouchableOpacity
                style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
                onPress={handleNativeShare}
              >
                <Ionicons name="share-outline" size={28} color={theme.colors.primary} />
                <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                  Share
                </Text>
              </TouchableOpacity>

              {/* Instagram */}
              <TouchableOpacity
                style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
                onPress={handleInstagramShare}
              >
                <Ionicons name="logo-instagram" size={28} color="#E4405F" />
                <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                  Instagram
                </Text>
              </TouchableOpacity>

              {/* Facebook */}
              <TouchableOpacity
                style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
                onPress={handleFacebookShare}
              >
                <Ionicons name="logo-facebook" size={28} color="#1877F2" />
                <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                  Facebook
                </Text>
              </TouchableOpacity>

              {/* Twitter */}
              <TouchableOpacity
                style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
                onPress={handleTwitterShare}
              >
                <Ionicons name="logo-twitter" size={28} color="#1DA1F2" />
                <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                  Twitter
                </Text>
              </TouchableOpacity>

              {/* Send to Chat */}
              <TouchableOpacity
                style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
                onPress={handleSendToChat}
              >
                <Ionicons name="chatbubble-outline" size={28} color={theme.colors.primary} />
                <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                  Send to Chat
                </Text>
              </TouchableOpacity>
            </View>

            {/* Copy Link Button (Full-width row) */}
            <TouchableOpacity
              style={[styles.copyLinkButton, { backgroundColor: theme.colors.background }]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.copyLinkText, { color: theme.colors.text }]}>
                Copy Link
              </Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheet>
      </GestureHandlerRootView>

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
                placeholder="Search people & groups..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Recipients List */}
            {isLoadingUsers ? (
              <View style={styles.loadingContainer}>
                <LoadingGlobe size="large" color={theme.colors.primary} />
              </View>
            ) : (
              <FlatList
                data={recipients}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const isSelected = selectedIds.includes(item._id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.userItem,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary + '18'
                            : theme.colors.background,
                        },
                      ]}
                      onPress={() => toggleRecipient(item._id)}
                      disabled={isSendingMessage}
                      activeOpacity={0.7}
                    >
                      {item.isGroup ? (
                        <View style={[styles.userAvatar, { backgroundColor: theme.colors.primary + '22' }]}>
                          <Ionicons name="chatbubbles" size={22} color={theme.colors.primary} />
                        </View>
                      ) : item.profilePic ? (
                        <Image source={{ uri: item.profilePic }} style={styles.userAvatar} />
                      ) : (
                        <View style={[styles.userAvatar, { backgroundColor: theme.colors.border }]}>
                          <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: theme.colors.text }]}>
                          {item.fullName}
                        </Text>
                        {item.subtitle ? (
                          <Text style={[styles.userUsername, { color: theme.colors.primary }]}>
                            {item.subtitle}
                          </Text>
                        ) : item.username ? (
                          <Text style={[styles.userUsername, { color: theme.colors.textSecondary }]}>
                            @{item.username}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.checkCircle,
                          {
                            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                            backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
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
                contentContainerStyle={{ paddingBottom: selectedIds.length > 0 ? 90 : 20 }}
              />
            )}

            {/* Floating Send Button */}
            {selectedIds.length > 0 && (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSendToRecipients}
                disabled={isSendingMessage}
                activeOpacity={0.85}
              >
                {isSendingMessage ? (
                  <LoadingGlobe size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.sendButtonText}>
                      Send{selectedIds.length > 1 ? ` to ${selectedIds.length}` : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});


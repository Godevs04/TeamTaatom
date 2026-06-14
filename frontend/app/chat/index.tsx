import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Platform, Image, Alert, Dimensions } from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Image as ExpoImage } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useRouter, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { matchGradientLocations } from '../../utils/linearGradient';
import logger from '../../utils/logger';
import { getPostById } from '../../services/posts';
import ChatMediaViewer from '../../components/chat/ChatMediaViewer';
import { CloudSkyBackground, CloudChatCommandHeader } from '../../components/cloud';
import { isChatDarkMode } from '../../utils/chatTheme';

// Clear push notification badge and dismiss tray notifications when messages are read.
const clearChatNotifications = () => {
  Notifications.setBadgeCountAsync(0).catch(() => {});
  Notifications.dismissAllNotificationsAsync().catch(() => {});
};

// Helper function to normalize IDs from various formats (string, ObjectId, Buffer)
const idCache = new Map<any, string | null>();
const normalizeId = (id: any): string | null => {
  if (!id) return null;
  
  if (typeof id === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      return id;
    }
    return id;
  }

  if (idCache.has(id)) {
    return idCache.get(id)!;
  }
  
  const result = (() => {
    if (id._id) {
      return normalizeId(id._id);
    }
    
    if (id.buffer && typeof id.buffer === 'object') {
      try {
        const bufferObj = id.buffer;
        const bytes: number[] = [];
        for (let i = 0; i < 12; i++) {
          const byte = bufferObj[i] ?? bufferObj[String(i)];
          if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
            bytes.push(byte);
          }
        }
        if (bytes.length === 12) {
          const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
          if (/^[0-9a-fA-F]{24}$/.test(hex)) {
            return hex;
          }
        }
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error converting buffer to hex', { error, id });
        }
      }
    }
    
    if (typeof id === 'object' && !Array.isArray(id)) {
      const keys = Object.keys(id);
      if (keys.length >= 12 && keys.every(k => /^\d+$/.test(k) && parseInt(k) < 12)) {
        try {
          const bytes: number[] = [];
          for (let i = 0; i < 12; i++) {
            const byte = id[i] ?? id[String(i)];
            if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
              bytes.push(byte);
            }
          }
          if (bytes.length === 12) {
            const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
            if (/^[0-9a-fA-F]{24}$/.test(hex)) {
              return hex;
            }
          }
        } catch (error) {
          if (__DEV__) {
            logger.debug('Error converting direct buffer to hex', { error, id });
          }
        }
      }
    }
    
    if (id.toString && typeof id.toString === 'function') {
      try {
        const str = id.toString();
        if (typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str)) {
          return str;
        }
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error calling toString on ID:', error);
        }
      }
    }
    
    try {
      const str = String(id);
      if (/^[0-9a-fA-F]{24}$/.test(str)) {
        return str;
      }
    } catch (error) {
      if (__DEV__) {
        logger.debug('Error converting ID to string:', error);
      }
    }
    
    return null;
  })();

  idCache.set(id, result);
  return result;
};

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

export default function ChatModal() {
  logger.debug('ChatModal rendered');
  const { theme, mode } = useTheme();
  const isDark = isChatDarkMode(mode, theme.colors.background);
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation<any>();

  // Restore local state for conversations
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const conversationsRef = useRef<any[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  // Keep track of locally marked read message IDs
  const locallyMarkedSeenMessageIdsRef = React.useRef<Set<string>>(new Set());
  // Keep track of the timestamp when "Mark all as read" was executed
  const markAllAsReadTimeRef = React.useRef<number>(0);

  // Intercept query params userId / chatId and redirect immediately to thread view
  const redirectInfoRef = React.useRef<{ checked: boolean; willRedirect: boolean; chatId?: string }>({
    checked: false,
    willRedirect: false,
  });

  if (!redirectInfoRef.current.checked) {
    const { consumePendingChatRoomId } = require('../../utils/connectChatBridge');
    const pendingChatId = consumePendingChatRoomId();
    const willRedirect = Boolean(params.userId || params.chatId || pendingChatId);
    redirectInfoRef.current = {
      checked: true,
      willRedirect,
      chatId: pendingChatId || undefined,
    };
  }

  useEffect(() => {
    if (redirectInfoRef.current.willRedirect) {
      const redirectParams = { ...params };
      if (redirectInfoRef.current.chatId && !params.chatId) {
        redirectParams.chatId = redirectInfoRef.current.chatId;
      }
      logger.debug('[CHAT LIST] Redirecting parameters to thread view:', redirectParams);
      router.replace({ pathname: '/chat/thread', params: redirectParams });
    }
  }, [params.userId, params.chatId]);

  const applyOptimisticReadState = useCallback((chats: any[]) => {
    return chats.map((chat: any) => {
      const myId = normalizeId(chat.me);
      const isGroup = chat.type === 'connect_page';
      const updatedMessages = (chat.messages || []).map((m: any) => {
        const msgId = normalizeId(m._id);
        const msgTime = m.timestamp ? new Date(m.timestamp).getTime() : 0;
        
        const shouldBeRead = (msgId && locallyMarkedSeenMessageIdsRef.current.has(msgId)) ||
                             (markAllAsReadTimeRef.current > 0 && msgTime <= markAllAsReadTimeRef.current);
        
        if (shouldBeRead) {
          const senderId = normalizeId(m.sender?._id || m.sender);
          if (!senderId || !myId || senderId === myId) return m;

          if (isGroup) {
            const currentSeenBy = Array.isArray(m.seenBy)
              ? (m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean) as string[])
              : [];
            if (myId && !currentSeenBy.includes(myId)) {
              return { ...m, seenBy: [...currentSeenBy, myId] };
            }
            return m;
          }

          if (m.seen === false || m.seen === undefined || m.seen === null) {
            return { ...m, seen: true };
          }
        }
        return m;
      });
      return { ...chat, messages: updatedMessages };
    });
  }, []);

  const parsePostShare = (text: string) => {
    if (!text || !text.startsWith('[POST_SHARE]')) return null;
    try {
      const data = text.replace('[POST_SHARE]', '');
      const parts = data.split('|');
      if (parts.length >= 3) {
        return {
          postId: parts[0],
          imageUrl: parts[1] || '',
          shareUrl: parts[2] || '',
          caption: parts[3] || '',
          authorName: parts[4] || ''
        };
      }
    } catch (error) {
      logger.error('Error parsing post share:', error);
    }
    return null;
  };

  // Component for chat list post thumbnail with fresh URL fetching
  const ChatListPostThumbnail = React.memo(({ imageUrl, postId, authorName, theme }: {
    imageUrl?: string;
    postId?: string;
    authorName?: string;
    theme: any;
  }) => {
    const [displayUrl, setDisplayUrl] = useState<string | null>(imageUrl?.trim() || null);
    const [imageError, setImageError] = useState(false);
    const hasTriedFetchRef = useRef(false);

    // Fetch fresh image URL if original fails or is missing
    const fetchFreshImage = useCallback(async () => {
      if (!postId || hasTriedFetchRef.current) return;
      hasTriedFetchRef.current = true;
      try {
        logger.debug('Fetching fresh thumbnail URL for chat list post:', postId);
        const response = await getPostById(postId);
        const newImageUrl = response.post?.imageUrl || response.post?.images?.[0];
        if (newImageUrl && newImageUrl.trim()) {
          setDisplayUrl(newImageUrl.trim());
          setImageError(false);
        } else {
          setImageError(true);
        }
      } catch (error) {
        logger.debug('Failed to fetch fresh thumbnail URL for chat list:', error);
        setImageError(true);
      }
    }, [postId]);

    useEffect(() => {
      setDisplayUrl(imageUrl?.trim() || null);
      setImageError(false);
      hasTriedFetchRef.current = false;
    }, [imageUrl, postId]);

    useEffect(() => {
      if (postId && (!displayUrl || displayUrl === '') && !hasTriedFetchRef.current) {
        fetchFreshImage();
      }
    }, [postId, displayUrl, fetchFreshImage]);

    return (
      <View style={styles.chatListPostPreview}>
        {displayUrl && displayUrl.trim() && !imageError ? (
          <Image
            source={{ uri: displayUrl }}
            style={styles.chatListPostThumbnail}
            resizeMode="cover"
            onError={() => {
              logger.debug('Chat list thumbnail failed to load, trying to fetch fresh URL');
              setImageError(true);
              if (postId && !hasTriedFetchRef.current) {
                fetchFreshImage();
              }
            }}
          />
        ) : (
          <View style={[styles.chatListPostThumbnail, styles.chatListPostThumbnailPlaceholder]}>
            <Ionicons name="image-outline" size={16} color={theme.colors.textSecondary} />
          </View>
        )}
        <View style={styles.chatListPostText}>
          {authorName && (
            <Text style={styles.chatListPostAuthor} numberOfLines={1}>
              {authorName}
            </Text>
          )}
          <View style={styles.chatListPostFooter}>
            <Ionicons name="link-outline" size={12} color={theme.colors.textSecondary} />
            <Text style={styles.chatListPostLink} numberOfLines={1}>
              View Post
            </Text>
          </View>
        </View>
      </View>
    );
  });

  // Reusable function to refresh chat list
  const refreshChatList = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      let myUserId = '';
      if (userData) {
        try { myUserId = JSON.parse(userData)._id; } catch {}
      }
      const { getApiBaseUrl } = require('../../utils/config');
      const API_BASE_URL = getApiBaseUrl();
      const res = await fetch(`${API_BASE_URL}/chat`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (data?.success) {
        let chats = (data.chats || []).map((chat: any) => ({ ...chat, me: myUserId }));
        chats = applyOptimisticReadState(chats);
        const chatMap = new Map<string, any>();
        chats.forEach((chat: any) => {
          let key;
          if (chat.type === 'connect_page') {
            key = `connect_page_${chat._id}`;
          } else {
            const participantIds = chat.participants
              .map((p: any) => (p._id ? p._id.toString() : p.toString()))
              .sort()
              .join('_');
            key = chat.type === 'admin_support' ? `admin_support_${myUserId}` : participantIds;
          }
          if (!chatMap.has(key) || new Date(chat.updatedAt) > new Date(chatMap.get(key).updatedAt)) {
            chatMap.set(key, chat);
          }
        });
        const uniqueChats = Array.from(chatMap.values());
        uniqueChats.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setConversations(uniqueChats);
      }
    } catch (err: any) {
      logger.error('refreshChatList error:', err?.message || err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applyOptimisticReadState]);

  // Fetch chat conversations and following users
  useFocusEffect(
    useCallback(() => {
      const loadChats = async () => {
        if (conversationsRef.current.length === 0) {
          setLoading(true);
        }
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        let myUserId = '';
        if (userData) {
          try {
            myUserId = JSON.parse(userData)._id;
          } catch {}
        }
        const { getApiBaseUrl } = require('../../utils/config');
        const API_BASE_URL = getApiBaseUrl();
        
        try {
          const res = await fetch(`${API_BASE_URL}/chat`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          const data = await res.json();
          let chats = data?.chats || [];
          chats = chats.map((chat: any) => ({
            ...chat,
            me: myUserId,
          }));
          chats = applyOptimisticReadState(chats);
          
          const chatMap = new Map<string, any>();
          chats.forEach((chat: any) => {
            let key;
            if (chat.type === 'connect_page') {
              key = `connect_page_${chat._id}`;
            } else {
              const participantIds = chat.participants
                .map((p: any) => (p?._id ? p._id.toString() : p?.toString() || ''))
                .sort()
                .join('_');
              key = chat.type === 'admin_support' ? `admin_support_${myUserId}` : participantIds;
            }
            if (!chatMap.has(key) || new Date(chat.updatedAt) > new Date(chatMap.get(key).updatedAt)) {
              chatMap.set(key, chat);
            }
          });
          const uniqueChats = Array.from(chatMap.values());
          uniqueChats.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setConversations(uniqueChats);
        } catch (e) {
          logger.error('Error fetching chats:', e);
        } finally {
          setLoading(false);
        }
      };

      const loadFollowers = async () => {
        try {
          const userData = await AsyncStorage.getItem('userData');
          let myUserId = '';
          if (userData) {
            try {
              myUserId = JSON.parse(userData)._id;
            } catch {}
          }
          if (!myUserId) return;

          const [followingRes, followersRes] = await Promise.all([
            api.get(`/api/v1/profile/${myUserId}/following`),
            api.get(`/api/v1/profile/${myUserId}/followers`)
          ]);

          const followingList = followingRes.data?.users || [];
          const followersList = followersRes.data?.users || [];

          // Merge lists and deduplicate by _id
          const combined = [...followingList, ...followersList];
          const uniqueUsersMap = new Map();
          combined.forEach((u: any) => {
            if (u && u._id) {
              uniqueUsersMap.set(u._id.toString(), u);
            }
          });

          setUsers(Array.from(uniqueUsersMap.values()));
        } catch (err: any) {
          logger.error('Error loading followers:', err?.message || err);
        }
      };

      loadChats();
      loadFollowers();
    }, [applyOptimisticReadState])
  );

  // Subscribe to real-time chat:update to refresh conversation list items
  useEffect(() => {
    const handleChatUpdate = (payload: any) => {
      if (!payload || !payload.chatId) return;
      
      setConversations(prev => {
        const chatIndex = prev.findIndex(c => normalizeId(c._id) === normalizeId(payload.chatId));
        if (chatIndex === -1) {
          refreshChatList();
          return prev;
        }
        
        const updatedChat = { ...prev[chatIndex] };
        const syntheticMsg = {
          _id: payload.messageId || `temp_${Date.now()}`,
          text: payload.text || '',
          sender: payload.senderId,
          timestamp: payload.timestamp || new Date().toISOString(),
          seen: false,
        };
        updatedChat.messages = [...(updatedChat.messages || []), syntheticMsg];
        updatedChat.updatedAt = payload.timestamp || new Date().toISOString();
        
        const newConversations = prev.filter((_, i) => i !== chatIndex);
        return [updatedChat, ...newConversations];
      });
    };

    socketService.subscribe('chat:update', handleChatUpdate);
    return () => {
      socketService.unsubscribe('chat:update', handleChatUpdate);
    };
  }, [refreshChatList]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    const totalUnread = conversations.reduce((count, chat) => {
      const currentUserId = normalizeId(chat.me);
      const isGroupChat = (chat as any).type === 'connect_page';
      const unreadCount = chat.messages?.filter((m: any) => {
        if (!m || !m.sender) return false;
        const senderId = normalizeId(m.sender?._id || m.sender);
        if (!senderId || !currentUserId || senderId === currentUserId) return false;
        if (isGroupChat) {
          if (Array.isArray(m.seenBy) && currentUserId && m.seenBy.some((id: any) => normalizeId(id) === currentUserId)) return false;
          return true;
        }
        if (m.seen === true) return false;
        return m.seen === false || m.seen === undefined || m.seen === null;
      }).length || 0;
      return count + unreadCount;
    }, 0);

    if (totalUnread === 0) {
      Alert.alert(
        'All Read',
        'All messages are already marked as read.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Mark All as Read',
      `Are you sure you want to mark all ${totalUnread} unread message${totalUnread > 1 ? 's' : ''} as read?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Mark All as Read',
          onPress: async () => {
            markAllAsReadTimeRef.current = Date.now();

            setConversations(prev => prev.map(chat => {
              const myId = normalizeId(chat.me);
              const isGroup = (chat as any).type === 'connect_page';
              const updatedMessages = (chat.messages || []).map((m: any) => {
                const senderId = normalizeId(m.sender?._id || m.sender);
                if (!senderId || !myId || senderId === myId) return m;

                const msgId = normalizeId(m._id);
                if (msgId) {
                  locallyMarkedSeenMessageIdsRef.current.add(msgId);
                }

                if (isGroup) {
                  const currentSeenBy = Array.isArray(m.seenBy)
                    ? m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean)
                    : [];
                  if (!currentSeenBy.includes(myId)) currentSeenBy.push(myId);
                  return { ...m, seenBy: currentSeenBy };
                }

                if (m.seen === false || m.seen === undefined || m.seen === null) {
                  return { ...m, seen: true };
                }
                return m;
              });
              return { ...chat, messages: updatedMessages };
            }));

            try {
              const updatePromises = conversations.map(async (chat) => {
                const isGroup = (chat as any).type === 'connect_page';

                if (isGroup) {
                  try {
                    await api.post(`/chat/room/${chat._id}/mark-all-seen`);
                  } catch (error) {
                    logger.debug(`Failed to mark group messages as seen for chat ${chat._id}:`, error);
                  }
                } else {
                  const other = chat.participants.find((u: any) => {
                    const uId = normalizeId(u?._id || u);
                    const meId = normalizeId(chat.me);
                    return uId && meId && uId !== meId;
                  });

                  if (other) {
                    const otherId = normalizeId(other?._id || other);
                    if (otherId) {
                      try {
                        await api.post(`/chat/${otherId}/mark-all-seen`);
                      } catch (error) {
                        logger.debug(`Failed to mark messages as seen for chat ${chat._id}:`, error);
                      }
                    }
                  }
                }
              });

              await Promise.allSettled(updatePromises);

              Alert.alert(
                'Success',
                `All ${totalUnread} message${totalUnread > 1 ? 's' : ''} marked as read.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              logger.error('Error marking all messages as read:', error);
              Alert.alert(
                'Error',
                'Failed to mark all messages as read. Please try again.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  }, [conversations]);

  if (redirectInfoRef.current.willRedirect) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingGlobe color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.error, fontSize: 16 }}>{error}</Text>
      </SafeAreaView>
    );
  }

  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = a.messages?.length ? new Date(a.messages[a.messages.length-1].timestamp).getTime() : 0;
    const bTime = b.messages?.length ? new Date(b.messages[b.messages.length-1].timestamp).getTime() : 0;
    return bTime - aTime;
  });
  
  const filtered = sortedConversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    if ((c as any).type === 'connect_page' && (c as any).connectPageId?.name) {
      return (c as any).connectPageId.name.toLowerCase().includes(q);
    }
    const other = c.participants.find((u: any) => u._id !== c.me);
    return other?.fullName?.toLowerCase().includes(q);
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      ...(isWeb && {
        maxWidth: isTablet ? 1200 : 1000,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    title: {
      fontSize: isTablet ? 22 : 20,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      color: theme.colors.text,
      letterSpacing: isIOS ? -0.3 : 0,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    chatList: {
      flex: 1,
      paddingHorizontal: isTablet ? 18 : 12,
    },
    chatItemFlat: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? 18 : 14,
      paddingVertical: isTablet ? 14 : 12,
      marginBottom: 4,
      backgroundColor: 'transparent',
    },
    chatItemUnread: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? 18 : 14,
      paddingVertical: isTablet ? 14 : 12,
      borderRadius: 16,
      marginBottom: 8,
      backgroundColor: isDark ? theme.colors.glassStrong : '#FFFFFF',
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? theme.colors.glassBorder : 'transparent',
      shadowColor: isDark ? (theme.colors.glowBlue || theme.colors.primary) : 'rgba(43, 127, 212, 0.18)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 6,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: isTablet ? 14 : 12,
    },
    avatar: {
      width: isTablet ? 56 : 50,
      height: isTablet ? 56 : 50,
      borderRadius: isTablet ? 28 : 25,
      borderWidth: 2,
      borderColor: isDark ? theme.colors.glassBorder : 'rgba(255,255,255,0.72)',
    },
    avatarPlaceholder: {
      width: isTablet ? 56 : 50,
      height: isTablet ? 56 : 50,
      borderRadius: isTablet ? 28 : 25,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.62)',
    },
    chatContent: {
      flex: 1,
      justifyContent: 'center',
    },
    chatTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    chatBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    chatName: {
      fontSize: 15,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      color: theme.colors.text,
      flexShrink: 1,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    chatNameUnread: {
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
    },
    chatTime: {
      fontSize: isTablet ? 12 : 11,
      fontFamily: getFontFamily('400'),
      fontWeight: '400',
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    connectBadge: {
      backgroundColor: theme.colors.primary + '18',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.primary + '24',
    },
    connectBadgeText: {
      fontSize: 10,
      fontWeight: '600',
    },
    lastMessage: {
      fontSize: 13,
      fontFamily: getFontFamily('400'),
      color: theme.colors.textSecondary,
      fontWeight: '400',
      lineHeight: 17,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    lastMessageUnread: {
      fontFamily: getFontFamily('500'),
      fontWeight: '500',
      color: theme.colors.text,
    },
    unreadBadge: {
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginLeft: 8,
      overflow: 'hidden',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    },
    unreadText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 16,
      width: 108,
      height: 108,
      borderRadius: 54,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? theme.colors.glassSurface : 'rgba(255,255,255,0.42)',
      borderWidth: 1,
      borderColor: isDark ? theme.colors.glassBorder : 'rgba(255,255,255,0.66)',
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    newMessageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.background === '#000000' || theme.colors.background === '#111114' ? '#07111C' : '#EAF8FF',
    },
    newMessageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: 'transparent',
    },
    newMessageTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    headerButton: {
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      borderRadius: isTablet ? 20 : 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.28)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    searchContainer: {
      paddingHorizontal: isTablet ? theme.spacing.xl : 16,
      paddingBottom: 12,
      backgroundColor: 'transparent',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background === '#000000' || theme.colors.background === '#111114'
        ? 'rgba(17, 34, 54, 0.72)'
        : 'rgba(255,255,255,0.72)',
      borderRadius: 24,
      paddingHorizontal: isTablet ? 14 : 12,
      height: isTablet ? 40 : 36,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.66)',
      shadowColor: '#65BDF7',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 5,
    },
    searchInput: {
      flex: 1,
      marginLeft: isTablet ? 10 : 8,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: getFontFamily('400'),
      fontWeight: '400',
      paddingVertical: 0,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        outlineStyle: 'none',
      } as any),
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 22,
      backgroundColor: theme.colors.background === '#000000' || theme.colors.background === '#111114'
        ? 'rgba(17, 34, 54, 0.72)'
        : 'rgba(255,255,255,0.68)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.52)',
      marginBottom: 8,
    },
    userAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
    },
    userName: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.colors.text,
    },
    chatListPostPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    chatListPostThumbnail: {
      width: 40,
      height: 40,
      borderRadius: 8,
      marginRight: 8,
      backgroundColor: theme.colors.background,
    },
    chatListPostThumbnailPlaceholder: {
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chatListPostText: {
      flex: 1,
      minWidth: 0,
    },
    chatListPostAuthor: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    chatListPostFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chatListPostLink: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
  });

  const chatGradientColors = isDark
    ? (theme.colors.screenGradient as [string, string, ...string[]])
    : (['transparent', '#F8FCFF', '#FFFFFF'] as const);
  const chatGradientLocs = matchGradientLocations(chatGradientColors.length, [0, 0.25, 1]);

  return (
    <>
      <View style={styles.container}>
        {!isDark && <CloudSkyBackground heightRatio={0.3} />}
        <LinearGradient
          colors={chatGradientColors}
          style={StyleSheet.absoluteFillObject}
          locations={chatGradientLocs}
        />
        <CloudChatCommandHeader
          title="Chats"
          search={search}
          onSearchChange={setSearch}
          onBack={() => router.back()}
          onCompose={() => setShowNewMessage(true)}
          onMarkAllRead={handleMarkAllAsRead}
        />

        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyMessage}>
              Start a conversation by tapping the compose button above
            </Text>
          </View>
        ) : (
          <FlatList
            style={styles.chatList}
            data={filtered}
            keyExtractor={item => item._id}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={15}
            renderItem={({ item }) => {
              const participants = (item.participants || []).filter((p: any) => p != null);
              let other = participants.find((u: any) => {
                const uId = normalizeId(u?._id || u);
                const meId = normalizeId(item.me);
                return uId && meId && uId !== meId;
              });
              if (!other && Array.isArray(participants) && typeof participants[0] === 'string') {
                other = participants.find((id: string) => {
                  const idNormalized = normalizeId(id);
                  const meId = normalizeId(item.me);
                  return idNormalized && meId && idNormalized !== meId;
                });
              }
              const otherUserId = normalizeId(other?._id || other);
              const currentUserId = normalizeId(item.me);
              const isGroupChat = (item as any).type === 'connect_page';

              const unreadCount = item.messages?.filter((m: any) => {
                if (!m || !m.sender) return false;
                const senderId = normalizeId(m.sender?._id || m.sender);
                if (!senderId || !currentUserId) return false;
                if (senderId === currentUserId) return false;

                if (isGroupChat) {
                  if (Array.isArray(m.seenBy) && currentUserId && m.seenBy.some((id: any) => normalizeId(id) === currentUserId)) return false;
                  return true;
                }

                if (m.seen === true) return false;
                return m.seen === false || m.seen === undefined || m.seen === null;
              }).length || 0;
              
              const isUnread = unreadCount > 0;
              return (
                <TouchableOpacity
                  style={[
                    isUnread ? styles.chatItemUnread : styles.chatItemFlat,
                    isUnread && styles.chatItemUnread,
                  ]}
                  onLongPress={() => {
                    const chatName = (item as any).type === 'connect_page' && (item as any).connectPageId?.name
                      ? (item as any).connectPageId.name
                      : other?.fullName || 'this chat';
                    Alert.alert(
                      'Delete Chat',
                      `Are you sure you want to delete the chat with "${chatName}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await api.delete(`/chat/room/${item._id}`);
                              setConversations(prev => prev.filter(c => c._id !== item._id));
                            } catch (e: any) {
                              logger.error('Error deleting chat:', e);
                              Alert.alert('Error', 'Failed to delete chat. Please try again.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                  onPress={() => {
                    if ((item as any).type === 'connect_page') {
                      router.push({ pathname: '/chat/thread', params: { chatId: item._id } });
                    } else if (otherUserId) {
                      router.push({ pathname: '/chat/thread', params: { userId: otherUserId } });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarContainer}>
                    {(item as any).type === 'connect_page' && (item as any).connectPageId?.profileImage ? (
                      <ExpoImage source={{ uri: (item as any).connectPageId.profileImage }} style={styles.avatar} cachePolicy="memory-disk" placeholder={require('../../assets/avatars/male_avatar.png')} />
                    ) : other && other.profilePic ? (
                      <ExpoImage source={{ uri: other.profilePic }} style={styles.avatar} cachePolicy="memory-disk" placeholder={require('../../assets/avatars/male_avatar.png')} />
                    ) : (item as any).type === 'connect_page' ? (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                        <Ionicons name="people" size={22} color={theme.colors.primary} />
                      </View>
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                        <Ionicons name="person" size={22} color={theme.colors.textSecondary} />
                      </View>
                    )}
                  </View>

                  <View style={styles.chatContent}>
                    <View style={styles.chatTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
                        <Text style={[styles.chatName, unreadCount > 0 && styles.chatNameUnread]} numberOfLines={1}>
                          {(item as any).type === 'connect_page' && (item as any).connectPageId?.name
                            ? (item as any).connectPageId.name
                            : other ? String(other.fullName || other._id || other) : '[No other user found]'}
                        </Text>
                        {(item as any).type === 'connect_page' && (
                          <LinearGradient
                            colors={['#1C73B4', '#50C878']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.connectBadge, { borderWidth: 0 }]}
                          >
                            <Text style={[styles.connectBadgeText, { color: '#FFFFFF' }]}>Connect</Text>
                          </LinearGradient>
                        )}
                      </View>
                      <Text style={[styles.chatTime, unreadCount > 0 && { color: theme.colors.primary }]}>
                        {(() => {
                          const lastMsg = item.messages?.[item.messages.length - 1];
                          if (!lastMsg?.timestamp) return '';
                          const d = new Date(lastMsg.timestamp);
                          const now = new Date();
                          const diffMs = now.getTime() - d.getTime();
                          const diffDays = Math.floor(diffMs / 86400000);
                          if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          if (diffDays === 1) return 'Yesterday';
                          if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
                          return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        })()}
                      </Text>
                    </View>
                    <View style={styles.chatBottomRow}>
                      <View style={{ flex: 1 }}>
                        {(item as any).type === 'connect_page' && (() => {
                          const lastMsg = item.messages?.[item.messages.length - 1];
                          if (!lastMsg) return null;
                          const senderId = normalizeId(lastMsg.sender?._id || lastMsg.sender);
                          const senderName = lastMsg.senderName || (participants.find((p: any) => normalizeId(p?._id || p) === senderId)?.fullName) || '';
                          if (senderName) {
                            return (
                              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 2 }} numberOfLines={1}>
                                {senderName}:
                              </Text>
                            );
                          }
                          return null;
                        })()}
                        {(() => {
                          const lastMsg = item.messages?.[item.messages.length - 1];
                          if (!lastMsg) return null;
                          const text = lastMsg.text || '';
                          const postShare = parsePostShare(text);
                          if (postShare) {
                            return <ChatListPostThumbnail imageUrl={postShare.imageUrl} postId={postShare.postId} authorName={postShare.authorName} theme={theme} />;
                          }
                          const hasAttachments = lastMsg.attachments && lastMsg.attachments.length > 0;
                          let previewText = text;
                          if (hasAttachments && !text) {
                            const firstType = lastMsg.attachments[0]?.type || 'file';
                            previewText = `📎 Sent a ${firstType}`;
                          }
                          return (
                            <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                              {previewText}
                            </Text>
                          );
                        })()}
                      </View>
                      {unreadCount > 0 && (
                        <LinearGradient
                          colors={['#1C73B4', '#50C878']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.unreadBadge}
                        >
                          <Text style={styles.unreadText}>{unreadCount}</Text>
                        </LinearGradient>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>

      {/* Compose / New Message Sheet */}
      {showNewMessage && (
        <SafeAreaView edges={['top']} style={styles.newMessageOverlay}>
          <View style={styles.newMessageHeader}>
            <Text style={styles.newMessageTitle}>New Message</Text>
            <TouchableOpacity 
              onPress={() => setShowNewMessage(false)} 
              style={styles.headerButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search followers..."
                placeholderTextColor={theme.colors.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>
          
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <FlatList
              data={search.trim() ? users.filter(u => u.fullName.toLowerCase().includes(search.trim().toLowerCase())) : users}
              keyExtractor={item => item._id}
              removeClippedSubviews={true}
              initialNumToRender={15}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userItem}
                  onPress={() => {
                    setShowNewMessage(false);
                    router.push({ pathname: '/chat/thread', params: { userId: item._id } });
                  }}
                  activeOpacity={0.7}
                >
                  {item.profilePic ? (
                    <ExpoImage source={{ uri: item.profilePic }} style={styles.userAvatar} cachePolicy="memory-disk" placeholder={require('../../assets/avatars/male_avatar.png')} />
                  ) : (
                    <Ionicons name="person-circle" size={48} color={theme.colors.textSecondary} style={{ marginRight: 16 }} />
                  )}
                  <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">
                    {String(item.fullName || '')}
                  </Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </SafeAreaView>
      )}
      <ChatMediaViewer isGlobal />
    </>
  );
}

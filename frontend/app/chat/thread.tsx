import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Image, Alert, Dimensions, Keyboard, Linking } from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Image as ExpoImage } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useRouter, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { callService } from '../../services/callService';
import CallScreen from '../../components/CallScreen';
import ThreeDotMenu from '../../components/ThreeDotMenu';
import { toggleBlockUser, getBlockStatus } from '../../services/profile';
import { clearChat, toggleMuteChat, getMuteStatus, ChatAttachment } from '../../services/chat';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';
import { sanitizeErrorForDisplay } from '../../utils/errorSanitizer';
import { getPostById } from '../../services/posts';
import ChatAttachmentPicker from '../../components/chat/ChatAttachmentPicker';
import ChatAttachmentPreview from '../../components/chat/ChatAttachmentPreview';
import MessageAttachment from '../../components/chat/MessageAttachment';
import ChatMediaViewer from '../../components/chat/ChatMediaViewer';
import {
  CloudSkyBackground,
  CloudChatCommandHeader,
  CloudChatConversationHeader,
  CloudInputDock,
  CloudAvatarStack,
} from '../../components/cloud';
import {
  createCloudChatBubbleStyles,
  CHAT_BUBBLE_MAX_WIDTH,
} from '../../components/cloud/cloudChatBubbleStyles';
import { cloudDesign } from '../../constants/cloudDesign';
import { isChatDarkMode } from '../../utils/chatTheme';

// Clear push notification badge and dismiss tray notifications when messages are read.
// Works for both Firebase (FCM) and Expo notification channels.
const clearChatNotifications = () => {
  Notifications.setBadgeCountAsync(0).catch(() => {});
  Notifications.dismissAllNotificationsAsync().catch(() => {});
};

// Helper function to normalize IDs from various formats (string, ObjectId, Buffer)
const normalizeId = (id: any): string | null => {
  if (!id) return null;
  
  if (typeof id === 'string') {
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      return id;
    }
    return id;
  }
  
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
};

// Responsive dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) {
    return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }
  if (isIOS) {
    return 'System';
  }
  return 'Roboto';
};

function ChatWindow({ otherUser, onClose, messages, onSendMessage, chatId, chatType, connectPageId, participants, onVoiceCall, onVideoCall, isCalling, showGlobalCallScreen, globalCallState, setShowGlobalCallScreen, setGlobalCallState, forceRender, setForceRender, router, onClearChat, onMessagesSeen }: {
  otherUser: any,
  onClose: () => void,
  messages: any[],
  onSendMessage: (msg: any) => void,
  chatId: string,
  chatType?: string,
  connectPageId?: any,
  participants?: any[],
  onVoiceCall: (user: any) => void,
  onVideoCall: (user: any) => void,
  isCalling: boolean,
  showGlobalCallScreen: boolean,
  globalCallState: any,
  setShowGlobalCallScreen: (show: boolean) => void,
  setGlobalCallState: (state: any) => void,
  forceRender: number,
  setForceRender: (fn: (prev: number) => number) => void,
  router: any,
  onClearChat?: () => void,
  onMessagesSeen?: (chatId: string, seenMessageIds: string[]) => void
}) {
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = isChatDarkMode(mode, theme.colors.background);
  const bubbleStyles = useMemo(
    () => createCloudChatBubbleStyles(isDark, theme),
    [isDark, theme]
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const isTaatomOfficial = otherUser?.isVerified === true && 
    (otherUser?.fullName === 'Taatom Official' || otherUser?.username === 'taatom_official');
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const parsePostShare = (text: string) => {
    if (!text || !text.startsWith('[POST_SHARE]')) return null;
    try {
      const data = text.replace('[POST_SHARE]', '');
      const parts = data.split('|');
      if (parts.length >= 3) {
        const imageUrl = (parts[1] || '').trim();
        const result = {
          postId: parts[0] || '',
          imageUrl: imageUrl,
          shareUrl: parts[2] || '',
          caption: parts[3] || '',
          authorName: parts[4] || ''
        };
        return result;
      }
    } catch (error) {
      logger.error('Error parsing post share:', error);
    }
    return null;
  };

  const parseJourneyShare = (text: string) => {
    if (!text || !text.startsWith('[JOURNEY_SHARE]')) return null;
    try {
      const data = text.replace('[JOURNEY_SHARE]', '');
      const parts = data.split('|');
      if (parts.length >= 3) {
        return {
          journeyId: parts[0] || '',
          shareUrl: parts[1] || '',
          title: parts[2] || 'Journey',
          distance: parts[3] || '',
          status: parts[4] || 'completed',
        };
      }
    } catch (error) {
      logger.error('Error parsing journey share:', error);
    }
    return null;
  };

  const handleJourneyPreviewClick = (journeyId: string) => {
    if (router && journeyId) {
      router.push(`/navigate/detail?journeyId=${journeyId}`);
    }
  };

  const handlePostPreviewClick = async (shareUrl: string, postId: string) => {
    try {
      if (router && postId) {
        try {
          const response = await getPostById(postId);
          const post = response.post || response;
          const isShort = post.type === 'short' || 
                         (post.videoUrl && !post.imageUrl) || 
                         (post.mediaUrl && post.type === 'short');
          
          if (isShort) {
            router.push(`/(tabs)/shorts?shortId=${postId}`);
          } else {
            router.push(`/(tabs)/home?postId=${postId}`);
          }
        } catch (fetchError) {
          logger.debug('Failed to fetch post details, defaulting to home:', fetchError);
          router.push(`/(tabs)/home?postId=${postId}`);
        }
      } else if (shareUrl) {
        try {
          const deepLink = `taatom://home`;
          await Linking.openURL(deepLink);
        } catch (deepLinkError) {
          try {
            await Linking.openURL(shareUrl);
          } catch (linkError) {
            logger.error('Error opening share URL:', linkError);
          }
        }
      }
    } catch (error) {
      logger.error('Error opening post:', error);
      if (shareUrl) {
        try {
          await Linking.openURL(shareUrl);
        } catch (linkError) {
          logger.error('Error opening share URL:', linkError);
        }
      }
    }
  };
  
  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUserId(user._id);
        }
      } catch (e) {
        logger.error('Error getting current user ID:', e);
      }
    };
    getCurrentUserId();
  }, []);

  const PostShareThumbnail = React.memo(({ imageUrl, postId, isOwn, theme }: {
    imageUrl?: string;
    postId?: string;
    isOwn: boolean;
    theme: any;
  }) => {
    const [displayUrl, setDisplayUrl] = useState<string | null>(imageUrl?.trim() || null);
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const hasTriedFetchRef = useRef(false);

    const fetchFreshImage = useCallback(async () => {
      if (!postId || hasTriedFetchRef.current || isLoading) return;
      hasTriedFetchRef.current = true;
      setIsLoading(true);
      try {
        const response = await getPostById(postId);
        const newImageUrl = response.post?.imageUrl || response.post?.images?.[0];
        if (newImageUrl && newImageUrl.trim()) {
          setDisplayUrl(newImageUrl.trim());
          setImageError(false);
        } else {
          setImageError(true);
        }
      } catch (error) {
        logger.debug('Failed to fetch fresh thumbnail URL:', error);
        setImageError(true);
      } finally {
        setIsLoading(false);
      }
    }, [postId, isLoading]);

    useEffect(() => {
      setDisplayUrl(imageUrl?.trim() || null);
      setImageError(false);
      hasTriedFetchRef.current = false;
      setIsLoading(false);
    }, [imageUrl, postId]);

    useEffect(() => {
      if (postId && (!displayUrl || displayUrl === '') && !hasTriedFetchRef.current) {
        fetchFreshImage();
      }
    }, [postId, displayUrl, fetchFreshImage]);

    if (displayUrl && displayUrl.trim() && !imageError) {
      return (
        <Image
          source={{ uri: displayUrl }}
          style={styles.postShareThumbnail}
          resizeMode="cover"
          onError={() => {
            setImageError(true);
            if (postId && !hasTriedFetchRef.current) {
              fetchFreshImage();
            }
          }}
          onLoadEnd={() => {
            setImageError(false);
          }}
        />
      );
    }

    if (isLoading) {
      return (
        <LoadingGlobe 
          size="small" 
          color={isOwn ? 'rgba(255,255,255,0.7)' : theme.colors.primary} 
        />
      );
    }

    return (
      <Ionicons 
        name="image" 
        size={20} 
        color={isOwn ? 'rgba(255,255,255,0.9)' : theme.colors.primary} 
      />
    );
  });

  const PostPreviewImage = React.memo(({ imageUrl, postId, isOwn, theme }: { 
    imageUrl?: string; 
    postId?: string; 
    isOwn: boolean;
    theme: any;
  }) => {
    const [imageError, setImageError] = useState(false);
    const [freshImageUrl, setFreshImageUrl] = useState<string | null>(null);
    const hasTriedFetchRef = useRef(false);

    const fetchFreshImage = useCallback(async () => {
      if (!postId || hasTriedFetchRef.current) return;
      hasTriedFetchRef.current = true;
      try {
        const response = await getPostById(postId);
        const newImageUrl = response.post?.imageUrl || response.post?.images?.[0];
        if (newImageUrl) {
          setFreshImageUrl(newImageUrl);
          setImageError(false);
        }
      } catch (error) {
        logger.debug('Failed to fetch fresh image URL:', error);
      }
    }, [postId]);

    useEffect(() => {
      setImageError(false);
      hasTriedFetchRef.current = false;
      setFreshImageUrl(null);
    }, [imageUrl, postId]);

    const displayUrl = freshImageUrl || imageUrl;
    const hasValidUrl = displayUrl && displayUrl.trim();

    if (!hasValidUrl || imageError) {
      if (postId && !hasTriedFetchRef.current && imageError) {
        fetchFreshImage();
      }
      
      return (
        <View style={[styles.postPreviewImageWrapper, styles.postPreviewImagePlaceholder]}>
          <Ionicons name="image-outline" size={32} color={isOwn ? 'rgba(255,255,255,0.5)' : theme.colors.textSecondary} />
        </View>
      );
    }

    return (
      <View style={styles.postPreviewImageWrapper}>
        <Image
          source={{ uri: displayUrl.trim() }}
          style={styles.postPreviewImage}
          resizeMode="cover"
          onError={() => {
            setImageError(true);
            if (postId && !hasTriedFetchRef.current) {
              fetchFreshImage();
            }
          }}
          onLoadEnd={() => {
            setImageError(false);
          }}
        />
      </View>
    );
  });

  const getUserName = (userId: string): string => {
    if (userId === 'test_user_id') {
      return 'Test User';
    }
    return otherUser?.fullName || 'Unknown User';
  };

  const resolvedProfilePic = useMemo(() => {
    if (otherUser?.profilePic) return otherUser.profilePic;
    if (participants && Array.isArray(participants)) {
      const match = participants.find((p: any) => {
        const pId = normalizeId(p?._id || p);
        const otherId = normalizeId(otherUser?._id);
        return pId && otherId && pId === otherId;
      });
      if (match?.profilePic) return match.profilePic;
    }
    return null;
  }, [otherUser?.profilePic, otherUser?._id, participants]);

  useEffect(() => {
    if (isTaatomOfficial) {
      setIsOnline(true);
    }
  }, [isTaatomOfficial]);

  useEffect(() => {
    const fetchStatuses = async () => {
      if (otherUser?._id) {
        try {
          const [blockStatus, muteStatus] = await Promise.all([
            getBlockStatus(otherUser._id),
            getMuteStatus(otherUser._id),
          ]);
          setIsBlocked(blockStatus.isBlocked);
          setIsMuted(muteStatus.muted);
        } catch (error) {
          logger.error('Error fetching statuses:', error);
        }
      }
    };
    fetchStatuses();
  }, [otherUser?._id]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const onSendMessageRef = useRef(onSendMessage);
  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  const [localMessages, setLocalMessages] = useState<any[]>([]);
  
  useEffect(() => {
    setLocalMessages([]);
    isInitialLoadRef.current = true;
    prevMessageCountRef.current = 0;
  }, [chatId]);
  
  const messagesLength = Array.isArray(messages) ? messages.length : 0;
  const messagesFirstId = messages.length > 0 ? normalizeId(messages[0]?._id) : '';
  const localMessagesLength = Array.isArray(localMessages) ? localMessages.length : 0;
  const localMessagesFirstId = localMessages.length > 0 ? normalizeId(localMessages[0]?._id) : '';
  const localMessagesSeenCount = localMessages.filter(m => m.seen === true).length;
  const messagesSeenCount = Array.isArray(messages) ? messages.filter((m: any) => m.seen === true).length : 0;

  const allMessages = React.useMemo(() => {
    const messagesArray = Array.isArray(messages) ? messages : [];
    const localMessagesArray = Array.isArray(localMessages) ? localMessages : [];
    const merged = [...localMessagesArray, ...messagesArray];
    const seen = new Set<string>();
    const deduplicated = merged.filter(msg => {
      if (!msg || !msg._id) return false;
      const id = normalizeId(msg._id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const sorted = deduplicated.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
    return sorted;
  }, [messagesLength, messagesFirstId, localMessagesLength, localMessagesFirstId, localMessagesSeenCount, messagesSeenCount]);
  
  const sortedMessages = allMessages;
  const sortedMessagesRef = React.useRef<any[]>([]);
  sortedMessagesRef.current = sortedMessages;

  useEffect(() => {
    let isMounted = true;
    
    const onMessageNew = (payload: any) => {
      if (!isMounted) return;
      if (!payload || !payload.message) return;
      
      const payloadChatId = normalizeId(payload.chatId);
      const currentChatId = normalizeId(chatId);
      
      if (payloadChatId && currentChatId && payloadChatId === currentChatId) {
        const messageId = normalizeId(payload.message?._id);
        if (!messageId) return;
        
        const existsInProps = messages.some((m: any) => {
          const msgId = normalizeId(m._id);
          return msgId && messageId && msgId === messageId;
        });
        
        if (!existsInProps) {
          setLocalMessages(prev => {
            const existsInLocal = prev.find(m => {
              const msgId = normalizeId(m._id);
              return msgId && messageId && msgId === messageId;
            });
            if (existsInLocal) return prev;
            return [...prev, payload.message];
          });
          
          try {
            onSendMessageRef.current(payload.message);
          } catch (error) {
            logger.error('[ChatWindow] Error calling parent callback', error);
          }
        }
        
        if ((window as any).messageFallbackTimeout) {
          clearTimeout((window as any).messageFallbackTimeout);
          (window as any).messageFallbackTimeout = null;
        }
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    };

    const onMessageSent = (payload: any) => {
      if (!isMounted) return;
      if (!payload || !payload.message) return;
      
      const payloadChatId = normalizeId(payload.chatId);
      const currentChatId = normalizeId(chatId);
      
      if (payloadChatId && currentChatId && payloadChatId === currentChatId) {
        setLocalMessages(prev => {
          const filtered = prev.filter(m => {
            const msgId = normalizeId(m._id);
            const payloadId = normalizeId(payload.message._id);
            if (m.isOptimistic && m.text === payload.message.text && 
                String(m.sender) === String(payload.message.sender)) {
              return false;
            }
            if (msgId && payloadId && msgId === payloadId) {
              return false;
            }
            return true;
          });
          
          const exists = filtered.some(m => {
            const msgId = normalizeId(m._id);
            const payloadId = normalizeId(payload.message._id);
            return msgId && payloadId && msgId === payloadId;
          });
          
          if (!exists) {
            return [...filtered, payload.message];
          }
          return filtered;
        });
        
        if ((window as any).messageFallbackTimeout) {
          clearTimeout((window as any).messageFallbackTimeout);
          (window as any).messageFallbackTimeout = null;
        }
        
        onSendMessageRef.current(payload.message);
      }
    };

    const onTyping = (payload: any) => {
      if (payload.from === otherUser._id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    };

    const onSeen = (payload: any) => {
      const isGroupChat = chatType === 'connect_page';

      if (isGroupChat) {
        const messageId = payload.messageId;
        const fromUserId = normalizeId(payload.from);
        const incomingSeenBy = Array.isArray(payload.seenBy) ? payload.seenBy : [];

        if (messageId && fromUserId) {
          setLocalMessages(prev =>
            prev.map(m => {
              if (normalizeId(m._id) === normalizeId(messageId)) {
                const currentSeenBy = Array.isArray(m.seenBy) ? m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean) as string[] : [];
                if (incomingSeenBy.length > 0) {
                  for (const id of incomingSeenBy) {
                    const nId = normalizeId(id);
                    if (nId && !currentSeenBy.includes(nId)) currentSeenBy.push(nId);
                  }
                } else if (fromUserId && !currentSeenBy.includes(fromUserId)) {
                  currentSeenBy.push(fromUserId);
                }
                return { ...m, seenBy: currentSeenBy };
              }
              return m;
            })
          );

          if (onMessagesSeen && chatId) {
            onMessagesSeen(chatId, [messageId]);
          }
        }
      } else if (normalizeId(payload.from) === normalizeId(otherUser._id)) {
        setLastSeenId(payload.messageId);
        const otherUserId = normalizeId(otherUser._id);
        const ownMessageIds = sortedMessagesRef.current
          .filter(m => {
            const senderId = normalizeId(m.sender?._id || m.sender);
            return senderId && otherUserId && senderId !== otherUserId;
          })
          .map(m => normalizeId(m._id))
          .filter(Boolean);

        setLocalMessages(prev =>
          prev.map(m => {
            const senderId = normalizeId(m.sender?._id || m.sender);
            if (senderId && otherUserId && senderId !== otherUserId && !m.seen) {
              return { ...m, seen: true };
            }
            return m;
          })
        );

        if (onMessagesSeen && chatId && ownMessageIds.length > 0) {
          onMessagesSeen(chatId, ownMessageIds);
        }
      }
    };

    const onOnline = (payload: any) => {
      if (payload.userId === otherUser._id && !isTaatomOfficial) setIsOnline(true);
    };

    const onOffline = (payload: any) => {
      if (payload.userId === otherUser._id && !isTaatomOfficial) setIsOnline(false);
    };
    
    socketService.subscribe('message:new', onMessageNew);
    socketService.subscribe('message:sent', onMessageSent);
    socketService.subscribe('typing', onTyping);
    socketService.subscribe('seen', onSeen);
    socketService.subscribe('user:online', onOnline);
    socketService.subscribe('user:offline', onOffline);
    
    const ensureConnection = async () => {
      try {
        await socketService.connect();
      } catch (e) {
        logger.error('[ChatWindow] Error ensuring socket connection:', e);
      }
    };
    ensureConnection();
    
    return () => {
      isMounted = false;
      socketService.unsubscribe('message:new', onMessageNew);
      socketService.unsubscribe('message:sent', onMessageSent);
      socketService.unsubscribe('typing', onTyping);
      socketService.unsubscribe('seen', onSeen);
      socketService.unsubscribe('user:online', onOnline);
      socketService.unsubscribe('user:offline', onOffline);
      
      if ((window as any).messageFallbackTimeout) {
        clearTimeout((window as any).messageFallbackTimeout);
        (window as any).messageFallbackTimeout = null;
      }
      setLocalMessages([]);
    };
  }, [otherUser?._id, chatId, onSendMessage]);
  
  const prevMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const hasScrolledToEndRef = useRef(false);

  useEffect(() => {
    const currentCount = allMessages.length;
    if (currentCount > prevMessageCountRef.current && flatListRef.current) {
      const wasInitialLoad = isInitialLoadRef.current;
      if (wasInitialLoad) {
        isInitialLoadRef.current = false;
      }
      prevMessageCountRef.current = currentCount;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      const delay = wasInitialLoad ? 300 : 100;
      scrollTimeoutRef.current = setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: !wasInitialLoad });
        }
        scrollTimeoutRef.current = null;
      }, delay);
    } else if (currentCount !== prevMessageCountRef.current) {
      prevMessageCountRef.current = currentCount;
    }
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [allMessages.length]);

  const handleInput = (text: string) => {
    setInput(text);
    socketService.emit('typing', { to: otherUser._id });
  };

  const hasMarkedAsSeenRef = useRef(false);
  const chatIdRef = useRef(chatId);
  const markSeenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (chatIdRef.current !== chatId) {
      hasMarkedAsSeenRef.current = false;
      chatIdRef.current = chatId;
      if (markSeenTimeoutRef.current) {
        clearTimeout(markSeenTimeoutRef.current);
        markSeenTimeoutRef.current = null;
      }
    }
  }, [chatId]);

  useEffect(() => {
    const isGroupChat = chatType === 'connect_page';
    if (sortedMessages.length > 0 && !hasMarkedAsSeenRef.current && chatId) {
      const myId = normalizeId(currentUserId);
      const unseen = sortedMessages.filter(m => {
        const senderId = normalizeId(m.sender?._id || m.sender);
        if (isGroupChat) {
          if (senderId === myId) return false;
          if (Array.isArray(m.seenBy) && myId && m.seenBy.some((id: any) => normalizeId(id) === myId)) return false;
          return true;
        }
        const otherUserId = normalizeId(otherUser._id);
        return senderId && otherUserId && senderId === otherUserId && !m.seen;
      });

      if (unseen.length > 0) {
        if (markSeenTimeoutRef.current) {
          clearTimeout(markSeenTimeoutRef.current);
        }

        markSeenTimeoutRef.current = setTimeout(() => {
          if (!hasMarkedAsSeenRef.current) {
            unseen.forEach(msg => {
              if (isGroupChat) {
                socketService.emit('seen', { messageId: msg._id, chatId });
              } else {
                socketService.emit('seen', { to: otherUser._id, messageId: msg._id, chatId });
              }
            });

            if (isGroupChat) {
              api.post(`/chat/room/${chatId}/mark-all-seen`).catch(e => {
                logger.debug('Failed to mark group messages as seen in backend:', e);
              });
            } else {
              api.post(`/chat/${otherUser._id}/mark-all-seen`).catch(e => {
                logger.debug('Failed to mark messages as seen in backend:', e);
              });
            }
            clearChatNotifications();

            setLocalMessages(prev => prev.map(m => {
              const msgId = normalizeId(m._id);
              const isUnseen = unseen.some(u => normalizeId(u._id) === msgId);
              if (isUnseen) {
                if (isGroupChat && myId) {
                  const currentSeenBy = Array.isArray(m.seenBy)
                    ? (m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean) as string[])
                    : [];
                  if (!currentSeenBy.includes(myId)) currentSeenBy.push(myId);
                  return { ...m, seenBy: currentSeenBy };
                }
                return { ...m, seen: true };
              }
              return m;
            }));

            if (onMessagesSeen && chatId) {
              onMessagesSeen(chatId, unseen.map(u => normalizeId(u._id)));
            }

            hasMarkedAsSeenRef.current = true;
          }
        }, 3000);
      }
    }
    
    return () => {
      if (markSeenTimeoutRef.current) {
        clearTimeout(markSeenTimeoutRef.current);
        markSeenTimeoutRef.current = null;
        if (!hasMarkedAsSeenRef.current && chatId) {
          const myId = normalizeId(currentUserId);
          const isGroup = chatType === 'connect_page';
          const unseenNow = sortedMessagesRef.current.filter((m: any) => {
            const senderId = normalizeId(m.sender?._id || m.sender);
            if (isGroup) {
              if (senderId === myId) return false;
              if (Array.isArray(m.seenBy) && myId && m.seenBy.some((id: any) => normalizeId(id) === myId)) return false;
              return true;
            }
            const otherUserIdNorm = normalizeId(otherUser._id);
            return senderId && otherUserIdNorm && senderId === otherUserIdNorm && !m.seen;
          });
          if (unseenNow.length > 0) {
            if (isGroup) {
              api.post(`/chat/room/${chatId}/mark-all-seen`).catch(() => {});
            } else {
              api.post(`/chat/${otherUser._id}/mark-all-seen`).catch(() => {});
            }
            clearChatNotifications();
            if (onMessagesSeen && chatId) {
              onMessagesSeen(chatId, unseenNow.map((u: any) => normalizeId(u._id)));
            }
            hasMarkedAsSeenRef.current = true;
          }
        }
      }
    };
  }, [sortedMessages, otherUser, chatId, chatType, currentUserId]);

  const markMessagesAsSeenIfNeeded = useCallback(() => {
    if (hasMarkedAsSeenRef.current) return;

    const myId = normalizeId(currentUserId);
    const isGroup = chatType === 'connect_page';

    const unseen = sortedMessages.filter(m => {
      const senderId = normalizeId(m.sender?._id || m.sender);
      if (isGroup) {
        if (senderId === myId) return false;
        if (Array.isArray(m.seenBy) && myId && m.seenBy.some((id: any) => normalizeId(id) === myId)) return false;
        return true;
      }
      const otherUserId = normalizeId(otherUser._id);
      return senderId && otherUserId && senderId === otherUserId && !m.seen;
    });

    if (unseen.length > 0) {
      unseen.forEach(msg => {
        if (isGroup) {
          socketService.emit('seen', { messageId: msg._id, chatId });
        } else {
          socketService.emit('seen', { to: otherUser._id, messageId: msg._id, chatId });
        }
      });

      if (isGroup) {
        api.post(`/chat/room/${chatId}/mark-all-seen`).catch(e => {
          logger.debug('Failed to mark group messages as seen in backend:', e);
        });
      } else {
        api.post(`/chat/${otherUser._id}/mark-all-seen`).catch(e => {
          logger.debug('Failed to mark messages as seen in backend:', e);
        });
      }
      clearChatNotifications();

      setLocalMessages(prev => prev.map(m => {
        const msgId = normalizeId(m._id);
        const isUnseen = unseen.some(u => normalizeId(u._id) === msgId);
        if (isUnseen) {
          if (isGroup && myId) {
            const currentSeenBy = Array.isArray(m.seenBy)
              ? (m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean) as string[])
              : [];
            if (!currentSeenBy.includes(myId)) currentSeenBy.push(myId);
            return { ...m, seenBy: currentSeenBy };
          }
          return { ...m, seen: true };
        }
        return m;
      }));

      if (onMessagesSeen && chatId) {
        onMessagesSeen(chatId, unseen.map(u => normalizeId(u._id)));
      }

      hasMarkedAsSeenRef.current = true;

      if (markSeenTimeoutRef.current) {
        clearTimeout(markSeenTimeoutRef.current);
        markSeenTimeoutRef.current = null;
      }
    }
  }, [sortedMessages, otherUser, chatId]);

  const handleSend = async () => {
    if (!input.trim() && pendingAttachments.length === 0) return;
    const messageText = input;
    const attachmentsToSend = [...pendingAttachments];
    
    markMessagesAsSeenIfNeeded();
    
    let currentUserId = '';
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        currentUserId = JSON.parse(userData)._id;
      }
    } catch (e) {
      logger.error('Error getting user ID:', e);
    }
    
    const optimisticMessage = {
      _id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: messageText,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      sender: currentUserId,
      timestamp: new Date().toISOString(),
      seen: false,
      isOptimistic: true,
    };

    onSendMessage(optimisticMessage);
    setInput('');
    setPendingAttachments([]);
    
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      const isGroupChat = chatType === 'connect_page';
      const endpoint = isGroupChat
        ? `/chat/room/${chatId}/messages`
        : `/chat/${otherUser._id}/messages`;
      const payload: { text?: string; attachments?: ChatAttachment[] } = {};
      if (messageText) payload.text = messageText;
      if (attachmentsToSend.length > 0) payload.attachments = attachmentsToSend;
      const res = await api.post(endpoint, payload);
      
      if ((window as any).messageFallbackTimeout) {
        clearTimeout((window as any).messageFallbackTimeout);
        (window as any).messageFallbackTimeout = null;
      }
      
      const fallbackTimeout = setTimeout(() => {
        const messageExists = messages.some((m: any) => m._id === res.data.message._id);
        if (!messageExists) {
          onSendMessage(res.data.message);
        }
      }, 300);
      
      (window as any).messageFallbackTimeout = fallbackTimeout;
      
    } catch (e) {
      logger.error('Error sending message:', e);
      setInput(messageText);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
      ...(isWeb && {
        maxWidth: isTablet ? 1200 : 1000,
        alignSelf: 'center',
        width: '100%',
      } as any),
    },
    chatHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? theme.spacing.lg : 8,
      paddingVertical: isTablet ? 10 : 8,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.border,
    },
    headerBack: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    headerUserInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 4,
    },
    headerAvatarWrap: {
      position: 'relative',
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatar: {
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      borderRadius: isTablet ? 20 : 18,
    },
    headerAvatarPlaceholder: {
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      borderRadius: isTablet ? 20 : 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: isTablet ? 12 : 10,
      height: isTablet ? 12 : 10,
      borderRadius: isTablet ? 6 : 5,
      backgroundColor: '#4cd137',
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    headerCenter: {
      flex: 1,
      justifyContent: 'center',
      marginLeft: isTablet ? 10 : 8,
      minWidth: 0,
    },
    chatName: {
      fontSize: isTablet ? 17 : 16,
      fontFamily: getFontFamily('600'),
      fontWeight: '600',
      color: theme.colors.text,
      flexShrink: 1,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    onlineStatus: {
      fontSize: isTablet ? 12 : 11,
      fontFamily: getFontFamily('400'),
      fontWeight: '400',
      marginTop: 1,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    headerActionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActionButtonDisabled: {
      opacity: 0.5,
    },
    messagesContainer: {
      flex: 1,
      paddingHorizontal: isTablet ? theme.spacing.lg : 12,
      backgroundColor: theme.colors.background,
    },
    bubble: {
      marginVertical: isTablet ? 3 : 2,
      paddingHorizontal: isTablet ? 14 : 12,
      paddingVertical: isTablet ? 8 : 7,
      borderRadius: isTablet ? 18 : 16,
      maxWidth: isTablet ? '70%' : '78%',
    },
    bubbleOwn: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderBottomLeftRadius: 4,
    },
    bubbleText: {
      color: theme.colors.text,
      fontSize: isTablet ? 15 : 15,
      fontFamily: getFontFamily('400'),
      lineHeight: isTablet ? 21 : 20,
      fontWeight: '400',
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    bubbleOwnText: {
      color: '#fff',
    },
    bubbleTime: {
      fontSize: isTablet ? 10 : 10,
      fontFamily: getFontFamily('400'),
      marginTop: 2,
      textAlign: 'right',
      opacity: 0.6,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    bubbleOwnTime: {
      color: '#fff',
    },
    bubbleOtherTime: {
      color: theme.colors.textSecondary,
    },
    typingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 12,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      alignSelf: 'flex-start',
    },
    typingText: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontStyle: 'italic',
      marginLeft: 6,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: isTablet ? theme.spacing.lg : 8,
      paddingTop: isTablet ? 8 : 6,
      paddingBottom: Math.max(isTablet ? 10 : 10, insets.bottom > 0 ? insets.bottom : 12),
      backgroundColor: theme.colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border || 'rgba(0,0,0,0.08)',
    },
    attachButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: isTablet ? 22 : 20,
      paddingHorizontal: isTablet ? 14 : 14,
      paddingVertical: isTablet ? 6 : 6,
      marginRight: isTablet ? 8 : 6,
      minHeight: isTablet ? 42 : 38,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: isTablet ? 15 : 15,
      fontFamily: getFontFamily('400'),
      lineHeight: isTablet ? 20 : 20,
      maxHeight: 100,
      paddingVertical: 0,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        outlineStyle: 'none',
      } as any),
    },
    sendButton: {
      width: isTablet ? 42 : 38,
      height: isTablet ? 42 : 38,
      borderRadius: isTablet ? 21 : 19,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isWeb && {
        cursor: 'pointer',
      } as any),
    },
    sendButtonDisabled: {
      backgroundColor: theme.colors.textSecondary,
    },
    typingDotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginHorizontal: 1.5,
    },
    postPreviewContainer: {
      width: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 4,
      backgroundColor: 'transparent',
    },
    postPreviewImageWrapper: {
      width: '100%',
      height: 200,
      backgroundColor: theme.colors.background,
      overflow: 'hidden',
    },
    postPreviewImage: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.background,
    },
    postPreviewImagePlaceholder: {
      width: '100%',
      height: 200,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: 'dashed',
    },
    postPreviewContent: {
      padding: 12,
      backgroundColor: 'transparent',
      paddingTop: 8,
    },
    postPreviewAuthor: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    postPreviewAuthorOwn: {
      color: '#fff',
    },
    postPreviewCaption: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 8,
      lineHeight: 18,
    },
    postPreviewCaptionOwn: {
      color: 'rgba(255,255,255,0.9)',
    },
    postPreviewFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    postPreviewLink: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    postPreviewLinkOwn: {
      color: 'rgba(255,255,255,0.9)',
    },
    postShareMessageContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      width: '100%',
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    postShareIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
      marginTop: 2,
      overflow: 'hidden',
    },
    postShareThumbnail: {
      width: '100%',
      height: '100%',
      borderRadius: 18,
    },
    postShareTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    postShareAuthor: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    postShareAuthorOwn: {
      color: '#fff',
    },
    postShareCaption: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 6,
      lineHeight: 20,
    },
    postShareCaptionOwn: {
      color: 'rgba(255,255,255,0.9)',
    },
    postShareFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    postShareLink: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    postShareLinkOwn: {
      color: 'rgba(255,255,255,0.95)',
    },
  });
  return (
    <>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
        <CloudChatConversationHeader
          title={otherUser?.fullName || 'Chat'}
          onBack={onClose}
          avatarUris={
            chatType === 'connect_page' && participants?.length
              ? participants
                  .map((p: any) => p?.profilePic)
                  .filter((u: string | undefined) => typeof u === 'string' && u.length > 0)
              : resolvedProfilePic
                ? [resolvedProfilePic]
                : []
          }
          typingText={isTyping ? 'typing…' : null}
          onTitlePress={() => {
            if (chatType === 'connect_page' && connectPageId?._id && router) {
              router.push(`/connect/page/${connectPageId._id}`);
            } else if (otherUser?._id && router) {
              router.push(`/profile/${otherUser._id}`);
            }
          }}
          rightAction={
            <ThreeDotMenu
              items={[
                {
                  label: 'View Profile',
                  icon: 'person-outline',
                  onPress: () => {
                    if (otherUser?._id && router) {
                      router.push(`/profile/${otherUser._id}`);
                    }
                  },
                },
                {
                  label: 'Clear Chat',
                  icon: 'trash-outline',
                  onPress: () => {
                    Alert.alert(
                      'Clear Chat',
                      'Are you sure you want to clear all messages in this chat? This action cannot be undone.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              if (otherUser?._id) {
                                await clearChat(otherUser._id);
                                if (onClearChat) {
                                  onClearChat();
                                }
                                Alert.alert('Success', 'Chat cleared successfully');
                              }
                            } catch (error: any) {
                              const { sanitizeErrorForDisplay } = await import('../../utils/errorSanitizer');
                              Alert.alert('Error', sanitizeErrorForDisplay(error, 'chat.clearChat'));
                            }
                          },
                        },
                      ]
                    );
                  },
                },
                {
                  label: isMuted ? 'Unmute Notifications' : 'Mute Notifications',
                  icon: isMuted ? 'notifications-outline' : 'notifications-off-outline',
                  onPress: async () => {
                    try {
                      if (otherUser?._id) {
                        const result = await toggleMuteChat(otherUser._id);
                        setIsMuted(result.muted);
                        Alert.alert('Success', result.message);
                      }
                    } catch (error: any) {
                      Alert.alert('Error', sanitizeErrorForDisplay(error, 'chat.toggleMute'));
                    }
                  },
                },
                {
                  label: isBlocked ? 'Unblock User' : 'Block User',
                  icon: 'ban-outline',
                  onPress: () => {
                    Alert.alert(
                      isBlocked ? 'Unblock User' : 'Block User',
                      isBlocked
                        ? `Are you sure you want to unblock ${otherUser?.fullName || 'this user'}?`
                        : `Are you sure you want to block ${otherUser?.fullName || 'this user'}? You won't be able to send or receive messages from them.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: isBlocked ? 'Unblock' : 'Block',
                          style: isBlocked ? 'default' : 'destructive',
                          onPress: async () => {
                            try {
                              if (otherUser?._id) {
                                const result = await toggleBlockUser(otherUser._id);
                                setIsBlocked(result.isBlocked);
                                Alert.alert('Success', result.message);
                                if (result.isBlocked) {
                                  onClose();
                                }
                              }
                            } catch (error: any) {
                              Alert.alert('Error', sanitizeErrorForDisplay(error, 'chat.updateBlockStatus'));
                            }
                          },
                        },
                      ]
                    );
                  },
                  destructive: Boolean(!isBlocked),
                },
              ]}
              iconColor={theme.colors.text}
              iconSize={20}
            />
          }
        />

        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            keyExtractor={(item, idx) => item._id || idx.toString()}
            removeClippedSubviews={true}
            maxToRenderPerBatch={15}
            windowSize={10}
            initialNumToRender={20}
            renderItem={({ item, index }) => {
              const senderId = normalizeId(item.sender?._id || item.sender);
              const otherUserId = normalizeId(otherUser?._id);
              const myUserId = normalizeId(currentUserId);

              const isGroupChat = chatType === 'connect_page';
              const isOwn = Boolean(
                (senderId && myUserId && senderId === myUserId) ||
                (!isGroupChat && senderId && otherUserId && senderId !== otherUserId && !myUserId)
              );

              let resolvedSenderName = item.senderName || '';
              let resolvedSenderPic = item.senderProfilePic || '';
              if (isGroupChat && !resolvedSenderName && senderId && participants) {
                const senderParticipant = participants.find((p: any) => normalizeId(p?._id || p) === senderId);
                if (senderParticipant) {
                  resolvedSenderName = senderParticipant.fullName || '';
                  if (!resolvedSenderPic) resolvedSenderPic = senderParticipant.profilePic || '';
                }
              }

              let showSenderInfo = false;
              if (isGroupChat && !isOwn) {
                if (index === 0) {
                  showSenderInfo = true;
                } else {
                  const prevMsg = sortedMessages[index - 1];
                  const prevSenderId = normalizeId(prevMsg?.sender?._id || prevMsg?.sender);
                  showSenderInfo = prevSenderId !== senderId;
                }
              }

              const messageTextStr = String(item.text || '');
              const postShare = parsePostShare(messageTextStr);
              const journeyShare = !postShare ? parseJourneyShare(messageTextStr) : null;

              const isSeenByAll = (() => {
                if (!isOwn) return false;
                if (!isGroupChat) return item.seen === true;
                if (Array.isArray(item.seenBy) && participants && participants.length > 0) {
                  const otherParticipantIds = participants
                    .map((p: any) => normalizeId(p?._id || p))
                    .filter((id: string | null) => id && id !== myUserId);
                  return otherParticipantIds.length > 0 && otherParticipantIds.every((pId: string) => item.seenBy.some((id: any) => normalizeId(id) === pId));
                }
                return item.seen === true;
              })();

              const BubbleWrapper = ({ children }: { children: React.ReactNode }) =>
                isOwn ? (
                  <LinearGradient
                    colors={['#1C73B4', '#50C878']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[bubbleStyles.bubbleOut, { maxWidth: CHAT_BUBBLE_MAX_WIDTH }]}
                  >
                    {children}
                  </LinearGradient>
                ) : (
                  <View style={[bubbleStyles.bubbleIn, { maxWidth: CHAT_BUBBLE_MAX_WIDTH }]}>{children}</View>
                );

              return (
                <View
                  style={[
                    bubbleStyles.messageRow,
                    { justifyContent: isOwn ? 'flex-end' : 'flex-start' },
                  ]}
                >
                  {isGroupChat && !isOwn && (
                    showSenderInfo ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => senderId && router.push(`/profile/${senderId}`)}
                        style={{ marginRight: 8, marginBottom: 2 }}
                      >
                        <ExpoImage
                          source={resolvedSenderPic ? { uri: resolvedSenderPic } : require('../../assets/avatars/male_avatar.png')}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.border }}
                          cachePolicy="memory-disk"
                          placeholder={require('../../assets/avatars/male_avatar.png')}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={bubbleStyles.avatarSpacer} />
                    )
                  )}
                  <View
                    style={[
                      bubbleStyles.bubbleColumn,
                      { alignItems: isOwn ? 'flex-end' : 'flex-start' },
                    ]}
                  >
                    {isGroupChat && !isOwn && showSenderInfo && resolvedSenderName ? (
                      <Text style={[bubbleStyles.senderName, { marginLeft: 0 }]} numberOfLines={1}>
                        {resolvedSenderName}
                      </Text>
                    ) : null}
                  <>
                    {postShare ? (
                      <BubbleWrapper>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handlePostPreviewClick(postShare.shareUrl, postShare.postId)}
                          style={styles.postShareMessageContainer}
                        >
                          <View style={[
                            styles.postShareIconContainer,
                            isOwn && { backgroundColor: 'rgba(255,255,255,0.2)' }
                          ]}>
                            <PostShareThumbnail
                              imageUrl={postShare.imageUrl}
                              postId={postShare.postId}
                              isOwn={isOwn}
                              theme={theme}
                            />
                          </View>
                          <View style={styles.postShareTextContainer}>
                            {postShare.authorName && (
                              <Text style={[styles.postShareAuthor, isOwn ? styles.postShareAuthorOwn : {}]} numberOfLines={1}>
                                {postShare.authorName}
                              </Text>
                            )}
                            {postShare.caption && (
                              <Text style={[styles.postShareCaption, isOwn ? styles.postShareCaptionOwn : {}]} numberOfLines={2}>
                                {postShare.caption}
                              </Text>
                            )}
                            <View style={styles.postShareFooter}>
                              <Ionicons name="link-outline" size={14} color={isOwn ? 'rgba(255,255,255,0.8)' : theme.colors.primary} />
                              <Text style={[styles.postShareLink, isOwn ? styles.postShareLinkOwn : {}]} numberOfLines={1}>
                                View Post
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          marginTop: 2,
                          gap: 3,
                        }}>
                          <Text style={isOwn ? bubbleStyles.timeOut : bubbleStyles.timeIn}>
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Text>
                          {isOwn && (
                            <View>
                              {isSeenByAll ? (
                                <Ionicons name="checkmark-done" size={13} color="#fff" style={{ opacity: 0.8 }} />
                              ) : (
                                <Ionicons name="checkmark" size={13} color="#fff" style={{ opacity: 0.6 }} />
                              )}
                            </View>
                          )}
                        </View>
                      </BubbleWrapper>
                    ) : journeyShare ? (
                      <BubbleWrapper>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => handleJourneyPreviewClick(journeyShare.journeyId)}
                          style={styles.postShareMessageContainer}
                        >
                          <View style={[
                            styles.postShareIconContainer,
                            { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : '#22C55E15' }
                          ]}>
                            <Ionicons name="navigate" size={28} color={isOwn ? '#fff' : '#22C55E'} />
                          </View>
                          <View style={styles.postShareTextContainer}>
                            <Text style={[styles.postShareAuthor, isOwn ? styles.postShareAuthorOwn : {}]} numberOfLines={1}>
                              {journeyShare.title}
                            </Text>
                            {journeyShare.distance ? (
                              <Text style={[styles.postShareCaption, isOwn ? styles.postShareCaptionOwn : {}]} numberOfLines={1}>
                                {journeyShare.distance} • {journeyShare.status.charAt(0).toUpperCase() + journeyShare.status.slice(1)}
                              </Text>
                            ) : null}
                            <View style={styles.postShareFooter}>
                              <Ionicons name="map-outline" size={14} color={isOwn ? 'rgba(255,255,255,0.8)' : '#22C55E'} />
                              <Text style={[styles.postShareLink, isOwn ? styles.postShareLinkOwn : { color: '#22C55E' }]} numberOfLines={1}>
                                View Journey
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          marginTop: 2,
                          gap: 3,
                        }}>
                          <Text style={isOwn ? bubbleStyles.timeOut : bubbleStyles.timeIn}>
                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </Text>
                          {isOwn && (
                            <View>
                              {isSeenByAll ? (
                                <Ionicons name="checkmark-done" size={13} color="#fff" style={{ opacity: 0.8 }} />
                              ) : (
                                <Ionicons name="checkmark" size={13} color="#fff" style={{ opacity: 0.6 }} />
                              )}
                            </View>
                          )}
                        </View>
                      </BubbleWrapper>
                    ) : (
                      <View>
                        {item.attachments && item.attachments.length > 0 && (
                          <View style={{ marginBottom: item.text ? 4 : 0 }}>
                            {item.attachments.map((att: any, attIdx: number) => (
                              <MessageAttachment
                                key={attIdx}
                                attachment={att}
                                isOwnMessage={isOwn}
                              />
                            ))}
                          </View>
                        )}
                        {(item.text || (!item.text && (!item.attachments || item.attachments.length === 0))) ? (
                          <BubbleWrapper>
                            {item.text ? (
                              <Text style={isOwn ? bubbleStyles.textOut : bubbleStyles.textIn}>
                                {String(item.text)}
                              </Text>
                            ) : null}
                            <View style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              marginTop: 2,
                              gap: 3,
                            }}>
                              <Text style={isOwn ? bubbleStyles.timeOut : bubbleStyles.timeIn}>
                                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </Text>
                              {isOwn && (
                                <View>
                                  {isSeenByAll ? (
                                    <Ionicons name="checkmark-done" size={13} color="#fff" style={{ opacity: 0.8 }} />
                                  ) : (
                                    <Ionicons name="checkmark" size={13} color="#fff" style={{ opacity: 0.6 }} />
                                  )}
                                </View>
                              )}
                            </View>
                          </BubbleWrapper>
                        ) : (
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            marginTop: 4,
                            gap: 3,
                          }}>
                            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'right' }}>
                              {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                            {isOwn && (
                              <View>
                                {isSeenByAll ? (
                                  <Ionicons name="checkmark-done" size={13} color={theme.colors.primary} style={{ opacity: 0.8 }} />
                                ) : (
                                  <Ionicons name="checkmark" size={13} color={theme.colors.primary} style={{ opacity: 0.6 }} />
                                )}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingVertical: 16 }}
            onContentSizeChange={() => {
              if (!hasScrolledToEndRef.current && allMessages.length > 0) {
                hasScrolledToEndRef.current = true;
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 50);
              }
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>

        {isTyping && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDotsContainer}>
              <View style={[styles.typingDot, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.colors.primary }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.colors.primary }]} />
            </View>
            <Text style={styles.typingText}>typing...</Text>
          </View>
        )}

        {pendingAttachments.length > 0 && (
          <ChatAttachmentPreview
            attachments={pendingAttachments}
            onRemove={(index) => {
              setPendingAttachments(prev => prev.filter((_, i) => i !== index));
            }}
          />
        )}

        <CloudInputDock
          value={input}
          onChangeText={handleInput}
          onSend={handleSend}
          onAttach={() => setShowAttachmentPicker(true)}
          placeholder="Type a message…"
          bottomInset={Math.max(insets.bottom, 10)}
          canSend={Boolean(input.trim()) || pendingAttachments.length > 0}
        />

        <ChatAttachmentPicker
          visible={showAttachmentPicker}
          onClose={() => setShowAttachmentPicker(false)}
          onAttachmentsReady={(attachments) => {
            setPendingAttachments(prev => [...prev, ...attachments]);
          }}
        />
      </KeyboardAvoidingView>
    </View>
    
    {showGlobalCallScreen && (
      <View style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.8)'
      }}>
        {globalCallState.otherUserId ? (
          <CallScreen
            visible={showGlobalCallScreen}
            onClose={() => {
              logger.debug('📞 ChatWindow call screen onClose called');
              setShowGlobalCallScreen(false);
              if (globalCallState.isCallActive || globalCallState.isOutgoingCall) {
                callService.endCall();
              }
            }}
            otherUser={{ 
              _id: globalCallState.otherUserId, 
              fullName: getUserName(globalCallState.otherUserId),
              profilePic: otherUser?.profilePic 
            }}
          />
        ) : (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center',
            backgroundColor: '#000'
          }}>
            <Text style={{ color: 'white', fontSize: 20, marginBottom: 20 }}>
              Call Screen Loading...
            </Text>
            <Text style={{ color: 'white', fontSize: 16 }}>
              showGlobalCallScreen: {showGlobalCallScreen.toString()}
            </Text>
            <Text style={{ color: 'white', fontSize: 16 }}>
              otherUserId: {globalCallState.otherUserId || 'null'}
            </Text>
            <TouchableOpacity 
              style={{ 
                backgroundColor: 'red', 
                padding: 15, 
                borderRadius: 10, 
                marginTop: 20 
              }}
              onPress={() => {
                logger.debug('📞 Force close call screen from ChatWindow');
                setShowGlobalCallScreen(false);
              }}
            >
              <Text style={{ color: 'white', fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )}
    <ChatMediaViewer isGlobal />
    </>
  );
}

export default function ChatThreadScreen() {
  const { theme, mode } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [blockedUserId, setBlockedUserId] = useState<string | null>(null);
  const [isBlockedError, setIsBlockedError] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [activeMessages, setActiveMessages] = useState<any[]>([]);

  // Global call state
  const [globalCallState, setGlobalCallState] = useState(callService.getCallState());
  const [showGlobalCallScreen, setShowGlobalCallScreen] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [isCalling, setIsCalling] = useState(false);

  // Keep track of locally marked read message IDs
  const locallyMarkedSeenMessageIdsRef = React.useRef<Set<string>>(new Set());

  const openChatWithUser = async (userArg: any) => {
    setChatLoading(true);
    setError(null);
    try {
      let user: { _id: string; fullName?: string; profilePic?: string; username?: string } | null = null;
      if (userArg != null) {
        if (typeof userArg === 'string') {
          user = { _id: userArg };
        } else if (userArg && typeof userArg === 'object' && (userArg._id != null || userArg.id != null)) {
          user = {
            _id: String(userArg._id ?? userArg.id),
            fullName: userArg.fullName,
            profilePic: userArg.profilePic,
            username: userArg.username,
          };
        }
      }
      if (!user || !user._id) {
        setError('Cannot open chat: user not found.');
        setShowErrorAlert(true);
        setChatLoading(false);
        return;
      }
      logger.debug('Opening chat with user:', user._id);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const [blockStatusResult, chatRes, messagesRes] = await Promise.allSettled([
        getBlockStatus(user._id).catch(() => ({ isBlocked: false })),
        Promise.race([
          api.get(`/chat/${user._id}`),
          timeoutPromise
        ]),
        Promise.race([
          api.get(`/chat/${user._id}/messages`),
          timeoutPromise
        ])
      ]);
      
      const blockStatusVal = blockStatusResult as any;
      if (blockStatusVal.status === 'fulfilled' && blockStatusVal.value.isBlocked) {
        setError('You cannot chat with this user because you have blocked them. Please unblock them first.');
        setBlockedUserId(user._id);
        setIsBlockedError(true);
        setShowErrorAlert(true);
        setChatLoading(false);
        return;
      }
      
      const chatResVal = chatRes as any;
      if (chatResVal.status === 'rejected') {
        throw chatResVal.reason;
      }
      const chatData = chatResVal.value.data.chat;
      if (!chatData) {
        throw new Error('No chat data returned');
      }

      let messagesData: any[] = [];
      const messagesResVal = messagesRes as any;
      if (messagesResVal.status === 'fulfilled') {
        messagesData = messagesResVal.value.data.messages || [];
      } else {
        logger.error('[ChatWindow] Parallel messages load failed:', messagesResVal.reason);
      }
      
      setActiveChat(chatData);
      setActiveMessages(messagesData);
      setSelectedUser(user);
    } catch (e: any) {
      logger.error('Error opening chat with user:', e);
      setError(`Failed to load chat: ${e.response?.data?.message || e.message || 'Unknown error'}`);
      setShowErrorAlert(true);
    } finally {
      setLoading(false);
      setChatLoading(false);
    }
  };

  const loadChatById = async (resolvedChatId: string) => {
    setLoading(true);
    setChatLoading(true);
    setError(null);
    try {
      const [chatRes, messagesRes] = await Promise.all([
        api.get(`/chat/room/${resolvedChatId}`),
        api.get(`/chat/room/${resolvedChatId}/messages`),
      ]);

      const chat = chatRes.data.chat;
      if (!chat) throw new Error('No chat data received');

      const messages = messagesRes.data.messages || [];
      const pageInfo = chat.connectPageId;
      const syntheticUser = pageInfo
        ? { _id: resolvedChatId, fullName: pageInfo.name, profilePic: pageInfo.profileImage }
        : { _id: resolvedChatId, fullName: 'Group Chat' };

      setActiveChat(chat);
      setActiveMessages(messages);
      setSelectedUser(syntheticUser);
    } catch (e: any) {
      logger.error('Error opening chat by chatId:', e);
      setError(`Failed to load chat: ${e.response?.data?.message || e.message || 'Unknown error'}`);
      setShowErrorAlert(true);
    } finally {
      setLoading(false);
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (params.userId) {
      setLoading(true);
      setError(null);
      api.get(`/profile/${params.userId}`)
        .then(res => {
          const user = {
            _id: res.data.profile._id,
            fullName: res.data.profile.fullName,
            profilePic: res.data.profile.profilePic,
          };
          openChatWithUser(user);
        })
        .catch(e => {
          setError('User not found or you are not allowed to chat.');
          setShowErrorAlert(true);
          setLoading(false);
        });
    } else {
      const { consumePendingChatRoomId } = require('../../utils/connectChatBridge');
      const resolvedChatId = (params.chatId as string) || consumePendingChatRoomId();
      if (resolvedChatId) {
        loadChatById(resolvedChatId);
      } else {
        setError('No chat details provided.');
        setLoading(false);
      }
    }
  }, [params.userId, params.chatId]);

  useEffect(() => {
    const unsubscribe = callService.onCallStateChange((state) => {
      setGlobalCallState(state);
      if (state.otherUserId && (state.isOutgoingCall || state.isIncomingCall || state.isCallActive)) {
        setShowGlobalCallScreen(true);
      } else {
        setShowGlobalCallScreen(false);
      }
      setForceRender(p => p + 1);
    });
    return unsubscribe;
  }, []);

  const handleNewMessage = useCallback((newMsg: any) => {
    setActiveMessages(prev => {
      const msgId = normalizeId(newMsg._id);
      const isDuplicate = prev.some(m => normalizeId(m._id) === msgId);
      if (isDuplicate) return prev;
      
      const isOptimistic = newMsg.isOptimistic;
      if (isOptimistic) {
        return [...prev, newMsg];
      }
      
      const filtered = prev.filter(m => {
        if (m.isOptimistic && m.text === newMsg.text && String(m.sender) === String(newMsg.sender)) {
          return false;
        }
        return true;
      });
      return [...filtered, newMsg];
    });
  }, []);

  const handleVoiceCall = useCallback((user: any) => {
    setIsCalling(true);
    callService.startCall(user._id, 'voice')
      .then(() => setIsCalling(false))
      .catch((e) => {
        logger.error('Voice call error:', e);
        setIsCalling(false);
      });
  }, []);

  const handleVideoCall = useCallback((user: any) => {
    setIsCalling(true);
    callService.startCall(user._id, 'video')
      .then(() => setIsCalling(false))
      .catch((e) => {
        logger.error('Video call error:', e);
        setIsCalling(false);
      });
  }, []);

  const handleClose = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/chat');
    }
  };

  const handleUnblock = async () => {
    if (!blockedUserId) return;
    try {
      setChatLoading(true);
      const result = await toggleBlockUser(blockedUserId);
      if (!result.isBlocked) {
        setShowErrorAlert(false);
        setError(null);
        setIsBlockedError(false);
        
        let userToOpen: any = null;
        if (selectedUser && selectedUser._id === blockedUserId) {
          userToOpen = selectedUser;
        } else {
          try {
            const profileRes = await api.get(`/profile/${blockedUserId}`);
            userToOpen = {
              _id: profileRes.data.profile._id,
              fullName: profileRes.data.profile.fullName,
              profilePic: profileRes.data.profile.profilePic,
            };
          } catch (e) {
            logger.error('Failed to fetch user profile:', e);
          }
        }
        
        if (userToOpen) {
          setBlockedUserId(null);
          await openChatWithUser(userToOpen);
        } else {
          setBlockedUserId(null);
          setChatLoading(false);
          handleClose();
        }
      }
    } catch (error: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(error, 'chat.unblockUser'));
      setChatLoading(false);
    }
  };

  if (chatLoading || loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <LoadingGlobe color={theme.colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (error && showErrorAlert) {
    const errorStyles = StyleSheet.create({
      errorContainer: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
      },
      errorCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.xl,
        padding: 32,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      errorIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: `${theme.colors.warning}20`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
      },
      errorTitle: {
        fontSize: theme.typography.h3.fontSize,
        fontWeight: theme.typography.h3.fontWeight,
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center',
      },
      errorMessage: {
        fontSize: theme.typography.body.fontSize,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
      },
      errorButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: theme.borderRadius.md,
        minWidth: 140,
      },
      errorButtonText: {
        color: '#FFFFFF',
        fontSize: theme.typography.body.fontSize,
        fontWeight: '600',
        textAlign: 'center',
      },
      errorButtonSecondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: theme.borderRadius.md,
        minWidth: 140,
        marginTop: 12,
      },
      errorButtonSecondaryText: {
        color: theme.colors.text,
        fontSize: theme.typography.body.fontSize,
        fontWeight: '600',
        textAlign: 'center',
      },
      buttonContainer: {
        width: '100%',
        alignItems: 'center',
      },
    });

    return (
      <SafeAreaView style={errorStyles.errorContainer}>
        <View style={errorStyles.errorCard}>
          <View style={errorStyles.errorIconContainer}>
            <Ionicons name="warning" size={32} color={theme.colors.warning} />
          </View>
          <Text style={errorStyles.errorTitle}>Cannot Open Chat</Text>
          <Text style={errorStyles.errorMessage}>{error}</Text>
          <View style={errorStyles.buttonContainer}>
            {isBlockedError && blockedUserId && (
              <TouchableOpacity
                style={errorStyles.errorButton}
                onPress={handleUnblock}
                activeOpacity={0.8}
              >
                <Text style={errorStyles.errorButtonText}>Unblock User</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={isBlockedError && blockedUserId ? errorStyles.errorButtonSecondary : errorStyles.errorButton}
              onPress={() => {
                setShowErrorAlert(false);
                setError(null);
                setBlockedUserId(null);
                setIsBlockedError(false);
                handleClose();
              }}
              activeOpacity={0.8}
            >
              <Text style={isBlockedError && blockedUserId ? errorStyles.errorButtonSecondaryText : errorStyles.errorButtonText}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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

  return (
    <ChatWindow
      otherUser={selectedUser}
      onClose={handleClose}
      messages={activeMessages} 
      onSendMessage={handleNewMessage} 
      chatId={activeChat?._id}
      chatType={activeChat?.type}
      connectPageId={activeChat?.connectPageId}
      participants={activeChat?.participants}
      onVoiceCall={handleVoiceCall}
      onVideoCall={handleVideoCall}
      isCalling={isCalling}
      showGlobalCallScreen={showGlobalCallScreen}
      globalCallState={globalCallState}
      setShowGlobalCallScreen={setShowGlobalCallScreen}
      setGlobalCallState={setGlobalCallState}
      forceRender={forceRender}
      setForceRender={setForceRender}
      router={router}
      onClearChat={() => setActiveMessages([])}
      onMessagesSeen={(seenChatId, seenIds) => {
        if (Array.isArray(seenIds)) {
          seenIds.forEach(id => {
            if (id) locallyMarkedSeenMessageIdsRef.current.add(id);
          });
        }
        setActiveMessages(prev => prev.map((m: any) => {
          const msgId = normalizeId(m._id);
          if (!seenIds.includes(msgId)) return m;
          const isGroup = activeChat?.type === 'connect_page';
          if (isGroup) {
            const myId = normalizeId(activeChat?.me);
            const currentSeenBy = Array.isArray(m.seenBy) ? [...m.seenBy] : [];
            if (myId && !currentSeenBy.includes(myId)) currentSeenBy.push(myId);
            return { ...m, seenBy: currentSeenBy };
          }
          return { ...m, seen: true };
        }));
      }}
    />
  );
}

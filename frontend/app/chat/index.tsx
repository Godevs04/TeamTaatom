import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Dimensions, Keyboard, Linking } from 'react-native';
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
import { clearChat, toggleMuteChat, getMuteStatus } from '../../services/chat';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';
import { sanitizeErrorForDisplay } from '../../utils/errorSanitizer';
import { getPostById } from '../../services/posts';

// Clear push notification badge and dismiss tray notifications when messages are read.
// Works for both Firebase (FCM) and Expo notification channels.
const clearChatNotifications = () => {
  Notifications.setBadgeCountAsync(0).catch(() => {});
  Notifications.dismissAllNotificationsAsync().catch(() => {});
};

// Helper function to normalize IDs from various formats (string, ObjectId, Buffer)
// Buffer objects in React Native appear as objects with numeric keys (e.g., { '0': 104, '1': 235, ... })
const normalizeId = (id: any): string | null => {
  if (!id) return null;
  
  // If it's already a string, validate and return it
  if (typeof id === 'string') {
    // Check if it's a valid ObjectId format (24 hex characters)
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      return id;
    }
    return id; // Return even if not valid format, let caller handle it
  }
  
  // If it's an object with _id property, recurse
  if (id._id) {
    return normalizeId(id._id);
  }
  
  // If it has a buffer property (serialized Buffer from backend)
  // This handles: { buffer: { '0': 104, '1': 235, ... } }
  if (id.buffer && typeof id.buffer === 'object') {
    try {
      const bufferObj = id.buffer;
      const bytes: number[] = [];
      
      // Try to extract bytes from buffer object (can have numeric string keys)
      for (let i = 0; i < 12; i++) {
        const byte = bufferObj[i] ?? bufferObj[String(i)];
        if (byte !== undefined && typeof byte === 'number' && byte >= 0 && byte <= 255) {
          bytes.push(byte);
        }
      }
      
      if (bytes.length === 12) {
        // Convert bytes to hex string (24 characters)
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
  
  // If the object itself looks like a buffer (has numeric keys directly)
  // This handles: { '0': 104, '1': 235, ... } (direct buffer serialization)
  if (typeof id === 'object' && !Array.isArray(id)) {
    const keys = Object.keys(id);
    // Check if it looks like a buffer (has numeric keys 0-11)
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
  
  // If it has toString method
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
  
  // Last resort: try to convert to string
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
  // Render logging removed - too verbose, use React DevTools for component tracking
  
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // Check if this is Taatom Official user - using properties set by backend
  // Backend sets isVerified: true and fullName: 'Taatom Official' for Taatom Official user
  const isTaatomOfficial = otherUser?.isVerified === true && 
    (otherUser?.fullName === 'Taatom Official' || otherUser?.username === 'taatom_official');
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const flatListRef = React.useRef<FlatList>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Parse post share message
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
        
        // Debug logging
        if (__DEV__) {
          logger.debug('Parsed post share:', {
            postId: result.postId,
            hasImageUrl: !!result.imageUrl,
            imageUrlLength: result.imageUrl.length,
            imageUrlPreview: result.imageUrl ? result.imageUrl.substring(0, 50) + '...' : 'EMPTY',
          });
        }
        
        return result;
      }
    } catch (error) {
      logger.error('Error parsing post share:', error);
    }
    return null;
  };

  // Parse journey share message
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

  // Handle journey preview click
  const handleJourneyPreviewClick = (journeyId: string) => {
    if (router && journeyId) {
      router.push(`/navigate/detail?journeyId=${journeyId}`);
    }
  };

  // Handle post preview click
  const handlePostPreviewClick = async (shareUrl: string, postId: string) => {
    try {
      // Try to navigate using router first (in-app navigation)
      if (router && postId) {
        // Check if this is a short by fetching post details
        try {
          const response = await getPostById(postId);
          const post = response.post || response;
          
          // Check if post is a short (type === 'short' or has videoUrl/mediaUrl)
          const isShort = post.type === 'short' || 
                         (post.videoUrl && !post.imageUrl) || 
                         (post.mediaUrl && post.type === 'short');
          
          if (isShort) {
            // Navigate to shorts page with shortId parameter
            router.push(`/(tabs)/shorts?shortId=${postId}`);
          } else {
            // Regular post - navigate to home with postId to scroll to specific post
            router.push(`/(tabs)/home?postId=${postId}`);
          }
        } catch (fetchError) {
          // If fetching post fails, try to determine from shareUrl or default to home
          logger.debug('Failed to fetch post details, defaulting to home:', fetchError);
          router.push(`/(tabs)/home?postId=${postId}`);
        }
      } else if (shareUrl) {
        // Fallback: Try deep link or web URL
        try {
          const deepLink = `taatom://home`;
          await Linking.openURL(deepLink);
        } catch (deepLinkError) {
          // If deep link fails, try web URL
          try {
            await Linking.openURL(shareUrl);
          } catch (linkError) {
            logger.error('Error opening share URL:', linkError);
          }
        }
      }
    } catch (error) {
      logger.error('Error opening post:', error);
      // Final fallback: try web URL
      if (shareUrl) {
        try {
          await Linking.openURL(shareUrl);
        } catch (linkError) {
          logger.error('Error opening share URL:', linkError);
        }
      }
    }
  };
  
  // Get current user ID on mount
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

  // Component to handle post share thumbnail with fresh URL fetching
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

    // Fetch fresh image URL if original fails or is missing
    const fetchFreshImage = useCallback(async () => {
      if (!postId || hasTriedFetchRef.current || isLoading) return;
      
      hasTriedFetchRef.current = true;
      setIsLoading(true);
      try {
        logger.debug('Fetching fresh thumbnail URL for post:', postId);
        const response = await getPostById(postId);
        const newImageUrl = response.post?.imageUrl || response.post?.images?.[0];
        if (newImageUrl && newImageUrl.trim()) {
          logger.debug('Fresh thumbnail URL fetched successfully');
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

    // Reset when imageUrl or postId changes
    useEffect(() => {
      setDisplayUrl(imageUrl?.trim() || null);
      setImageError(false);
      hasTriedFetchRef.current = false;
      setIsLoading(false);
    }, [imageUrl, postId]);

    // Try to fetch fresh URL if original is missing
    useEffect(() => {
      if (postId && (!displayUrl || displayUrl === '') && !hasTriedFetchRef.current) {
        fetchFreshImage();
      }
    }, [postId, displayUrl, fetchFreshImage]);

    // Show image if we have a URL
    if (displayUrl && displayUrl.trim() && !imageError) {
      return (
        <Image
          source={{ uri: displayUrl }}
          style={styles.postShareThumbnail}
          resizeMode="cover"
          onError={() => {
            logger.debug('Thumbnail image failed to load, trying to fetch fresh URL');
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

    // Show loading or fallback icon
    if (isLoading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={isOwn ? 'rgba(255,255,255,0.7)' : theme.colors.primary} 
        />
      );
    }

    // Fallback icon
    return (
      <Ionicons 
        name="image" 
        size={20} 
        color={isOwn ? 'rgba(255,255,255,0.9)' : theme.colors.primary} 
      />
    );
  });

  // Component to handle post preview image with error fallback
  const PostPreviewImage = React.memo(({ imageUrl, postId, isOwn, theme }: { 
    imageUrl?: string; 
    postId?: string; 
    isOwn: boolean;
    theme: any;
  }) => {
    const [imageError, setImageError] = useState(false);
    const [freshImageUrl, setFreshImageUrl] = useState<string | null>(null);
    const hasTriedFetchRef = useRef(false);

    // Try to fetch fresh image URL if original fails
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

    // Reset error state when imageUrl or postId changes
    useEffect(() => {
      setImageError(false);
      hasTriedFetchRef.current = false;
      setFreshImageUrl(null);
    }, [imageUrl, postId]);

    const displayUrl = freshImageUrl || imageUrl;
    const hasValidUrl = displayUrl && displayUrl.trim();

    // Show placeholder if no URL or error occurred
    if (!hasValidUrl || imageError) {
      // Try to fetch fresh URL in background if we haven't tried yet and have postId
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
            logger.debug('Error loading post preview image, showing placeholder');
            setImageError(true);
            // Try to fetch fresh image URL if we have postId
            if (postId && !hasTriedFetchRef.current) {
              fetchFreshImage();
            }
          }}
          onLoadStart={() => {
            logger.debug('Post preview image loading started');
          }}
          onLoadEnd={() => {
            logger.debug('Post preview image loaded successfully');
            setImageError(false);
          }}
        />
      </View>
    );
  });

  // Get user name from user ID
  const getUserName = (userId: string): string => {
    // Handle test user ID
    if (userId === 'test_user_id') {
      return 'Test User';
    }
    
    // Return the actual other user's name
    return otherUser?.fullName || 'Unknown User';
  };

  // Always set Taatom Official as online
  useEffect(() => {
    if (isTaatomOfficial) {
      setIsOnline(true);
    }
  }, [isTaatomOfficial]);

  // Fetch block status and mute status when component mounts or otherUser changes
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

  // Auto-scroll to bottom when keyboard opens
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

  // CRITICAL: Use ref to store onSendMessage to avoid stale closures
  const onSendMessageRef = useRef(onSendMessage);
  useEffect(() => {
    onSendMessageRef.current = onSendMessage;
  }, [onSendMessage]);

  // CRITICAL: Local state to track incoming messages for instant UI updates
  // This works alongside the parent's activeMessages state to ensure real-time updates
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  
  // Clear local messages and reset scroll state when chat changes
  useEffect(() => {
    setLocalMessages([]);
    isInitialLoadRef.current = true;
    prevMessageCountRef.current = 0;
  }, [chatId]);
  
  // Track when messages prop changes (reduced logging)
  useEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_VERBOSE_DEBUG === 'true') {
      logger.debug('[ChatWindow] Messages prop changed', {
        messagesCount: messages?.length || 0
      });
    }
  }, [messages]);
  
  // Merge local messages with prop messages (deduplicated)
  // CRITICAL: Use useMemo with length-based dependencies to prevent infinite loops
  // Using length + first message ID as a stable key instead of array reference
  const messagesLength = Array.isArray(messages) ? messages.length : 0;
  const messagesFirstId = messages.length > 0 ? normalizeId(messages[0]?._id) : '';
  const localMessagesLength = Array.isArray(localMessages) ? localMessages.length : 0;
  const localMessagesFirstId = localMessages.length > 0 ? normalizeId(localMessages[0]?._id) : '';
  const localMessagesSeenCount = localMessages.filter(m => m.seen === true).length;
  const messagesSeenCount = Array.isArray(messages) ? messages.filter((m: any) => m.seen === true).length : 0;

  const allMessages = React.useMemo(() => {
    // No logging here - useMemo recalculating is normal behavior
    // Only log errors if something goes wrong
    
    // Create stable arrays to prevent unnecessary recalculations
    const messagesArray = Array.isArray(messages) ? messages : [];
    const localMessagesArray = Array.isArray(localMessages) ? localMessages : [];
    const merged = [...localMessagesArray, ...messagesArray];
    
    // Deduplicate by _id
    const seen = new Set<string>();
    const deduplicated = merged.filter(msg => {
      if (!msg || !msg._id) return false;
      const id = normalizeId(msg._id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    
    // Sort by timestamp (oldest first)
    const sorted = deduplicated.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
    
    return sorted;
  }, [messagesLength, messagesFirstId, localMessagesLength, localMessagesFirstId, localMessagesSeenCount, messagesSeenCount]); // Use stable primitives
  
  // Sort messages ascending by timestamp (oldest first)
  // Use allMessages which is already sorted
  const sortedMessages = allMessages;

  // Ref to always have current sortedMessages inside socket callbacks (avoids stale closure)
  const sortedMessagesRef = React.useRef<any[]>([]);
  sortedMessagesRef.current = sortedMessages;

  useEffect(() => {
    // CRITICAL: Ensure socket is connected and subscribed properly
    // Based on documented solution in USER_TO_USER_CHAT_SYSTEM.md
    let isMounted = true;
    
    // Subscribe to socket for new messages, typing, seen, presence
    const onMessageNew = (payload: any) => {
      if (!isMounted) return;
      
      if (__DEV__) {
        logger.debug('[ChatWindow] Received message:new event', { 
          chatId: payload?.chatId,
          messageId: payload?.message?._id,
          hasMessage: !!payload?.message 
        });
      }
      
      if (!payload || !payload.message) {
        logger.debug('[ChatWindow] Invalid payload - missing message');
        return;
      }
      
      // CRITICAL: Normalize chatId for comparison (handle ObjectId, string, Buffer)
      const payloadChatId = normalizeId(payload.chatId);
      const currentChatId = normalizeId(chatId);
      
      if (payloadChatId && currentChatId && payloadChatId === currentChatId) {
        logger.debug('[ChatWindow] ✅ Message matches current chat, adding to UI');
        
        // CRITICAL: Check if message already exists in props to prevent infinite loops
        const messageId = normalizeId(payload.message?._id);
        
        // If message doesn't have _id, log and skip (shouldn't happen after backend fix)
        if (!messageId) {
          logger.error('[ChatWindow] Message received without _id, skipping', payload.message);
          return;
        }
        
        const existsInProps = messages.some((m: any) => {
          const msgId = normalizeId(m._id);
          return msgId && messageId && msgId === messageId;
        });
        
        // CRITICAL: Update local state immediately for instant UI feedback
        // Only if message doesn't exist in props (prevents duplicate updates)
        if (!existsInProps) {
          setLocalMessages(prev => {
            const existsInLocal = prev.find(m => {
              const msgId = normalizeId(m._id);
              return msgId && messageId && msgId === messageId;
            });
            if (existsInLocal) {
              logger.debug('[ChatWindow] Message already in local state, skipping duplicate');
              return prev;
            }
            logger.debug('[ChatWindow] Adding new message to local state:', payload.message._id);
            return [...prev, payload.message];
          });
          
          // Only call parent callback if message doesn't exist in props
          // This prevents infinite loops where parent updates cause prop changes
          // which trigger this handler again
          try {
            onSendMessageRef.current(payload.message);
          } catch (error) {
            logger.error('[ChatWindow] Error calling parent callback', error);
          }
        } else {
          logger.debug('[ChatWindow] Message already exists in props, skipping to prevent loop');
        }
        
        // Clear fallback timeout if it exists
        if ((window as any).messageFallbackTimeout) {
          clearTimeout((window as any).messageFallbackTimeout);
          (window as any).messageFallbackTimeout = null;
        }
        
        // Scroll to bottom when new message arrives
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        logger.debug('[ChatWindow] ❌ Message not for current chat:', { 
          payloadChatId, 
          currentChatId,
          messageText: payload.message?.text?.substring(0, 30)
        });
      }
    };
    const onMessageSent = (payload: any) => {
      if (!isMounted) return;
      
      logger.debug('[ChatWindow] Received message:sent event:', payload);
      
      if (!payload || !payload.message) {
        logger.debug('[ChatWindow] Invalid message:sent payload - missing message');
        return;
      }
      
      // CRITICAL: Normalize chatId for comparison
      const payloadChatId = normalizeId(payload.chatId);
      const currentChatId = normalizeId(chatId);
      
      // This is confirmation that our message was sent successfully
      // Replace optimistic message with real message from server
      if (payloadChatId && currentChatId && payloadChatId === currentChatId) {
        logger.debug('[ChatWindow] ✅ Message sent confirmation matches current chat, updating UI');
        
        // CRITICAL: Update local state to replace optimistic message
        setLocalMessages(prev => {
          // Remove optimistic messages with same text/sender, add real message
          const filtered = prev.filter(m => {
            const msgId = normalizeId(m._id);
            const payloadId = normalizeId(payload.message._id);
            // Keep if it's not the optimistic version of this message
            if (m.isOptimistic && m.text === payload.message.text && 
                String(m.sender) === String(payload.message.sender)) {
              return false; // Remove optimistic version
            }
            // Remove if it's a duplicate of the real message
            if (msgId && payloadId && msgId === payloadId) {
              return false; // Will be replaced by real message
            }
            return true;
          });
          
          // Check if real message already exists
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
        
        // Clear any existing fallback timeout
        if ((window as any).messageFallbackTimeout) {
          clearTimeout((window as any).messageFallbackTimeout);
          (window as any).messageFallbackTimeout = null;
        }
        
        // Also call parent callback
        onSendMessageRef.current(payload.message);
      } else {
        logger.debug('[ChatWindow] ❌ Message sent confirmation not for current chat:', { 
          payloadChatId, 
          currentChatId 
        });
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
        // Group chat: update seenBy array on the specific message
        const messageId = payload.messageId;
        const fromUserId = normalizeId(payload.from);
        const incomingSeenBy = Array.isArray(payload.seenBy) ? payload.seenBy : [];

        if (messageId && fromUserId) {
          setLocalMessages(prev =>
            prev.map(m => {
              if (normalizeId(m._id) === normalizeId(messageId)) {
                const currentSeenBy = Array.isArray(m.seenBy) ? m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean) as string[] : [];
                // Merge incoming seenBy with current
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

          // Also update parent activeMessages
          if (onMessagesSeen && chatId) {
            onMessagesSeen(chatId, [messageId]);
          }
        }
      } else if (normalizeId(payload.from) === normalizeId(otherUser._id)) {
        // 1:1 chat: existing behavior
        setLastSeenId(payload.messageId);
        const otherUserId = normalizeId(otherUser._id);

        // Collect all own message IDs from current messages (via ref to avoid stale closure)
        const ownMessageIds = sortedMessagesRef.current
          .filter(m => {
            const senderId = normalizeId(m.sender?._id || m.sender);
            return senderId && otherUserId && senderId !== otherUserId;
          })
          .map(m => normalizeId(m._id))
          .filter(Boolean);

        // Update localMessages for in-session messages
        setLocalMessages(prev =>
          prev.map(m => {
            const senderId = normalizeId(m.sender?._id || m.sender);
            if (senderId && otherUserId && senderId !== otherUserId && !m.seen) {
              return { ...m, seen: true };
            }
            return m;
          })
        );

        // Update activeMessages in parent so seen status survives prop recomputes
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
    
    // CRITICAL: Subscribe to socket events immediately
    // socketService.subscribe will handle connection if needed
    // Based on documented solution: subscribe first, then ensure connection
    // This ensures listeners are registered before any events arrive
    socketService.subscribe('message:new', onMessageNew);
    socketService.subscribe('message:sent', onMessageSent);
    socketService.subscribe('typing', onTyping);
    socketService.subscribe('seen', onSeen);
    socketService.subscribe('user:online', onOnline);
    socketService.subscribe('user:offline', onOffline);
    
    logger.debug('[ChatWindow] Socket events subscribed');
    
    // CRITICAL: Ensure socket is connected
    // This ensures we're ready to receive events
    const ensureConnection = async () => {
      try {
        const connectedSocket = await socketService.connect();
        if (connectedSocket && connectedSocket.connected) {
          logger.debug('[ChatWindow] Socket connected and ready');
        } else {
          logger.debug('[ChatWindow] Socket connection in progress...');
        }
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
      
      // Cleanup fallback timeout
      if ((window as any).messageFallbackTimeout) {
        clearTimeout((window as any).messageFallbackTimeout);
        (window as any).messageFallbackTimeout = null;
      }
      
      // Clear local messages on unmount or chat change
      setLocalMessages([]);
    };
  }, [otherUser?._id, chatId, onSendMessage]); // Include onSendMessage to ensure ref is updated
  
  // CRITICAL: Auto-scroll to bottom when messages change
  // Use a ref to track previous length to prevent infinite loops
  const prevMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const hasScrolledToEndRef = useRef(false);

  useEffect(() => {
    const currentCount = allMessages.length;

    // Only scroll if new messages were added (count increased)
    if (currentCount > prevMessageCountRef.current && flatListRef.current) {
      const wasInitialLoad = isInitialLoadRef.current;
      if (wasInitialLoad) {
        isInitialLoadRef.current = false;
      }
      prevMessageCountRef.current = currentCount;

      // Clear any existing timeout to prevent multiple scrolls
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Initial load: use longer delay + no animation to reliably reach the end.
      // Subsequent messages: short delay + smooth animation.
      const delay = wasInitialLoad ? 300 : 100;
      scrollTimeoutRef.current = setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: !wasInitialLoad });
        }
        scrollTimeoutRef.current = null;
      }, delay);
    } else if (currentCount !== prevMessageCountRef.current) {
      // Update ref even if we don't scroll
      prevMessageCountRef.current = currentCount;
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [allMessages.length]); // Trigger on message count change only

  // Emit typing event
  const handleInput = (text: string) => {
    setInput(text);
    socketService.emit('typing', { to: otherUser._id });
  };

  // CRITICAL: Mark messages as seen ONLY when user actually views/interacts with them
  // Use a ref to track if we've already marked messages as seen for this chat session
  const hasMarkedAsSeenRef = useRef(false);
  const chatIdRef = useRef(chatId);
  const markSeenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset when chatId changes
    if (chatIdRef.current !== chatId) {
      hasMarkedAsSeenRef.current = false;
      chatIdRef.current = chatId;
      if (markSeenTimeoutRef.current) {
        clearTimeout(markSeenTimeoutRef.current);
        markSeenTimeoutRef.current = null;
      }
    }
  }, [chatId]);

  // Mark messages as seen only after user has had time to view them (3 seconds after chat window is visible)
  // This ensures unread count persists until user actually views the chat
  useEffect(() => {
    const isGroupChat = chatType === 'connect_page';
    // Only mark as seen once per chat session, and only after a delay to ensure user has viewed messages
    if (sortedMessages.length > 0 && !hasMarkedAsSeenRef.current && chatId) {
      const myId = normalizeId(currentUserId);
      const unseen = sortedMessages.filter(m => {
        const senderId = normalizeId(m.sender?._id || m.sender);
        if (isGroupChat) {
          // Group chat: unseen = not sent by me AND I'm not in seenBy
          if (senderId === myId) return false;
          if (Array.isArray(m.seenBy) && myId && m.seenBy.some((id: any) => normalizeId(id) === myId)) return false;
          return true;
        }
        // 1:1 chat: existing logic
        const otherUserId = normalizeId(otherUser._id);
        return senderId && otherUserId && senderId === otherUserId && !m.seen;
      });

      if (unseen.length > 0) {
        // Clear any existing timeout
        if (markSeenTimeoutRef.current) {
          clearTimeout(markSeenTimeoutRef.current);
        }

        // Wait 3 seconds after chat window is visible before marking as seen
        // This gives user time to actually view the messages
        markSeenTimeoutRef.current = setTimeout(() => {
          if (!hasMarkedAsSeenRef.current) {
            logger.debug('[UNREAD DEBUG] Marking messages as seen after 3s delay', {
              chatId,
              unseenCount: unseen.length,
              isGroupChat
            });

            // Mark as seen via socket (for real-time)
            unseen.forEach(msg => {
              if (isGroupChat) {
                // Group chat: emit with chatId, no specific 'to' user needed
                socketService.emit('seen', { messageId: msg._id, chatId });
              } else {
                socketService.emit('seen', { to: otherUser._id, messageId: msg._id, chatId });
              }
            });

            // Mark as seen in backend (only for 1:1 chats — group chats handled via socket markMessageSeen)
            if (!isGroupChat) {
              api.post(`/chat/${otherUser._id}/mark-all-seen`).catch(e => {
                logger.debug('Failed to mark messages as seen in backend:', e);
              });
            }
            clearChatNotifications();

            // Update local state
            setLocalMessages(prev => prev.map(m => {
              const msgId = normalizeId(m._id);
              const isUnseen = unseen.some(u => normalizeId(u._id) === msgId);
              if (isUnseen) {
                if (isGroupChat && myId) {
                  const currentSeenBy = Array.isArray(m.seenBy) ? [...m.seenBy] : [];
                  if (!currentSeenBy.includes(myId)) currentSeenBy.push(myId);
                  return { ...m, seenBy: currentSeenBy };
                }
                return { ...m, seen: true };
              }
              return m;
            }));

            // Notify parent to update conversations badge
            if (onMessagesSeen && chatId) {
              onMessagesSeen(chatId, unseen.map(u => normalizeId(u._id)));
            }

            hasMarkedAsSeenRef.current = true;
          }
        }, 3000); // 3 second delay - gives user time to view messages
      }
    }
    
    // Cleanup: if timeout is still pending when chat closes, fire mark-as-seen immediately
    return () => {
      if (markSeenTimeoutRef.current) {
        clearTimeout(markSeenTimeoutRef.current);
        markSeenTimeoutRef.current = null;
        // Fire immediately on close so the badge clears when returning to chat list
        if (!hasMarkedAsSeenRef.current && chatId) {
          const otherUserIdNorm = normalizeId(otherUser._id);
          const unseenNow = sortedMessagesRef.current.filter(m => {
            const senderId = normalizeId(m.sender?._id || m.sender);
            return senderId && otherUserIdNorm && senderId === otherUserIdNorm && !m.seen;
          });
          if (unseenNow.length > 0) {
            api.post(`/chat/${otherUser._id}/mark-all-seen`).catch(() => {});
            clearChatNotifications();
            if (onMessagesSeen && chatId) {
              onMessagesSeen(chatId, unseenNow.map((u: any) => normalizeId(u._id)));
            }
            hasMarkedAsSeenRef.current = true;
          }
        }
      }
    };
  }, [sortedMessages, otherUser, chatId]);

  // Also mark as seen immediately when user sends a message (they're actively viewing the chat)
  const markMessagesAsSeenIfNeeded = useCallback(() => {
    if (hasMarkedAsSeenRef.current) return;
    
    const unseen = sortedMessages.filter(m => {
      const senderId = normalizeId(m.sender?._id || m.sender);
      const otherUserId = normalizeId(otherUser._id);
      return senderId && otherUserId && senderId === otherUserId && !m.seen;
    });
    
    if (unseen.length > 0) {
      logger.debug('[UNREAD DEBUG] Marking messages as seen (user sent message)', {
        chatId,
        unseenCount: unseen.length
      });
      
      // Mark as seen via socket
      unseen.forEach(msg => {
        socketService.emit('seen', { to: otherUser._id, messageId: msg._id, chatId });
      });
      
      // Mark as seen in backend + clear push notification badge/tray
      api.post(`/chat/${otherUser._id}/mark-all-seen`).catch(e => {
        logger.debug('Failed to mark messages as seen in backend:', e);
      });
      clearChatNotifications();

      // Update local state
      setLocalMessages(prev => prev.map(m => {
        const msgId = normalizeId(m._id);
        const isUnseen = unseen.some(u => normalizeId(u._id) === msgId);
        if (isUnseen) {
          return { ...m, seen: true };
        }
        return m;
      }));

      // Notify parent to update conversations badge
      if (onMessagesSeen && chatId) {
        onMessagesSeen(chatId, unseen.map(u => normalizeId(u._id)));
      }

      hasMarkedAsSeenRef.current = true;

      // Clear the timeout since we've already marked as seen
      if (markSeenTimeoutRef.current) {
        clearTimeout(markSeenTimeoutRef.current);
        markSeenTimeoutRef.current = null;
      }
    }
  }, [sortedMessages, otherUser, chatId]);

  // In handleSend, update local state via onSendMessage
  const handleSend = async () => {
    if (!input.trim()) return;
    const messageText = input;
    logger.debug('Sending message:', messageText);
    
    // Mark messages as seen when user sends a message (they're actively viewing the chat)
    markMessagesAsSeenIfNeeded();
    
    // Get current user ID for optimistic message
    let currentUserId = '';
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        currentUserId = JSON.parse(userData)._id;
      }
    } catch (e) {
      logger.error('Error getting user ID:', e);
    }
    
    // Create optimistic message immediately for instant UI feedback
    const optimisticMessage = {
      _id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: messageText,
      sender: currentUserId,
      timestamp: new Date().toISOString(),
      seen: false,
      isOptimistic: true, // Flag to identify optimistic messages
    };
    
    // Add optimistic message immediately to UI for instant feedback
    onSendMessage(optimisticMessage);
    setInput(''); // Clear input immediately for better UX
    
    // Scroll to bottom after adding optimistic message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    try {
      // Use room endpoint for connect_page group chats, user endpoint for 1:1 chats
      const isGroupChat = chatType === 'connect_page';
      const endpoint = isGroupChat
        ? `/chat/room/${chatId}/messages`
        : `/chat/${otherUser._id}/messages`;
      const res = await api.post(endpoint, { text: messageText });
      logger.debug('Message sent successfully:', res.data.message);
      
      // Clear any existing fallback timeout
      if ((window as any).messageFallbackTimeout) {
        clearTimeout((window as any).messageFallbackTimeout);
        (window as any).messageFallbackTimeout = null;
      }
      
      // The socket event should fire and replace the optimistic message
      // But if socket doesn't fire, we'll add the real message and remove optimistic one
      const fallbackTimeout = setTimeout(() => {
        logger.debug('Socket fallback: ensuring real message is in state');
        // Check if real message already exists (from socket)
        const messageExists = messages.some((m: any) => m._id === res.data.message._id);
        if (!messageExists) {
          logger.debug('Message not found in state, adding via fallback');
          // Add real message - handleNewMessage will deduplicate
          onSendMessage(res.data.message);
        }
        // Remove optimistic message - we need to do this via a callback or state update
        // Since we don't have direct access to setActiveMessages, we'll rely on handleNewMessage
        // to handle deduplication properly
      }, 300);
      
      // Store the timeout so we can clear it if socket event fires
      (window as any).messageFallbackTimeout = fallbackTimeout;
      
    } catch (e) {
      logger.error('Error sending message:', e);
      // Remove optimistic message on error by filtering it out
      // We need to notify parent to remove it, but since we use onSendMessage for adding,
      // we'll need a different approach. For now, restore input and show error.
      // The optimistic message will be replaced when user retries or when socket syncs
      setInput(messageText);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

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
      paddingHorizontal: isTablet ? theme.spacing.lg : 10,
      paddingTop: isTablet ? 8 : 6,
      paddingBottom: isTablet ? 10 : 8,
      backgroundColor: theme.colors.background,
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
      
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
        {/* Modern Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerUserInfo}
            activeOpacity={0.7}
            onPress={() => {
              if (chatType === 'connect_page' && connectPageId?._id && router) {
                router.push(`/connect/page/${connectPageId._id}`);
              } else if (otherUser?._id && router) {
                router.push(`/profile/${otherUser._id}`);
              }
            }}
          >
            <View style={styles.headerAvatarWrap}>
              {chatType === 'connect_page' && connectPageId?.profileImage ? (
                <Image
                  source={{ uri: connectPageId.profileImage }}
                  style={styles.headerAvatar}
                />
              ) : otherUser.profilePic ? (
                <Image
                  source={{ uri: otherUser.profilePic }}
                  style={styles.headerAvatar}
                />
              ) : chatType === 'connect_page' ? (
                <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Ionicons name="people" size={18} color={theme.colors.primary} />
                </View>
              ) : (
                <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                  <Ionicons name="person" size={18} color={theme.colors.textSecondary} />
                </View>
              )}
              {isOnline && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.headerCenter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.chatName} numberOfLines={1} ellipsizeMode="tail">
                  {otherUser.fullName}
                </Text>
                {isTaatomOfficial && (
                  <Ionicons name="checkmark-circle" size={15} color={theme.colors.success || '#4CAF50'} />
                )}
              </View>
              {isTaatomOfficial && (
                <Text style={[styles.onlineStatus, { color: theme.colors.primary }]}>Online</Text>
              )}
              {chatType === 'connect_page' && connectPageId?.name ? (
                <Text style={[styles.onlineStatus, { color: theme.colors.textSecondary }]}>{connectPageId.name}</Text>
              ) : !isTaatomOfficial && otherUser?.username ? (
                <Text style={[styles.onlineStatus, { color: theme.colors.textSecondary }]}>{otherUser.username}</Text>
              ) : null}
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <ThreeDotMenu
              items={[
                {
                  label: 'View Profile',
                  icon: 'person-outline',
                  onPress: () => {
                    // Navigate to user profile
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
          </View>
        </View>

        {/* Messages */}
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
              // CRITICAL: Normalize sender IDs for proper comparison
              const senderId = normalizeId(item.sender?._id || item.sender);
              const otherUserId = normalizeId(otherUser?._id);
              const myUserId = normalizeId(currentUserId);

              // Message is "own" if sender matches current user
              // Primary check: sender === me (reliable when currentUserId is loaded)
              // Fallback for 1:1 chats only: if myUserId not loaded yet, check sender !== otherUser
              // Skip fallback for group/connect chats where otherUser._id is a chatRoomId
              const isGroupChat = chatType === 'connect_page';
              const isOwn = Boolean(
                (senderId && myUserId && senderId === myUserId) ||
                (!isGroupChat && senderId && otherUserId && senderId !== otherUserId && !myUserId)
              );
              const isLastOwn = isOwn && index === sortedMessages.length - 1;

              // Group chat: resolve sender name and pic from participants if not on the message
              let resolvedSenderName = item.senderName || '';
              let resolvedSenderPic = item.senderProfilePic || '';
              if (isGroupChat && !resolvedSenderName && senderId && participants) {
                const senderParticipant = participants.find((p: any) => normalizeId(p?._id || p) === senderId);
                if (senderParticipant) {
                  resolvedSenderName = senderParticipant.fullName || '';
                  if (!resolvedSenderPic) resolvedSenderPic = senderParticipant.profilePic || '';
                }
              }

              // Group chat: determine if this is the first message in a sequence from the same sender
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

              // Check if this is a post share or journey share
              const messageTextStr = String(item.text || '');
              const postShare = parsePostShare(messageTextStr);
              const journeyShare = !postShare ? parseJourneyShare(messageTextStr) : null;

              // Group chat read receipts: check seenBy array
              // Double tick when all other participants have seen the message
              const isSeenByAll = (() => {
                if (!isOwn) return false;
                if (!isGroupChat) return item.seen === true;
                // For group chats: check seenBy includes all participants except sender
                if (Array.isArray(item.seenBy) && participants && participants.length > 0) {
                  const otherParticipantIds = participants
                    .map((p: any) => normalizeId(p?._id || p))
                    .filter((id: string | null) => id && id !== myUserId);
                  return otherParticipantIds.length > 0 && otherParticipantIds.every((pId: string) => item.seenBy.some((id: any) => normalizeId(id) === pId));
                }
                // Fallback: use boolean seen
                return item.seen === true;
              })();

              return (
                <View style={isGroupChat && !isOwn ? { flexDirection: 'row', alignItems: 'flex-end', marginBottom: showSenderInfo ? 6 : 2 } : undefined}>
                  {/* Group chat: sender profile pic */}
                  {isGroupChat && !isOwn && (
                    showSenderInfo ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => senderId && router.push(`/profile/${senderId}`)}
                        style={{ marginRight: 8, marginBottom: 2 }}
                      >
                        <Image
                          source={resolvedSenderPic ? { uri: resolvedSenderPic } : require('../../assets/avatars/male_avatar.png')}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.border }}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 28, marginRight: 8 }} />
                    )
                  )}
                  <View style={[
                    styles.bubble,
                    isOwn ? styles.bubbleOwn : styles.bubbleOther,
                    isGroupChat && !isOwn ? { maxWidth: '75%' } : undefined
                  ]}>
                    {/* Group chat: sender name on first message in sequence */}
                    {isGroupChat && !isOwn && showSenderInfo && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => senderId && router.push(`/profile/${senderId}`)}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: theme.colors.primary,
                          marginBottom: 3,
                        }} numberOfLines={1}>
                          {resolvedSenderName || 'Unknown'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {postShare ? (
                      // Render post share as attractive text message with small image thumbnail
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
                    ) : journeyShare ? (
                      // Render journey share card
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
                    ) : (
                      // Regular text message
                      <Text style={[
                        styles.bubbleText,
                        isOwn ? styles.bubbleOwnText : {}
                      ]}>
                        {String(item.text || '')}
                      </Text>
                    )}

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      marginTop: 2,
                      gap: 3,
                    }}>
                      <Text style={[
                        styles.bubbleTime,
                        isOwn ? styles.bubbleOwnTime : styles.bubbleOtherTime
                      ]}>
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
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingVertical: 16 }}
            onContentSizeChange={() => {
              if (!hasScrolledToEndRef.current && allMessages.length > 0) {
                // First content render — jump instantly so the last message is visible
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

        {/* Enhanced Typing Indicator */}
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

        {/* Clean Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={handleInput}
              placeholder="Type a message..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              textAlignVertical="center"
            />
          </View>
          
          {input.trim() && (
            <TouchableOpacity 
              onPress={handleSend} 
              style={styles.sendButton}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityHint="Sends the message in the input field"
            >
              <Ionicons 
                name="send" 
                size={18} 
                color="#fff" 
              />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
    
    {/* Global Call Screen - Render within ChatWindow */}
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
              // End the call if it's active
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
    </>
  );
}

export default function ChatModal() {
        logger.debug('ChatModal rendered');
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  // Restore local state for conversations, activeChat, activeMessages
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [blockedUserId, setBlockedUserId] = useState<string | null>(null);
  const [isBlockedError, setIsBlockedError] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [activeMessages, setActiveMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Global call state
  const [globalCallState, setGlobalCallState] = useState(callService.getCallState());
  const [showGlobalCallScreen, setShowGlobalCallScreen] = useState(false);
  const [forceRender, setForceRender] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const chatIdModeRef = React.useRef(false);

  // Parse post share message (for chat list)
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
          logger.debug('Fresh thumbnail URL fetched successfully for chat list');
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

    // Reset when imageUrl or postId changes
    useEffect(() => {
      setDisplayUrl(imageUrl?.trim() || null);
      setImageError(false);
      hasTriedFetchRef.current = false;
    }, [imageUrl, postId]);

    // Try to fetch fresh URL if original is missing
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

  // Move handleNewMessage here with deduplication
  const handleNewMessage = (msg: any) => {
    if (!msg || !msg._id) {
      if (__DEV__) {
        logger.debug('[ChatWindow] handleNewMessage: Invalid message, returning');
      }
      return; // Guard against invalid messages
    }
    
    setActiveMessages((prev: any[]) => {
      // Deduplicate by _id to prevent duplicate messages
      const exists = prev.some(m => {
        const prevId = normalizeId(m._id);
        const newId = normalizeId(msg._id);
        return prevId && newId && prevId === newId;
      });
      
      if (exists) {
        logger.debug('Duplicate message detected, skipping:', msg._id);
        return prev;
      }
      
      // If this is a real message (not optimistic), remove any optimistic messages with the same text and sender
      // This handles the case where optimistic message was added, then real message arrives
      if (!msg.isOptimistic && msg.text) {
        const filtered = prev.filter(m => {
          // Remove optimistic messages that match this real message's text and sender
          // Match by text content and sender to ensure we're replacing the right message
          if (m.isOptimistic && m.text === msg.text && String(m.sender) === String(msg.sender)) {
            logger.debug('Removing optimistic message, replacing with real message:', { optimisticId: m._id, realId: msg._id });
            return false;
          }
          return true;
        });
        const newMessages = [...filtered, msg];
        logger.debug('Updated messages after adding real message:', { prevCount: prev.length, newCount: newMessages.length, messageId: msg._id });
        return newMessages;
      }
      
      // For optimistic messages, just add them
      const newMessages = [...prev, msg];
      logger.debug('Added message:', { messageId: msg._id, isOptimistic: msg.isOptimistic, totalMessages: newMessages.length });
      return newMessages;
    });
  };

  // Handle call functionality
  const handleVoiceCall = async (otherUser: any) => {
    if (isCalling) return; // Prevent multiple calls
    
    try {
      setIsCalling(true);
      logger.debug('📞 Starting voice call to:', otherUser._id);
      
      // Immediately show call screen for outgoing call
      setGlobalCallState({
        isCallActive: false,
        isIncomingCall: false,
        isOutgoingCall: true,
        callType: 'voice',
        otherUserId: otherUser._id,
        callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callDuration: 0,
        isMuted: false,
        isVideoEnabled: false,
      });
      setShowGlobalCallScreen(true);
      setForceRender(prev => prev + 1);
      
      // Check if call service is initialized
      if (!callService.isInitialized()) {
        logger.debug('📞 Call service not initialized, initializing...');
        await callService.initialize();
      }
      
      await callService.startCall(otherUser._id, 'voice');
      logger.debug('📞 Voice call started successfully');
    } catch (error) {
      logger.error('📞 Error starting voice call:', error);
      // Hide call screen on error
      setShowGlobalCallScreen(false);
      setForceRender(prev => prev + 1);
      Alert.alert('Error', 'Failed to start voice call.');
    } finally {
      setIsCalling(false);
    }
  };

  const handleVideoCall = async (otherUser: any) => {
    if (isCalling) return; // Prevent multiple calls
    
    try {
      setIsCalling(true);
      logger.debug('📞 Starting video call to:', otherUser._id);
      
      // Immediately show call screen for outgoing call
      setGlobalCallState({
        isCallActive: false,
        isIncomingCall: false,
        isOutgoingCall: true,
        callType: 'video',
        otherUserId: otherUser._id,
        callId: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callDuration: 0,
        isMuted: false,
        isVideoEnabled: true,
      });
      setShowGlobalCallScreen(true);
      setForceRender(prev => prev + 1);
      
      // Check if call service is initialized
      if (!callService.isInitialized()) {
        logger.debug('📞 Call service not initialized, initializing...');
        await callService.initialize();
      }
      
      await callService.startCall(otherUser._id, 'video');
      logger.debug('📞 Video call started successfully');
    } catch (error) {
      logger.error('📞 Error starting video call:', error);
      // Hide call screen on error
      setShowGlobalCallScreen(false);
      setForceRender(prev => prev + 1);
      Alert.alert('Error', 'Failed to start video call.');
    } finally {
      setIsCalling(false);
    }
  };

  // Get user name from user ID
  const getUserName = (userId: string): string => {
    // Handle test user ID
    if (userId === 'test_user_id') {
      return 'Test User';
    }
    
    // Try to find user in conversations first
    const conversation = conversations.find(conv => 
      conv.participants.some((p: any) => p._id === userId)
    );
    if (conversation) {
      const user = conversation.participants.find((p: any) => p._id === userId);
      return user?.fullName || 'Unknown User';
    }
    
    // Try to find in users list
    const user = users.find(u => u._id === userId);
    if (user) {
      return user.fullName || 'Unknown User';
    }
    
    return 'Unknown User';
  };

  // Initialize call service and listen for global call state changes
  useEffect(() => {
    const initializeCallService = async () => {
      try {
        // Initialize call service
        await callService.initialize();
        logger.debug('📞 Call service initialized in chat component');
        
        // Debug call service state
        try {
          const debugInfo = callService.getDebugInfo();
          logger.debug('📞 Call service debug info:', debugInfo);
        } catch (error) {
          logger.error('📞 Error getting debug info:', error);
        }
        
        // Check if call service is working
        const isWorking = callService.isWorking();
        logger.debug('📞 Call service is working:', isWorking);
        
        // Test socket connection
        try {
          const socketTest = await callService.testSocketConnection();
          logger.debug('📞 Socket connection test result:', socketTest);
        } catch (error) {
          logger.error('📞 Error testing socket connection:', error);
        }
      } catch (error) {
        logger.error('📞 Failed to initialize call service:', error);
      }
    };
    
    initializeCallService();
    
    const unsubscribe = callService.onCallStateChange((state) => {
      logger.debug('📞 Global call state changed:', state);
      logger.debug('📞 Current showGlobalCallScreen:', showGlobalCallScreen);
      logger.debug('📞 State otherUserId:', state.otherUserId);
      setGlobalCallState(state);
      
      // Show call screen for incoming calls
      if (state.isIncomingCall) {
        logger.debug('📞 Setting showGlobalCallScreen to TRUE for incoming call');
        logger.debug('📞 Incoming call otherUserId:', state.otherUserId);
        setShowGlobalCallScreen(true);
        setForceRender(prev => prev + 1);
        logger.debug('📞 Showing global call screen for incoming call');
      } else if (state.isCallActive || state.isOutgoingCall) {
        // Keep call screen visible during active calls
        logger.debug('📞 Setting showGlobalCallScreen to TRUE for active call');
        logger.debug('📞 Active call otherUserId:', state.otherUserId);
        setShowGlobalCallScreen(true);
        setForceRender(prev => prev + 1);
        logger.debug('📞 Keeping call screen visible for active call');
      } else {
        // Hide call screen when no call is active
        logger.debug('📞 Setting showGlobalCallScreen to FALSE - no active call');
        setShowGlobalCallScreen(false);
        setForceRender(prev => prev + 1);
        logger.debug('📞 Hiding call screen - no active call');
      }
    });
    
    return unsubscribe;
  }, []);

  // Monitor showGlobalCallScreen state changes
  useEffect(() => {
        logger.debug('📞 showGlobalCallScreen state changed to:', showGlobalCallScreen);
        logger.debug('📞 globalCallState.otherUserId:', globalCallState.otherUserId);
  }, [showGlobalCallScreen, globalCallState.otherUserId]);

  // Helper to fetch chat and messages - OPTIMIZED for performance
  const openChatWithUser = async (userArg: any) => {
    const startTime = Date.now();
    setChatLoading(true);
    setError(null);
    try {
      // Normalize: accept id string (e.g. admin chat when participants are ObjectIds) or user object
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
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      // OPTIMIZATION: Fetch block status, chat, and messages in parallel for 2-3x faster loading
      // Block check can run in parallel since we'll check it after receiving chat data
      const [blockStatusResult, chatRes, messagesRes] = await Promise.allSettled([
        // Block check - run in parallel but non-blocking
        getBlockStatus(user._id).catch(() => ({ isBlocked: false })),
        // Chat fetch with timeout
        Promise.race([
          api.get(`/chat/${user._id}`),
          timeoutPromise
        ]),
        // Messages fetch with timeout - run in parallel with chat
        Promise.race([
          api.get(`/chat/${user._id}/messages`),
          timeoutPromise
        ])
      ]);
      
      // Check block status result (non-blocking - only show error if blocking)
      if (blockStatusResult.status === 'fulfilled' && blockStatusResult.value.isBlocked) {
        setError('You cannot chat with this user because you have blocked them. Please unblock them first.');
        setBlockedUserId(user._id);
        setIsBlockedError(true);
        setShowErrorAlert(true);
        setChatLoading(false);
        return;
      }
      
      // Handle chat and messages results
      if (chatRes.status === 'rejected') {
        throw chatRes.reason;
      }
      if (messagesRes.status === 'rejected') {
        throw messagesRes.reason;
      }
      
      // CRITICAL: Don't mark messages as seen when opening chat
      // Only mark as seen when ChatWindow component is actually visible and user views messages
      // This preserves unread count until user actually opens and views the chat
      logger.debug('[UNREAD DEBUG] Skipping mark-all-seen on chat open - will mark when chat window is visible');
      
      const loadTime = Date.now() - startTime;
      logger.debug(`[PERF] Chat loaded in ${loadTime}ms (optimized parallel fetch)`);
      
      // Ensure chat data is properly structured
      const chat = (chatRes.value as any).data.chat;
      if (!chat) {
        throw new Error('No chat data received');
      }
      
      // Ensure participants are properly populated
      if (!chat.participants || !Array.isArray(chat.participants)) {
        logger.warn('Chat participants not properly populated, using fallback');
        chat.participants = [
          { _id: user._id, fullName: user.fullName, profilePic: user.profilePic }
        ];
      }
      
      // CRITICAL: Keep original seen status - don't mark as seen when opening chat
      const updatedMessages = (messagesRes.value as any).data.messages || [];
      
      setActiveChat(chat);
      setActiveMessages(updatedMessages);
      setSelectedUser(user);
      
      // CRITICAL: Don't mark messages as seen in conversations list when opening chat
      // Only mark as seen when ChatWindow is actually visible
      // This preserves unread count until user actually views the chat
      setConversations(prev => prev.map(prevChat => {
        if (prevChat._id !== chat._id) return prevChat;
        // Keep original seen status
        return prevChat;
      }));
    } catch (e: any) {
      logger.error('Error opening chat with user:', e);
      
      // Handle specific error cases
      if (e.response?.status === 403) {
        // Check if this is a block-related error
        const errorMessage = e.response?.data?.message || e.message || '';
        if (errorMessage.includes('block')) {
          setError('You cannot chat with this user. They may have blocked you or you may have blocked them.');
          setIsBlockedError(true);
          setBlockedUserId((typeof userArg === 'string' ? userArg : userArg?._id) ?? null);
        } else {
          setError('You cannot chat with this user. They may have blocked you or you may have blocked them.');
          setIsBlockedError(false);
        }
        setShowErrorAlert(true);
      } else if (e.response?.status === 404) {
        setError('Chat not found or you are not allowed to access this chat.');
        setIsBlockedError(false);
        setShowErrorAlert(true);
      } else {
        setError(`Failed to load chat: ${e.response?.data?.message || e.message || 'Unknown error'}`);
        setIsBlockedError(false);
        setShowErrorAlert(true);
      }
    } finally {
      setChatLoading(false);
    }
  };

  // Prevent back navigation when ChatWindow is open
  // Intercept back action (both swipe and button) to close chat instead of navigating away
  const navigation = useNavigation<any>();
  useFocusEffect(
    useCallback(() => {
      if (!activeChat) return; // Only intercept if chat is open

      // Prevent default back behavior when chat is open
      const unsubscribe = navigation?.addListener('beforeRemove', (e: any) => {
        // Prevent default back navigation
        e.preventDefault();
        // Close the chat instead
        setSelectedUser(null);
        setActiveChat(null);
        setActiveMessages([]);
      });

      return unsubscribe;
    }, [activeChat, navigation])
  );

  // If userId param is present, fetch that user directly
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
    }
  }, [params.userId]);

  // If chatId param is present (from connect page group chat), fetch chat directly by ID
  // Also checks connectChatBridge as fallback since Expo Router params can be unreliable
  useEffect(() => {
    if (params.userId) return;

    // Check for pending chatRoomId synchronously (no async delay)
    const { consumePendingChatRoomId } = require('../../utils/connectChatBridge');
    const resolvedChatId = (params.chatId as string) || consumePendingChatRoomId();

    if (!resolvedChatId) return;
    chatIdModeRef.current = true;

    let cancelled = false;
    const loadChatById = async () => {
      logger.debug('[CHAT] Opening chat by room ID:', resolvedChatId);

      setLoading(true);
      setChatLoading(true);
      setError(null);
      try {
        const [chatRes, messagesRes] = await Promise.all([
          api.get(`/chat/room/${resolvedChatId}`),
          api.get(`/chat/room/${resolvedChatId}/messages`),
        ]);

        if (cancelled) return;
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
        if (cancelled) return;
        logger.error('Error opening chat by chatId:', e);
        setError(`Failed to load chat: ${e.response?.data?.message || e.message || 'Unknown error'}`);
        setShowErrorAlert(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setChatLoading(false);
        }
      }
    };

    loadChatById();
    return () => { cancelled = true; };
  }, [params.chatId]);

  // If no userId param, fetch chat conversations and following users
  useEffect(() => {
        logger.debug('Fetching chats useEffect running');
    const loadChats = async () => {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      let myUserId = '';
      if (userData) {
        try {
          myUserId = JSON.parse(userData)._id;
        } catch {}
      }
      logger.debug('Requesting chats for user:', myUserId);
      // Use dynamic API URL detection for web
      const { getApiBaseUrl } = require('../../utils/config');
      const API_BASE_URL = getApiBaseUrl();
      const socket = io(API_BASE_URL, { path: '/socket.io', transports: ['websocket'] });
      socket.on('connect', () => {
        logger.debug('[SOCKET] connected to backend');
        socket.emit('test', { hello: 'world' });
      });
      socket.on('connect_error', (err) => {
        logger.debug('[SOCKET] connect_error:', err);
      });
      fetch(`${API_BASE_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          logger.debug('Fetch /chat data:', JSON.stringify(data, null, 2));
          let chats = data.chats || [];
          chats = chats.map((chat: any) => ({
            ...chat,
            me: myUserId,
          }));
          
          // Frontend deduplication as safety measure
          const chatMap = new Map<string, any>();
          chats.forEach((chat: any) => {
            let key;
            if (chat.type === 'connect_page') {
              // Connect page chats: unique per chat
              key = `connect_page_${chat._id}`;
            } else {
              const participantIds = chat.participants
                .map((p: any) => (p._id ? p._id.toString() : p.toString()))
                .sort()
                .join('_');
              key = chat.type === 'admin_support' ? `admin_support_${myUserId}` : participantIds;
            }

            if (!chatMap.has(key) ||
                new Date(chat.updatedAt) > new Date(chatMap.get(key).updatedAt)) {
              chatMap.set(key, chat);
            }
          });
          
          const uniqueChats = Array.from(chatMap.values());
          uniqueChats.sort((a: any, b: any) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          setConversations(uniqueChats);
          // Optionally fetch following users as before
          if (myUserId) {
            api.get(`/api/v1/profile/${myUserId}/following`)
              .then(followRes => setUsers(followRes.data.users || []))
              .catch(() => setUsers([]))
              .finally(() => setLoading(false));
          } else {
            setUsers([]);
            setLoading(false);
          }
        })
        .catch(err => {
          logger.debug('Fetch /chat error:', err);
          setConversations([]);
          setUsers([]);
          setLoading(false);
        });
    };
    if (!params.userId && !params.chatId && !chatIdModeRef.current) {
      loadChats();
    }
  }, [params.userId, params.chatId]);

  // When user is selected from inbox or search, fetch chat and messages.
  // Skip if we already have this chat open (e.g. opened from list tap) to avoid double-fetch and stuck loading.
  // Skip if chatId param is present — the chatId effect already loaded the chat directly.
  useEffect(() => {
    if (!selectedUser || params.userId || params.chatId || chatIdModeRef.current) return;
    const otherId = normalizeId(selectedUser._id ?? (selectedUser as any).id);
    const chatAlreadyOpen = activeChat?.participants?.some((p: any) => normalizeId(p?._id ?? p) === otherId);
    if (chatAlreadyOpen) return;
    openChatWithUser(selectedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    // Count total unread messages
    const totalUnread = conversations.reduce((count, chat) => {
      const currentUserId = normalizeId(chat.me);
      const isGroupChat = (chat as any).type === 'connect_page';
      const unreadCount = chat.messages?.filter((m: any) => {
        if (!m || !m.sender) return false;
        const senderId = normalizeId(m.sender?._id || m.sender);
        if (!senderId || !currentUserId || senderId === currentUserId) return false;
        // Group chat: check seenBy
        if (isGroupChat) {
          if (Array.isArray(m.seenBy) && currentUserId && m.seenBy.some((id: any) => normalizeId(id) === currentUserId)) return false;
          return true;
        }
        // 1:1 chat: check seen boolean
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

    // Show confirmation alert
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
            try {
              // Mark all messages as seen in all conversations
              const updatePromises = conversations.map(async (chat) => {
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
              });

              await Promise.allSettled(updatePromises);

              // Update local state - mark all messages as seen
              setConversations(prev => prev.map(chat => {
                const currentUserId = normalizeId(chat.me);
                const updatedMessages = (chat.messages || []).map((m: any) => {
                  const senderId = normalizeId(m.sender?._id || m.sender);
                  // Mark as seen if it's from someone else and not already seen
                  if (senderId && currentUserId && senderId !== currentUserId && (m.seen === false || m.seen === undefined || m.seen === null)) {
                    return { ...m, seen: true };
                  }
                  return m;
                });
                return { ...chat, messages: updatedMessages };
              }));

              // Show success alert
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

  // Show ChatWindow if chat and messages are loaded
  if ((params.userId || params.chatId || chatIdModeRef.current || selectedUser) && (activeChat && !chatLoading)) {
    return <ChatWindow
      otherUser={selectedUser}
      onClose={() => {
        const shouldGoBack = !!(params.userId || params.chatId || chatIdModeRef.current);
        chatIdModeRef.current = false;
        setSelectedUser(null);
        setActiveChat(null);
        setActiveMessages([]);
        if (shouldGoBack) router.back();
      }} 
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
      onMessagesSeen={(seenChatId, seenIds) => {
        const isGroup = activeChat?.type === 'connect_page';
        // Update badge count in conversations list
        setConversations(prev => prev.map(conv => {
          if (conv._id !== seenChatId) return conv;
          const myId = normalizeId(conv.me);
          const updatedMessages = (conv.messages || []).map((m: any) => {
            const msgId = normalizeId(m._id);
            if (!seenIds.includes(msgId)) return m;
            if (isGroup && myId) {
              // Group chat: add current user to seenBy so unread count clears
              const currentSeenBy = Array.isArray(m.seenBy) ? m.seenBy.map((id: any) => normalizeId(id)).filter(Boolean) : [];
              if (!currentSeenBy.includes(myId)) currentSeenBy.push(myId);
              return { ...m, seenBy: currentSeenBy };
            }
            return { ...m, seen: true };
          });
          return { ...conv, messages: updatedMessages };
        }));
        // Update activeMessages so the read receipt ticks survive recomputes
        setActiveMessages(prev => prev.map((m: any) => {
          const msgId = normalizeId(m._id);
          if (!seenIds.includes(msgId)) return m;
          if (isGroup) {
            const myId = normalizeId(activeChat?.me);
            const currentSeenBy = Array.isArray(m.seenBy) ? [...m.seenBy] : [];
            if (myId && !currentSeenBy.includes(myId)) currentSeenBy.push(myId);
            return { ...m, seenBy: currentSeenBy };
          }
          return { ...m, seen: true };
        }));
      }}
      onClearChat={() => {
        // Clear active messages
        setActiveMessages([]);
        // Optionally refresh chat list
        const reloadChats = async () => {
          const token = await AsyncStorage.getItem('authToken');
          const userData = await AsyncStorage.getItem('userData');
          let myUserId = '';
          if (userData) {
            try { myUserId = JSON.parse(userData)._id; } catch {}
          }
          // Use dynamic API URL detection for web
      const { getApiBaseUrl } = require('../../utils/config');
      const API_BASE_URL = getApiBaseUrl();
          fetch(`${API_BASE_URL}/chat`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          })
            .then(res => res.json())
            .then(data => {
              let chats = data.chats || [];
              chats = chats.map((chat: any) => ({ ...chat, me: myUserId }));
              const chatMap = new Map<string, any>();
              chats.forEach((chat: any) => {
                const participantIds = chat.participants
                  .map((p: any) => p._id || p)
                  .sort()
                  .join('-');
                if (!chatMap.has(participantIds)) {
                  chatMap.set(participantIds, chat);
                }
              });
              const uniqueChats = Array.from(chatMap.values());
              uniqueChats.sort((a: any, b: any) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
              setConversations(uniqueChats);
            })
            .catch(err => logger.error('Error reloading chats:', err));
        };
        reloadChats();
      }}
    />;
  }
  if (chatLoading || loading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} size="large" /></SafeAreaView>;
  }
  
  // Show error alert as part of chat interface
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

    const handleUnblock = async () => {
      if (!blockedUserId) return;
      
      try {
        setChatLoading(true);
        const result = await toggleBlockUser(blockedUserId);
        
        if (!result.isBlocked) {
          // User is now unblocked, try to open chat again
          setShowErrorAlert(false);
          setError(null);
          setIsBlockedError(false);
          
          // Get user info - either from selectedUser or fetch from params
          let userToOpen: any = null;
          
          if (selectedUser && selectedUser._id === blockedUserId) {
            userToOpen = selectedUser;
          } else if (params.userId && params.userId === blockedUserId) {
            // Fetch user profile if we only have ID
            try {
              const profileRes = await api.get(`/profile/${params.userId}`);
              userToOpen = {
                _id: profileRes.data.profile._id,
                fullName: profileRes.data.profile.fullName,
                profilePic: profileRes.data.profile.profilePic,
              };
            } catch (e) {
              logger.error('Failed to fetch user profile:', e);
            }
          } else if (blockedUserId) {
            // Fallback: try to fetch user by blockedUserId
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
            // If we can't get user info, just go back
            setBlockedUserId(null);
            setChatLoading(false);
            if (router && typeof router.back === 'function') {
              router.back();
            }
          }
        }
      } catch (error: any) {
        Alert.alert('Error', sanitizeErrorForDisplay(error, 'chat.unblockUser'));
        setChatLoading(false);
      }
    };

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
                try {
                  if (router && typeof router.back === 'function') {
                    router.back();
                  } else {
                    setSelectedUser(null);
                    setActiveChat(null);
                    setActiveMessages([]);
                  }
                } catch (e) {
                  setSelectedUser(null);
                  setActiveChat(null);
                  setActiveMessages([]);
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={isBlockedError && blockedUserId ? errorStyles.errorButtonSecondaryText : errorStyles.errorButtonText}>
                {isBlockedError && blockedUserId ? 'Go Back' : 'Go Back'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }
  
  if (error) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.colors.error, fontSize: 16 }}>{error}</Text></SafeAreaView>;
  }

  // Always show chat inbox as default (even if empty)
  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = a.messages?.length ? new Date(a.messages[a.messages.length-1].timestamp).getTime() : 0;
    const bTime = b.messages?.length ? new Date(b.messages[b.messages.length-1].timestamp).getTime() : 0;
    return bTime - aTime;
  });
  const filtered = sortedConversations.filter(c => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    // Search connect page name for connect_page chats
    if ((c as any).type === 'connect_page' && (c as any).connectPageId?.name) {
      return (c as any).connectPageId.name.toLowerCase().includes(q);
    }
    const other = c.participants.find((u: any) => u._id !== c.me);
    return other?.fullName?.toLowerCase().includes(q);
  });
        logger.debug('Rendering chat inbox, conversations:', conversations);

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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isTablet ? theme.spacing.xl : 16,
      paddingVertical: isTablet ? theme.spacing.md : 12,
      backgroundColor: theme.colors.background,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerButton: {
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      borderRadius: isTablet ? 20 : 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchContainer: {
      paddingHorizontal: isTablet ? theme.spacing.xl : 16,
      paddingBottom: 8,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: isTablet ? 12 : 10,
      paddingHorizontal: isTablet ? 14 : 12,
      height: isTablet ? 40 : 36,
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
    chatList: {
      flex: 1,
    },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? theme.spacing.xl : 16,
      paddingVertical: isTablet ? 14 : 12,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: isTablet ? 14 : 12,
    },
    avatar: {
      width: isTablet ? 56 : 50,
      height: isTablet ? 56 : 50,
      borderRadius: isTablet ? 28 : 25,
    },
    avatarPlaceholder: {
      width: isTablet ? 56 : 50,
      height: isTablet ? 56 : 50,
      borderRadius: isTablet ? 28 : 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: isTablet ? 14 : 12,
      height: isTablet ? 14 : 12,
      borderRadius: isTablet ? 7 : 6,
      backgroundColor: '#4cd137',
      borderWidth: 2,
      borderColor: theme.colors.background,
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
      backgroundColor: theme.colors.primary + '15',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 4,
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
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      marginLeft: 8,
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
      opacity: 0.5,
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
      backgroundColor: theme.colors.background,
    },
    newMessageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.colors.background,
    },
    newMessageTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
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

  return (
    <>
      {/* Debug: ChatModal render state */}
      {__DEV__ && logger.debug('📞 ChatModal RENDER', { showGlobalCallScreen, otherUserId: globalCallState.otherUserId, forceRender })}
      
      {/* Global Call Screen - Always render when showGlobalCallScreen is true */}
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
                logger.debug('📞 Global call screen onClose called');
                setShowGlobalCallScreen(false);
                // End the call if it's active
                if (globalCallState.isCallActive || globalCallState.isOutgoingCall) {
                  callService.endCall();
                }
              }}
              otherUser={{ 
                _id: globalCallState.otherUserId, 
                fullName: getUserName(globalCallState.otherUserId),
                profilePic: undefined 
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
                  logger.debug('📞 Force close call screen');
                  setShowGlobalCallScreen(false);
                }}
              >
                <Text style={{ color: 'white', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      {/* Test indicator - always visible when showGlobalCallScreen is true */}
      {showGlobalCallScreen && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: 100,
          backgroundColor: 'red', 
          padding: 10, 
          zIndex: 10001,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>
            🔴 CALL SCREEN ACTIVE 🔴
          </Text>
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 14 }}>
            showGlobalCallScreen: {showGlobalCallScreen.toString()}
          </Text>
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 14 }}>
            otherUserId: {globalCallState.otherUserId || 'null'}
          </Text>
        </View>
      )}
      
      {/* Debug info for call screen */}
      {/* Debug: Render check */}
      {__DEV__ && logger.debug('📞 Render check', { showGlobalCallScreen, otherUserId: globalCallState.otherUserId, forceRender })}
      
      <SafeAreaView style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Chats</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              logger.debug('[Mark All Read] Button pressed');
              handleMarkAllAsRead();
            }}
            style={styles.headerButton}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="checkmark-done" size={20} color={theme.colors.primary || '#007AFF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowNewMessage(true)}
            style={styles.headerButton}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="create-outline" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Compact Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chat List */}
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
            let other = item.participants.find((u: any) => {
              const uId = normalizeId(u?._id || u);
              const meId = normalizeId(item.me);
              return uId && meId && uId !== meId;
            });
            // If participants is array of ObjectIds, fallback
            if (!other && Array.isArray(item.participants) && typeof item.participants[0] === 'string') {
              other = item.participants.find((id: string) => {
                const idNormalized = normalizeId(id);
                const meId = normalizeId(item.me);
                return idNormalized && meId && idNormalized !== meId;
              });
            }
            // Calculate unread count - handle Buffer objects from backend
            const otherUserId = normalizeId(other?._id || other);
            const currentUserId = normalizeId(item.me);
            const isGroupChat = (item as any).type === 'connect_page';

            // Calculate unread count: messages from other user (not from current user) that are not seen
            // This includes admin messages from Taatom Official (000000000000000000000001) to regular users
            // SIMPLIFIED: Count any message that is NOT from current user and NOT seen
            const unreadCount = item.messages?.filter((m: any) => {
              // Skip invalid messages
              if (!m || !m.sender) return false;

              // Normalize sender ID - handle Buffer objects from backend
              const senderId = normalizeId(m.sender?._id || m.sender);

              // Skip if sender is current user (messages from current user are never unread)
              if (!senderId || !currentUserId) return false;
              if (senderId === currentUserId) return false;

              // For group chats: check if current user is in seenBy array
              if (isGroupChat) {
                if (Array.isArray(m.seenBy) && currentUserId && m.seenBy.some((id: any) => normalizeId(id) === currentUserId)) return false;
                return true; // Not in seenBy = unread for this user
              }

              // For 1:1 chats: check seen boolean
              if (m.seen === true) return false;
              const isUnseen = m.seen === false || m.seen === undefined || m.seen === null;

              // Debug logging for admin messages (Taatom Official ID: 000000000000000000000001)
              if (__DEV__ && senderId === '000000000000000000000001') {
                logger.debug('[UNREAD DEBUG] Admin message check', {
                  chatId: item._id,
                  senderId,
                  otherUserId,
                  currentUserId,
                  isUnseen,
                  seen: m.seen,
                  messageId: m._id,
                  participants: item.participants?.map((p: any) => normalizeId(p?._id || p))
                });
              }

              return isUnseen;
            }).length || 0;
            
            return (
              <TouchableOpacity
                style={styles.chatItem}
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
                    // For connect_page chats, open by chat room ID
                    const chatId = item._id;
                    // Set chatIdModeRef BEFORE state updates so the selectedUser effect skips
                    chatIdModeRef.current = true;
                    setLoading(true);
                    setChatLoading(true);
                    Promise.all([
                      api.get(`/chat/room/${chatId}`),
                      api.get(`/chat/room/${chatId}/messages`),
                    ]).then(([chatRes, messagesRes]) => {
                      const chat = chatRes.data.chat;
                      const messages = messagesRes.data.messages || [];
                      const pageInfo = chat?.connectPageId;
                      const syntheticUser = pageInfo
                        ? { _id: chatId, fullName: pageInfo.name, profilePic: pageInfo.profileImage }
                        : { _id: chatId, fullName: 'Group Chat' };
                      setActiveChat(chat);
                      setActiveMessages(messages);
                      setSelectedUser(syntheticUser);
                    }).catch((e) => {
                      logger.error('Error opening connect_page chat:', e);
                      chatIdModeRef.current = false;
                      setError('Failed to load chat');
                      setShowErrorAlert(true);
                    }).finally(() => {
                      setLoading(false);
                      setChatLoading(false);
                    });
                  } else {
                    openChatWithUser(other);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  {(item as any).type === 'connect_page' && (item as any).connectPageId?.profileImage ? (
                    <Image source={{ uri: (item as any).connectPageId.profileImage }} style={styles.avatar} />
                  ) : other && other.profilePic ? (
                    <Image source={{ uri: other.profilePic }} style={styles.avatar} />
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
                        <View style={styles.connectBadge}>
                          <Text style={[styles.connectBadgeText, { color: theme.colors.primary }]}>Connect</Text>
                        </View>
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
                      {(item as any).type === 'connect_page' && (
                        <Text style={[styles.lastMessage, { fontSize: 12, marginBottom: 1 }]} numberOfLines={1}>
                          {((item as any).connectPageId?.followerCount || 0) + 1} {((item as any).connectPageId?.followerCount || 0) + 1 === 1 ? 'member' : 'members'}
                        </Text>
                      )}
                      {(() => {
                        const lastMessage = item.messages?.[item.messages.length-1];
                        const messageText = String(lastMessage?.text || '');
                        const postShare = parsePostShare(messageText);
                        const journeyShare = !postShare && messageText.startsWith('[JOURNEY_SHARE]') ? (() => {
                          try {
                            const parts = messageText.replace('[JOURNEY_SHARE]', '').split('|');
                            return parts.length >= 3 ? { title: parts[2], distance: parts[3] || '' } : null;
                          } catch { return null; }
                        })() : null;

                        if (postShare) {
                          return (
                            <ChatListPostThumbnail
                              imageUrl={postShare.imageUrl}
                              postId={postShare.postId}
                              authorName={postShare.authorName}
                              theme={theme}
                            />
                          );
                        } else if (journeyShare) {
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name="navigate" size={14} color="#22C55E" />
                              <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                                {journeyShare.title}{journeyShare.distance ? ` • ${journeyShare.distance}` : ''}
                              </Text>
                            </View>
                          );
                        } else {
                          return (
                            <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                              {messageText}
                            </Text>
                          );
                        }
                      })()}
                    </View>
                    {unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText} numberOfLines={1}>
                          {unreadCount > 99 ? '99+' : String(unreadCount)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 0.5, backgroundColor: theme.colors.border, marginLeft: isTablet ? 86 : 78 }} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Enhanced New Message Modal */}
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
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={search.trim() ? users.filter(u => u.fullName.toLowerCase().includes(search.trim().toLowerCase())) : users}
                keyExtractor={item => item._id}
                removeClippedSubviews={true}
                initialNumToRender={15}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userItem}
                    onPress={() => openChatWithUser(item)}
                    activeOpacity={0.7}
                  >
                    {item.profilePic ? (
                      <Image source={{ uri: item.profilePic }} style={styles.userAvatar} />
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
            )}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
    </>
  );
}
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { callService } from '../../services/callService';
import CallScreen from '../../components/CallScreen';
import ThreeDotMenu from '../../components/ThreeDotMenu';
import { toggleBlockUser, getBlockStatus } from '../../services/profile';
import { clearChat, toggleMuteChat, getMuteStatus } from '../../services/chat';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';

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

function ChatWindow({ otherUser, onClose, messages, onSendMessage, chatId, onVoiceCall, onVideoCall, isCalling, showGlobalCallScreen, globalCallState, setShowGlobalCallScreen, setGlobalCallState, forceRender, setForceRender, router, onClearChat }: { 
  otherUser: any, 
  onClose: () => void, 
  messages: any[], 
  onSendMessage: (msg: any) => void, 
  chatId: string, 
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
  onClearChat?: () => void
}) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const flatListRef = React.useRef<FlatList>(null);

  // Get user name from user ID
  const getUserName = (userId: string): string => {
    // Handle test user ID
    if (userId === 'test_user_id') {
      return 'Test User';
    }
    
    // Return the actual other user's name
    return otherUser?.fullName || 'Unknown User';
  };

  // Sort messages ascending by timestamp (oldest first)
  const sortedMessages = [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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

  useEffect(() => {
    // Subscribe to socket for new messages, typing, seen, presence
    const onMessageNew = (payload: any) => {
      logger.debug('Received message:new event:', payload);
      if (payload.message && payload.chatId === chatId) {
        logger.debug('Adding message to active chat:', payload.message);
        // Clear fallback timeout if it exists
        if ((window as any).messageFallbackTimeout) {
          clearTimeout((window as any).messageFallbackTimeout);
          (window as any).messageFallbackTimeout = null;
        }
        // Append to active chat if open
        onSendMessage(payload.message);
      } else {
        logger.debug('Message not for current chat or missing data:', { payload, chatId });
        // Optionally: update chat list preview/unread here
        // (You may want to trigger a chat list refresh or update state)
      }
    };
    const onMessageSent = (payload: any) => {
      // Optionally: update message status in UI (e.g., from 'pending' to 'sent')
      // You may want to update the message in your state by _id
    };
    const onTyping = (payload: any) => {
      if (payload.from === otherUser._id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    };
    const onSeen = (payload: any) => {
      if (payload.from === otherUser._id) {
        setLastSeenId(payload.messageId);
      }
    };
    const onOnline = (payload: any) => {
      if (payload.userId === otherUser._id) setIsOnline(true);
    };
    const onOffline = (payload: any) => {
      if (payload.userId === otherUser._id) setIsOnline(false);
    };
    socketService.subscribe('message:new', onMessageNew);
    socketService.subscribe('message:sent', onMessageSent);
    socketService.subscribe('typing', onTyping);
    socketService.subscribe('seen', onSeen);
    socketService.subscribe('user:online', onOnline);
    socketService.subscribe('user:offline', onOffline);
    return () => {
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
    };
  }, [otherUser, chatId]); // Add chatId to dependency array

  // Emit typing event
  const handleInput = (text: string) => {
    setInput(text);
    socketService.emit('typing', { to: otherUser._id });
  };

  // Emit seen event when chat is opened or scrolled to bottom
  useEffect(() => {
    if (sortedMessages.length > 0) {
      const lastMsg = sortedMessages[sortedMessages.length - 1];
      logger.debug('lastMsg:', lastMsg);
      if (lastMsg && lastMsg.sender !== otherUser._id) {
        logger.debug('[SOCKET] emitting seen event:', { to: otherUser._id, messageId: lastMsg._id, chatId });
        socketService.emit('seen', { to: otherUser._id, messageId: lastMsg._id, chatId });
      }
    }
  }, [sortedMessages, otherUser, chatId]);

  // --- 1. When opening a chat, emit 'seen' for all unseen messages from the other user ---
  useEffect(() => {
    if (sortedMessages.length > 0) {
      const unseen = sortedMessages.filter(m => m.sender === otherUser._id && !m.seen);
      unseen.forEach(msg => {
        logger.debug('[SOCKET] emitting seen event:', { to: otherUser._id, messageId: msg._id, chatId });
        socketService.emit('seen', { to: otherUser._id, messageId: msg._id, chatId });
      });
    }
  }, [sortedMessages, otherUser, chatId]);

  // In handleSend, update local state via onSendMessage
  const handleSend = async () => {
    if (!input.trim()) return;
    const messageText = input;
        logger.debug('Sending message:', messageText);
    setInput(''); // Clear input immediately for better UX
    
    try {
      const res = await api.post(`/chat/${otherUser._id}/messages`, { text: messageText });
      logger.debug('Message sent successfully:', res.data.message);
      
      // Add a fallback mechanism - if socket doesn't fire within 1 second, add the message manually
      const fallbackTimeout = setTimeout(() => {
        logger.debug('Socket fallback: adding message manually');
        onSendMessage(res.data.message);
      }, 1000);
      
      // Store the timeout so we can clear it if socket event fires
      (window as any).messageFallbackTimeout = fallbackTimeout;
      
    } catch (e) {
      logger.error('Error sending message:', e);
      // Restore input on error
      setInput(messageText);
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
      justifyContent: 'space-between',
      paddingHorizontal: isTablet ? theme.spacing.xl : 20,
      paddingVertical: isTablet ? theme.spacing.lg : 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    headerBack: {
      // Minimum touch target: 44x44 for iOS, 48x48 for Android
      minWidth: isAndroid ? 48 : (isTablet ? 52 : 44),
      minHeight: isAndroid ? 48 : (isTablet ? 52 : 44),
      width: isTablet ? 52 : (isAndroid ? 48 : 44),
      height: isTablet ? 52 : (isAndroid ? 48 : 44),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: isTablet ? 26 : (isAndroid ? 24 : 22),
      backgroundColor: theme.colors.background,
      ...(isWeb && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      } as any),
    },
    headerAvatarWrap: {
      position: 'relative',
      width: isTablet ? 56 : 48,
      height: isTablet ? 56 : 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: isTablet ? 18 : 14,
      height: isTablet ? 18 : 14,
      borderRadius: isTablet ? 9 : 7,
      backgroundColor: '#4cd137',
      borderWidth: 3,
      borderColor: theme.colors.surface,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: isTablet ? theme.spacing.md : 8,
      minWidth: 0,
    },
    chatName: {
      fontSize: isTablet ? 22 : 18,
      fontFamily: getFontFamily('700'),
      fontWeight: '700',
      color: theme.colors.text,
      textAlign: 'center',
      maxWidth: '100%',
      letterSpacing: isIOS ? 0.3 : 0.2,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    onlineStatus: {
      fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
      fontFamily: getFontFamily('500'),
      fontWeight: '500',
      marginTop: 2,
      textAlign: 'center',
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerActionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    headerActionButtonDisabled: {
      opacity: 0.5,
    },
    messagesContainer: {
      flex: 1,
      paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    bubble: {
      marginVertical: isTablet ? 6 : 4,
      paddingHorizontal: isTablet ? theme.spacing.md : 14,
      paddingVertical: isTablet ? theme.spacing.md : 10,
      borderRadius: isTablet ? 22 : 18,
      maxWidth: isTablet ? '70%' : '75%',
    },
    bubbleOwn: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.primary,
      borderBottomRightRadius: 6,
    },
    bubbleOther: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderBottomLeftRadius: 6,
    },
    bubbleText: {
      color: theme.colors.text,
      fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
      fontFamily: getFontFamily('400'),
      lineHeight: isTablet ? 22 : 20,
      fontWeight: '400',
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    bubbleOwnText: {
      color: '#fff',
    },
    bubbleTime: {
      fontSize: isTablet ? theme.typography.small.fontSize : 10,
      fontFamily: getFontFamily('400'),
      marginTop: 4,
      textAlign: 'right',
      opacity: 0.7,
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
      marginLeft: 16,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    typingText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontStyle: 'italic',
      marginLeft: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
      paddingVertical: isTablet ? theme.spacing.md : 12,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: isTablet ? 24 : 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: isTablet ? theme.spacing.lg : 16,
      paddingVertical: isTablet ? theme.spacing.sm : 8,
      marginRight: isTablet ? theme.spacing.sm : 8,
      minHeight: isTablet ? 50 : 40,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: isTablet ? theme.typography.body.fontSize + 1 : 15,
      fontFamily: getFontFamily('400'),
      lineHeight: isTablet ? 22 : 20,
      maxHeight: 100,
      paddingVertical: 2,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        outlineStyle: 'none',
      } as any),
    },
    sendButton: {
      width: isTablet ? 50 : 40,
      height: isTablet ? 50 : 40,
      borderRadius: isTablet ? 25 : 20,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...(isWeb && {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
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
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 2,
    },
  });

  return (
    <>
      
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Enhanced Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={onClose} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerAvatarWrap}>
            {otherUser.profilePic ? (
              <Image 
                source={{ uri: otherUser.profilePic }} 
                style={{ width: 48, height: 48, borderRadius: 24 }} 
              />
            ) : (
              <Ionicons 
                name="person-circle" 
                size={48} 
                color={isOnline ? theme.colors.primary : theme.colors.textSecondary} 
              />
            )}
            {isOnline && <View style={styles.onlineDot} />}
          </View>
          
          <View style={styles.headerCenter}>
            <Text 
              style={styles.chatName} 
              numberOfLines={1} 
              ellipsizeMode="tail"
            >
              {otherUser.fullName}
            </Text>
            <Text style={[
              styles.onlineStatus,
              { color: isOnline ? theme.colors.primary : theme.colors.textSecondary }
            ]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            {/* Call options commented out - will be available in next update */}
            {/* <TouchableOpacity 
              style={[styles.headerActionButton, isCalling && styles.headerActionButtonDisabled]}
              onPress={() => onVoiceCall(otherUser)}
              disabled={isCalling}
            >
              <Ionicons 
                name="call" 
                size={20} 
                color={isCalling ? theme.colors.textSecondary : theme.colors.primary} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.headerActionButton, isCalling && styles.headerActionButtonDisabled]}
              onPress={() => onVideoCall(otherUser)}
              disabled={isCalling}
            >
              <Ionicons 
                name="videocam" 
                size={20} 
                color={isCalling ? theme.colors.textSecondary : theme.colors.primary} 
              />
            </TouchableOpacity> */}
            
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
                              Alert.alert('Error', error.message || 'Failed to clear chat');
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
                      Alert.alert('Error', error.message || 'Failed to toggle mute');
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
                              Alert.alert('Error', error.message || 'Failed to update block status');
                            }
                          },
                        },
                      ]
                    );
                  },
                  destructive: !isBlocked,
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
            keyExtractor={(_, idx) => idx.toString()}
            renderItem={({ item, index }) => {
              const isOwn = item.sender !== otherUser._id;
              const isLastOwn = isOwn && index === sortedMessages.length - 1;
              
              return (
                <View style={[
                  styles.bubble, 
                  isOwn ? styles.bubbleOwn : styles.bubbleOther
                ]}>
                  <Text style={[
                    styles.bubbleText,
                    isOwn ? styles.bubbleOwnText : {}
                  ]}>
                    {String(item.text || '')}
                  </Text>
                  
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'flex-end', 
                    marginTop: 4 
                  }}>
                    <Text style={[
                      styles.bubbleTime,
                      isOwn ? styles.bubbleOwnTime : styles.bubbleOtherTime
                    ]}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                    {isOwn && (
                      <View style={{ marginLeft: 6 }}>
                        {isLastOwn && item._id === lastSeenId ? (
                          <Ionicons name="checkmark-done" size={14} color="#fff" />
                        ) : (
                          <Ionicons name="checkmark" size={14} color="#fff" style={{ opacity: 0.7 }} />
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingVertical: 16 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
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
    </SafeAreaView>
    
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

  // Move handleNewMessage here
  const handleNewMessage = (msg: any) => setActiveMessages((prev: any[]) => [...prev, msg]);

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

  // Helper to fetch chat and messages
  const openChatWithUser = async (user: any) => {
    setChatLoading(true);
    setError(null);
    try {
      logger.debug('Opening chat with user:', user._id);
      
      // Check block status first
      try {
        const blockStatus = await getBlockStatus(user._id);
        if (blockStatus.isBlocked) {
          setError('You cannot chat with this user because you have blocked them. Please unblock them first.');
          setBlockedUserId(user._id);
          setIsBlockedError(true);
          setShowErrorAlert(true);
          setChatLoading(false);
          return;
        }
      } catch (blockError) {
        logger.error('Error checking block status:', blockError);
        // Continue even if block check fails
      }
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      // Get chat and messages first
      const chatRes = await Promise.race([
        api.get(`/chat/${user._id}`),
        timeoutPromise
      ]);
      
      const messagesRes = await Promise.race([
        api.get(`/chat/${user._id}/messages`),
        timeoutPromise
      ]);
      
      // Mark all messages as seen in the backend (optional, don't block on this)
      try {
        await api.post(`/chat/${user._id}/mark-all-seen`);
      } catch (e) {
        logger.debug('Failed to mark messages as seen:', e);
      }
      
      // Ensure chat data is properly structured
      const chat = (chatRes as any).data.chat;
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
      
      // Mark all messages from other user as seen locally
      const updatedMessages = ((messagesRes as any).data.messages || []).map((msg: any) =>
        msg.sender === user._id ? { ...msg, seen: true } : msg
      );
      
      setActiveChat(chat);
      setActiveMessages(updatedMessages);
      setSelectedUser(user);
      setConversations(prev => prev.map(prevChat => {
        if (prevChat._id !== chat._id) return prevChat;
        const updatedMsgs = (prevChat.messages || []).map((msg: any) =>
          msg.sender === user._id ? { ...msg, seen: true } : msg
        );
        return { ...prevChat, messages: updatedMsgs };
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
          setBlockedUserId(user._id);
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
      const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
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
            const participantIds = chat.participants
              .map((p: any) => (p._id ? p._id.toString() : p.toString()))
              .sort()
              .join('_');
            
            if (!chatMap.has(participantIds) || 
                new Date(chat.updatedAt) > new Date(chatMap.get(participantIds).updatedAt)) {
              chatMap.set(participantIds, chat);
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
    if (!params.userId) {
      loadChats();
    }
  }, [params.userId]);

  // When user is selected from inbox or search, fetch chat and messages
  useEffect(() => {
    if (selectedUser && !params.userId) {
      openChatWithUser(selectedUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  // Show ChatWindow if chat and messages are loaded
  if ((params.userId || selectedUser) && (activeChat && !chatLoading)) {
    return <ChatWindow 
      otherUser={selectedUser} 
      onClose={() => {
        setSelectedUser(null);
        setActiveChat(null);
        setActiveMessages([]);
        if (params.userId) router.back();
        // Refresh chat list after closing chat
        const reloadChats = async () => {
          const token = await AsyncStorage.getItem('authToken');
          const userData = await AsyncStorage.getItem('userData');
          let myUserId = '';
          if (userData) {
            try { myUserId = JSON.parse(userData)._id; } catch {}
          }
          const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
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
              logger.debug('Reloaded /chat data:', JSON.stringify(data, null, 2));
              let chats = data.chats || [];
              chats = chats.map((chat: any) => ({ ...chat, me: myUserId }));
              
              // Frontend deduplication as safety measure
              const chatMap = new Map<string, any>();
              chats.forEach((chat: any) => {
                const participantIds = chat.participants
                  .map((p: any) => (p._id ? p._id.toString() : p.toString()))
                  .sort()
                  .join('_');
                
                if (!chatMap.has(participantIds) || 
                    new Date(chat.updatedAt) > new Date(chatMap.get(participantIds).updatedAt)) {
                  chatMap.set(participantIds, chat);
                }
              });
              
              const uniqueChats = Array.from(chatMap.values());
              uniqueChats.sort((a: any, b: any) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
              
              setConversations(uniqueChats);
            });
        };
        reloadChats();
      }} 
      messages={activeMessages} 
      onSendMessage={handleNewMessage} 
      chatId={activeChat?._id} 
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
          const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
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
            .catch(err => console.error('Error reloading chats:', err));
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
        ...theme.shadows.large,
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
        Alert.alert('Error', error.message || 'Failed to unblock user');
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
    const other = c.participants.find((u: any) => u._id !== c.me);
    return other?.fullName?.toLowerCase().includes(search.trim().toLowerCase());
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
      paddingHorizontal: isTablet ? theme.spacing.xl : 20,
      paddingVertical: isTablet ? theme.spacing.lg : 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    title: {
      fontSize: isTablet ? theme.typography.h1.fontSize : 26,
      fontFamily: getFontFamily('800'),
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: isIOS ? -0.5 : 0,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      width: isTablet ? 52 : 44,
      height: isTablet ? 52 : 44,
      borderRadius: isTablet ? 26 : 22,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: isTablet ? theme.spacing.md : 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    searchContainer: {
      marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
      marginVertical: isTablet ? theme.spacing.md : 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: isTablet ? theme.borderRadius.lg : 16,
      paddingHorizontal: isTablet ? theme.spacing.lg : 16,
      paddingVertical: isTablet ? theme.spacing.md : 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    searchInput: {
      flex: 1,
      marginLeft: isTablet ? theme.spacing.md : 12,
      color: theme.colors.text,
      fontSize: isTablet ? theme.typography.body.fontSize + 1 : 16,
      fontFamily: getFontFamily('500'),
      fontWeight: '500',
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
      paddingHorizontal: isTablet ? theme.spacing.xl : 20,
      paddingVertical: isTablet ? theme.spacing.lg : 16,
      backgroundColor: theme.colors.surface,
      marginHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
      marginVertical: isTablet ? 8 : 6,
      borderRadius: isTablet ? theme.borderRadius.lg : 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: isTablet ? theme.spacing.lg : 16,
    },
    avatar: {
      width: isTablet ? 64 : 52,
      height: isTablet ? 64 : 52,
      borderRadius: isTablet ? 32 : 26,
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: isTablet ? 18 : 14,
      height: isTablet ? 18 : 14,
      borderRadius: isTablet ? 9 : 7,
      backgroundColor: '#4cd137',
      borderWidth: 3,
      borderColor: theme.colors.surface,
    },
    chatContent: {
      flex: 1,
      justifyContent: 'center',
    },
    chatName: {
      fontSize: isTablet ? theme.typography.body.fontSize + 3 : 17,
      fontFamily: getFontFamily('700'),
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 4,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    lastMessage: {
      fontSize: isTablet ? theme.typography.body.fontSize : 14,
      fontFamily: getFontFamily('500'),
      color: theme.colors.textSecondary,
      fontWeight: '500',
      lineHeight: isTablet ? 20 : 18,
      ...(isWeb && {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      } as any),
    },
    unreadBadge: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
    unreadText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyIcon: {
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
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
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    newMessageTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    userAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 16,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
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
      {/* Enhanced Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setShowNewMessage(true)} 
            style={styles.headerButton}
          >
            <Ionicons name="create-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Enhanced Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats..."
            placeholderTextColor={theme.colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Chat List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
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
          renderItem={({ item }) => {
            if (__DEV__) {
              logger.debug('Chat item', { 
                chatId: item._id, 
                messages: item.messages?.map((m: any) => ({ _id: m._id, sender: m.sender, seen: m.seen, text: m.text })) 
              });
            }
            let other = item.participants.find((u: any) => u._id !== item.me);
            // If participants is array of ObjectIds, fallback
            if (!other && Array.isArray(item.participants) && typeof item.participants[0] === 'string') {
              other = item.participants.find((id: string) => id !== item.me);
            }
            const unreadCount = item.messages?.filter((m: any) => m.sender === (other._id || other) && !m.seen).length || 0;
            
            return (
              <TouchableOpacity
                style={styles.chatItem}
                onPress={() => openChatWithUser(other)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  {other && other.profilePic ? (
                    <Image source={{ uri: other.profilePic }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person-circle" size={52} color={theme.colors.textSecondary} />
                  )}
                </View>
                
                <View style={styles.chatContent}>
                  <Text style={styles.chatName} numberOfLines={1}>
                    {other ? String(other.fullName || other._id || other) : '[No other user found]'}
                  </Text>
                  <Text style={styles.lastMessage} numberOfLines={2}>
                    {String(item.messages?.[item.messages.length-1]?.text || '')}
                  </Text>
                </View>
                
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
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
                data={users.filter(u => u.fullName.toLowerCase().includes(search.trim().toLowerCase()))}
                keyExtractor={item => item._id}
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
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
// REMOVE: import { useAuth } from '../../context/AuthContext';

function ChatWindow({ otherUser, onClose, messages, onSendMessage, chatId }: { otherUser: any, onClose: () => void, messages: any[], onSendMessage: (msg: any) => void, chatId: string }) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const flatListRef = React.useRef<FlatList>(null);

  // Sort messages ascending by timestamp (oldest first)
  const sortedMessages = [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  useEffect(() => {
    // Subscribe to socket for new messages, typing, seen, presence
    const onMessageNew = (payload: any) => {
      if (payload.message && payload.chatId === chatId) {
        // Append to active chat if open
        onSendMessage(payload.message);
      } else {
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
      console.log('lastMsg:', lastMsg);
      if (lastMsg && lastMsg.sender !== otherUser._id) {
        console.log('[SOCKET] emitting seen event:', { to: otherUser._id, messageId: lastMsg._id, chatId });
        socketService.emit('seen', { to: otherUser._id, messageId: lastMsg._id, chatId });
      }
    }
  }, [sortedMessages, otherUser, chatId]);

  // --- 1. When opening a chat, emit 'seen' for all unseen messages from the other user ---
  useEffect(() => {
    if (sortedMessages.length > 0) {
      const unseen = sortedMessages.filter(m => m.sender === otherUser._id && !m.seen);
      unseen.forEach(msg => {
        console.log('[SOCKET] emitting seen event:', { to: otherUser._id, messageId: msg._id, chatId });
        socketService.emit('seen', { to: otherUser._id, messageId: msg._id, chatId });
      });
    }
  }, [sortedMessages, otherUser, chatId]);

  // --- 2. When a 'seen' event is received, update the 'seen' property for the correct message(s) in both the open chat and the chat list ---
  // REMOVE the following useEffect from ChatWindow:
  // useEffect(() => {
  //   const onSeenGlobal = (payload: any) => {
  //     setActiveMessages((prevMsgs: any[]) => prevMsgs.map((m: any) => m._id === payload.messageId ? { ...m, seen: true } : m));
  //     setConversations((prev: any[]) => prev.map((chat: any) => {
  //       if (!chat.messages) return chat;
  //       const updatedMessages = chat.messages.map((m: any) =>
  //         m._id === payload.messageId ? { ...m, seen: true } : m
  //       );
  //       return { ...chat, messages: updatedMessages };
  //     }));
  //   };
  //   socketService.subscribe('seen', onSeenGlobal);
  //   return () => { socketService.unsubscribe('seen', onSeenGlobal); };
  // }, []);

  // In handleSend, update local state via onSendMessage
  const handleSend = async () => {
    if (!input.trim()) return;
    try {
      const res = await api.post(`/chat/${otherUser._id}/messages`, { text: input });
      onSendMessage(res.data.message);
      setInput('');
    } catch (e) {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles(theme).chatHeader}>
          <TouchableOpacity onPress={onClose} style={styles(theme).headerBack}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles(theme).headerAvatarWrap}>
            {otherUser.profilePic ? (
              <Image source={{ uri: otherUser.profilePic }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <Ionicons name="person-circle" size={44} color={isOnline ? theme.colors.primary : theme.colors.textSecondary} />
            )}
            {isOnline && <View style={styles(theme).onlineDot} />}
          </View>
          <View style={styles(theme).headerCenter}>
            <Text style={styles(theme).chatName}>{otherUser.fullName}</Text>
            <Text style={{ color: isOnline ? theme.colors.primary : theme.colors.textSecondary, fontSize: 12, textAlign: 'center' }}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={({ item, index }) => {
            const isOwn = item.sender !== otherUser._id;
            const isLastOwn = isOwn && index === sortedMessages.length - 1;
            // --- Ticks: single for sent, double for seen ---
            return (
              <View style={[styles(theme).bubble, item.sender === otherUser._id ? styles(theme).bubbleOther : styles(theme).bubbleOwn]}>
                <Text style={styles(theme).bubbleText}>{String(item.text || '')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Text style={styles(theme).bubbleTime}>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  {isOwn && (
                    isLastOwn && item._id === lastSeenId ? (
                      // Double tick (seen)
                      <Ionicons name="checkmark-done" size={16} color="#2196f3" style={{ marginLeft: 4 }} />
                    ) : (
                      // Single tick (sent)
                      <Ionicons name="checkmark" size={16} color="#aaa" style={{ marginLeft: 4 }} />
                    )
                  )}
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 12 }}
          // removed inverted
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        {isTyping && (
          <View style={{ marginLeft: 16, marginBottom: 4 }}>
            <Text style={{ color: theme.colors.textSecondary }}>Typing...</Text>
          </View>
        )}
        <View style={styles(theme).inputBar}>
          <TextInput
            style={styles(theme).input}
            value={input}
            onChangeText={handleInput}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textSecondary}
          />
          <TouchableOpacity onPress={handleSend} style={styles(theme).sendButton}>
            <Ionicons name="send" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function ChatModal() {
  console.log('ChatModal rendered');
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
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [activeMessages, setActiveMessages] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Move handleNewMessage here
  const handleNewMessage = (msg: any) => setActiveMessages((prev: any[]) => [...prev, msg]);

  // Helper to fetch chat and messages
  const openChatWithUser = async (user: any) => {
    setChatLoading(true);
    setError(null);
    try {
      console.log('Opening chat with user:', user._id);
      
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
        console.log('Failed to mark messages as seen:', e);
      }
      
      // Ensure chat data is properly structured
      const chat = (chatRes as any).data.chat;
      if (!chat) {
        throw new Error('No chat data received');
      }
      
      // Ensure participants are properly populated
      if (!chat.participants || !Array.isArray(chat.participants)) {
        console.warn('Chat participants not properly populated, using fallback');
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
      console.error('Error opening chat with user:', e);
      setError(`Failed to load chat: ${e.message || 'Unknown error'}`);
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
          setLoading(false);
        });
    }
  }, [params.userId]);

  // If no userId param, fetch chat conversations and following users
  useEffect(() => {
    console.log('Fetching chats useEffect running');
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
      console.log('Requesting chats for user:', myUserId);
      const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      const socket = io(API_BASE_URL, { path: '/socket.io', transports: ['websocket'] });
      socket.on('connect', () => {
        console.log('[SOCKET] connected to backend');
        socket.emit('test', { hello: 'world' });
      });
      socket.on('connect_error', (err) => {
        console.log('[SOCKET] connect_error:', err);
      });
      fetch(`${API_BASE_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          console.log('Fetch /chat data:', JSON.stringify(data, null, 2));
          let chats = data.chats || [];
          chats = chats.map((chat: any) => ({
            ...chat,
            me: myUserId,
          }));
          setConversations(chats);
          // Optionally fetch following users as before
          api.get('/profile/following')
            .then(followRes => setUsers(followRes.data.users || []))
            .catch(() => setUsers([]))
            .finally(() => setLoading(false));
        })
        .catch(err => {
          console.log('Fetch /chat error:', err);
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
    return <ChatWindow otherUser={selectedUser} onClose={() => {
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
          console.log('[SOCKET] connected to backend');
          socket.emit('test', { hello: 'world' });
        });
        socket.on('connect_error', (err) => {
          console.log('[SOCKET] connect_error:', err);
        });
        fetch(`${API_BASE_URL}/chat`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
          .then(res => res.json())
          .then(data => {
            console.log('Reloaded /chat data:', JSON.stringify(data, null, 2));
            let chats = data.chats || [];
            chats = chats.map((chat: any) => ({ ...chat, me: myUserId }));
            setConversations(chats);
          });
      };
      reloadChats();
    }} messages={activeMessages} onSendMessage={handleNewMessage} chatId={activeChat?._id} />;
  }
  if (chatLoading || loading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.colors.primary} size="large" /></SafeAreaView>;
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
  console.log('Rendering chat inbox, conversations:', conversations);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={styles(theme).header}>
        <Text style={styles(theme).title}>Chats</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowNewMessage(true)} style={{ marginRight: 12 }}>
            <Ionicons name="create-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles(theme).searchBar}>
        <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
        <TextInput
          style={styles(theme).searchInput}
          placeholder="Search chats..."
          placeholderTextColor={theme.colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 48 }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 16 }}>No conversations yet.</Text>
          {/* <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>{JSON.stringify(conversations)}</Text> */}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            console.log('Chat:', item._id, 'Messages:', item.messages?.map((m: any) => ({ _id: m._id, sender: m.sender, seen: m.seen, text: m.text })));
            let other = item.participants.find((u: any) => u._id !== item.me);
            // If participants is array of ObjectIds, fallback
            if (!other && Array.isArray(item.participants) && typeof item.participants[0] === 'string') {
              other = item.participants.find((id: string) => id !== item.me);
            }
            const unreadCount = item.messages?.filter((m: any) => m.sender === (other._id || other) && !m.seen).length || 0;
            return (
              <TouchableOpacity
                style={styles(theme).item}
                onPress={() => openChatWithUser(other)}
              >
                {/* Show avatar or fallback */}
                {other && other.profilePic ? (
                  <Image source={{ uri: other.profilePic }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                ) : (
                  <Ionicons name="person-circle" size={40} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles(theme).name}>{other ? String(other.fullName || other._id || other) : '[No other user found]'}</Text>
                  <Text style={styles(theme).lastMsg} numberOfLines={1}>{String(item.messages?.[item.messages.length-1]?.text || '')}</Text>
                </View>
                {unreadCount > 0 && (
                  <View style={{ backgroundColor: '#2196f3', borderRadius: 10, minWidth: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{unreadCount}</Text>
                  </View>
                )}
                {!other && (
                  <Text style={{ color: 'red', fontSize: 10, marginLeft: 8 }}>[Mapping error: no other user]</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
      {/* Only show New Message search if showNewMessage is true */}
      {showNewMessage && (
        <RNSafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.background, position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}>
          <View style={{ backgroundColor: theme.colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={[styles(theme).title, { flex: 1, textAlign: 'left' }]}>New Message</Text>
              <TouchableOpacity onPress={() => setShowNewMessage(false)} style={{ marginLeft: 12 }}>
                <Ionicons name="close" size={26} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles(theme).searchBar}>
            <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={styles(theme).searchInput}
              placeholder="Search followers..."
              placeholderTextColor={theme.colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            {loading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={users.filter(u => u.fullName.toLowerCase().includes(search.trim().toLowerCase()))}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles(theme).item, { alignItems: 'center' }]}
                    onPress={() => openChatWithUser(item)}
                  >
                    {item.profilePic ? (
                      <Image source={{ uri: item.profilePic }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                    ) : (
                      <Ionicons name="person-circle" size={40} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
                    )}
                    <Text style={styles(theme).name} numberOfLines={1} ellipsizeMode="tail">{String(item.fullName || '')}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </RNSafeAreaView>
      )}
    </SafeAreaView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: 12,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: theme.colors.text,
    fontSize: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  lastMsg: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chatWindow: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerBack: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerAvatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4cd137',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  bubble: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 18,
    maxWidth: '80%',
  },
  bubbleOwn: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bubbleText: {
    color: theme.colors.text,
    fontSize: 16,
  },
  bubbleTime: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.text,
    fontSize: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendButton: {
    padding: 8,
  },
});

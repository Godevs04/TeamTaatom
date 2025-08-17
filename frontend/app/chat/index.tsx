import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { socketService } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
// REMOVE: import { useAuth } from '../../context/AuthContext';

function ChatWindow({ otherUser, onClose, messages, onSendMessage }: { otherUser: any, onClose: () => void, messages: any[], onSendMessage: (msg: any) => void }) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const flatListRef = React.useRef<FlatList>(null);

  useEffect(() => {
    // Subscribe to socket for new messages, typing, seen, presence
    const onMessage = (payload: any) => {
      if (payload.message && payload.message.sender === otherUser._id) {
        // Only update messages if they are not already present (e.g., from initial load)
        // This prevents duplicates if the user is already in the chat window
        if (!messages.some(msg => msg._id === payload.message._id)) {
          // setMessages(prev => [...prev, payload.message]); // Removed setMessages
        }
      }
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
    socketService.subscribe('receiveMessage', onMessage);
    socketService.subscribe('typing', onTyping);
    socketService.subscribe('seen', onSeen);
    socketService.subscribe('user:online', onOnline);
    socketService.subscribe('user:offline', onOffline);
    return () => {
      socketService.unsubscribe('receiveMessage', onMessage);
      socketService.unsubscribe('typing', onTyping);
      socketService.unsubscribe('seen', onSeen);
      socketService.unsubscribe('user:online', onOnline);
      socketService.unsubscribe('user:offline', onOffline);
    };
  }, [otherUser, messages]); // Add messages to dependency array

  // Emit typing event
  const handleInput = (text: string) => {
    setInput(text);
    socketService.emit('typing', { to: otherUser._id });
  };

  // Emit seen event when chat is opened or scrolled to bottom
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender !== otherUser._id) {
        socketService.emit('seen', { to: otherUser._id, messageId: lastMsg._id });
      }
    }
  }, [messages, otherUser]);

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
          data={messages}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={({ item, index }) => {
            const isOwn = item.sender !== otherUser._id;
            const isLastOwn = isOwn && index === messages.length - 1;
            return (
              <View style={[styles(theme).bubble, item.sender === otherUser._id ? styles(theme).bubbleOther : styles(theme).bubbleOwn]}>
                <Text style={styles(theme).bubbleText}>{String(item.text || '')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Text style={styles(theme).bubbleTime}>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  {isLastOwn && item._id === lastSeenId ? (
                    <Ionicons name="checkmark-done" size={16} color="#2196f3" style={{ marginLeft: 4 }} />
                  ) : null}
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 12 }}
          inverted
          onContentSizeChange={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
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
  // Hardcode user ID for immediate fix
  const myUserId = '689f1ceb8cc7779086cdb071';
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
      const chatRes = await api.get(`/chat/${user._id}`);
      const messagesRes = await api.get(`/chat/${user._id}/messages`);
      setActiveChat(chatRes.data.chat);
      setActiveMessages(messagesRes.data.messages || []);
      setSelectedUser(user);
    } catch (e) {
      setError('Failed to load chat.');
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
    console.log('Requesting chats for user:', myUserId);
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
      const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      fetch(`${API_BASE_URL}/chat`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          console.log('Fetch /chat data:', data);
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
    }} messages={activeMessages} onSendMessage={handleNewMessage} />;
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
          <Text style={{ color: theme.colors.textSecondary, fontSize: 10 }}>{JSON.stringify(conversations)}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            console.log('Rendering chat item:', item);
            let other = item.participants.find((u: any) => u._id !== myUserId);
            // If participants is array of ObjectIds, fallback
            if (!other && Array.isArray(item.participants) && typeof item.participants[0] === 'string') {
              other = item.participants.find((id: string) => id !== myUserId);
            }
            const unreadCount = item.messages?.filter((m: any) => other && m.sender === (other._id || other) && !m.seen).length || 0;
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
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.background }}>
          <View style={styles(theme).header}>
            <Text style={styles(theme).title}>New Message</Text>
            <TouchableOpacity onPress={() => setShowNewMessage(false)}>
              <Ionicons name="close" size={26} color={theme.colors.text} />
            </TouchableOpacity>
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
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={users.filter(u => u.fullName.toLowerCase().includes(search.trim().toLowerCase()))}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles(theme).item}
                  onPress={() => openChatWithUser(item)}
                >
                  {item.profilePic ? (
                    <Image source={{ uri: item.profilePic }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                  ) : (
                    <Ionicons name="person-circle" size={40} color={theme.colors.textSecondary} style={{ marginRight: 12 }} />
                  )}
                  <Text style={styles(theme).name}>{String(item.fullName || '')}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
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

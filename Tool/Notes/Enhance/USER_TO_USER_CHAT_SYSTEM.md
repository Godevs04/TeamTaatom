# User-to-User Chat System Implementation

## Table of Contents
1. [Business Overview](#business-overview)
2. [Technical Architecture](#technical-architecture)
3. [Database Schema](#database-schema)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Real-Time Communication (Socket.IO)](#real-time-communication-socketio)
7. [API Endpoints](#api-endpoints)
8. [Security & Privacy](#security--privacy)
9. [Features & Functionality](#features--functionality)
10. [Performance Optimization](#performance-optimization)
11. [Future Enhancements](#future-enhancements)

---

## Business Overview

### Purpose
The User-to-User Chat System enables direct, real-time messaging between users within the Taatom platform. This feature facilitates:
- **Social Interaction**: Users can communicate with each other directly
- **Community Building**: Enhances user engagement and retention
- **Support Integration**: Seamlessly integrates with admin support chat system
- **User Experience**: Provides instant messaging capabilities similar to modern social platforms

### Business Value
- **Increased Engagement**: Real-time messaging keeps users active on the platform
- **User Retention**: Direct communication strengthens user relationships
- **Scalability**: Built to handle growing user base with efficient architecture
- **Monetization Potential**: Foundation for premium features (e.g., group chats, media sharing)

### User Flows
1. **Initiating a Chat**: User clicks on another user's profile → Opens chat window
2. **Sending Messages**: User types message → Sends → Real-time delivery to recipient
3. **Receiving Messages**: User receives notification → Opens chat → Views message
4. **Chat Management**: User can mute, clear, or block chat conversations

---

## Technical Architecture

### System Components

```
┌─────────────────┐
│   Frontend      │
│  (React Native) │
└────────┬────────┘
         │
         │ HTTP/REST API
         │ WebSocket (Socket.IO)
         │
┌────────▼────────┐
│   Backend       │
│  (Express.js)   │
└────────┬────────┘
         │
         │ MongoDB Queries
         │
┌────────▼────────┐
│   Database      │
│   (MongoDB)     │
└─────────────────┘
```

### Technology Stack
- **Backend**: Node.js, Express.js, Socket.IO, MongoDB, Mongoose
- **Frontend**: React Native, Expo, Socket.IO Client
- **Database**: MongoDB (NoSQL)
- **Real-Time**: Socket.IO (WebSocket with polling fallback)

---

## Database Schema

### Chat Model (`backend/src/models/Chat.js`)

```javascript
const ChatSchema = new Schema({
  participants: [{ 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true 
  }],
  messages: [MessageSchema],
  type: {
    type: String,
    enum: ['user_chat', 'admin_support'],
    default: 'user_chat',
    index: true
  },
  relatedEntity: {
    type: {
      type: String,
      enum: ['trip_verification', 'support'],
      default: null
    },
    refId: {
      type: Types.ObjectId,
      default: null
    }
  },
  status: {
    type: String,
    enum: ['open', 'waiting_user', 'resolved'],
    default: 'open'
  },
  assignedAdminId: {
    type: Types.ObjectId,
    ref: 'SuperAdmin',
    default: null
  }
}, { timestamps: true });
```

### Message Schema (Embedded in Chat)

```javascript
const MessageSchema = new Schema({
  sender: { 
    type: Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  seen: { 
    type: Boolean, 
    default: false 
  }
});
```

### Database Indexes
- `participants: 1` - Fast lookup of chats by participants
- `messages.timestamp: -1` - Efficient message sorting
- `updatedAt: -1` - Chat list sorting by last activity
- `participants: 1, updatedAt: -1` - Compound index for user's chat queries

---

## Backend Implementation

### Core Files

#### 1. Chat Controller (`backend/src/controllers/chat.controller.js`)

**Key Functions:**

- **`listChats`**: Retrieves all chats for the authenticated user
  - Deduplicates chats by participants
  - Separates `user_chat` and `admin_support` chats
  - Sorts by `updatedAt` (most recent first)
  - Populates participant details (name, profile picture, verification status)

- **`getChat`**: Gets or creates a chat between two users
  - Validates user IDs
  - Checks blocking status
  - Creates new chat if doesn't exist
  - Returns chat with populated participants

- **`getMessages`**: Retrieves all messages for a specific chat
  - Validates user permissions
  - Returns messages array sorted by timestamp

- **`sendMessage`**: Sends a new message
  - Validates message text
  - Checks user blocking status
  - Finds or creates chat
  - Adds message to chat
  - Emits real-time Socket.IO events
  - Sends push notification to recipient
  - Updates chat `updatedAt` timestamp

- **`markMessageSeen`**: Marks a specific message as seen
  - Validates user is participant
  - Updates message `seen` status
  - Emits Socket.IO event to sender

- **`markAllMessagesSeen`**: Marks all messages from other user as seen
  - Updates all unread messages
  - Emits Socket.IO event

- **`clearChat`**: Deletes all messages in a chat
  - Removes all messages from array
  - Preserves chat document

- **`toggleMuteChat`**: Mutes/unmutes chat notifications
  - Stores mute status in user preferences

**Security Checks:**
- JWT authentication required for all endpoints
- User blocking validation
- Participant verification
- Prevents spoofing (users cannot send as system user)

#### 2. Chat Routes (`backend/src/routes/chat.routes.js`)

```javascript
// GET /api/v1/chat - List all chats
router.get('/', authMiddleware, chatController.listChats);

// GET /api/v1/chat/:otherUserId - Get specific chat
router.get('/:otherUserId', authMiddleware, chatController.getChat);

// GET /api/v1/chat/:otherUserId/messages - Get messages
router.get('/:otherUserId/messages', authMiddleware, chatController.getMessages);

// POST /api/v1/chat/:otherUserId/messages - Send message
router.post('/:otherUserId/messages', authMiddleware, chatController.sendMessage);

// POST /api/v1/chat/:otherUserId/mark-all-seen - Mark all as seen
router.post('/:otherUserId/mark-all-seen', authMiddleware, chatController.markAllMessagesSeen);

// DELETE /api/v1/chat/:otherUserId/messages - Clear chat
router.delete('/:otherUserId/messages', authMiddleware, chatController.clearChat);

// POST /api/v1/chat/:otherUserId/mute - Toggle mute
router.post('/:otherUserId/mute', authMiddleware, chatController.toggleMuteChat);

// GET /api/v1/chat/:otherUserId/mute-status - Get mute status
router.get('/:otherUserId/mute-status', authMiddleware, chatController.getMuteStatus);
```

---

## Frontend Implementation

### Core Files

#### 1. Chat Service (`frontend/services/chat.ts`)

Provides TypeScript interfaces and API functions:

```typescript
interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    fullName: string;
    profilePic: string;
  }>;
  messages: Array<{
    _id: string;
    sender: string;
    text: string;
    timestamp: string;
    seen: boolean;
  }>;
  updatedAt: string;
  createdAt: string;
}

// API Functions
- listChats(): Promise<ChatListResponse>
- getChat(otherUserId: string): Promise<ChatResponse>
- getMessages(otherUserId: string): Promise<MessagesResponse>
- sendMessage(otherUserId: string, text: string): Promise<{success: boolean; message: any}>
- markAllMessagesSeen(otherUserId: string): Promise<{success: boolean; message: string}>
- clearChat(otherUserId: string): Promise<{success: boolean; message: string}>
- toggleMuteChat(otherUserId: string): Promise<{success: boolean; muted: boolean; message: string}>
- getMuteStatus(otherUserId: string): Promise<{muted: boolean}>
```

#### 2. Socket Service (`frontend/services/socket.ts`)

Manages WebSocket connection and real-time events:

**Key Features:**
- Automatic reconnection with exponential backoff
- Message queuing for offline scenarios
- Connection state tracking
- Event subscription/unsubscription system
- URL change detection (for dynamic IP addresses)

**Connection Flow:**
1. Retrieves JWT token from AsyncStorage
2. Connects to Socket.IO server at `/app` namespace
3. Authenticates using JWT token
4. Joins user-specific room (`user:${userId}`)
5. Subscribes to real-time events

**Event Handling:**
- `message:new` - New message received
- `message:sent` - Message sent confirmation
- `chat:update` - Chat list update
- `typing` - User is typing indicator
- `seen` - Message seen confirmation
- `user:online` - User came online
- `user:offline` - User went offline

#### 3. Chat Window Component (`frontend/app/chat/index.tsx`)

**Features:**
- Real-time message display
- Typing indicators
- Online/offline status
- Read receipts (seen indicators)
- Message input with send button
- Auto-scroll to latest message
- Block/unblock user functionality
- Mute/unmute chat
- Clear chat history
- Voice and video call integration

**State Management:**
- Local state for messages, input, typing status
- Socket subscriptions for real-time updates
- Optimistic UI updates for better UX

---

## Real-Time Communication (Socket.IO)

### Backend Socket Setup (`backend/src/socket/index.js`)

#### Initialization

```javascript
function setupSocket(server) {
  io = new Server(server, {
    path: WS_PATH, // '/socket.io'
    cors: {
      origin: WS_ALLOWED_ORIGIN,
      credentials: true,
    },
  });
  
  const nsp = io.of('/app'); // Namespace for app events
  // ... authentication and event handlers
}
```

#### Authentication Middleware

```javascript
nsp.use(async (socket, next) => {
  // Extract JWT token from handshake
  let token = socket.handshake.auth?.token || 
              socket.handshake.query?.auth ||
              socket.handshake.headers?.authorization?.split(' ')[1];
  
  // Verify token
  const payload = jwt.verify(token, JWT_SECRET);
  socket.user = payload;
  socket.userId = payload.userId || payload._id || payload.id;
  
  // Join user-specific room
  socket.join(`user:${socket.userId}`);
  
  // Track online users
  if (!onlineUsers.has(socket.userId)) {
    onlineUsers.set(socket.userId, new Set());
  }
  onlineUsers.get(socket.userId).add(socket.id);
  
  // Notify user is online
  nsp.to(`user:${socket.userId}`).emit('user:online', { userId: socket.userId });
  
  return next();
});
```

#### Event Handlers

**1. Typing Indicator**
```javascript
socket.on('typing', ({ to }) => {
  if (to) emitToUser(to, 'typing', { from: socket.userId });
});
```

**2. Message Seen**
```javascript
socket.on('seen', async ({ to, messageId, chatId }) => {
  // Find chat if chatId not provided
  if (!chatId && to && messageId) {
    const chat = await Chat.findOne({ 
      participants: { $all: [socket.userId, to] }, 
      'messages._id': messageId 
    });
    if (chat) chatId = chat._id;
  }
  
  // Mark message as seen in database
  if (chatId && messageId) {
    await chatController.markMessageSeen(chatId, messageId, socket.userId);
  }
  
  // Emit to sender
  if (to) emitToUser(to, 'seen', { from: socket.userId, messageId });
});
```

**3. Send Message (Real-Time)**
```javascript
socket.on('sendMessage', async ({ to, text }) => {
  // Find or create chat
  let chat = await Chat.findOne({ 
    participants: { $all: [socket.userId, to] } 
  });
  if (!chat) {
    chat = await Chat.create({ 
      participants: [socket.userId, to], 
      messages: [] 
    });
  }
  
  // Add message
  const message = { 
    sender: socket.userId, 
    text, 
    timestamp: new Date() 
  };
  chat.messages.push(message);
  await chat.save();
  
  // Emit to recipient
  emitToUser(to, 'message:new', { chatId: chat._id, message });
  
  // Emit ack to sender
  emitToUser(socket.userId, 'message:sent', { chatId: chat._id, message });
  
  // Update chat list for both users
  emitToUser(to, 'chat:update', { 
    chatId: chat._id, 
    lastMessage: message.text, 
    timestamp: message.timestamp 
  });
  emitToUser(socket.userId, 'chat:update', { 
    chatId: chat._id, 
    lastMessage: message.text, 
    timestamp: message.timestamp 
  });
});
```

**4. Disconnect Handler**
```javascript
socket.on('disconnect', () => {
  // Remove socket from online users
  if (onlineUsers.has(socket.userId)) {
    onlineUsers.get(socket.userId).delete(socket.id);
    if (onlineUsers.get(socket.userId).size === 0) {
      onlineUsers.delete(socket.userId);
    }
  }
  
  // Notify user is offline
  nsp.to(`user:${socket.userId}`).emit('user:offline', { userId: socket.userId });
});
```

### Frontend Socket Integration

#### Connection

```typescript
// Connect to socket server
const socket = await socketService.connect();

// Subscribe to events
socketService.subscribe('message:new', (payload) => {
  // Handle new message
  const { chatId, message } = payload;
  // Update local state
});

socketService.subscribe('message:sent', (payload) => {
  // Handle message sent confirmation
});

socketService.subscribe('chat:update', (payload) => {
  // Handle chat list update
  // Refresh chat list UI
});

socketService.subscribe('typing', (payload) => {
  // Show typing indicator
  const { from } = payload;
  // Update typing state
});

socketService.subscribe('seen', (payload) => {
  // Update message seen status
  const { from, messageId } = payload;
  // Mark message as seen in UI
});
```

#### Sending Events

```typescript
// Send typing indicator
socketService.emit('typing', { to: otherUserId });

// Mark message as seen
socketService.emit('seen', { 
  to: otherUserId, 
  messageId: messageId, 
  chatId: chatId 
});
```

---

## API Endpoints

### Base URL
```
/api/v1/chat
```

### Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | List all chats | Yes |
| GET | `/:otherUserId` | Get specific chat | Yes |
| GET | `/:otherUserId/messages` | Get messages | Yes |
| POST | `/:otherUserId/messages` | Send message | Yes |
| POST | `/:otherUserId/mark-all-seen` | Mark all as seen | Yes |
| DELETE | `/:otherUserId/messages` | Clear chat | Yes |
| POST | `/:otherUserId/mute` | Toggle mute | Yes |
| GET | `/:otherUserId/mute-status` | Get mute status | Yes |

### Request/Response Examples

#### List Chats
```http
GET /api/v1/chat
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Chats fetched successfully",
  "data": {
    "chats": [
      {
        "_id": "chat_id",
        "participants": [
          {
            "_id": "user1_id",
            "fullName": "User One",
            "profilePic": "url",
            "isVerified": true
          },
          {
            "_id": "user2_id",
            "fullName": "User Two",
            "profilePic": "url",
            "isVerified": false
          }
        ],
        "messages": [...],
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Send Message
```http
POST /api/v1/chat/:otherUserId/messages
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "text": "Hello, how are you?"
}

Response:
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "_id": "message_id",
      "sender": "user_id",
      "text": "Hello, how are you?",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "seen": false
    }
  }
}
```

---

## Security & Privacy

### Authentication
- All endpoints require JWT authentication
- Socket.IO connections authenticated via JWT token
- Token validated on every request

### Authorization
- Users can only access chats they are participants in
- Blocked users cannot send/receive messages
- System user (Taatom Official) protected from spoofing

### Privacy Features
- **User Blocking**: Blocked users cannot initiate or continue chats
- **Mute Functionality**: Users can mute chat notifications
- **Clear Chat**: Users can delete their chat history
- **Read Receipts**: Users can see when messages are read

### Data Protection
- Messages stored securely in MongoDB
- No message content logged in production
- User IDs validated before database queries
- Input sanitization for message text

---

## Features & Functionality

### Core Features

1. **Real-Time Messaging**
   - Instant message delivery via Socket.IO
   - Optimistic UI updates for better UX
   - Message queuing for offline scenarios

2. **Chat List**
   - Shows all conversations
   - Sorted by last activity
   - Displays last message preview
   - Unread message count

3. **Message Features**
   - Text messages
   - Timestamps
   - Read receipts (seen indicators)
   - Message status (sent, seen)

4. **User Presence**
   - Online/offline status
   - Real-time updates

5. **Typing Indicators**
   - Shows when other user is typing
   - Real-time updates

6. **Chat Management**
   - Mute/unmute notifications
   - Clear chat history
   - Block/unblock users

### Advanced Features

1. **Multi-Device Support**
   - Messages synced across all devices
   - Socket.IO rooms for user-specific events
   - Online status tracked per device

2. **Push Notifications**
   - Expo Push Notifications for mobile
   - Notifications sent when user is offline
   - Custom notification sounds

3. **Admin Support Integration**
   - Seamless integration with admin support chat
   - Same chat model for both user and admin chats
   - Type differentiation (`user_chat` vs `admin_support`)

---

## Performance Optimization

### Database Optimizations

1. **Indexes**
   - Compound indexes for common queries
   - Index on `participants` for fast chat lookup
   - Index on `messages.timestamp` for sorting

2. **Query Optimization**
   - Lean queries for read operations
   - Selective field population
   - Pagination support (future)

3. **Caching Strategy**
   - Chat list cached on frontend
   - Messages loaded on-demand
   - Optimistic updates reduce API calls

### Socket.IO Optimizations

1. **Room Management**
   - User-specific rooms (`user:${userId}`)
   - Efficient event broadcasting
   - Connection pooling

2. **Message Queuing**
   - Queue messages when offline
   - Automatic retry on reconnection
   - Queue size limits (100 messages, 5 minutes)

3. **Connection Management**
   - Automatic reconnection
   - Exponential backoff
   - Connection state tracking

### Frontend Optimizations

1. **State Management**
   - Local state for messages
   - Optimistic UI updates
   - Debounced typing indicators

2. **Rendering**
   - FlatList for message rendering
   - Virtual scrolling for long chats
   - Memoization for expensive components

---

## Future Enhancements

### Planned Features

1. **Media Support**
   - Image sharing
   - Video sharing
   - File attachments
   - Voice messages

2. **Group Chats**
   - Multi-user conversations
   - Group management
   - Group settings

3. **Message Reactions**
   - Emoji reactions
   - Message replies
   - Message forwarding

4. **Advanced Features**
   - Message search
   - Message editing/deletion
   - Message pinning
   - Chat archiving

5. **Analytics**
   - Message delivery rates
   - User engagement metrics
   - Chat performance monitoring

### Technical Improvements

1. **Scalability**
   - Redis for message queuing
   - Horizontal scaling with Socket.IO adapters
   - Database sharding

2. **Reliability**
   - Message persistence guarantees
   - Delivery receipts
   - Message retry mechanism

3. **Performance**
   - Message pagination
   - Lazy loading
   - Background sync

---

## Implementation Timeline

### Phase 1: Core Functionality ✅
- Database schema design
- Basic API endpoints
- Socket.IO setup
- Frontend chat UI

### Phase 2: Real-Time Features ✅
- Real-time messaging
- Typing indicators
- Read receipts
- Online/offline status

### Phase 3: Advanced Features ✅
- Chat management (mute, clear, block)
- Push notifications
- Multi-device support
- Admin support integration

### Phase 4: Future Enhancements (Planned)
- Media sharing
- Group chats
- Message reactions
- Advanced analytics

---

## Testing

### Unit Tests
- Chat controller functions
- Socket event handlers
- Message validation

### Integration Tests
- API endpoint testing
- Socket.IO connection testing
- Database operations

### E2E Tests
- Complete chat flow
- Multi-device scenarios
- Offline/online transitions

---

## Troubleshooting

### Common Issues

1. **Socket Connection Failed**
   - Check JWT token validity
   - Verify server URL
   - Check network connectivity
   - Review CORS settings

2. **Messages Not Delivered**
   - Check Socket.IO connection status
   - Verify user blocking status
   - Review server logs
   - Check database connectivity

3. **Read Receipts Not Updating**
   - Verify Socket.IO event emission
   - Check message seen handler
   - Review database update logic

---

## Conclusion

The User-to-User Chat System is a comprehensive, real-time messaging solution built with modern technologies. It provides a solid foundation for user communication with room for future enhancements. The architecture is scalable, secure, and optimized for performance.

### Key Achievements
- ✅ Real-time messaging with Socket.IO
- ✅ Secure authentication and authorization
- ✅ Multi-device support
- ✅ Push notifications
- ✅ Chat management features
- ✅ Admin support integration

### Next Steps
- Implement media sharing
- Add group chat functionality
- Enhance analytics and monitoring
- Optimize for larger scale

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-01  
**Author**: Development Team  
**Status**: Production Ready


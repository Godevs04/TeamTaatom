# Taatom Chat System - Complete Technical & Business Documentation

## Table of Contents
1. [Overview](#overview)
2. [Business Logic & Use Cases](#business-logic--use-cases)
3. [System Architecture](#system-architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Real-Time Communication](#real-time-communication)
7. [Data Models](#data-models)
8. [API Endpoints](#api-endpoints)
9. [Socket Events](#socket-events)
10. [Key Features](#key-features)
11. [Common Issues & Solutions](#common-issues--solutions)
12. [Development Guide](#development-guide)

---

## Overview

The Taatom chat system is a **real-time messaging platform** that enables users to communicate with each other and with the Taatom Official support account. It uses **Socket.IO** for real-time bidirectional communication and **MongoDB** for persistent message storage.

### Core Components
- **Backend**: Node.js/Express with Socket.IO server
- **Frontend**: React Native (Expo) with Socket.IO client
- **Database**: MongoDB with Mongoose ODM
- **Real-Time**: WebSocket connections via Socket.IO

---

## Business Logic & Use Cases

### 1. User-to-User Chat
**Purpose**: Enable direct messaging between two users

**Business Rules**:
- Users can only chat if neither has blocked the other
- Each conversation is a unique chat document with both users as participants
- Messages are stored in chronological order within the chat document
- Users can see read receipts (seen indicators)
- Users can mute/unmute chat notifications
- Users can clear chat history (deletes all messages but keeps chat document)

**Flow**:
1. User A wants to message User B
2. System checks if either user has blocked the other
3. If allowed, system finds or creates a chat document with both as participants
4. Messages are sent via HTTP POST and broadcast via WebSocket
5. Both users receive real-time updates

### 2. Admin Support Chat
**Purpose**: Enable users to contact Taatom Official for support

**Business Rules**:
- Messages to Taatom Official (`TAATOM_OFFICIAL_USER_ID`) create `admin_support` type chats
- Regular users cannot send messages AS Taatom Official (anti-spoofing)
- Admin support chats have special status tracking: `open`, `waiting_user`, `resolved`
- When a user replies to an admin support chat, status changes to `open`
- Admin support chats are separate from regular user chats in the UI
- Admins can view all admin support conversations in real-time

**Flow**:
1. User sends message to Taatom Official
2. System creates or finds `admin_support` type chat
3. Message is stored and broadcast to user and admin rooms
4. Admins see the message in their admin panel
5. Admin replies appear in the user's chat

### 3. Chat List Management
**Purpose**: Display all conversations sorted by most recent activity

**Business Rules**:
- Chats are sorted by `updatedAt` (most recent first)
- Each chat shows: other participant's name, profile picture, last message preview, timestamp
- Unread message count is calculated based on `seen` status
- Duplicate chats (same participants) are deduplicated, keeping the most recent
- Admin support chats are kept separate from user chats

### 4. Read Receipts
**Purpose**: Show when messages have been seen

**Business Rules**:
- Messages have a `seen` boolean field (default: `false`)
- When a user opens a chat, all messages from the other user are marked as seen
- Real-time `seen` events are broadcast to the sender
- Read receipts update in real-time via WebSocket

### 5. Typing Indicators
**Purpose**: Show when the other user is typing

**Business Rules**:
- Typing events are sent via WebSocket (not stored in database)
- Typing indicator shows for a few seconds after last typing event
- Typing events are sent to the recipient only

### 6. Online/Offline Status
**Purpose**: Show if the other user is currently online

**Business Rules**:
- Users are tracked as online when they have an active WebSocket connection
- Users can have multiple devices connected simultaneously
- When all connections close, user is marked offline
- Taatom Official is always shown as online

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   React Native  │◄──────►│  Socket.IO      │◄──────►│   MongoDB       │
│     Client      │         │     Server       │         │   Database      │
└─────────────────┘         └─────────────────┘         └─────────────────┘
         │                           │                           │
         │                           │                           │
         │  HTTP REST API            │                           │
         └───────────────────────────┘                           │
                                                                 │
                                                          ┌───────┴───────┐
                                                          │  Chat Model   │
                                                          │  User Model   │
                                                          └───────────────┘
```

### Component Hierarchy

**Frontend**:
```
ChatModal (Main Container)
├── ChatList (List of conversations)
│   └── ChatItem (Individual chat preview)
└── ChatWindow (Active conversation)
    ├── MessageList (FlatList of messages)
    ├── MessageInput (Text input + send button)
    ├── TypingIndicator
    └── OnlineStatusIndicator
```

**Backend**:
```
Express Server
├── Socket.IO Server (/app namespace)
│   ├── Authentication Middleware
│   ├── Connection Handlers
│   └── Event Handlers
└── REST API Routes
    └── Chat Controller
        ├── listChats
        ├── getChat
        ├── getMessages
        ├── sendMessage
        ├── markAllMessagesSeen
        ├── clearChat
        ├── toggleMuteChat
        └── getMuteStatus
```

---

## Backend Implementation

### 1. Socket Server Setup (`backend/src/socket/index.js`)

**Initialization**:
```javascript
const io = new Server(server, {
  path: WS_PATH, // '/socket.io'
  cors: {
    origin: WS_ALLOWED_ORIGIN,
    credentials: true,
  },
});

const nsp = io.of('/app'); // Namespace for app events
```

**Key Features**:
- Uses `/app` namespace for all application events
- JWT authentication middleware validates tokens
- Tracks online users in `onlineUsers` Map (userId → Set<socketId>)
- Supports multiple devices per user

**Authentication Flow**:
1. Client sends JWT token in `auth.token`, `query.auth`, or `Authorization` header
2. Server verifies token and extracts `userId`
3. Socket joins `user:${userId}` room automatically
4. Socket ID is added to user's online set
5. `user:online` event is emitted to user's room

### 2. Chat Controller (`backend/src/controllers/chat.controller.js`)

#### Key Functions:

**`listChats`**:
- Fetches all chats where current user is a participant
- Populates participant details (name, profile picture)
- Generates signed URLs for profile pictures (S3/cloud storage)
- Deduplicates chats by participants (keeps most recent)
- Separates `admin_support` chats from `user_chat` chats
- Returns chats sorted by `updatedAt` (newest first)

**`getChat`**:
- Finds or creates chat between two users
- Validates user IDs and checks blocking status
- Returns chat with populated participants

**`sendMessage`**:
- Validates message text and recipient
- Checks blocking status (except for admin support)
- Finds or creates chat document
- Creates message object with `sender`, `text`, `timestamp`
- Saves message to chat's `messages` array
- Emits real-time events via Socket.IO:
  - `message:new` to recipient
  - `message:sent` to sender
  - `chat:update` to both users
- Sends push notification to recipient (if Expo token exists)
- For admin support: emits to admin rooms

**`markAllMessagesSeen`**:
- Marks all messages from other user as `seen: true`
- Updates database and triggers real-time updates

**`clearChat`**:
- Removes all messages from chat document
- Keeps chat document intact (for future messages)
- Emits `chat:cleared` event to both users

**`toggleMuteChat`**:
- Adds/removes chat from user's `mutedChats` array
- Used to suppress notifications for specific chats

### 3. Chat Model (`backend/src/models/Chat.js`)

**Schema Structure**:
```javascript
{
  participants: [ObjectId], // Array of 2 user IDs
  messages: [{
    sender: ObjectId,
    text: String,
    timestamp: Date,
    seen: Boolean
  }],
  type: 'user_chat' | 'admin_support',
  relatedEntity: {
    type: 'trip_verification' | 'support',
    refId: ObjectId
  },
  status: 'open' | 'waiting_user' | 'resolved',
  assignedAdminId: ObjectId,
  updatedAt: Date,
  createdAt: Date
}
```

**Indexes**:
- `participants: 1` - Fast lookup by participants
- `messages.timestamp: -1` - Fast message sorting
- `updatedAt: -1` - Fast chat list sorting
- `participants: 1, updatedAt: -1` - Compound index for user's chats

---

## Frontend Implementation

### 1. Socket Service (`frontend/services/socket.ts`)

**Purpose**: Manages WebSocket connection and event subscription

**Key Features**:
- Automatic reconnection with exponential backoff
- Message queuing for offline scenarios
- Connection state tracking (`connecting`, `connected`, `disconnected`, `reconnecting`)
- URL change detection (handles dynamic IP addresses)
- Event subscription/unsubscription system

**Connection Flow**:
1. Retrieves JWT token from AsyncStorage
2. Gets API base URL dynamically (handles IP changes)
3. Connects to Socket.IO server at `${apiBaseUrl}/app`
4. Authenticates using JWT token in `auth` and `query` params
5. Joins `user:${userId}` room after connection
6. Sets up `onAny` handler to forward all events to subscribers

**Key Methods**:
- `connect()`: Establishes WebSocket connection
- `disconnect()`: Closes connection
- `emit(event, ...args)`: Sends event to server (queues if offline)
- `subscribe(event, callback)`: Registers event listener
- `unsubscribe(event, callback)`: Removes event listener
- `isConnected()`: Returns connection status

**Event Forwarding**:
- Uses `socket.onAny()` to catch all events
- Forwards events to registered listeners via callback
- Handles payload extraction (Socket.IO sends payload as first argument)

### 2. Chat Service (`frontend/services/chat.ts`)

**Purpose**: HTTP API client for chat operations

**Methods**:
- `listChats()`: GET `/api/v1/chat` - Get all chats
- `getChat(otherUserId)`: GET `/api/v1/chat/:otherUserId` - Get specific chat
- `getMessages(otherUserId)`: GET `/api/v1/chat/:otherUserId/messages` - Get messages
- `sendMessage(otherUserId, text)`: POST `/api/v1/chat/:otherUserId/messages` - Send message
- `markAllMessagesSeen(otherUserId)`: POST `/api/v1/chat/:otherUserId/mark-all-seen` - Mark as seen
- `clearChat(otherUserId)`: DELETE `/api/v1/chat/:otherUserId/messages` - Clear chat
- `toggleMuteChat(otherUserId)`: POST `/api/v1/chat/:otherUserId/mute` - Toggle mute
- `getMuteStatus(otherUserId)`: GET `/api/v1/chat/:otherUserId/mute-status` - Get mute status

### 3. Chat UI (`frontend/app/chat/index.tsx`)

**Main Component: `ChatModal`**

**State Management**:
- `conversations`: Array of chat objects (from `listChats`)
- `activeChat`: Currently open chat object
- `activeMessages`: Messages for active chat
- `selectedUser`: User selected for new chat
- `search`: Search query for filtering chats

**Key Features**:
- Chat list with search functionality
- Real-time message updates via Socket.IO
- Optimistic UI updates (shows sent messages immediately)
- Unread message count badges
- Last message preview and timestamp
- Profile picture display with signed URLs

**Chat Window Component**:
- Message list with FlatList (virtualized for performance)
- Text input with send button
- Typing indicator
- Online/offline status
- Read receipts (seen indicators)
- Block/unblock user functionality
- Mute/unmute chat
- Clear chat history
- Voice and video call integration

**Real-Time Updates**:
- Subscribes to `message:new` for incoming messages
- Subscribes to `message:sent` for send confirmation
- Subscribes to `chat:update` for chat list updates
- Subscribes to `typing` for typing indicators
- Subscribes to `seen` for read receipts
- Subscribes to `user:online`/`user:offline` for presence

**Message Handling**:
- Messages are sorted by timestamp (oldest first)
- Sender's messages appear on right, recipient's on left
- Timestamps displayed in relative format (e.g., "2 minutes ago")
- Auto-scroll to latest message on new message
- Handles Buffer object serialization from backend (normalizes IDs)

---

## Real-Time Communication

### Socket Events Flow

#### Sending a Message:

```
User Types Message
    │
    ▼
Frontend: sendMessage(otherUserId, text)
    │
    ▼
HTTP POST /api/v1/chat/:otherUserId/messages
    │
    ▼
Backend: chat.controller.sendMessage()
    │
    ├─► Save to MongoDB
    │
    ├─► Emit 'message:new' to recipient (user:${otherUserId})
    │
    ├─► Emit 'message:sent' to sender (user:${userId})
    │
    └─► Emit 'chat:update' to both users
```

#### Receiving a Message:

```
Backend emits 'message:new'
    │
    ▼
Socket.IO forwards to client
    │
    ▼
Frontend: socketService.onAny() catches event
    │
    ▼
Frontend: Registered listener (handleNewMessage) called
    │
    ▼
Frontend: Updates local state (activeMessages)
    │
    ▼
UI re-renders with new message
```

### Event Types

#### Client → Server Events:
- `sendMessage`: Send a new message
- `typing`: User is typing
- `seen`: Mark message as seen
- `join`: Join a room
- `leave`: Leave a room
- `call:invite`: Initiate a call
- `call:accept`: Accept a call
- `call:reject`: Reject a call
- `call:end`: End a call

#### Server → Client Events:
- `message:new`: New message received
- `message:sent`: Message sent confirmation
- `message:error`: Error sending message
- `chat:update`: Chat list update (new last message)
- `chat:cleared`: Chat was cleared
- `typing`: Other user is typing
- `seen`: Message was seen by recipient
- `user:online`: User came online
- `user:offline`: User went offline
- `call:incoming`: Incoming call
- `call:accepted`: Call was accepted
- `call:rejected`: Call was rejected
- `call:ended`: Call ended

### Multi-Device Support

**How it works**:
- Each device has its own socket connection
- Backend tracks all socket IDs for each user in `onlineUsers` Map
- When emitting to a user, backend sends to ALL their sockets
- This ensures messages appear on all user's devices simultaneously

**Example**:
```
User A has 2 devices:
- Device 1: socketId = "abc123"
- Device 2: socketId = "def456"

Backend stores: onlineUsers.set(userAId, Set(["abc123", "def456"]))

When User B sends message to User A:
- Backend emits to both "abc123" and "def456"
- Both devices receive the message in real-time
```

---

## Data Models

### Chat Document

```javascript
{
  _id: ObjectId("..."),
  participants: [
    ObjectId("user1_id"),
    ObjectId("user2_id")
  ],
  messages: [
    {
      _id: ObjectId("..."),
      sender: ObjectId("user1_id"),
      text: "Hello!",
      timestamp: ISODate("2024-01-15T10:30:00Z"),
      seen: false
    },
    {
      _id: ObjectId("..."),
      sender: ObjectId("user2_id"),
      text: "Hi there!",
      timestamp: ISODate("2024-01-15T10:31:00Z"),
      seen: true
    }
  ],
  type: "user_chat", // or "admin_support"
  relatedEntity: {
    type: "support",
    refId: null
  },
  status: "open", // for admin_support
  assignedAdminId: null,
  updatedAt: ISODate("2024-01-15T10:31:00Z"),
  createdAt: ISODate("2024-01-15T10:30:00Z")
}
```

### User Document (Relevant Fields)

```javascript
{
  _id: ObjectId("..."),
  fullName: "John Doe",
  profilePic: "https://...",
  profilePicStorageKey: "s3-key-...",
  blockedUsers: [ObjectId("...")],
  mutedChats: [
    {
      chatId: ObjectId("..."),
      mutedAt: ISODate("...")
    }
  ],
  expoPushToken: "ExponentPushToken[...]"
}
```

---

## API Endpoints

### Base URL: `/api/v1/chat`

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

**List Chats**:
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
        "_id": "...",
        "participants": [
          {
            "_id": "...",
            "fullName": "John Doe",
            "profilePic": "https://...",
            "isVerified": false
          }
        ],
        "messages": [...],
        "updatedAt": "2024-01-15T10:31:00Z"
      }
    ]
  }
}
```

**Send Message**:
```http
POST /api/v1/chat/:otherUserId/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Hello!"
}

Response:
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "message": {
      "_id": "...",
      "sender": "...",
      "text": "Hello!",
      "timestamp": "2024-01-15T10:31:00Z"
    }
  }
}
```

---

## Socket Events

### Connection

**Client connects**:
```javascript
const socket = io(`${apiBaseUrl}/app`, {
  path: '/socket.io',
  auth: { token: jwtToken },
  query: { auth: jwtToken },
  extraHeaders: { Authorization: `Bearer ${jwtToken}` }
});
```

**Server authenticates**:
- Verifies JWT token
- Extracts `userId`
- Joins `user:${userId}` room
- Adds socket to `onlineUsers` Map

### Sending Messages

**Client emits**:
```javascript
socketService.emit('sendMessage', {
  to: otherUserId,
  text: 'Hello!'
});
```

**Server handles**:
- Saves message to database
- Emits `message:new` to recipient
- Emits `message:sent` to sender
- Emits `chat:update` to both users

### Receiving Messages

**Client subscribes**:
```javascript
socketService.subscribe('message:new', (payload) => {
  const { chatId, message } = payload;
  // Update UI with new message
});
```

**Server emits**:
```javascript
nsp.to(`user:${recipientId}`).emit('message:new', {
  chatId: chat._id.toString(),
  message: { ... }
});
```

---

## Key Features

### 1. Real-Time Updates
- Messages appear instantly without page refresh
- Chat list updates automatically when new messages arrive
- Read receipts update in real-time

### 2. Offline Support
- Messages are queued when offline
- Queued messages are sent when connection is restored
- Maximum queue size: 100 messages
- Maximum queue age: 5 minutes

### 3. Multi-Device Synchronization
- Messages appear on all user's devices simultaneously
- Read receipts sync across devices
- Online status updates across devices

### 4. Security
- JWT authentication required for all operations
- Blocking prevents unwanted messages
- Anti-spoofing: Users cannot send as Taatom Official
- Input validation on all endpoints

### 5. Performance
- Database indexes for fast queries
- Message pagination (future enhancement)
- Virtualized lists for large message histories
- Optimistic UI updates

### 6. User Experience
- Typing indicators
- Online/offline status
- Read receipts
- Unread message badges
- Mute/unmute notifications
- Clear chat history
- Search functionality

---

## Common Issues & Solutions

### Issue 1: Messages Not Appearing in Real-Time

**Symptoms**:
- Messages only appear after page refresh
- Socket connection appears connected but events not received

**Possible Causes**:
1. Socket event listeners not registered
2. Event payload not being extracted correctly
3. Stale closure in React hooks
4. Socket not connected to correct URL

**Solutions**:
1. Ensure `socketService.subscribe()` is called in `useEffect` with proper dependencies
2. Check that `onAny` handler is extracting `args[0]` as payload
3. Use `useRef` for socket callbacks to avoid stale closures
4. Verify socket is connecting to correct API URL (check `getApiBaseUrl()`)

**Debug Steps**:
```javascript
// Check socket connection
console.log('Socket connected:', socketService.isConnected());

// Check event listeners
socketService.subscribe('message:new', (payload) => {
  console.log('Message received:', payload);
});

// Check backend emits
// In backend, add logging:
logger.debug('Emitting message:new', { userId, chatId });
```

### Issue 2: Duplicate Messages

**Symptoms**:
- Same message appears multiple times
- Messages duplicated after reconnection

**Possible Causes**:
1. Multiple event listeners registered
2. Optimistic UI update + real-time update both showing
3. Message queue processing duplicates

**Solutions**:
1. Unsubscribe from events in cleanup function
2. Deduplicate messages by `_id` before rendering
3. Clear message queue on reconnection

**Code Example**:
```javascript
useEffect(() => {
  const handleNewMessage = (payload) => {
    setActiveMessages(prev => {
      // Deduplicate by _id
      const existingIds = new Set(prev.map(m => m._id));
      if (existingIds.has(payload.message._id)) {
        return prev; // Already have this message
      }
      return [...prev, payload.message];
    });
  };
  
  socketService.subscribe('message:new', handleNewMessage);
  
  return () => {
    socketService.unsubscribe('message:new', handleNewMessage);
  };
}, []);
```

### Issue 3: Chat List Not Updating

**Symptoms**:
- New messages don't update chat list preview
- Last message and timestamp not updating

**Possible Causes**:
1. `chat:update` event not being handled
2. Chat list state not updating
3. Chat deduplication removing new chat

**Solutions**:
1. Subscribe to `chat:update` event
2. Update chat in `conversations` array
3. Re-sort chats by `updatedAt`

**Code Example**:
```javascript
useEffect(() => {
  const handleChatUpdate = (payload) => {
    setConversations(prev => {
      const updated = prev.map(chat => {
        if (chat._id === payload.chatId) {
          return {
            ...chat,
            messages: [...chat.messages, payload.message],
            updatedAt: payload.timestamp
          };
        }
        return chat;
      });
      // Re-sort by updatedAt
      return updated.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    });
  };
  
  socketService.subscribe('chat:update', handleChatUpdate);
  
  return () => {
    socketService.unsubscribe('chat:update', handleChatUpdate);
  };
}, []);
```

### Issue 4: Socket Connection Failures

**Symptoms**:
- Socket not connecting
- Connection errors in console
- "Invalid token" errors

**Possible Causes**:
1. JWT token expired or invalid
2. CORS issues
3. Backend not running
4. Network connectivity issues

**Solutions**:
1. Refresh JWT token before connecting
2. Check `WS_ALLOWED_ORIGIN` environment variable
3. Verify backend is running and Socket.IO is initialized
4. Check network connectivity

**Debug Steps**:
```javascript
// Check token
const token = await AsyncStorage.getItem('authToken');
console.log('Token exists:', !!token);

// Check connection
socketService.connect().then(socket => {
  console.log('Socket connected:', socket?.connected);
});

// Check backend
// Verify WS_ALLOWED_ORIGIN matches frontend URL
```

### Issue 5: Buffer Object Serialization

**Symptoms**:
- IDs appear as objects instead of strings
- `normalizeId()` function errors
- Message sender IDs not matching

**Possible Causes**:
- MongoDB ObjectIds serialized as Buffer objects
- React Native JSON serialization issues

**Solutions**:
- Use `normalizeId()` helper function to convert Buffer to string
- Ensure backend converts ObjectIds to strings before sending

**Code Example**:
```javascript
const normalizeId = (id: any): string | null => {
  if (typeof id === 'string') return id;
  if (id?._id) return normalizeId(id._id);
  if (id?.toString) return id.toString();
  // Handle Buffer objects...
  return null;
};
```

---

## Development Guide

### Setting Up Development Environment

1. **Backend Setup**:
```bash
cd backend
npm install
# Set environment variables:
# - JWT_SECRET
# - WS_ALLOWED_ORIGIN
# - TAATOM_OFFICIAL_USER_ID
npm run dev
```

2. **Frontend Setup**:
```bash
cd frontend
npm install
# Ensure API_BASE_URL is set correctly
npm start
```

### Testing Chat Functionality

1. **Test User-to-User Chat**:
   - Create two test accounts
   - Send message from User A to User B
   - Verify message appears in real-time on User B's device
   - Verify read receipts work

2. **Test Admin Support Chat**:
   - Send message to Taatom Official
   - Verify `admin_support` chat is created
   - Verify admins see message in admin panel

3. **Test Multi-Device**:
   - Login on two devices with same account
   - Send message from Device A
   - Verify message appears on Device B in real-time

### Debugging Tips

1. **Enable Debug Logging**:
```javascript
// In socket.ts
if (process.env.NODE_ENV === 'development') {
  logger.debug('Socket event:', event, payload);
}
```

2. **Check Socket Connection**:
```javascript
console.log('Socket state:', socketService.getConnectionState());
console.log('Socket connected:', socketService.isConnected());
```

3. **Monitor Events**:
```javascript
// Subscribe to all events for debugging
socketService.subscribe('message:new', (payload) => {
  console.log('[DEBUG] message:new', payload);
});
```

### Best Practices

1. **Always unsubscribe** from socket events in cleanup
2. **Deduplicate messages** before adding to state
3. **Handle offline scenarios** with message queuing
4. **Validate user IDs** before sending messages
5. **Check blocking status** before allowing chat
6. **Use optimistic UI updates** for better UX
7. **Normalize IDs** to handle Buffer serialization
8. **Handle errors gracefully** with user-friendly messages

---

## Conclusion

The Taatom chat system is a comprehensive real-time messaging platform with robust features for user-to-user communication and admin support. Understanding the architecture, data flow, and common issues will help developers maintain and extend the system effectively.

For questions or issues, refer to:
- Socket.IO documentation: https://socket.io/docs/
- MongoDB Mongoose documentation: https://mongoosejs.com/docs/
- React Native documentation: https://reactnative.dev/docs/

---

**Last Updated**: January 2024
**Version**: 1.0
**Maintainer**: Taatom Development Team


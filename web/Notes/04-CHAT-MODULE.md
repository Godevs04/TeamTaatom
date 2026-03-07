# Chat Module – Developer Guide

In-depth documentation for the **Chat** (inbox and conversations) module.

---

## 1. Purpose & User Flow

- **Screens:**  
  - `app/chat/index.tsx` – chat list (inbox).  
  - (Conversation screen may be same file or nested route.)
- **Purpose:** List conversations, open a chat with a user, send/receive messages, mark seen, clear chat, mute, block; optional voice/video calls via call service and socket.
- **User flow:** Open chat list → tap conversation → see messages → send text; optionally mark seen, clear, mute, block; start voice/video call if supported.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **Chat list** | `listChats()` → list of chats with last message and participant info. |
| **Conversation** | `getChat(otherUserId)`, `getMessages(otherUserId)`; display messages; `sendMessage(otherUserId, text)`. |
| **Mark seen** | `markAllMessagesSeen(otherUserId)` when opening or viewing chat. |
| **Clear chat** | `clearChat(otherUserId)` with confirmation. |
| **Mute** | `toggleMuteChat(otherUserId)`; `getMuteStatus(otherUserId)` for UI state. |
| **Block** | Block user (profile/userManagement); affects chat visibility/behavior. |
| **Real-time** | Socket events for new messages (if backend emits); update local state. |
| **Calls** | callService + socket for signaling; CallScreen for voice/video. |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/chat` | List all chats for current user. |
| GET | `/api/v1/chat/${otherUserId}` | Get single chat with other user. |
| GET | `/api/v1/chat/${otherUserId}/messages` | Get messages for that chat. |
| POST | `/api/v1/chat/${otherUserId}/messages` | Send message `{ text }`. |
| POST | `/api/v1/chat/${otherUserId}/mark-all-seen` | Mark all messages as seen. |
| DELETE | `/api/v1/chat/${otherUserId}/messages` | Clear all messages. |
| POST | `/api/v1/chat/${otherUserId}/mute` | Toggle mute. |
| GET | `/api/v1/chat/${otherUserId}/mute-status` | Get mute status `{ muted }`. |

---

## 4. Types & Schemas

**Chat (service):**

```ts
interface Chat {
  _id: string;
  participants: Array<{ _id: string; fullName: string; profilePic: string }>;
  messages: Array<{ _id: string; sender: string; text: string; timestamp: string; seen: boolean }>;
  updatedAt: string;
  createdAt: string;
}
```

**Responses:** ChatListResponse (chats[]), ChatResponse (chat), MessagesResponse (messages[]).

---

## 5. Technical Logic (Summary)

- **List:** Fetch once or on focus; sort by updatedAt/last message; show unread badge if any message not seen.
- **Messages:** Pagination if backend supports; append new messages; on send optimistically add to UI then confirm from response.
- **Socket:** Subscribe to room or user-specific event for new message; push to messages and update chat list preview.
- **Alerts:** Use CustomAlert/useAlert for errors and confirmations (clear, block, etc.).

---

## 6. File Map

| File | Role |
|------|------|
| `app/chat/index.tsx` | Chat list and conversation UI, state, send, actions. |
| `services/chat.ts` | listChats, getChat, getMessages, sendMessage, markAllMessagesSeen, clearChat, toggleMuteChat, getMuteStatus. |
| `services/callService.ts` | Call state and signaling. |
| `components/CallScreen.tsx` | Voice/video call UI. |
| `services/socket.ts` | Socket connection for real-time and calls. |

---

## 7. Chat & Message types – full schema (technical)

**Chat:** _id, participants (array of { _id, fullName, profilePic }), messages (array of { _id, sender, text, timestamp, seen }), updatedAt, createdAt.

**MessagesResponse:** messages (same shape as above). Sender may be user ID string or populated object; frontend normalizes for display and "unread" (msg.seen === false and sender !== currentUser).

---

## 8. Chat list screen – functional detail

- **Load:** listChats() on mount/focus; sort by updatedAt or last message timestamp descending. For each chat, determine "other" participant (participants.find(p => p._id !== currentUserId)); show avatar, name, last message preview, timestamp, unread badge (count of messages where !seen and sender === otherUserId).
- **Unread count (home):** Raw fetch to /chat; iterate chats and sum unseen messages from other user; see Home module doc for normalization (Buffer/ObjectId handling).
- **Tap chat:** Navigate to conversation view (same file or nested route) with otherUserId; load getChat(otherUserId) and getMessages(otherUserId); call markAllMessagesSeen(otherUserId) when opening so messages mark as seen.

---

## 9. Conversation view – send & real-time

- **Send message:** User types text; on Send call sendMessage(otherUserId, text). Optimistically add message to local state with pending flag; on response replace with server message (id, timestamp, seen). On error showError and revert or show retry.
- **Real-time:** Socket subscribe to room or event for this chat (e.g. message:new with payload { chatId, message }); when event received, if message is for current chat append to messages and update list preview; if from other user and chat open, optionally mark as seen via markAllMessagesSeen.
- **Clear chat:** Confirmation (showConfirm/showDestructiveConfirm); then clearChat(otherUserId); on success clear local messages and update list.
- **Mute:** toggleMuteChat(otherUserId); getMuteStatus(otherUserId) for initial state; UI shows mute icon state.

---

## 10. Error handling & alerts

- All API errors parsed with parseError(error); throw new Error(parsedError.userMessage). UI uses useAlert showError(message). Confirmations (clear, block) use CustomAlert or useAlert showConfirm/showDestructiveConfirm so no default system Alert.

---

## 11. File map (detailed)

| File | Role |
|------|------|
| `app/chat/index.tsx` | Chat list + conversation view; state (chats, messages, otherUser, mute, loading); listChats, getMessages, sendMessage, markAllMessagesSeen, clearChat, toggleMute; socket subscribe; message input and list. |
| `services/chat.ts` | All chat API functions (see section 3). |
| `services/callService.ts` | Voice/video call state; signaling. |
| `components/CallScreen.tsx` | UI for active call; accept/decline. |
| `services/socket.ts` | Connection, auth (token or cookie), subscribe/unsubscribe for message:new, seen. |

---

*Backend API: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*

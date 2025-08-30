# TeamTaatom Technical Documentation

## Table of Contents

1. [Project Structure](#project-structure)
2. [Backend Overview](#backend-overview)
   - [Environment & Config](#environment--config)
   - [Models](#models)
   - [Controllers](#controllers)
   - [Routes](#routes)
   - [Socket (WebSocket) Flow](#socket-websocket-flow)
   - [Middleware](#middleware)
   - [Utils](#utils)
3. [Frontend Overview](#frontend-overview)
   - [App Structure](#app-structure)
   - [Screens & Components](#screens--components)
   - [Services](#services)
   - [State & Context](#state--context)
   - [Socket Client](#socket-client)
   - [Theme & Styling](#theme--styling)
4. [Authentication Flow](#authentication-flow)
5. [Post Flow](#post-flow)
6. [Profile Flow](#profile-flow)
7. [Chat Flow](#chat-flow)
8. [Common Patterns & Best Practices](#common-patterns--best-practices)
9. [Extending the System](#extending-the-system)
10. [Onboarding a New Developer](#onboarding-a-new-developer)

---

## Project Structure

```
TeamTaatom/
  backend/
    src/
      controllers/
      middleware/
      models/
      routes/
      socket/
      utils/
      config/
      app.js
      server.js
    environment.env
  frontend/
    app/
      (tabs)/
      (auth)/
      chat/
      post/
      profile/
      index.tsx
    components/
    constants/
    context/
    services/
    types/
    utils/
    app.json
    index.js
```

---

## Backend Overview

### Environment & Config
- **environment.env**: Stores environment variables (DB URI, JWT secret, API URLs, etc.).
- **config/db.js**: MongoDB connection logic.
- **config/cloudinary.js**: Cloudinary image upload config.

### Models
- **User.js**: User schema (name, email, password, profilePic, followers, following, etc.).
- **Post.js**: Post schema (author, caption, image, likes, comments, etc.).
- **Chat.js**: Chat schema (participants, messages, each message has sender, text, timestamp, seen).
- **ForgotSignIn.js**: For password reset/OTP flows.

### Controllers
- **authController.js**: Handles signup, signin, OTP, Google auth, password reset.
- **postController.js**: Handles CRUD for posts, likes, comments.
- **profileController.js**: Handles profile view/update, follow/unfollow, user search.
- **chat.controller.js**: Handles chat list, get chat, get messages, send message, mark as seen.

### Routes
- **authRoutes.js**: `/auth` endpoints (signup, signin, OTP, etc.).
- **postRoutes.js**: `/posts` endpoints (CRUD, like, comment).
- **profileRoutes.js**: `/profile` endpoints (view/update, follow, search).
- **chat.routes.js**: `/chat` endpoints (list, get, send, mark as seen).

### Socket (WebSocket) Flow
- **socket/index.js**: Sets up Socket.IO server, manages user connections, emits/receives real-time events:
  - `message:new`, `message:sent`, `chat:update`, `seen`, `typing`, `user:online`, `user:offline`.
  - Maintains a map of online users and their socket IDs.
  - Handles multi-device by storing a set of socket IDs per user.

### Middleware
- **authMiddleware.js**: JWT authentication for protected routes.
- **errorHandler.js**: Centralized error handling.

### Utils
- **sendOtp.js**: Sends OTP via email.
- **socketBus.js**: Helper for socket-related logic (e.g., get followers).

---

## Frontend Overview

### App Structure
- **app/**: Main app directory, contains screens for tabs, auth, chat, post, profile.
- **components/**: Reusable UI components (Card, AuthInput, NavBar, etc.).
- **constants/**: Color and theme definitions.
- **context/**: Theme context and (optionally) other global providers.
- **services/**: API and socket service modules.
- **types/**: TypeScript types for user, post, etc.
- **utils/**: Utility functions (validation, geo, etc.).

### Screens & Components
- **app/(tabs)/**: Main tab screens (home, post, profile, chat).
- **app/(auth)/**: Auth screens (signin, signup, forgot, reset, verify OTP).
- **app/chat/**: Chat screen and chat modal.
- **components/**: UI elements (MessageList, CommentBox, EditProfile, etc.).

### Services
- **services/api.ts**: Axios instance for REST API calls.
- **services/socket.ts**: Socket.IO client setup and event subscription logic.
- **services/auth.ts, posts.ts, profile.ts**: API wrappers for respective features.

### State & Context
- **context/ThemeContext.tsx**: Provides theme (light/dark) to the app.
- (If using Redux or other state management, would be here.)

### Socket Client
- **services/socket.ts**: Handles connecting to the backend socket, subscribing/unsubscribing to events, emitting events.

### Theme & Styling
- **constants/colors.ts, theme.ts**: Centralized color and theme definitions.
- **ThemeContext**: Used throughout the app for consistent styling.

---

## Authentication Flow
1. **Signup**: User submits name, email, password → `/auth/signup` → receives OTP.
2. **Verify OTP**: User enters OTP → `/auth/verify-otp` → account activated.
3. **Signin**: User submits email, password → `/auth/signin` → receives JWT.
4. **Google Auth**: User signs in with Google → `/auth/google`.
5. **Forgot/Reset Password**: User requests reset → `/auth/forgot-password` → receives OTP → `/auth/reset-password`.

---

## Post Flow
1. **Create Post**: User uploads image, caption → `/posts` (POST, multipart).
2. **Get Posts**: Fetch all posts → `/posts` (GET).
3. **Like/Unlike**: Toggle like on a post → `/posts/:id/like` (POST).
4. **Comment**: Add comment → `/posts/:id/comments` (POST).
5. **Delete**: Remove post or comment → `/posts/:id` or `/posts/:id/comments/:commentId` (DELETE).

---

## Profile Flow
1. **View Profile**: `/profile/:id` (GET).
2. **Update Profile**: `/profile/:id` (PUT, multipart for profilePic).
3. **Follow/Unfollow**: `/profile/:id/follow` (POST).
4. **Search Users**: `/profile/search?query=...` (GET).

---

## Chat Flow
### Backend
- **listChats**: Returns all chats for the user, with participants and messages.
- **getChat**: Returns a specific chat between two users.
- **getMessages**: Returns all messages in a chat.
- **sendMessage**: Adds a message to a chat, emits real-time events.
- **markMessageSeen**: Marks a specific message as seen.
- **markAllMessagesSeen**: Marks all messages from the other user as seen (called when opening a chat).

### Socket Events
- **message:new**: Emitted to recipient when a new message is sent.
- **message:sent**: Emitted to sender as delivery ack.
- **chat:update**: Emitted to both users to update chat list preview/unread.
- **seen**: Emitted when a message is marked as seen.
- **typing**: Emitted when a user is typing.
- **user:online/user:offline**: Presence events.

### Frontend
- **Chat List**: Fetches all chats, displays last message, unread count (messages from other user with `seen: false`).
- **Chat Window**: Fetches messages for a chat, subscribes to socket events for real-time updates.
- **Unread Count**: Updated both locally and via backend when messages are seen.

---

## Common Patterns & Best Practices
- **RESTful API**: All backend endpoints follow REST conventions.
- **JWT Auth**: All protected routes require JWT in the `Authorization` header.
- **Socket.IO**: Used for real-time chat, with robust multi-device support.
- **Separation of Concerns**: Controllers handle business logic, routes handle HTTP, models handle data.
- **Theme Consistency**: All screens use a centralized theme for styling.
- **Error Handling**: Centralized error handler middleware in backend.

---

## Extending the System
- **Group Chat**: Extend the `participants` array and message schema to support per-user seen status.
- **Notifications**: Add push notification logic in backend and frontend.
- **Media Support**: Extend post and chat message schema to support videos, files, etc.
- **Admin Features**: Add moderation endpoints and UI.

---

## Onboarding a New Developer
1. **Clone the repo and install dependencies** in both `backend` and `frontend`.
2. **Set up environment variables** using `environment.env` and `frontend/.env`.
3. **Start MongoDB** and run the backend (`npm start`).
4. **Start the frontend** (React Native/Expo).
5. **Test API endpoints** using the provided Postman collection.
6. **Explore the codebase** using this documentation as a guide.

---

If you need a more detailed breakdown of any specific flow, class, or method, see the respective file or ask for a deep dive!

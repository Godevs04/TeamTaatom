# TeamTaatom Frontend – Developer Guide Index

This folder contains **per-module, in-depth developer documentation** for the TeamTaatom React Native / Expo frontend. Each document is written so **new developers** can understand both **what** the module does and **how** it works at a low level.

**What each module doc includes:**
- **Purpose & user flow** – What the screen does and how the user moves through it.
- **Key functionality** – Feature list (tables).
- **Backend API** – Endpoints, methods, request/response shapes.
- **Types & schemas** – Full interfaces (e.g. PostType, CreatePostData, UserSettings) where relevant.
- **Step-by-step flows** – Initial load, refresh, submit, error paths (numbered steps).
- **State & refs** – All important state variables and refs with their role.
- **Constants & configuration** – Timeouts, limits, storage keys, throttle values.
- **Error handling** – What happens on network error, 429, validation failure; which alerts are used (CustomAlert/useAlert, no default Alert).
- **Technical logic** – Guards, de-duplication, cache strategy, socket subscriptions, normalization (e.g. ObjectId/Buffer handling).
- **File map** – Which file does what (screens, services, components).

Use the document links below to jump to a module; start with **00-INDEX** (this file) for the full map.

---

## Document Map

| # | Document | Module | Description |
|---|----------|--------|-------------|
| 00 | **00-INDEX.md** | — | This index and app overview |
| 01 | [01-HOME-MODULE.md](./01-HOME-MODULE.md) | Home | Main feed, posts, ads, scroll, real-time |
| 02 | [02-POST-MODULE.md](./02-POST-MODULE.md) | Post | Create post/short, media, location, songs |
| 03 | [03-PROFILE-MODULE.md](./03-PROFILE-MODULE.md) | Profile | User profile, travel map, edit, follow |
| 04 | [04-CHAT-MODULE.md](./04-CHAT-MODULE.md) | Chat | Inbox, conversations, messages, calls |
| 05 | [05-LOCALE-MODULE.md](./05-LOCALE-MODULE.md) | Locale | Places discovery, map, nearby locales |
| 06 | [06-NOTIFICATIONS-MODULE.md](./06-NOTIFICATIONS-MODULE.md) | Notifications | List, mark read, grouping, deep links |
| 07 | [07-SETTINGS-MODULE.md](./07-SETTINGS-MODULE.md) | Settings | Account, privacy, notifications, appearance, data |
| 08 | [08-COLLECTIONS-MODULE.md](./08-COLLECTIONS-MODULE.md) | Collections | Create/list/detail, add/remove posts |
| 09 | [09-AUTH-MODULE.md](./09-AUTH-MODULE.md) | Auth | Sign in, sign up, OTP, forgot/reset password |
| 10 | [10-ACTIVITY-SEARCH-TRIPSCORE.md](./10-ACTIVITY-SEARCH-TRIPSCORE.md) | Activity, Search, Tripscore | Activity feed, search, TripScore flows |
| 11 | [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md) | API | Backend API endpoints used by frontend |
| 12 | [12-MISC-MODULES.md](./12-MISC-MODULES.md) | Followers, Support, Policies, Onboarding, Map, Saved, Report, Mentions | Short docs for remaining modules |

---

## App Overview

- **Stack:** React Native (Expo), TypeScript, Expo Router (file-based routing).
- **State / context:** ThemeContext, AlertContext, SettingsContext, ScrollContext; local state per screen.
- **API:** Axios instance in `services/api.ts` (base URL from config, auth via Bearer token on mobile, httpOnly cookies + CSRF on web).
- **Real-time:** Socket.IO (`services/socket.ts`) for chat, calls, and optional post updates.

---

## Route Structure (Expo Router)

```
app/
├── _layout.tsx              # Root layout (providers, stack)
├── index.tsx                # Entry (redirect to auth or tabs)
├── (tabs)/                  # Tab navigator
│   ├── home.tsx             # Feed
│   ├── shorts.tsx           # Shorts feed
│   ├── post.tsx             # Create post/short
│   ├── locale.tsx           # Locale discovery
│   └── profile.tsx         # Current user profile
├── (auth)/                  # Auth stack
│   ├── signin.tsx, signup.tsx, verifyOtp.tsx, forgot.tsx, reset-password.tsx
├── onboarding/              # Welcome, interests, suggested users
├── settings/                # Settings stack (account, privacy, notifications, etc.)
├── chat/index.tsx           # Chat list
├── profile/[id].tsx         # Other user profile
├── notifications.tsx        # Notifications list
├── followers.tsx            # Followers list
├── activity/index.tsx       # Activity feed
├── collections/             # index, create, [id]
├── search.tsx               # Search
├── hashtag/[hashtag].tsx    # Hashtag posts
├── map/                     # all-locations, current-location
├── tripscore/               # continents → countries → locations → map
├── support/                 # help, contact
└── policies/                # privacy, terms, copyright
```

---

## Services (Frontend)

| Service | Purpose |
|---------|---------|
| `api.ts` | Axios client, interceptors, auth, CSRF, throttling |
| `auth.ts` | Sign up/in, OTP, forgot/reset, token storage, session |
| `posts.ts` | Feed, get post by ID, create post/short, like, comment, delete, archive |
| `profile.ts` | Get profile, follow, follow requests, block, travel map, TripScore |
| `chat.ts` | List chats, get/send messages, mark seen, clear, mute |
| `notifications.ts` | List, mark read, mark all read, unread count, click handling |
| `locale.ts` | List/fetch locales (places) for Locale tab |
| `collections.ts` | CRUD collections, add/remove/reorder posts |
| `settings.ts` | Get/update user settings (privacy, notifications, etc.) |
| `activity.ts` | Activity feed, privacy toggle |
| `search.ts` | Post search, location search |
| `hashtags.ts` | Hashtag search, trending, posts by hashtag |
| `socket.ts` | Socket.IO connection, auth, reconnection |
| `realtimePosts.ts` | Real-time like/comment/save via socket |
| `analytics.ts` | Screen views, events, engagement |
| `updateService.ts` | Expo Updates check and install |
| `userManagement.ts` | Sessions, blocked users, account delete, export |

---

## Types (Frontend)

| File | Main types |
|------|------------|
| `types/post.ts` | `PostType`, `CommentType`, `LocationType` |
| `types/user.ts` | `UserType`, `FollowRequest`, `FollowRequestsResponse` |
| `types/notification.ts` | `Notification`, `NotificationResponse`, `MarkAsReadResponse` |

---

*For low-level, module-by-module detail (screens, components, API calls, schemas, logic), see the linked documents above.*

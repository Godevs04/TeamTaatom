# Taatom notification flow (scenario-based)

## Overview

- **In-app list**: `app/notifications.tsx` loads notifications via `getNotifications()`, groups by time, and on item press calls `handleNotificationClick(notification)` from `services/notifications.ts`.
- **Push (remote)**: Backend sends push via `sendNotification.js` (Expo or FCM) with payload `{ type, screen, entityId, senderId }`. When the user **taps** the push, the app should navigate to `data.screen` (same destinations as in-app).

---

## 1. Frontend – scenario handling (`services/notifications.ts`)

`handleNotificationClick(notification)`:

- **Input**: Full `Notification` from API (has `_id`, `type`, `fromUser`, `post`, `postId`, `fromUserId`, etc.).
- **Behavior**: Marks as read, then returns `{ success, message, shouldNavigate, navigationPath }` by type:

| Type             | Navigation (when entity exists)     | Fallback message                    |
|------------------|-------------------------------------|-------------------------------------|
| `like`           | `/(tabs)/home?postId=${postId}`     | "The post you liked has been deleted" |
| `comment`        | `/(tabs)/home?postId=${postId}`     | "The post you commented on has been deleted" |
| `follow`         | `/profile/${userId}`               | "This user account is no longer available" |
| `follow_request` | In list: opens **FollowRequestPopup**; from handler: `/profile/${userId}` | - |
| `follow_approved`| `/profile/${userId}`               | - |
| `post_deleted` / `short_deleted` | No navigation | "This content has been deleted" |
| `mention`        | `/(tabs)/home?postId=${postId}`     | "The post you were mentioned in has been deleted" |
| `share`          | `/(tabs)/home?postId=${postId}`     | "The shared post has been deleted" |
| default          | postId → home?postId; else fromUserId → profile | "Notification processed successfully" |

- **Special**: In `app/notifications.tsx`, `follow_request` is handled first and opens the approve/reject popup; only other types go through `handleNotificationClick`.

---

## 2. Where notifications are used

| Location | What it does |
|----------|----------------|
| **`app/notifications.tsx`** | List: `getNotifications`, `markAsRead`, `markAllAsRead`, `handleNotificationClick`; follow_request → `FollowRequestPopup`; badge not used here (see profile). |
| **`app/(tabs)/profile.tsx`** | Badge: `getUnreadCount()` → `unreadCount`; "Notifications" tab opens `/notifications`. |
| **`app/_layout.tsx`** | Registers push token (iOS Expo / Android FCM), sets Expo notification handler; **push-opened** should call navigation with `data.screen`. |
| **`services/pushNotifications.ts`** | Expo push registration only (`registerForPushNotificationsAsync`). |
| **`services/fcm.ts`** | FCM init, token, foreground/background handlers; `setupNotificationOpenedHandler(data)` – should navigate using `data.screen`. |
| **`services/settings.ts`** | Notification preferences (push, email, likes, comments, follows, messages, follow request/approval). |

---

## 3. Backend – when push is sent (`sendNotification.js` + controllers)

- **Who sends**: `sendNotificationToUser({ userId, title, body, data })` from:
  - **profileController**: follow_request (target user), follow (target user), follow_approved (requester).
  - **postController**: like (post owner), comment (post owner), post_mention (mentioned user).
- **Payload**: `data` includes `type`, `fromUserId`, `entityId`, `senderId`; for like/comment also `postId`. `getScreenForType(type, data)` builds `screen`:
  - like / comment / post_mention → `/post/${postId}` (or `/home` if no postId).
  - follow / follow_request / follow_approved → `/profile/${fromUserId}`.
  - trip_created / trip_approved → post or `/home`.
- **Expo payload**: `data: { type, screen, entityId, senderId }` (and optional metadata).
- **User prefs**: `sendNotificationToUser` checks `user.settings.notifications` (e.g. likesNotifications, followRequestNotifications) and skips push if disabled.

---

## 4. Push “opened” (tap) behavior

- **Backend** does not send notification `_id` in the push payload, so the app cannot “mark as read by id” from the tap. It can only **navigate** using the embedded `screen` path.
- **Required**: When the user opens the app from a push (Expo or FCM), read `data.screen` and call `router.push(data.screen)` (with fallback e.g. `/notifications` if missing).
- **Expo**: Use `Notifications.addNotificationResponseReceivedListener` and `Notifications.getLastNotificationResponseAsync()` (cold start).
- **FCM**: Use existing `setupNotificationOpenedHandler`; inside the callback call `router.push(data.screen)`.

This keeps push navigation aligned with the scenario-based rules in `handleNotificationClick` and `getScreenForType`.

# Notifications Module – Developer Guide

In-depth documentation for the **Notifications** module.

---

## 1. Purpose & User Flow

- **Screen:** `app/notifications.tsx`.
- **Purpose:** List in-app notifications (like, comment, follow, follow_request, follow_approved), grouped by time (Today, Yesterday, Last 7 days, Last 30 days, Older); mark read, mark all read; tap to navigate to post/profile or show “content not available” custom alert if content deleted.
- **User flow:** Open Notifications → see grouped list → tap notification → navigate or see custom alert; tap “Mark All Read” when unread exist.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **List** | `getNotifications(page, limit)`; pagination; duplicate follow_request filtered client-side. |
| **Grouping** | `groupNotificationsByTime(notifications)` → sections: Today, Yesterday, Last 7 days, Last 30 days, Older. |
| **Mark read** | Single: `markNotificationAsRead(id)`; all: `markAllNotificationsAsRead()`. |
| **Tap handling** | `handleNotificationClick(notification)` in service: navigate to post/profile or return message; if content unavailable, frontend shows CustomAlert “Content not available”. |
| **Follow request** | In-app: open FollowRequestPopup (approve/reject); API: approveFollowRequest, rejectFollowRequest. |
| **Empty state** | Card with icon and message when no notifications. |
| **Post thumbnail** | Like/comment show post image or placeholder (icon) if missing/failed. |
| **SectionList** | Sections with section header + items; keyExtractor by item._id. |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/notifications?page=&limit=` | List notifications. |
| PUT | `/api/v1/notifications/${notificationId}/read` | Mark one read. |
| PUT | `/api/v1/notifications/read-all` | Mark all read. |
| GET | `/api/v1/notifications/unread-count` | Unread count. |

---

## 4. Types & Schemas

**Notification (types/notification.ts):**

- _id, type (like | comment | follow | follow_request | follow_approved | post_mention), fromUser, toUser, post?, comment?, isRead, createdAt, updatedAt.

**NotificationResponse:** notifications[], unreadCount, pagination (currentPage, totalPages, totalNotifications, hasNextPage, limit).

**handleNotificationClick (service):** Returns { success, message, shouldNavigate?, navigationPath?, contentUnavailable? }. Frontend uses contentUnavailable or message pattern to show CustomAlert.

---

## 5. Technical Logic (Summary)

- **Date grouping:** Buckets by createdAt (today start, yesterday start, last 7 days, last 30 days); anything older → “Older” section.
- **Duplicate follow_request:** Client filters by `${fromUser._id}-${type}` so one entry per requester.
- **Failed thumbnails:** failedThumbnails Set; on image onError add id to Set and show placeholder (icon).
- **List layout:** SectionList with flex:1 and listWrapper minHeight so list is visible; theme colors for background/surface.

---

## 6. File Map

| File | Role |
|------|------|
| `app/notifications.tsx` | Notifications screen, SectionList, empty state, CustomAlert for content unavailable. |
| `services/notifications.ts` | getNotifications, markNotificationAsRead, markAllNotificationsAsRead, handleNotificationClick, getUnreadCount. |
| `types/notification.ts` | Notification, NotificationResponse. |
| `components/FollowRequestPopup.tsx` | Approve/reject follow request. |

---

## 7. groupNotificationsByTime – date buckets (technical)

- **Today:** `createdAt >= todayStart` (todayStart = start of current day in local time).
- **Yesterday:** `createdAt >= yesterdayStart && createdAt < todayStart`.
- **Last 7 days:** `createdAt >= lastWeekStart && createdAt < yesterdayStart`.
- **Last 30 days:** `createdAt >= lastMonthStart && createdAt < lastWeekStart`.
- **Older:** `createdAt < lastMonthStart`.
- All comparisons use `new Date(n.createdAt).getTime()` for consistency. Sections are pushed in order (Today, Yesterday, Last 7 days, Last 30 days, Older); only non-empty sections included. Empty notifications array returns [].

---

## 8. handleNotificationClick – return values & navigation (technical)

- **like/comment:** If postId or post._id exists → return { shouldNavigate: true, navigationPath: `/(tabs)/home?postId=${postId}` }. Else (post deleted) → return { contentUnavailable: true, message: 'This post is no longer available.' }.
- **follow/follow_approved:** If fromUser._id exists → navigationPath to `/profile/${userId}`. Else user deleted → contentUnavailable, message 'This user is no longer available.'.
- **follow_request:** Not handled by handleNotificationClick for in-app list; UI opens FollowRequestPopup and does not navigate. For push/payload flow service may return profile path.
- **Mark read:** handleNotificationClick calls markNotificationAsRead(notification._id) before returning so backend state is updated.

---

## 9. Frontend tap flow (step-by-step)

1. User taps a notification item.
2. If type === 'follow_request': setFollowRequestPopup({ visible: true, notification }); return.
3. Else: await handleNotificationClick(notification). If !result.success → showError(result.message); return.
4. Update local state: setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n)).
5. If result.shouldNavigate && result.navigationPath → router.push(result.navigationPath).
6. Else if result.contentUnavailable or message matches /deleted|no longer available|not available|unavailable/i → setContentUnavailableAlert({ visible: true, title: 'Content not available', message: result.message }); CustomAlert shows with one OK button.
7. Else → showInfo(result.message).

---

## 10. List rendering & layout (technical)

- **SectionList:** sections = groupNotificationsByTime(notifications); keyExtractor = (item) => item._id; renderItem = single notification row; renderSectionHeader = section title (Today, Yesterday, etc.).
- **Wrapper:** View with style listWrapper (flex:1, minHeight:200) so list gets height; SectionList has style notificationList (flex:1, width:'100%') and contentContainerStyle (flexGrow:1, paddingBottom).
- **Empty state:** When notifications.length === 0, show View with emptyCard (theme.colors.surface, border, icon, "No Notifications Yet", message). emptyContainer has minHeight and flex:1 so it fills space.

---

## 11. Thumbnail & failed image (technical)

- **Show thumbnail when:** (item.post && (item.post.imageUrl || ['like','comment'].includes(item.type))). So like/comment without imageUrl still show the thumbnail container with placeholder.
- **Placeholder:** If !item.post?.imageUrl || failedThumbnails.has(item._id), render View with Ionicons "image-outline" and theme.colors.surfaceSecondary background (postThumbnailPlaceholder style). On image onError, setFailedThumbnails(prev => new Set(prev).add(item._id)). On refresh or first-page load, setFailedThumbnails(() => new Set()) to clear.

---

## 12. API response handling (defensive)

- **getNotifications:** rawList = response?.notifications ?? []; if !Array.isArray(rawList) set notifications to [] and return. setHasMore(response?.pagination?.hasNextPage ?? false). On catch for page 1: setNotifications([]) so UI shows empty state instead of stale list.

---

*Profile follow requests: [03-PROFILE-MODULE.md](./03-PROFILE-MODULE.md). API: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*

# Web App Implementation Progress

Source of truth: module notes in this folder (`01-HOME-MODULE.md` … `12-MISC-MODULES.md`). No backend changes.

---

## Status legend

- **Done** – Implemented and aligned with notes; no lint errors.
- **In progress** – Currently being worked on.
- **Yet to do** – Not started.

---

## Module status

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 00 | Index / Overview | Done | Flow and doc map used for implementation order. |
| 01 | Home (Feed) | Done | Feed list, page-based pagination (15/page), refresh, deep link ?postId=, liked IDs in localStorage, error copy per notes. |
| 02 | Post (Create) | Done | Photo post (images, caption, location, progress); Short (video, thumbnail, caption, location, copyright); auth guard; validation messages per notes. |
| 03 | Profile | Done | getProfile, follow, block, updateProfile APIs; ProfileActions (Follow/Unfollow, Edit, Settings); profile header and grid aligned. |
| 04 | Chat | Done | listChats, getChat, getMessages, sendChatMessage, markSeen, clearChat, mute APIs; chat list + conversation pages; Chat in nav. |
| 05 | Locale | Done | getLocaleById; list + filters; locale detail page /locale/[id]; link from cards. |
| 06 | Notifications | Done | getNotifications, markRead, markAllRead, unreadCount; types/notification; groupNotificationsByTime; (dashboard)/notifications page; Bell in header + nav. |
| 07 | Settings | Done | Settings home and sub-pages already present; getSettings, updateSettings, updateSettingCategory, resetSettings in api. |
| 08 | Collections | Done | getCollections, getCollection, create, update, delete, addPost, removePost, reorder in api; list, create, detail pages. |
| 09 | Auth | Done | Login, register, verify-otp, forgot, reset in app/auth; authMe, signIn, signUp, etc. in api. |
| 10 | Activity, Search, Tripscore | Done | getActivity in api; activity page; search page (users + posts) already present. |
| 11 | Backend API | — | Reference only; web lib/api aligned. |
| 12 | Misc | Done | Settings sub-pages (terms, contact-support, content-policy, about, manage-posts) present; dashboard nav updated. |

---

## Changes log (concise)

- **Home (01):** Page-based feed via `getFeed({ page, limit })`, useFeed with page param; pull-to-refresh (refetch); deep link `?postId=` scroll-into-view; error copy per notes (connection, 429, generic); liked IDs in localStorage and merged into posts; 15 posts per page on web; no ad placeholders on web.
- **Post (02):** createShort in api; create page tabs (Photo post | Short); auth guard and redirect; validation copy per notes; copyright checkbox for shorts; progress for both.
- **Profile (03):** followProfile, getBlockStatus, blockUser, updateProfile in api; User type isFollowing/followRequestSent; ProfileActions client component; profile [id] page header + actions + premium styling.
- **Chat (04):** types/chat.ts; listChats, getChat, getChatMessages, sendChatMessage, markChatMessagesSeen, clearChat, toggleChatMute, getChatMuteStatus in api; (dashboard)/chat list page and (dashboard)/chat/[userId] conversation page; mark seen on open; Chat in dashboard nav.
- **Locale (05):** getLocaleById in api; locale list with search/country/state filters; /locale/[id] detail page; cards link to detail.
- **Notifications (06):** types/notification.ts; getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getNotificationsUnreadCount in api; lib/notifications.ts (groupNotificationsByTime, getNotificationLink); (dashboard)/notifications page with sections; Bell in header and nav.
- **Settings (07):** Settings home and sub-routes (account, privacy, notifications, appearance, data, etc.) already present; api has getSettings, updateSettings, updateSettingCategory, resetSettings.
- **Collections (08):** Full collections API; list, create, detail (with remove post, delete collection) pages.
- **Auth (09):** Already implemented (login, register, verify-otp, forgot, reset); no backend changes.
- **Activity/Search/Tripscore (10):** getActivity in api; activity page with feed; search page (users + posts) already present.
- **Misc (12):** Settings covers terms, contact-support, content-policy, about, manage-posts; dashboard nav and header updated.
- *(Further entries added as modules are completed.)*

# Backend API Reference (Frontend Usage)

Consolidated list of backend API endpoints used by the TeamTaatom frontend. Base URL from config (`getApiBaseUrl()`); auth: Bearer token (mobile) or httpOnly cookies + X-CSRF-Token (web).

---

## Auth

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| POST | `/api/v1/auth/signup` | auth | Sign up |
| GET | `/api/v1/auth/check-username?username=` | auth | Username availability |
| POST | `/api/v1/auth/verify-otp` | auth | Verify OTP |
| POST | `/api/v1/auth/resend-otp` | auth | Resend OTP |
| POST | `/api/v1/auth/signin` | auth | Sign in |
| GET | `/api/v1/auth/me` | auth, settings | Current user |
| POST | `/api/v1/auth/logout` | auth | Logout |
| POST | `/api/v1/auth/forgot-password` | auth | Forgot password |
| POST | `/api/v1/auth/google` | googleAuth | Google OAuth |
| POST | `/api/v1/auth/refresh` | api (interceptor) | Refresh token |

---

## Posts & Shorts

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/posts?page=&limit=` | posts | Feed |
| GET | `/api/v1/posts/${postId}` | posts | Single post |
| POST | `/api/v1/posts` | posts | Create post (FormData) |
| GET | `/api/v1/posts/user/${userId}?page=&limit=` | posts | User posts |
| POST | `/api/v1/posts/${postId}/like` | posts | Like |
| POST | `/api/v1/posts/${postId}/comments` | posts | Add comment |
| DELETE | `/api/v1/posts/${postId}/comments/${commentId}` | posts | Delete comment |
| DELETE | `/api/v1/posts/${postId}` | posts | Delete post |
| PATCH | `/api/v1/posts/${postId}/archive` | posts | Archive |
| PATCH | `/api/v1/posts/${postId}/unarchive` | posts | Unarchive |
| PATCH | `/api/v1/posts/${postId}/hide` | posts | Hide |
| PATCH | `/api/v1/posts/${postId}/unhide` | posts | Unhide |
| GET | `/api/v1/posts/archived?page=&limit=` | posts | Archived list |
| GET | `/api/v1/posts/hidden?page=&limit=` | posts | Hidden list |
| PATCH | `/api/v1/posts/${postId}/toggle-comments` | posts | Toggle comments |
| PATCH | `/api/v1/posts/${postId}` | posts | Update caption |
| DELETE | `/api/v1/posts/${shortId}` | posts | Delete short |
| GET | `/api/v1/shorts?page=&limit=` | posts | Shorts feed |
| GET | `/api/v1/shorts/user/${userId}?page=&limit=` | posts | User shorts |
| POST | `/api/v1/shorts` (or similar) | posts | Create short (FormData) |

---

## Profile & Follow

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/profile/${userId}` | profile | Get profile |
| PUT | `/api/v1/profile/${userId}` | profile | Update profile (FormData) |
| POST | `/api/v1/profile/${userId}/follow` | profile | Follow |
| GET | `/api/v1/profile/search?q=&page=&limit=` | profile | User search |
| PUT | `/api/v1/profile/${userId}/push-token` | profile | Push token |
| POST | `/api/v1/user/save-push-token` | profile | Save push token |
| GET | `/api/v1/profile/follow-requests` | profile | Follow requests |
| POST | `/api/v1/profile/follow-requests/${requestId}/approve` | profile | Approve |
| POST | `/api/v1/profile/follow-requests/${requestId}/reject` | profile | Reject |
| POST | `/api/v1/profile/${userId}/block` | profile | Block |
| GET | `/api/v1/profile/${userId}/block-status` | profile | Block status |
| GET | `/api/v1/profile/suggested-users?limit=` | profile | Suggested users |
| GET | `/api/v1/profile/${userId}/tripscore/continents` | profile | TripScore continents |
| GET | `/api/v1/profile/${userId}/tripscore/continents/${continent}/countries` | profile | Countries |
| GET | `/api/v1/profile/${userId}/tripscore/countries/${country}` | profile | Country |
| GET | `/api/v1/profile/${userId}/tripscore/countries/${country}/locations` | profile | Locations |
| GET | `/api/v1/profile/${userId}/travel-map` | profile, posts | Travel map |

---

## Chat

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/chat` | chat | List chats |
| GET | `/api/v1/chat/${otherUserId}` | chat | Get chat |
| GET | `/api/v1/chat/${otherUserId}/messages` | chat | Get messages |
| POST | `/api/v1/chat/${otherUserId}/messages` | chat | Send message |
| POST | `/api/v1/chat/${otherUserId}/mark-all-seen` | chat | Mark seen |
| DELETE | `/api/v1/chat/${otherUserId}/messages` | chat | Clear chat |
| POST | `/api/v1/chat/${otherUserId}/mute` | chat | Toggle mute |
| GET | `/api/v1/chat/${otherUserId}/mute-status` | chat | Mute status |

---

## Notifications

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/notifications?page=&limit=` | notifications | List |
| PUT | `/api/v1/notifications/${id}/read` | notifications | Mark read |
| PUT | `/api/v1/notifications/read-all` | notifications | Mark all read |
| GET | `/api/v1/notifications/unread-count` | notifications | Unread count |

---

## Locales (Places)

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/locales?page=&limit=&search=&countryCode=&stateCode=&spotTypes=&includeInactive=` | locale | List locales |
| GET | `/api/v1/locales/${id}` | locale | Get locale |

---

## Collections

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/collections` | collections | List (query: userId?) |
| POST | `/api/v1/collections` | collections | Create |
| GET | `/api/v1/collections/${id}` | collections | Get one |
| PUT | `/api/v1/collections/${id}` | collections | Update |
| DELETE | `/api/v1/collections/${id}` | collections | Delete |
| POST | `/api/v1/collections/${id}/posts` | collections | Add post |
| DELETE | `/api/v1/collections/${id}/posts/${postId}` | collections | Remove post |
| PUT | `/api/v1/collections/${id}/reorder` | collections | Reorder (postIds) |

---

## Settings

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/settings` | settings | Get settings |
| PUT | `/api/v1/settings` | settings | Update settings |
| PUT | `/api/v1/settings/${category}` | settings | Update category |
| POST | `/api/v1/settings/reset` | settings | Reset |

---

## Search & Hashtags

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/search/posts` | search | Search posts |
| GET | `/api/v1/search/location` | search | Search location |
| GET | `/api/v1/hashtags/search?q=&limit=` | hashtags | Hashtag search |
| GET | `/api/v1/hashtags/trending?limit=` | hashtags | Trending |
| GET | `/api/v1/hashtags/${name}` | hashtags | Get hashtag |
| GET | `/api/v1/hashtags/${name}/posts?page=&limit=` | hashtags | Posts by hashtag |

---

## Activity & User Management

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/activity` | activity | Current user activity |
| GET | `/api/v1/activity/user/${userId}` | activity | User activity |
| PUT | `/api/v1/activity/privacy` | activity | Activity privacy |
| GET | `/api/v1/users/me/activity` | userManagement | Account activity |
| GET | `/api/v1/users/me/sessions` | userManagement | Sessions |
| DELETE | `/api/v1/users/me/sessions/${sessionId}` | userManagement | Revoke session |
| GET | `/api/v1/users/me/blocked` | userManagement | Blocked users |
| DELETE | `/api/v1/users/me/blocked/${userId}` | userManagement | Unblock |
| POST | `/api/v1/users/me/verify-email` | userManagement | Verify email |
| POST | `/api/v1/sync` | userManagement | Sync |
| DELETE | `/api/v1/users/me` | userManagement | Delete account |
| GET | `/api/v1/users/me/export` | userManagement | Export data |

---

## Other

| Method | Endpoint | Service | Purpose |
|--------|----------|---------|---------|
| GET | `/locations/countries` | location | Countries list |
| GET | `/locations/states/${countryCode}` | location | States |
| POST | `/api/v1/reports` | report | Create report |
| POST | `/api/v1/analytics/events` | analytics | Send events |
| GET | `/api/v1/feature-flags` | featureFlags | Feature flags |
| GET | `/api/v1/mentions/search` | mentions | @mention search |
| POST | `/api/v1/short-url/create` | shortUrl | Create short URL |

---

## Auth & request behaviour (technical)

- **Base URL:** From getApiBaseUrl() / config (env EXPO_PUBLIC_API_BASE_URL or auto-detect for web). api.ts updates config.baseURL on every request for web.
- **Auth header (mobile):** AsyncStorage.getItem('authToken') → Authorization: Bearer ${token}.
- **Web:** withCredentials: true; no Authorization header; CSRF: X-CSRF-Token from document.cookie (csrf-token=).
- **Platform header:** X-Platform: Platform.OS (ios | android | web).
- **Throttling:** Minimum 100ms between same request (method+url) to reduce 429.
- **Timeout:** Default 30000ms; createPostWithProgress / createShortWithProgress may use longer for uploads.
- **Errors:** parseError(error) returns userMessage; services throw new Error(parsedError.userMessage). 401 may trigger refresh (POST /api/v1/auth/refresh) and retry in api interceptor.

---

## Response shapes (where used)

- **Posts:** { posts: PostType[], pagination }.
- **Post single:** { post: PostType } or PostType.
- **Profile:** UserType or { user: UserType }.
- **Settings:** { settings: UserSettings }.
- **Notifications:** { notifications: Notification[], unreadCount, pagination }.
- **Chat list:** { chats: Chat[] }; messages: { messages: Message[] }.
- **Locales:** { success, message, locales: Locale[], pagination }.
- **Collections:** { collections: Collection[] } or { collection: Collection }.

---

*All module docs are in the same folder; see [00-INDEX.md](./00-INDEX.md) for the full list.*

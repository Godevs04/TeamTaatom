# Profile Module – Developer Guide

Documentation for **Profile**: current user profile (tab) and other user profile (dynamic route).

---

## 1. Purpose & User Flow

- **Screens:**  
  - `app/(tabs)/profile.tsx` – current user profile (tab).  
  - `app/profile/[id].tsx` – other user’s profile by ID.
- **Purpose:** Show user info, travel map, posts/shorts, follow state, edit (self), follow/unfollow (others), kebab menu (settings, sign out, etc.).
- **User flow:** Open profile → see bio, stats, map, grid of posts/shorts → tap post to open; on own profile: edit, sign out; on other: follow/unfollow, block, report.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **Profile data** | Fetched via `getProfile(userId)`; shows fullName, profilePic, bio, followers/following counts. |
| **Travel map** | Globe or map of visited locations; `getTravelMap(userId)` or TripScore endpoints. |
| **Posts / Shorts** | Grid of user’s posts; `getUserPosts(userId, page)`; tap → post detail or home with postId. |
| **Follow** | Follow/unfollow; follow requests (private accounts); approve/reject from profile or notifications. |
| **Edit profile** | EditProfile component/screen: name, bio, profile picture (camera/gallery). |
| **Kebab menu** | Options: settings, sign out, etc. (current user). |
| **Block / Report** | On other user: block, report; block status from `getBlockStatus(userId)`. |
| **TripScore** | Continents/countries/locations for user; links to tripscore flows. |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/profile/${userId}` | Get profile. |
| PUT | `/api/v1/profile/${userId}` | Update profile (FormData: fullName, bio, profilePic). |
| POST | `/api/v1/profile/${userId}/follow` | Follow user. |
| GET | `/api/v1/profile/${userId}/block-status` | Block status. |
| POST | `/api/v1/profile/${userId}/block` | Block user. |
| GET | `/api/v1/profile/${userId}/travel-map` | Travel map data. |
| GET | `/api/v1/posts/user/${userId}?page=&limit=` | User’s posts. |
| GET | `/api/v1/profile/${userId}/tripscore/continents` | TripScore continents. |
| (and country/location sub-routes) | | |

Follow requests: `getFollowRequests`, `approveFollowRequest`, `rejectFollowRequest` in profile service.

---

## 4. Types

- **UserType:** `types/user.ts` (e.g. _id, fullName, username, email, profilePic, bio).
- **PostType:** `types/post.ts` for post grid.

---

## 5. File Map

| File | Role |
|------|------|
| `app/(tabs)/profile.tsx` | Current user profile tab. |
| `app/profile/[id].tsx` | Other user profile. |
| `services/profile.ts` | getProfile, updateProfile, follow, block, travel map, TripScore, follow requests. |
| `services/posts.ts` | getUserPosts. |
| `components/EditProfile.tsx` | Edit profile form and image picker. |

---

## 6. UserType & FollowRequest – full schema (technical)

**UserType (types/user.ts):**
- `_id`, `fullName`, `username?`, `bio?`, `email`, `profilePic`, `followers` (string[]), `following` (string[]), `totalLikes`, `isVerified`, `createdAt`, `updatedAt`, `isFollowing?`, `followRequestSent?`, `requiresFollowApproval?`.

**FollowRequest:** `_id`, `user` (UserType), `requestedAt`, `status`: 'pending' | 'approved' | 'rejected'.

**FollowRequestsResponse:** `followRequests: FollowRequest[]`.

---

## 7. getProfile response & update profile (FormData)

- **GET profile:** Returns user object (UserType shape); may include followers count, following count, isFollowing for current viewer.
- **PUT profile:** FormData with `fullName`, `bio`, and optionally `profilePic` (file). Content-Type left undefined for multipart. Used by EditProfile after crop/pick.

---

## 8. Follow / block behaviour (functional)

- **Follow:** POST `/api/v1/profile/${userId}/follow`. If account is private and requires approval, backend may return followRequestSent; UI shows "Requested" or "Follow request pending". If public, isFollowing becomes true.
- **Unfollow:** Same endpoint may toggle (or separate unfollow endpoint); UI updates isFollowing and follower count optimistically or after refetch.
- **Block:** POST `/api/v1/profile/${userId}/block`; then getBlockStatus to confirm. Blocked users may be hidden from list and profile.
- **Block status:** GET block-status returns e.g. `{ blocked: boolean }` to show "Block" vs "Unblock" and block-related UI.

---

## 9. Travel map & TripScore (technical)

- **Travel map:** GET `/api/v1/profile/${userId}/travel-map` returns locations array (number, latitude, longitude, address, date) and statistics (totalLocations, totalDistance, totalDays). Rendered on globe or map (e.g. RotatingGlobe component).
- **TripScore:** Hierarchy: continents → countries (by continent) → country detail → locations (by country). Endpoints under `/api/v1/profile/${userId}/tripscore/...`. Used for "places visited" and links to tripscore screens.

---

## 10. Profile screen state (current user tab)

- **State:** profile (UserType | null), posts (PostType[]), loading, refreshing, page, hasMore, selectedTab ('posts' | 'shorts'), unreadNotificationCount (for badge). May also store travel map data and TripScore summary.
- **Data load:** On mount/focus: getProfile(me), getUserPosts(me, 1); on load more: getUserPosts(me, page+1). Shorts: getUserShorts(me, page).
- **Edit:** EditProfile modal/screen; on save call updateProfile(userId, FormData); on success refetch profile and showSuccess.

---

## 11. Other user profile ([id].tsx)

- **Route param:** `id` = other user's _id.
- **State:** profile (other user), posts, loading, follow state (isFollowing, followRequestSent), block status.
- **Load:** getProfile(id), getBlockStatus(id), getUserPosts(id). Follow button: if isFollowing show Unfollow; if followRequestSent show "Requested"; if requiresFollowApproval show "Request" (sends follow request).
- **Block/Report:** Block calls profile block API; report uses report service (type, targetUserId, reason). Confirmation via showConfirm/showDestructiveConfirm before destructive actions.

---

## 12. File map (detailed)

| File | Role |
|------|------|
| `app/(tabs)/profile.tsx` | Current user: banner, avatar, bio, stats, map, tabs (posts/shorts), grid, edit button, kebab (settings, sign out), notification badge. |
| `app/profile/[id].tsx` | Other user: same layout but follow button, block, report; no edit. |
| `services/profile.ts` | getProfile, updateProfile (FormData), follow, getFollowRequests, approveFollowRequest, rejectFollowRequest, block, getBlockStatus, getTravelMapData, getTripscoreContinents, getTripscoreCountries, getTripscoreLocations, suggested users. |
| `services/posts.ts` | getUserPosts, getUserShorts. |
| `components/EditProfile.tsx` | Modal/screen: fullName, bio, profilePic pick (camera/gallery), validation (name non-empty, bio length), updateProfile on save. |

---

*Notifications for follow requests: [06-NOTIFICATIONS-MODULE.md](./06-NOTIFICATIONS-MODULE.md). Settings: [07-SETTINGS-MODULE.md](./07-SETTINGS-MODULE.md).*

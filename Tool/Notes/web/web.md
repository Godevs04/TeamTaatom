## Mobile App Feature Analysis (Expo React Native)

### Authentication
- **Screens**: `app/(auth)/signin.tsx`, `signup.tsx`, `verifyOtp.tsx`, `forgot.tsx`, `reset-password.tsx`
- **Services**: `services/auth.ts`, `services/googleAuth.ts`
- **Backend**:
  - `POST /api/v1/auth/signup` – email/password signup with OTP
  - `POST /api/v1/auth/verify-otp` – verify OTP
  - `POST /api/v1/auth/resend-otp` – resend OTP
  - `POST /api/v1/auth/signin` – email/password signin
  - `POST /api/v1/auth/google` – Google OAuth
  - `GET /api/v1/auth/check-username` – username availability
  - `POST /api/v1/auth/forgot-password`, `reset-password`
  - `GET /api/v1/auth/me`, `POST /refresh`, `logout`
- **Features**:
  - Email/password + OTP verification
  - Google OAuth
  - Password reset via OTP
  - JWT-based auth (Bearer for mobile, cookies for web)
  - Token persistence in AsyncStorage (mobile)

### User Profile & Account
- **Screens**: `app/(tabs)/profile.tsx`, `app/profile/[id].tsx`, `app/followers.tsx`, settings screens under `app/settings/*`
- **Services**: `services/profile.ts`
- **Backend**:
  - `GET/PUT /api/v1/profile/:id`
  - `GET /profile/search`, `/profile/suggested-users`
  - `POST /profile/interests`
  - `POST /profile/:id/follow`, `/block`
  - `GET /profile/:id/followers`, `/following`, `/block-status`
  - `GET /profile/follow-requests`, `POST /follow-requests/:id/approve|reject`
  - TripScore + travel map endpoints (see Location)
- **Features**:
  - View/edit profile (avatar, full name, username, bio)
  - Followers / following lists
  - Follow/unfollow with private profile flow
  - Follow-requests approval/rejection
  - Block/unblock
  - Profile-level TripScore stats & travel map data
  - Rich settings: account, privacy, notifications, appearance, data/export, blocked-users, sessions, activity log

### Posts & Shorts (Trips)
- **Posts**:
  - **Screens**: `app/(tabs)/home.tsx`, `app/(tabs)/post.tsx` (photo mode), `app/post/[id].tsx`, `app/user-posts/[userId].tsx`, `app/saved-posts/index.tsx`, `app/settings/manage-posts.tsx`
  - **Services**: `services/posts.ts`, `services/realtimePosts.ts`
  - **Backend**:
    - `GET /api/v1/posts` – global feed (offset/cursor pagination)
    - `GET /api/v1/posts/:id`
    - `POST /api/v1/posts` – create photo post (multipart, up to 10 images)
    - `GET /api/v1/posts/user/:userId`
    - `POST /api/v1/posts/:id/like`
    - `POST /api/v1/posts/:id/comments`, `DELETE /:id/comments/:commentId`
    - `DELETE /api/v1/posts/:id`
    - `PATCH /api/v1/posts/:id/archive|unarchive|hide|unhide|toggle-comments`
    - `PATCH /api/v1/posts/:id` – update caption/meta
    - `GET /api/v1/posts/archived`, `/hidden`
  - **Features**:
    - Multi-image posts with captions (hashtags, mentions)
    - Location tagging (lat/lng + address)
    - Optional background music (song selection, trimming, volume)
    - View post detail with likes, comments, saves, share
    - Archive/hide/delete/edit posts
    - EXIF GPS extraction on upload
    - Real-time feed updates (Socket.IO)

- **Shorts**:
  - **Screens**: `app/(tabs)/shorts.tsx` (vertical swipe feed), user shorts grid from profile
  - **Backend**:
    - `GET /api/v1/shorts`, `/shorts/user/:userId`
    - `POST /api/v1/shorts` – create short (video + optional thumbnail)
  - **Features**:
    - Full-screen vertical swipe feed with snapping
    - Auto-play/pause on visibility
    - Per-short like, comment, share, save
    - Video upload + thumbnail, optional music
    - Signed video URLs + refresh on 403/404/timeout

### Audio / Music
- **Screens**: integrated into post/short creation (SongSelector, SongPlayer)
- **Service**: `services/songs.ts`
- **Backend**: `/api/v1/songs` (`GET /`, `GET /:id`, `POST /upload`, `DELETE`, `PATCH /toggle`, `PUT`)
- **Features**:
  - Song library browsing & search
  - Genre filtering and pagination
  - Attach song to post/short with clip selection and volume
  - Audio playback via signed S3 URLs

### Location, TripScore, Maps
- **Screens**:
  - `app/map/all-locations.tsx`, `app/map/current-location.tsx`
  - `app/tripscore/continents.tsx`
  - `app/tripscore/continents/[continent]/countries.tsx`
  - `app/tripscore/countries/[country].tsx`
  - `app/tripscore/countries/[country]/locations.tsx`
  - `app/tripscore/countries/[country]/map.tsx`
- **Services**: location/TripScore helpers
- **Backend**:
  - `GET /api/v1/profile/:id/tripscore/continents`
  - `GET /api/v1/profile/:id/tripscore/continents/:continent/countries`
  - `GET /api/v1/profile/:id/tripscore/countries/:country`
  - `GET /api/v1/profile/:id/tripscore/countries/:country/locations`
  - `GET /api/v1/profile/:id/travel-map`
  - `POST /api/v1/maps/search-place-user`
  - `GET /api/v1/search/location` (or similar) – location-radius search
- **Features**:
  - GPS capture + EXIF GPS extraction
  - Reverse geocoding / place selection
  - Verified locations feeding TripScore
  - TripScore hierarchy: continents → countries → locations
  - Travel map with markers (react-native-maps)
  - Location-based search & filtering

### Media Upload & Cloud Integration
- **Implementation**: `services/posts.ts` (`createPostWithProgress`, `createShortWithProgress`)
- **Features**:
  - Multi-image upload (posts) with progress UI
  - Large video upload (shorts) with progress
  - Thumbnails for videos
  - Cloudinary for images
  - S3 for videos and songs (presigned URLs)
  - Automatic signed URL refresh (shorts, posts, audio)

### Social Features
- **Likes & saves**:
  - Toggle like on posts and shorts
  - Save posts to collections; collections CRUD (`/collections`)
  - Local liked-IDs caching on mobile for UX
- **Comments**:
  - Add/delete comments on posts/shorts
  - Comment modals & counts
- **Share**:
  - Short URL generation via `/short-url/create`
  - Native share sheets
- **Follow / block / report**:
  - Follow/unfollow with private-account workflow
  - Block/unblock, block status checks
  - Report users/posts (`/reports`)
- **Notifications**:
  - Feed-style notifications (`/notifications`)
  - Unread count, mark read/all-read
  - Expo push token registration & push notifications
- **Chat**:
  - 1:1 messaging: threads list, conversation detail
  - Send, mute/unmute, mark-all-seen, delete messages
  - Real-time via Socket.IO

### Onboarding, Search, Misc
- **Onboarding**:
  - `onboarding/welcome` → `interests` → `suggested-users`
  - Interests saved to `/profile/interests`
  - Suggested users from `/profile/suggested-users` (now interest-aware)
- **Search**:
  - Global search screen: users, posts, hashtags, locations
  - Hashtag pages: `app/hashtag/[hashtag].tsx`
- **Collections**:
  - `app/collections/index.tsx`, `/[id].tsx`, `/create.tsx`
- **Activity feed**: `app/activity/index.tsx`
- **Policies & support**: terms, privacy, copyright, support/help/contact screens

---

## Backend API & Middleware Analysis

### API Groups
- **Auth (`/api/v1/auth`)**:
  - `POST /signup`, `/verify-otp`, `/resend-otp`, `/signin`, `/google`
  - `GET /me`, `POST /refresh`, `/forgot-password`, `/reset-password`, `/logout`
- **Posts (`/api/v1/posts`)**:
  - `GET /`, `GET /:id`, `POST /`
  - `GET /user/:userId`
  - `POST /:id/like`
  - `POST /:id/comments`, `DELETE /:id/comments/:commentId`
  - `DELETE /:id`
  - `PATCH /:id/archive|unarchive|hide|unhide|toggle-comments`
  - `PATCH /:id` – update
  - `GET /archived`, `/hidden`
- **Shorts (`/api/v1/shorts`)**:
  - `GET /`, `GET /user/:userId`, `POST /`
- **Profile (`/api/v1/profile`)**:
  - `GET /search`, `/suggested-users`, `POST /interests`
  - `GET /follow-requests`, `POST /follow-requests/:id/approve|reject`
  - `GET /:id`, `PUT /:id`
  - `POST /:id/follow`, `/block`
  - `GET /:id/block-status`, `/followers`, `/following`
  - TripScore endpoints + `/travel-map`
  - `PUT /:id/push-token`
- **Chat (`/api/v1/chat`)**:
  - Threads: `GET /`
  - Conversation: `GET /:otherUserId`, `/messages`
  - `POST /:otherUserId/messages`, `mark-all-seen`, `mute`
  - `DELETE /:otherUserId/messages`, `GET /:otherUserId/mute-status`
- **Notifications (`/api/v1/notifications`)**:
  - `GET /`, `PUT /:id/read`, `PUT /read-all`, `GET /unread-count`
- **Collections (`/api/v1/collections`)**:
  - CRUD collections, add/remove posts, reorder
- **Search & hashtags**:
  - `/search/posts`, `/search/location`
  - `/hashtags/search`, `/trending`, `/:hashtag`, `/:hashtag/posts`
- **Songs (`/api/v1/songs`)**:
  - `GET /`, `GET /:id`
  - Admin: `POST /upload`, `DELETE /:id`, `PATCH /:id/toggle`, `PUT /:id`
- **Maps (`/api/v1/maps`)**:
  - `POST /search-place`, `/geocode` (admin)
  - `POST /search-place-user` (users)
- **Reports (`/api/v1/reports`)**:
  - `POST /`
- **Activity & settings**:
  - `/api/v1/activity` – list activity, `user/:userId`, `PUT /privacy`
  - `/api/v1/settings` – `GET`, `PUT`, `/reset`, `PUT /:category`
- **User management (`/api/v1/user-management`)**:
  - Account-activity, sessions, blocked users, email verification, delete, export
- **Short URL (`/api/v1/short-url`)**:
  - `POST /create`, plus public redirect `/s/:shortCode`
- **Health (`/health/*`)**:
  - Basic, detailed, readiness, liveness
- **SuperAdmin (`/api/v1/superadmin`)**:
  - Full admin ecosystem (users, posts, songs, TripScore, analytics, moderation, feature flags)

### Auth Strategy
- **Tokens**:
  - JWT access tokens with user ID.
  - Mobile: Bearer tokens in `Authorization` header.
  - Web: HttpOnly cookies.
- **Middleware**:
  - `authMiddleware` – required auth; verifies JWT, checks `isVerified`, loads user, attaches `req.user`.
  - `optionalAuth` – same verification but continues without `req.user` on missing/invalid token.
  - SuperAdmin-specific token verification for admin routes.
- **CSRF**:
  - Cookie-based CSRF tokens.
  - Enforced for state-changing requests unless:
    - Bearer token used (mobile).
    - Endpoint explicitly whitelisted (signup, signin, etc.).

### Global Middleware
- Helmet, CORS, cookie-parser.
- Request ID + structured logging.
- Compression and body parsing.
- Request size limiter (path-aware: posts/shorts/profile/songs).
- Rate limiting (global + endpoint-specific).
- Input sanitization to prevent XSS.
- CSRF token generation + verification.
- Central error handler that standardizes responses & codes.

### Response & Error Format
- **Success**:
  ```json
  {
    "success": true,
    "message": "Human-readable message",
    "data": { ... } // OR top-level domain keys like posts, shorts, pagination
  }
  ```
- **Error**:
  ```json
  {
    "success": false,
    "error": {
      "code": "AUTH_1001",
      "message": "User-friendly message",
      "details": { ... optional }
    }
  }
  ```
- **Error codes**: namespaced (`AUTH_*`, `VAL_*`, `RES_*`, `FILE_*`, `RATE_*`, `SRV_*`, `BIZ_*`) and consistent across controllers.

### Pagination
- **Offset-based**:
  - Query: `page`, `limit`
  - Response:
    ```json
    {
      "pagination": {
        "currentPage": 1,
        "totalPages": 10,
        "totalPosts": 200,
        "hasNextPage": true,
        "hasPrevPage": false,
        "limit": 20
      }
    }
    ```
- **Cursor-based**:
  - Query: `useCursor=true`, `cursor`, `limit`
  - Response:
    ```json
    {
      "pagination": {
        "cursor": "2024-01-15T10:30:00.000Z",
        "hasNextPage": true,
        "limit": 20
      }
    }
    ```
- Widely used for feeds like `/posts` and others where time-ordered data benefits from cursoring.

---

## Feature Parity Checklist for Web (Next.js App Router)

> Everything that exists in mobile MUST exist in web. This is a checklist, not implementation.

### Auth & Account
- [ ] Email/password signup with OTP verification, resend OTP.
- [ ] Email/password signin.
- [ ] Google OAuth signin (web flow).
- [ ] Forgot password + OTP reset.
- [ ] Username availability check.
- [ ] Logout and session handling via HttpOnly cookies.
- [ ] Use CSRF tokens (`X-CSRF-Token`) for state-changing requests.

### Profile & Settings
- [ ] Current-user profile page with avatar, bio, TripScore, stats.
- [ ] Public profile page by username/ID.
- [ ] Edit profile (bio, name, avatar upload).
- [ ] Followers / following pages.
- [ ] Follow/unfollow buttons honoring privacy.
- [ ] Follow-request management UI.
- [ ] Settings pages mirroring mobile: account, privacy, notifications, appearance, data/export, sessions, blocked users.
- [ ] TripScore and travel map sections on profile.

### Posts & Shorts
- [ ] Home feed with posts (infinite scroll or “Load more”) using `/posts`.
- [ ] Post detail page with photos, caption, likes, comments, saves, share.
- [ ] Create-post page: multi-image upload, caption, tags, location, music.
- [ ] User-posts page for any user.
- [ ] Saved posts + collections management.
- [ ] Shorts feed on web (vertical swiper or responsive cards).
- [ ] Short detail or full-screen short experience.
- [ ] Create-short page: video + thumbnail, caption, music, location.

### Location, TripScore, Maps
- [ ] Location picker using `/maps/search-place-user`.
- [ ] Travel map page with markers.
- [ ] TripScore pages: continents, countries, locations.
- [ ] Country/continent map views.
- [ ] Distinguish verified vs non-verified locations visually.

### Media, Cloud, Signed URLs
- [ ] Image upload with progress for posts.
- [ ] Video upload with progress for shorts.
- [ ] Use backend `/posts` and `/shorts` endpoints directly (FormData).
- [ ] Respect signed URLs (images, videos, audio) and refresh by refetching post/short when necessary.

### Social Features
- [ ] Like/unlike posts and shorts (optimistic UI).
- [ ] Save/unsave posts into collections; full collections UI.
- [ ] Comments on posts/shorts: list/add/delete.
- [ ] Share buttons with short URLs and OG metadata.
- [ ] Follow/unfollow everywhere.
- [ ] Block/unblock + report flows.
- [ ] Notifications center and unread badge.
- [ ] Web chat UI with threads, messages, mute, seen; Socket.IO client.

### Onboarding, Discovery, Search
- [ ] Onboarding: interests + suggested users (or equivalent flow).
- [ ] Global search (users, posts, hashtags, locations).
- [ ] Hashtag pages with post lists.
- [ ] Activity feed page.

### Web-Specific Requirements (SEO, SSR, Meta)
- [ ] SEO-friendly routes (profiles, posts, hashtags, TripScore).
- [ ] `generateMetadata` / `metadata` per route with:
  - Titles, descriptions, canonical URLs.
  - Open Graph & Twitter card tags.
  - Per-post OG image (first photo/thumbnail).
- [ ] SSR/SSG where appropriate:
  - SSR for public content (profiles, posts, hashtags, TripScore).
  - SSG + revalidation for policies, help, static pages.
- [ ] Middleware-based auth for protected routes.
- [ ] `next/image` for asset optimization.
- [ ] Accessible HTML (a11y), keyboard/focus handling.


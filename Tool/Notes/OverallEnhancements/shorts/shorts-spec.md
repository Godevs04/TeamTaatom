# Shorts Menu - Product Specification

## 1. Overview

The Shorts menu provides a TikTok-style vertical video feed where users can watch short-form videos (up to 60 minutes), interact through likes and comments, follow creators, and discover new content. The feed uses full-screen vertical scrolling with auto-play, swipe gestures, and immersive viewing experience.

### User Personas & Goals

- **Content Consumers**: Watch short videos, discover new creators, get entertainment
- **Engaged Users**: Like, comment, share, and follow creators
- **Content Creators**: Share short videos, build audience, gain followers
- **Casual Viewers**: Quick entertainment, passive consumption

### Frontend-Backend-superAdmin Collaboration

- **Frontend** (`frontend/app/(tabs)/shorts.tsx`): Vertical feed UI, video playback, swipe gestures, interactions, comment modal
- **Backend** (`backend/src/controllers/postController.js`, `backend/src/routes/shortsRoutes.js`): Serves shorts feed, handles engagement, video storage
- **superAdmin** (`superAdmin/src/pages/TravelContent.jsx`): Moderates shorts (activate/deactivate/flag/delete)

**Cross-Module Context**: Shorts are created from the Post tab using "Short mode" (see Post spec). Viewing history and engagement on shorts contributes to TripScore only when the upload has trusted GPS metadata (same rules as posts). Saved shorts appear later under the Profile → SAVED tab, alongside saved photo posts.

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `frontend/app/(tabs)/shorts.tsx`

**Purpose**: Vertical video feed with full-screen playback

**Entry Points**:
- Tab navigation from bottom bar (Shorts icon)
- Deep link: `/(tabs)/shorts`
- Navigation from other screens (tap on short video)
- Navigation from profile (tap on short in profile grid): Tapping a short thumbnail in Profile → SHORTS opens the Shorts feed anchored at that short, using the same vertical feed but with an initial index
- From Profile → SAVED tab when tapping on a saved short (opens Shorts feed anchored at that short)

**Exit Points**:
- Tab navigation → Switch to other tabs
- Back button → Returns to previous screen (if opened from Profile or Saved, returns to originating screen)
- Tap on user → Navigate to profile
- Swipe down → Close (if opened from detail view)

**Video Player Features**:
- Full-screen vertical playback (9:16 aspect ratio)
- Auto-play on scroll
- Pause on tap
- Swipe up/down to navigate
- Background music support
- Volume control

**Modals**:
- Comment Modal: View and add comments
- Share Modal: Share short to external apps
- User Profile Modal: Quick profile view (inferred)

---

## 3. Detailed Features & User Flows

### 3.1 Vertical Feed View

**Feature Name**: Infinite Scroll Video Feed

**Business Description**: Users see a continuous feed of short videos in full-screen vertical format. Videos auto-play when scrolled into view and pause when scrolled away.

**Preconditions**:
- Network connectivity (with offline caching)
- User may be authenticated (optional for viewing, required for interactions)

**Step-by-Step Flow**:
1. User opens Shorts tab
2. Fetch shorts: `GET /api/v1/shorts?page=1&limit=20`
3. Display videos in FlatList with:
   - `pagingEnabled: true` (snap to each video)
   - `showsVerticalScrollIndicator: false`
   - `snapToInterval: SCREEN_HEIGHT` (full screen per video)
   - `decelerationRate: 'fast'`
4. As user scrolls:
   - Current video pauses
   - Next video auto-plays
   - Previous videos unload (memory optimization)
5. Track current index: `currentIndex` state
6. Preload next video for smooth playback
7. Cleanup videos 3 positions away from current

**Validations**:
- Videos filtered to: `isActive: true`, `isArchived: { $ne: true }`, `isHidden: { $ne: true }`, `type: 'short'`
- Videos sorted by `createdAt: -1` (newest first)

**Error States**:
- Network error: Show offline banner, use cached videos
- No videos: Show empty state "No shorts available"
- Video load error: Skip to next video, show error indicator

**Success States**:
- Videos play smoothly
- Auto-play works correctly
- Swipe navigation is responsive

---

### 3.2 Video Playback

**Feature Name**: Auto-Play with Controls

**Business Description**: Videos automatically play when scrolled into view, pause on tap, and support background music playback.

**Preconditions**: Video is in viewport

**Step-by-Step Flow - Auto-Play**:
1. Video scrolls into view (current index matches)
2. Load video: `videoRef.loadAsync({ uri: videoUrl })`
3. Play video: `videoRef.playAsync()`
4. Set `isPlaying: true`
5. If video has background music:
   - Load song: `SongPlayer` component
   - Play music at specified `startTime`
   - Adjust volume to `songVolume`
   - Stop at `endTime` or 60 seconds
6. Track video view: `trackPostView(shortId, { type: 'short', source: 'shorts_feed' })`

**Step-by-Step Flow - Pause on Tap**:
1. User taps on video
2. Show pause button overlay (fade in)
3. Pause video: `videoRef.pauseAsync()`
4. Pause music (if playing)
5. Set `isPlaying: false`
6. Hide pause button after 2 seconds (fade out)
7. If user taps again: Resume playback

**Step-by-Step Flow - Background Music**:
1. Check if short has `song` data
2. If yes: Load song from `song.songId`
3. Play song starting at `song.startTime`
4. Adjust volume to `song.volume` (0-1)
5. Stop at `song.endTime` or 60 seconds (whichever comes first)
6. Sync with video playback (pause/resume together)

**Validations**:
- Video URL must be valid
- Video must be in supported format (MP4, MOV, etc.)
- Song data must be valid (songId, startTime, endTime, volume)

**Error States**:
- Video load fails: Show error indicator, skip to next
- Music load fails: Continue without music (video still plays)
- Network timeout: Show "Video unavailable" message

**Success States**:
- Video plays smoothly
- Music syncs with video
- Controls respond immediately

---

### 3.3 Swipe Navigation

**Feature Name**: Vertical Swipe Gestures

**Business Description**: Users can swipe up to see next video or swipe down to see previous video. Swipe gestures provide smooth navigation between videos.

**Preconditions**: User is on Shorts screen

**Step-by-Step Flow - Swipe Up (Next)**:
1. User swipes up on video
2. Track swipe start: `onTouchStart` → `setSwipeStartY(y)`
3. Track swipe end: `onTouchEnd` → Calculate delta
4. If delta > 50px (upward swipe):
   - Scroll to next video: `flatListRef.scrollToIndex({ index: currentIndex + 1 })`
   - Update `currentIndex`
   - Pause current video
   - Play next video
5. Show swipe animation (fade transition)

**Step-by-Step Flow - Swipe Down (Previous)**:
1. User swipes down on video
2. If `currentIndex > 0`:
   - Scroll to previous video
   - Update `currentIndex`
   - Play previous video
3. If `currentIndex === 0`: Show "No more videos" hint (inferred)

**Swipe Hint**:
- Show hint overlay: "Swipe up for next video"
- Hide after 3 seconds
- Show only on first visit (inferred)

**Validations**:
- Swipe threshold: 50px minimum
- Cannot swipe beyond first/last video
- Swipe disabled during video load

**Error States**:
- Swipe fails: Video stays on current
- Index out of bounds: Clamp to valid range

**Success States**:
- Smooth swipe animation
- Video transitions seamlessly
- No lag or stuttering

---

### 3.4 Video Interactions (Like, Comment, Share, Save)

**Feature Name**: Engagement Actions

**Business Description**: Users can like, comment, share, and save shorts directly from the feed.

**Preconditions**: User is authenticated (for like/comment/share/save)

**Step-by-Step Flow - Like**:
1. User taps heart icon
2. Optimistic update: Toggle `isLiked`, increment/decrement `likesCount`
3. Call API: `POST /api/v1/posts/:id/like`
4. On success: Update state with server response
5. Track analytics: `trackEngagement('like', 'short', shortId)`
6. Trigger haptic feedback
7. Show animation: Heart fills, count updates

**Step-by-Step Flow - Comment**:
1. User taps comment icon
2. Open `PostComments` modal
3. Load comments: `GET /api/v1/posts/:id` (to get full post with comments)
4. User types comment and submits
5. Call API: `POST /api/v1/posts/:id/comments` with `{ text: string }`
   - Note: Shorts use the same comments endpoint as photo posts (POST /api/v1/posts/:id/comments), so validation rules are identical to the Home feed
6. On success: Add comment to local state, increment `commentsCount`
7. Track analytics: `trackEngagement('comment', 'short', shortId)`
8. Trigger haptic feedback

**Step-by-Step Flow - Share**:
1. User taps share icon
2. Open native share sheet: `Share.share({ message: shortUrl, url: shortUrl })`
3. User selects share method (WhatsApp, Instagram, etc.)
4. Track analytics: `trackEngagement('share', 'short', shortId)`

**Step-by-Step Flow - Save**:
1. User taps bookmark icon
2. Toggle save state in AsyncStorage (`savedShorts` array)
3. Update local state `isSaved`
4. Emit event: `savedEvents.emitChanged()`
   - These saved shorts are later surfaced in the Profile → SAVED tab, using the same savedShorts AsyncStorage key as defined in the Profile spec
5. Show toast: "Saved to favorites!" or "Removed from saved"

**Validations**:
- Like: Post must exist, user must be authenticated
- Comment: Text length 1–1000 characters (same as posts), post must allow comments
- Share: Post must be active
- Save: No validation (client-side only)

**Error States**:
- Like/Comment API error: Revert optimistic update, show error toast
- Network error: Show "Connection issue" message
- Comment disabled: Show "Comments are disabled for this short"

**Success States**:
- Like: Heart icon fills, count updates
- Comment: Comment appears in modal, count increments
- Share: Native share sheet opens
- Save: Bookmark icon fills, toast shown
  - Saved shorts remain local to the device (no server sync), same as saved posts

---

### 3.5 Follow Creator

**Feature Name**: Quick Follow

**Business Description**: Users can follow the creator of a short directly from the video feed without leaving the shorts screen.

**Preconditions**: User is authenticated, viewing another user's short

**Step-by-Step Flow**:
1. User taps "Follow" button (on user info overlay)
2. Optimistic update: Button changes to "Following"
3. Call API: `POST /api/v1/profile/:id/follow`
4. On success: Update follow state
5. Track analytics: `trackEngagement('follow', 'short', creatorId)`
6. Show toast: "Following @username"

**Validations**:
- Cannot follow self
- Cannot follow if already following (handled by toggle)

**Error States**:
- Follow API error: Revert optimistic update, show error
- Network error: Show "Failed to follow" message

**Success States**:
- Button updates to "Following"
- Toast confirms action
- Creator notified (inferred)

---

### 3.6 Video Quality Adaptation

**Feature Name**: Network-Aware Quality

**Business Description**: Automatically adjusts video quality based on network conditions to ensure smooth playback.

**Preconditions**: Video is loading

**Step-by-Step Flow**:
1. Check network status: `fetch('https://www.google.com/favicon.ico')`
2. If request succeeds quickly (< 3 seconds):
   - Set `videoQuality: 'high'`
   - Use original video URL
3. If request fails or times out:
   - Set `videoQuality: 'low'`
   - Use lower quality URL (if available) or add quality parameter
4. Re-check network every 60 seconds
5. Adjust quality dynamically

**Validations**:
- Network check timeout: 3 seconds
- Quality options: 'low' | 'medium' | 'high'

**Error States**:
- Network check fails: Default to 'low' quality
- Quality adaptation fails: Use original URL

**Success States**:
- Videos load at appropriate quality
- Smooth playback on all networks
- Automatic quality adjustment

---

### 3.7 Video Caching

**Feature Name**: Offline Video Support

**Business Description**: Caches recently viewed videos for offline playback and faster loading.

**Preconditions**: Video is viewed

**Step-by-Step Flow**:
1. When video is viewed, cache video URL:
   - Key: `video:${shortId}`
   - Value: `{ url: string, timestamp: number }`
   - TTL: 30 minutes
2. On next load, check cache first
3. If cached and fresh: Use cached URL
4. If expired or missing: Fetch from server
5. Cleanup old cache entries (> 30 minutes)

**Validations**:
- Cache duration: 30 minutes
- Max cache size: Limited by device storage (inferred)

**Error States**:
- Cache full: Evict oldest entries
- Cache read fails: Fetch from server

**Success States**:
- Videos load faster from cache
- Offline playback works for cached videos
- Cache management is efficient

---

## 4. Data Model & API Design

### 4.1 Data Entities

**Short Entity** (same as Post with `type: 'short'`):
```typescript
interface Short {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
    username?: string;
  };
  caption: string; // 1-1000 chars
  videoUrl: string; // Required for shorts
  imageUrl?: string; // Thumbnail
  location?: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  type: 'short'; // Always 'short'
  likes: string[]; // Array of user IDs
  comments: Comment[];
  isActive: boolean;
  isArchived?: boolean;
  isHidden?: boolean;
  commentsDisabled?: boolean;
  views: number;
  song?: {
    songId: {
      _id: string;
      title: string;
      artist: string;
      s3Url: string;
    };
    startTime: number; // Default: 0
    endTime: number | null; // null = play until end or 60s
    volume: number; // Default: 0.5, range 0-1
  };
  createdAt: string;
  // Virtual fields
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  isLiked: boolean; // Computed
  mediaUrl: string; // Alias for videoUrl
}
```

### 4.2 API Endpoints

#### GET /api/v1/shorts

**Purpose**: Fetch paginated list of short videos for feed

**Method**: GET

**Auth**: Optional (public access, but authenticated users get `isLiked` field)

**Query Parameters**:
- `page` (number, default: 1): Page number
- `limit` (number, default: 20): Items per page

**Request Body**: None

**Response Structure**:
```json
{
  "success": true,
  "message": "Shorts fetched successfully",
  "shorts": [Short[]],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalShorts": 200,
    "hasNextPage": true,
    "limit": 20
  }
}
```

**Backend Logic** (from `backend/src/controllers/postController.js`):
- Filters: `isActive: true`, `isArchived: { $ne: true }`, `isHidden: { $ne: true }`, `type: 'short'`
- Sorts by `createdAt: -1` (newest first)
- Uses aggregation pipeline for efficient joins (user, comments, songs)
- Adds `isLiked` field if user is authenticated
- Returns `mediaUrl` (alias for `videoUrl`)

---

#### GET /api/v1/shorts/user/:userId

**Purpose**: Get shorts by specific user

**Method**: GET

**Auth**: Optional

**Path Parameters**:
- `userId`: User ID

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 100)

**Response Structure**: Same as `GET /api/v1/shorts`

**Backend Logic**:
- Filters by `user: userId` and `type: 'short'`
- Same sorting and aggregation as main feed

---

#### POST /api/v1/shorts

**Purpose**: Create new short video

**Method**: POST

**Auth**: Required

**Request Body**: `multipart/form-data`
- `video`: Video file (required, max 60 minutes)
- `image`: Thumbnail image (optional)
- `caption`: String (required, 1-1000 chars)
- `address`, `latitude`, `longitude`: Location data (optional)
- `hasExifGps`, `takenAt`, `source`, `fromCamera`: TripScore metadata (optional)
- `songId`, `songStartTime`, `songEndTime`, `songVolume`: Music data (optional)
- `tags`: Comma-separated hashtags (optional)

**Response Structure**:
```json
{
  "success": true,
  "message": "Short created successfully",
  "short": Short
}
```

**Backend Logic**:
- Uploads video to Sevalla Object Storage (or Cloudinary)
- Generates thumbnail if not provided
- Creates Post document with `type: 'short'`
- Extracts hashtags and mentions
- Creates TripVisit (if location verified)
- Creates notifications for mentions
- Invalidates shorts feed cache

---

#### POST /api/v1/posts/:id/like

**Purpose**: Like/unlike a short (same endpoint as posts)

**Method**: POST

**Auth**: Required

**Response Structure**:
```json
{
  "success": true,
  "isLiked": true,
  "likesCount": 42
}
```

---

#### POST /api/v1/posts/:id/comments

**Purpose**: Add comment to short (same endpoint as posts)

**Method**: POST

**Auth**: Required

**Request Body**:
```json
{
  "text": "Great video!"
}
```

**Response Structure**:
```json
{
  "success": true,
  "comment": {
    "_id": "...",
    "user": {...},
    "text": "Great video!",
    "createdAt": "..."
  }
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Local State

**Component State** (`frontend/app/(tabs)/shorts.tsx`):
- `shorts`: Array of Short objects
- `loading`: Boolean for initial load
- `currentIndex`: Number (current video index)
- `isPlaying`: Boolean (global play state)
- `videoStates`: `{ [shortId]: boolean }` (per-video play state)
- `showPauseButton`: `{ [shortId]: boolean }` (pause button visibility)
- `currentUser`: Current user object
- `savedShorts`: Set of saved short IDs
- `showCommentModal`: Boolean
- `selectedShortId`: String or null
- `selectedShortComments`: Array of comments
- `actionLoading`: String or null (loading state for actions)
- `followStates`: `{ [userId]: boolean }` (follow status per user)
- `swipeStartX`, `swipeStartY`: Number or null (swipe tracking)
- `showSwipeHint`: Boolean
- `videoQuality`: 'low' | 'medium' | 'high'

**Refs**:
- `flatListRef`: FlatList reference
- `videoRefs`: `{ [shortId]: Video }` (video player refs)
- `pauseTimeoutRefs`: `{ [shortId]: NodeJS.Timeout }` (pause button timeouts)
- `swipeAnimation`: Animated value for swipe
- `fadeAnimation`: Animated value for fade
- `videoCacheRef`: Map of cached video URLs

### 5.2 Global State / Context

**ThemeContext**: Provides theme for styling

**AlertContext**: Provides error/success alerts

### 5.3 Custom Hooks

**useScrollToHideNav**: Hides tab bar on scroll

### 5.4 Caching Strategy

**Video Cache**:
- Key: `video:${shortId}`
- Value: `{ url: string, timestamp: number }`
- TTL: 30 minutes
- Stored in memory (`videoCacheRef`)

**AsyncStorage**:
- Saved shorts: `'savedShorts'` (array of short IDs)
- Synced via `savedEvents` emitter

**Backend Cache**:
- Shorts list: Cached with TTL (inferred)
- Single short: Cached with TTL (inferred)

### 5.5 Optimistic Updates

**Like Action**:
- Immediately updates `isLiked` and `likesCount`
- Reverts on API error

**Follow Action**:
- Immediately updates follow button
- Reverts on API error

### 5.6 Side Effects

**useEffect Dependencies**:
- Load shorts on mount
- Track current video view
- Preload next video
- Cleanup distant videos
- Monitor network status
- Load saved shorts on mount

**Cleanup**:
- Unload videos on unmount
- Clear pause timeouts
- Clear video cache

---

## 6. Backend Logic & Rules

### 6.1 Short Retrieval Rules

**Filtering**:
- Only active shorts: `isActive: true`
- Exclude archived: `isArchived: { $ne: true }`
- Exclude hidden: `isHidden: { $ne: true }`
- Only short type: `type: 'short'`

**Sorting**:
- Default: `createdAt: -1` (newest first)
- No algorithm-based ranking (chronological feed)

**Performance Optimizations**:
- Uses aggregation pipeline (avoids N+1 queries)
- Caches shorts lists
- Limits comment user lookups to essential fields

### 6.2 Engagement Rules

**Like Rules**:
- Users can like/unlike their own shorts
- No rate limiting (inferred)
- Creates Activity record
- Sends notification to creator (if not own short)

**Comment Rules**:
- Max length: 1000 characters (same as posts, shared endpoint)
- Min length: 1 character
- Comments disabled if `commentsDisabled === true`
- Extracts mentions and creates notifications

**View Tracking**:
- Views incremented on `GET /api/v1/posts/:id`
- Only incremented if viewing another user's short (not own)
- Anonymous views also counted

### 6.3 Video Upload Rules

**File Requirements**:
- Format: MP4, MOV, etc. (video/*)
- Max duration: 60 minutes (3600 seconds)
- No file size limit (unlimited uploads)
- Thumbnail: Optional (auto-generated if missing)

**Location & TripScore**:
- Shorts follow the exact same TripScore pipeline as photo posts. On upload, the backend evaluates the source (taatom_camera_live, gallery_exif, etc.) and sets a trustLevel on the generated TripVisit. Only high and medium trust visits contribute to TripScore, as described in the Profile spec. The source → trust mapping is identical to posts (see Post spec section 3.3 Location Extraction & Verification):
  - `taatom_camera_live` → `'high'` trust
  - `gallery_exif` → `'medium'` trust
  - `gallery_no_exif` → `'low'` trust
  - `manual_only` → `'unverified'` trust

### 6.4 Background Music Rules

**Music Playback**:
- Start time: `song.startTime` (default: 0)
- End time: `song.endTime` or 60 seconds (whichever comes first)
- Volume: `song.volume` (0-1, default: 0.5)
- Syncs with video playback (pause/resume together)

### 6.5 Cross-Module Behaviour

Shorts reuse the same posts collection and core controllers as photo posts, with `type: 'short'` used to differentiate them.

Comment creation, likes, and view tracking share the same endpoints as Home feed posts (`/api/v1/posts/:id/...`), so rate limits and validation rules are identical.

TripVisits created from shorts follow the same trust-level and deduplication rules used for TripScore in the Profile spec.

Saved shorts integrate with the Profile → SAVED tab via the shared `savedShorts` AsyncStorage key.

---

## 7. superAdmin Dependencies

### 7.1 Content Moderation

**File**: `superAdmin/src/pages/TravelContent.jsx`

**Features**:
- View all shorts with filters
- Activate/Deactivate shorts
- Flag shorts for review
- Delete shorts permanently
- Search by caption, user, location
- Filter by status (active/inactive)

**Impact on Shorts Feed**:
- Deactivated shorts excluded from feed
- Flagged shorts may be hidden (inferred)
- Deleted shorts removed permanently

---

## 8. Permissions, Privacy & Security

### 8.1 Access Rules

**Public Access**:
- Anyone can view shorts feed (no authentication required)
- Unauthenticated users can watch but cannot interact

**Authenticated Access**:
- Required for: Like, Comment, Share, Save, Follow actions
- Optional for: Viewing feed (enhanced with `isLiked` field)

### 8.2 Privacy Rules

**Short Visibility**:
- Only active, non-archived, non-hidden shorts appear in feed
- **Current behaviour**: Profile visibility settings (profileVisibility in the Profile spec) do not hide a user's active shorts from the Shorts feed. This may differ from how photo posts are filtered in other parts of the app.
- Blocked users' shorts may be filtered (inferred)

**Content Filtering**:
- No explicit content filtering based on user preferences
- Moderation happens at superAdmin level

### 8.3 Security Checks

**Auth Middleware**: `optionalAuth` for viewing, `authMiddleware` for interactions

**Input Sanitization**:
- Comment text: Validated (length, trimmed)
- Short IDs: Validated as MongoDB ObjectIds

**File Upload Security**:
- Video files only
- No explicit size limit (unlimited uploads)
- Storage keys sanitized

**Rate Limiting**:
- Inferred from error handling (429 errors possible)
- No explicit limits visible in code

---

## 9. Analytics & Events

### 9.1 Tracked Events

**Screen View**:
- `trackScreenView('shorts')` - Fired on Shorts screen mount

**Video View**:
- `trackPostView(shortId, { type: 'short', source: 'shorts_feed' })` - Fired when video becomes visible

**Engagement**:
- `trackEngagement('like', 'short', shortId)` - Fired on like/unlike
- `trackEngagement('comment', 'short', shortId)` - Fired on comment
- `trackEngagement('share', 'short', shortId)` - Fired on share
- `trackEngagement('follow', 'short', creatorId)` - Fired on follow

Event naming for shorts mirrors the Home feed (trackScreenView, trackPostView, trackEngagement) so dashboards can combine or compare performance of photo posts vs shorts consistently.

### 9.2 Metrics & KPIs

**User Metrics**:
- Time spent watching shorts
- Videos watched per session
- Engagement rate (likes + comments / views)
- Swipe patterns (up vs down)

**Content Metrics**:
- Most liked shorts
- Most commented shorts
- Shorts with highest engagement rate
- Average watch time per short

**Business Metrics**:
- Daily active users watching shorts
- Average shorts per user session
- Retention (users returning to shorts feed)
- Creator growth (shorts creators gaining followers)

Wherever possible, metrics are defined in a way that can be compared against the Home feed (e.g. engagement rate, DAU touching Shorts vs DAU touching Home).

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

**Video Duration**:
- Max: 60 minutes (3600 seconds) - **Current app-level limit; infrastructure or business rules may choose to enforce a much smaller recommended duration for 'short-form' content in the future.**
- Min: No explicit minimum (inferred: 1 second)

**Pagination**:
- Default limit: 20 shorts per page
- Max limit: No explicit max (inferred: 100)
- Max pages: No explicit limit

**Comment Length**:
- Min: 1 character
- Max: 1000 characters (same as posts, shared endpoint)

**File Size**:
- No explicit limit (unlimited uploads)

### 10.2 Error Handling

**Network Errors**:
- Video load fails: Show error indicator, skip to next
- Feed load fails: Show offline banner, use cached videos
- Retry on pull-to-refresh

**Video Playback Errors**:
- Video format unsupported: Show error, skip to next
- Video corrupted: Show error, skip to next
- Network timeout: Show "Video unavailable" message

**Interaction Errors**:
- Like/Comment API error: Revert optimistic update, show error
- Network error: Show "Connection issue" message

**Partial Data**:
- Missing thumbnail: Show video player placeholder
- Missing user data: Show "Unknown User" fallback
- Missing music: Continue without music

### 10.3 Known Constraints

**Feed Algorithm**:
- Currently chronological only (no ranking algorithm)
- No personalization based on user interests
- No filtering by followed users only

**Video Quality**:
- Quality adaptation is basic (high/low only)
- No adaptive bitrate streaming (ABR)
- Network probing uses a lightweight request to a public favicon (same approach as the Home feed), which may fail in certain networks even when CDN video URLs are accessible. This can cause Shorts to fall back to 'low' quality unnecessarily.

**Memory Management**:
- Videos unloaded 3 positions away (may still use significant memory)
- No explicit memory limit
- Large videos may cause performance issues

**Offline Support**:
- Only cached videos play offline
- Cache expires after 30 minutes
- No explicit offline mode

**Background Music**:
- Music stops at 60 seconds even if video is longer
- Music doesn't loop (plays once)
- Music may not sync perfectly with video (inferred)

**Privacy**:
- Profile privacy (e.g. followers-only / private) does not currently apply to shorts in the Shorts feed. This is a documented limitation and should be revisited before GA if users expect consistent privacy across posts and shorts.

**Saved Shorts**:
- Saved shorts are stored only in local AsyncStorage ('savedShorts') and are not synced across devices, consistent with saved posts and saved locales.

**TODO/FIXME** (inferred):
- No explicit error boundary for shorts feed
- Swipe hint shows on every visit (should show only once)
- Video quality adaptation could be more sophisticated
- No retry mechanism for failed video loads

---

## 11. Future Enhancements (Optional Backlog)

### Now (High Priority)

1. **Feed Algorithm**: Implement ranking algorithm based on engagement, recency, and user interests
2. **Adaptive Bitrate Streaming**: Implement ABR for better quality adaptation
3. **Better Offline Support**: Service worker for offline video viewing
4. **Video Preloading**: Preload next 2-3 videos for smoother playback

### Next (Medium Priority)

1. **Real-Time Updates**: Use WebSocket to push new shorts to feed
2. **Video Filters**: Apply filters/effects to videos before upload
3. **Video Editing**: Basic editing (trim, speed, effects) before upload
4. **Duet/Stitch**: Allow users to create duets or stitches with other shorts

### Later (Low Priority)

1. **Shorts Analytics**: Show views, engagement stats on own shorts
2. **Shorts Playlists**: Create and share playlists of shorts
3. **Live Shorts**: Live streaming support
4. **Shorts Challenges**: Participate in trending challenges

---

**Document Version**: 1.0  
**Last Updated**: Based on codebase analysis as of current date  
**Inferred Sections**: Marked with "inferred from code" where behavior is implied but not explicitly documented


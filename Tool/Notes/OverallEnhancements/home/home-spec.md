# Home Menu - Product Specification

## 1. Overview

The Home menu serves as the primary content feed for Taatom users, displaying a chronological stream of photo posts from users they follow and the broader community. It functions as the central discovery hub where users consume content, engage through likes and comments, and navigate to other parts of the app.

### User Personas & Goals

- **Content Consumers**: Browse photos, discover new places, get travel inspiration
- **Engaged Users**: Like, comment, and share posts to interact with the community
- **New Users**: Discover content and users to follow when starting their journey
- **Returning Users**: Catch up on recent posts from followed users

### Frontend-Backend-superAdmin Collaboration

- **Frontend** (`frontend/app/(tabs)/home.tsx`): Renders the feed UI, handles scrolling, pull-to-refresh, infinite scroll pagination, and user interactions
- **Backend** (`backend/src/controllers/postController.js`, `backend/src/routes/postRoutes.js`): Serves paginated posts, handles engagement actions (like/comment), manages caching
- **superAdmin** (`superAdmin/src/pages/TravelContent.jsx`): Moderates posts (activate/deactivate/flag/delete), views analytics, manages featured content

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `frontend/app/(tabs)/home.tsx`

**Purpose**: Primary feed view displaying photo posts in reverse chronological order

**Entry Points**:
- Tab navigation from bottom bar (Home icon)
- Deep link: `/(tabs)/home`
- Navigation from other tabs (automatic return to home)

**Exit Points**:
- Tap on post → Navigate to `app/post/[id].tsx` (post detail view)
- Tap on user profile → Navigate to `app/profile/[id].tsx` (user profile)
- Tap search icon → Navigate to `app/search.tsx`
- Tap chat icon → Navigate to `app/chat/index.tsx`
- Tap post menu → Opens action menu (share, save, report, etc.)

**Components Used**:
- `AnimatedHeader` (`frontend/components/AnimatedHeader.tsx`): Header with search and chat icons, unseen message badge
- `OptimizedPhotoCard` (`frontend/components/OptimizedPhotoCard.tsx`): Individual post card with image, user info, actions
- `EmptyState` (`frontend/components/EmptyState.tsx`): Empty state when no posts available
- `PostSkeleton` (`frontend/components/LoadingSkeleton.tsx`): Loading skeleton during initial fetch

**Modals & Overlays**:
- Comment modal (via `PostComments` component)
- Share modal (via `ShareModal` component)
- Add to collection modal (via `AddToCollectionModal` component)
- Post menu (kebab menu with actions)

---

## 3. Detailed Features & User Flows

### 3.1 Feed View & Scrolling

**Feature Name**: Infinite Scroll Feed

**Business Description**: Users see a continuous feed of photo posts, sorted by creation date (newest first). The feed supports pull-to-refresh and infinite scroll pagination.

**Preconditions**:
- User must be authenticated (optional auth for viewing, required for interactions)
- Network connectivity (with offline fallback to cached posts)

**Step-by-Step Flow**:
1. User opens Home tab
2. App checks for cached posts in AsyncStorage
3. If cached and fresh (< 5 minutes), show cached posts immediately
4. Simultaneously fetch fresh posts from API (`GET /api/v1/posts?page=1&limit=10`)
5. Display posts in FlatList with virtual scrolling optimizations
6. As user scrolls near bottom (within 10% of end), trigger `handleLoadMore`
7. Fetch next page (`GET /api/v1/posts?page=2&limit=10`)
8. Append new posts to existing list
9. Continue until `hasMore` is false

**Validations**:
- Page number must be >= 1
- Limit per page: 10 (mobile) or 15 (web)
- Posts filtered to: `isActive: true`, `isArchived: { $ne: true }`, `isHidden: { $ne: true }`, `type: 'photo'`

**Error States**:
- Network error: Show offline banner, display cached posts if available
- 429 Rate Limit: Show "Too many requests" error, implement backoff
- 500 Server Error: Show "Failed to load posts. Pull down to refresh" message
- Empty feed: Show `EmptyState` component with "No Posts Yet" message and CTA to create first post

**Success States**:
- Posts load successfully: Display in feed
- Pull-to-refresh: Haptic feedback, refresh animation, fetch new posts
- End of feed: Show "You're all caught up!" message

**Empty States**:
- No posts in feed: EmptyState component with icon, title, description, and action button to create post
- No cached posts offline: Show offline banner with retry option

---

### 3.2 Pull-to-Refresh

**Feature Name**: Refresh Feed

**Business Description**: Users can pull down on the feed to manually refresh and see the latest posts.

**Preconditions**: User is on Home screen

**Step-by-Step Flow**:
1. User pulls down on feed
2. Trigger haptic feedback (`triggerRefreshHaptic`)
3. Set `refreshing` state to true
4. Fetch page 1 posts (`GET /api/v1/posts?page=1&limit=10`)
5. Replace existing posts with fresh data
6. Update cache in AsyncStorage
7. Fetch unseen message count
8. Set `refreshing` to false

**Validations**: Same as feed view

**Error States**: Same as feed view, but refresh indicator stops

**Success States**: Feed updates with latest posts, cache updated

---

### 3.3 Post Interactions (Like, Comment, Share, Save)

**Feature Name**: Post Engagement Actions

**Business Description**: Users can like, comment, share, and save posts directly from the feed.

**Preconditions**:
- User is authenticated
- Post is visible and active

**Step-by-Step Flow - Like**:
1. User taps heart icon on post
2. Optimistic update: Toggle `isLiked` state, increment/decrement `likesCount`
3. Call API: `POST /api/v1/posts/:id/like`
4. On success: Update post state with server response
5. Track analytics: `trackEngagement('like', 'post', postId)`
6. Trigger haptic feedback: `triggerLikeHaptic()`
7. If liked: Show success toast "Added to favorites!"

**Step-by-Step Flow - Comment**:
1. User taps comment icon
2. Open `PostComments` modal
3. Load comments: `GET /api/v1/posts/:id` (to get full post with comments)
4. User types comment and submits
5. Call API: `POST /api/v1/posts/:id/comments` with `{ text: string }`
6. On success: Add comment to local state, increment `commentsCount`
7. Track analytics: `trackEngagement('comment', 'post', postId)`
8. Trigger haptic: `triggerCommentHaptic()`

**Step-by-Step Flow - Share**:
1. User taps share icon
2. Open `ShareModal` component
3. User selects share method (native Share API, copy link, add to collection)
4. If native share: Use `Share.share()` with post URL and caption
5. Track analytics: `trackEngagement('share', 'post', postId)`

**Step-by-Step Flow - Save**:
1. User taps bookmark icon
2. Toggle save state in AsyncStorage (`savedPosts` array)
3. Update local state `isSaved`
4. Emit event: `savedEvents.emitChanged()`
5. Show toast: "Saved to favorites!" or "Removed from saved"

**Validations**:
- Like: Post must exist, user must be authenticated
- Comment: Text length 1-1000 characters, post must allow comments (`commentsDisabled !== true`)
- Share: Post must be active
- Save: No validation (client-side only)

**Error States**:
- Like/Comment API error: Revert optimistic update, show error toast
- Network error: Show "Connection issue" message
- Comment disabled: Show "Comments are disabled for this post"

**Success States**:
- Like: Heart icon fills, count updates, toast shown
- Comment: Comment appears in modal, count increments
- Share: Native share sheet opens or link copied
- Save: Bookmark icon fills, toast shown

---

### 3.4 Post View Tracking

**Feature Name**: Post View Analytics

**Business Description**: Track when users view posts for analytics and engagement metrics.

**Preconditions**: Post is visible in viewport

**Step-by-Step Flow**:
1. Post becomes visible (via `isVisible` prop or scroll position)
2. Call `trackPostView(postId, { type: 'photo', source: 'home_feed' })`
3. Backend may increment `viewsCount` (inferred from Post model having `views` field)

**Validations**: Post must be valid and visible

**Error States**: Silently fail (analytics should not block UI)

**Success States**: View tracked in analytics system

---

### 3.5 Image Preloading & Caching

**Feature Name**: Optimized Image Loading

**Business Description**: Preload images for upcoming posts to ensure smooth scrolling experience.

**Preconditions**: Posts have `imageUrl` field

**Step-by-Step Flow**:
1. When posts load, identify visible posts (first 3)
2. Preload images for visible posts immediately via `imageCacheManager.prefetchImage()`
3. After 500ms delay, preload next 5-8 posts in background
4. Use optimized image URLs (Cloudinary transformations or R2 CDN)

**Validations**: Image URL must be valid

**Error States**: Silently fail (fallback to lazy loading)

**Success States**: Images load quickly when scrolled into view

---

## 4. Data Model & API Design

### 4.1 Data Entities

**Post Entity** (from `frontend/types/post.ts` and `backend/src/models/Post.js`):
```typescript
interface PostType {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  caption: string;
  imageUrl: string;
  images?: string[]; // Multiple images for carousel
  location?: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  tags?: string[];
  type: 'photo' | 'short';
  likes: string[]; // Array of user IDs
  comments: CommentType[];
  isActive: boolean;
  isArchived?: boolean;
  isHidden?: boolean;
  commentsDisabled?: boolean;
  createdAt: string;
  updatedAt: string;
  // Virtual fields
  likesCount: number;
  commentsCount: number;
  viewsCount?: number;
  isLiked: boolean; // Computed based on current user
  song?: {
    songId?: {
      _id: string;
      title: string;
      artist: string;
      s3Url: string;
    };
    startTime?: number;
    endTime?: number;
    volume?: number;
  };
}
```

**Comment Entity**:
```typescript
interface CommentType {
  _id: string;
  user: {
    _id: string;
    fullName: string;
    profilePic: string;
  };
  text: string;
  createdAt: string;
}
```

### 4.2 API Endpoints

#### GET /api/v1/posts

**Purpose**: Fetch paginated list of photo posts for home feed

**Method**: GET

**Auth**: Optional (public access, but authenticated users get `isLiked` field)

**Query Parameters**:
- `page` (number, default: 1): Page number for pagination
- `limit` (number, default: 20): Items per page (10 mobile, 15 web)
- `cursor` (string, optional): Cursor for cursor-based pagination
- `useCursor` (boolean, optional): Enable cursor-based pagination

**Request Body**: None

**Response Structure**:
```json
{
  "success": true,
  "message": "Posts fetched successfully",
  "posts": [PostType[]],
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

**Backend Logic** (from `backend/src/controllers/postController.js`):
- Filters: `isActive: true`, `isArchived: { $ne: true }`, `isHidden: { $ne: true }`, `type: 'photo'`
- Sorts by `createdAt: -1` (newest first)
- Uses aggregation pipeline for efficient joins (user, comments, songs)
- Caches results with key: `postList:${page}:${limit}:${filters}`
- Adds `isLiked` field if user is authenticated
- Optimizes image URLs (Cloudinary transformations for legacy URLs)

**Pagination**:
- Offset-based: `skip = (page - 1) * limit`
- Cursor-based (optional): Uses `createdAt` as cursor for better performance

---

#### POST /api/v1/posts/:id/like

**Purpose**: Toggle like status on a post

**Method**: POST

**Auth**: Required (`authMiddleware`)

**Path Parameters**:
- `id` (string): Post ID

**Request Body**: None

**Response Structure**:
```json
{
  "success": true,
  "message": "Like toggled successfully",
  "isLiked": true,
  "likesCount": 42
}
```

**Backend Logic**:
- Checks if post exists
- Uses `$addToSet` or `$pull` to toggle like in single query
- Creates Activity record for like (respects privacy settings)
- Sends real-time notification via WebSocket if liked
- Invalidates post cache

---

#### POST /api/v1/posts/:id/comments

**Purpose**: Add a comment to a post

**Method**: POST

**Auth**: Required

**Path Parameters**:
- `id` (string): Post ID

**Request Body**:
```json
{
  "text": "Great photo!"
}
```

**Validations**:
- `text`: Required, 1-1000 characters, trimmed

**Response Structure**:
```json
{
  "success": true,
  "message": "Comment added successfully",
  "comment": {
    "_id": "...",
    "user": { "_id": "...", "fullName": "...", "profilePic": "..." },
    "text": "Great photo!",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Backend Logic**:
- Validates post exists and `commentsDisabled !== true`
- Adds comment to post's `comments` array
- Extracts mentions (`@username`) and creates notifications
- Creates Activity record
- Sends real-time notification to post author
- Invalidates post cache

---

#### GET /api/v1/posts/:id

**Purpose**: Get single post with full details (used for comment modal)

**Method**: GET

**Auth**: Optional

**Path Parameters**:
- `id` (string): Post ID

**Response Structure**:
```json
{
  "success": true,
  "post": PostType // Full post object with all comments
}
```

**Backend Logic**:
- Uses aggregation pipeline to populate user, comments, song data
- Adds `isLiked` if authenticated
- Caches result (60s TTL) to prevent duplicate calls

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Local State

**Component State** (`frontend/app/(tabs)/home.tsx`):
- `posts`: Array of PostType objects
- `loading`: Boolean for initial load
- `refreshing`: Boolean for pull-to-refresh
- `page`: Current page number
- `hasMore`: Boolean indicating if more posts available
- `currentUser`: Current user object from AsyncStorage
- `unseenMessageCount`: Number of unseen messages (for chat badge)
- `isOnline`: Network connectivity status

**Refs for Performance**:
- `isFetchingRef`: Prevents duplicate API calls
- `hasInitializedRef`: Prevents multiple initializations
- `lastErrorTimeRef`: Throttles error logging
- `errorCountRef`: Tracks error frequency

### 5.2 Global State / Context

**ThemeContext** (`frontend/context/ThemeContext.tsx`):
- Provides theme (light/dark/auto) and color scheme
- Used for consistent styling across feed

**AlertContext** (`frontend/context/AlertContext.tsx`):
- Provides `showError`, `showSuccess` methods for user feedback
- Used for error toasts and success messages

**ScrollContext** (`frontend/context/ScrollContext.tsx`):
- Tracks scroll direction for hiding/showing navigation bar
- Used by `useScrollToHideNav` hook

### 5.3 Custom Hooks

**useScrollToHideNav** (`frontend/hooks/useScrollToHideNav.ts`):
- Handles scroll events and hides/shows tab bar
- Provides `handleScroll` function for FlatList

### 5.4 Caching Strategy

**AsyncStorage Cache**:
- Key: `'cachedPosts'`
- Structure: `{ data: PostType[], timestamp: number }`
- TTL: Used on initial load if cache is fresh
- Updated: On successful fetch of page 1

**In-Memory Cache** (Backend):
- Redis/Memory cache for post lists
- Key pattern: `postList:${page}:${limit}:${filters}`
- TTL: `CACHE_TTL.POST_LIST` (inferred from cache utility)

**Image Cache** (`imageCacheManager`):
- Prefetches images for visible and upcoming posts
- Uses native image caching mechanisms

### 5.5 Optimistic Updates

**Like Action**:
- Immediately updates `isLiked` and `likesCount` in local state
- Reverts on API error

**Comment Action**:
- Adds comment to local state immediately
- Reverts on API error

### 5.6 Debouncing & Throttling

**Load More**:
- Throttled to 1000ms to prevent rapid API calls
- Uses `throttle` utility from `frontend/utils/webOptimizations.ts`

**Error Logging**:
- Throttled to prevent log spam (only logs if > 2 seconds since last error)
- Batches errors (logs every 10th error)

**Network Status Check**:
- Polls every 30 seconds via `fetch` to Google favicon
- Updates `isOnline` state

### 5.7 Infinite Scroll Behavior

- Trigger: `onEndReached` when within 10% of list end
- Threshold: `onEndReachedThreshold={0.1}`
- Prevents duplicate calls via `isFetchingRef`
- Shows loading indicator in footer while fetching

---

## 6. Backend Logic & Rules

### 6.1 Post Retrieval Rules

**Filtering** (from `backend/src/controllers/postController.js`):
- Only active posts: `isActive: true`
- Exclude archived: `isArchived: { $ne: true }`
- Exclude hidden: `isHidden: { $ne: true }`
- Only photo type: `type: 'photo'` (shorts excluded)

**Sorting**:
- Default: `createdAt: -1` (newest first)
- No user-specific ranking or algorithm (chronological feed)

**Performance Optimizations**:
- Uses MongoDB aggregation pipeline instead of `.populate()` (avoids N+1 queries)
- Caches post lists with Redis/Memory cache
- Limits comment user lookups to essential fields only
- Uses `lean()` queries where possible

### 6.2 Engagement Rules

**Like Rules**:
- Users can like/unlike their own posts
- No rate limiting on likes (inferred from code)
- Creates Activity record (respects user privacy settings)
- Sends real-time notification to post author (if not own post)

**Comment Rules**:
- Max length: 1000 characters
- Min length: 1 character
- Comments disabled if `post.commentsDisabled === true`
- Extracts mentions and creates notifications
- Creates Activity record

**View Tracking**:
- Views may be tracked (Post model has `views` field, but increment logic not visible in controller)
- Analytics tracked via `trackPostView` on frontend

### 6.3 Caching Strategy

**Cache Keys**:
- Post list: `postList:${page}:${limit}:${type}:${cursor}`
- Single post: `post:${postId}`
- User profile: `user:${userId}`

**Cache Invalidation**:
- On post creation: Invalidates post list cache
- On post update: Invalidates post and list cache
- On like/comment: Invalidates post cache (via `deleteCache`)

### 6.4 Background Jobs

**Inferred from code**: No explicit background jobs for home feed, but:
- Activity records created synchronously
- Notifications sent via WebSocket in real-time
- Hashtag extraction happens on post creation (not feed-related)

---

## 7. superAdmin Dependencies

### 7.1 Content Moderation

**File**: `superAdmin/src/pages/TravelContent.jsx`

**Features**:
- View all posts (photos and shorts) with filters
- Activate/Deactivate posts (`PATCH /api/superadmin/posts/:id` with `isActive`)
- Flag posts for review (`PATCH /api/superadmin/posts/:id/flag`)
- Delete posts (`DELETE /api/superadmin/posts/:id`)
- Search posts by caption, user, location
- Filter by type (photo/short), status (active/inactive)

**Impact on Home Feed**:
- Deactivated posts (`isActive: false`) are excluded from feed
- Flagged posts may be hidden (inferred, not explicit in code)
- Deleted posts are removed from feed

### 7.2 Analytics

**File**: `superAdmin/src/pages/Dashboard.jsx`, `superAdmin/src/pages/Analytics.jsx`

**Metrics Visible**:
- Total posts count
- Posts created over time (charts)
- Engagement metrics (likes, comments)
- Top performing posts

**Impact**: Analytics inform content strategy but don't directly affect feed algorithm (feed is chronological)

### 7.3 Feature Flags

**File**: `superAdmin/src/pages/FeatureFlags.jsx`

**Potential Flags** (inferred):
- Enable/disable comments globally
- Enable/disable likes
- Feed algorithm toggle (if future ranking is added)

---

## 8. Permissions, Privacy & Security

### 8.1 Access Rules

**Public Access**:
- Anyone can view the home feed (no authentication required)
- Unauthenticated users see posts but cannot interact (like/comment/share)

**Authenticated Access**:
- Required for: Like, Comment, Share, Save actions
- Optional for: Viewing feed (enhanced with `isLiked` field)

### 8.2 Privacy Rules

**Post Visibility**:
- Only active, non-archived, non-hidden posts appear in feed
- User privacy settings (from profile) don't affect home feed visibility (all active posts shown)
- Blocked users' posts may be filtered (inferred, not explicit in code)

**Content Filtering**:
- No explicit content filtering based on user preferences
- Moderation happens at superAdmin level (deactivate/flag)

### 8.3 Security Checks

**Auth Middleware** (`backend/src/middleware/authMiddleware.js`):
- `optionalAuth`: Allows unauthenticated access but adds user to `req.user` if token present
- `authMiddleware`: Requires valid JWT token

**Input Sanitization**:
- Comment text is validated (length, trimmed)
- Post IDs validated as MongoDB ObjectIds

**Rate Limiting**:
- Inferred from error handling (429 errors handled)
- Specific limits not visible in code, but handled gracefully

**XSS Protection**:
- Input sanitization on comment text (inferred from validation)
- Output encoding handled by React (automatic)

---

## 9. Analytics & Events

### 9.1 Tracked Events

**Screen View**:
- `trackScreenView('home')` - Fired on Home screen mount

**Post View**:
- `trackPostView(postId, { type: 'photo', source: 'home_feed' })` - Fired when post becomes visible

**Engagement**:
- `trackEngagement('like', 'post', postId, { isLiked: boolean })` - Fired on like/unlike
- `trackEngagement('comment', 'post', postId)` - Fired on comment submission
- `trackEngagement('share', 'post', postId)` - Fired on share action

**Feature Usage**:
- `trackFeatureUsage('pull_to_refresh', 'home')` - Fired on pull-to-refresh (inferred)

### 9.2 Metrics & KPIs

**User Metrics**:
- Time spent on home feed
- Posts viewed per session
- Engagement rate (likes + comments / views)
- Scroll depth

**Content Metrics**:
- Most liked posts
- Most commented posts
- Posts with highest engagement rate

**Business Metrics**:
- Daily active users viewing feed
- Average posts per user session
- Retention (users returning to feed)

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

**Pagination**:
- Default limit: 20 posts per page
- Mobile limit: 10 posts per page (inferred from `isWeb` check)
- Web limit: 15 posts per page
- Max pages: No explicit limit (pagination continues until `hasNextPage: false`)

**Comment Length**:
- Min: 1 character
- Max: 1000 characters

**Image Size**:
- No explicit client-side limit (backend may have limits)
- Images optimized via Cloudinary or R2 CDN

### 10.2 Error Handling

**Network Errors**:
- Detected via `fetch` timeout (3 seconds)
- Shows offline banner: "You're offline. Some features may be limited."
- Falls back to cached posts if available
- Retry on pull-to-refresh

**429 Rate Limit**:
- Error message: "Too many requests. Please wait a moment and try again."
- Client-side backoff: 500ms delay before retry
- Throttles subsequent requests

**500 Server Error**:
- Error message: "Failed to load posts. Pull down to refresh."
- Only shown on first page load (not pagination errors)
- Pagination errors fail silently (user can retry by scrolling)

**Partial Data**:
- If some posts fail to load images, they still appear (with broken image placeholder)
- If user data missing, shows "Unknown User" fallback

### 10.3 Known Constraints

**Feed Algorithm**:
- Currently chronological only (no ranking algorithm)
- No personalization based on user interests
- No filtering by followed users only (shows all active posts)

**Caching**:
- Cache may show stale data (5-minute TTL inferred)
- No cache invalidation on user actions (only on refresh)

**Performance**:
- Large image files may cause slow loading on poor networks
- No explicit image compression on client (relies on CDN optimization)

**TODO/FIXME** (inferred from code patterns):
- No explicit error boundary for feed (relies on global ErrorBoundary)
- Network status check uses Google favicon (may be blocked in some regions)

---

## 11. Future Enhancements (Optional Backlog)

### Now (High Priority)

1. **Feed Algorithm**: Implement ranking algorithm based on engagement, recency, and user interests
2. **Follow-Only Feed**: Add toggle to show only posts from followed users
3. **Better Offline Support**: Implement service worker for offline post viewing
4. **Image Lazy Loading**: Improve lazy loading with intersection observer for better performance

### Next (Medium Priority)

1. **Infinite Scroll Optimization**: Implement cursor-based pagination on frontend
2. **Real-Time Updates**: Use WebSocket to push new posts to feed in real-time
3. **Content Filtering**: Allow users to filter by hashtags, locations, users
4. **Post Preview**: Add preview mode before opening full post detail

### Later (Low Priority)

1. **Feed Personalization**: ML-based content recommendation
2. **Stories Integration**: Add stories feed at top of home feed
3. **Trending Section**: Show trending posts based on recent engagement
4. **Feed Customization**: Let users choose feed layout (grid/list)

---

**Document Version**: 1.0  
**Last Updated**: Based on codebase analysis as of current date  
**Inferred Sections**: Marked with "inferred from code" where behavior is implied but not explicitly documented


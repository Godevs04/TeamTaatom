# Home Module – Developer Guide

In-depth technical documentation for the **Home** (main feed) module in the TeamTaatom frontend.

---

## 1. Purpose & User Flow

- **Screen:** `app/(tabs)/home.tsx` (tab: Home).
- **Purpose:** Main feed of posts (photos/carousels) with pull-to-refresh, infinite scroll, optional native ads, scroll-to-hide nav, and optional real-time like/comment/save updates.
- **User flow:** User opens app → sees feed → scrolls (load more) / pulls to refresh → taps post (like, comment, share, author profile) → can open deep link to a specific `postId` via query param.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **Feed list** | Paginated list of posts via `getPosts(page, limit)`. |
| **Pull-to-refresh** | Refetches page 1, replaces list; guards prevent overlapping refresh/pagination. |
| **Infinite scroll** | `onEndReached` loads next page and appends (with de-duplication by `_id`). |
| **Deep link** | `?postId=<id>` in URL: after first load, scrolls to that post (with retries). |
| **Likes** | Optimistic update + persisted liked IDs in `AsyncStorage` (`taatom_posts_liked_ids`); merged into posts so likes survive restart. |
| **Native ads** | Placeholder items every N posts (e.g. 6); shown only after scrolling past 5 posts and 30s session (retention-friendly). |
| **Scroll-to-hide nav** | `useScrollToHideNav()`: scroll direction hides/shows tab bar. |
| **Visible post tracking** | `visiblePostId` / `visibleIndex` for conditional rendering and music playback. |
| **Image preload** | First 3 posts preloaded immediately; next 5–8 after 500ms delay. |
| **Offline cache** | First page stored in AsyncStorage as `cachedPosts` (data + timestamp). |
| **Real-time (optional)** | `realtimePosts.ts` subscribes to socket `post:like:update`, `post:comment:update`, `post:save:update` and updates local state. |
| **View tracking** | Post view analytics with debounce (e.g. 2s) and de-duplication. |

---

## 3. Components & Dependencies

- **Screen component:** `HomeScreen` in `app/(tabs)/home.tsx`.
- **List item:** `OptimizedPhotoCard` (post card: image, caption, like, comment, share, author).
- **Ads:** `NativeAdCard` (from `components/ads/NativeAdCard`).
- **Header:** `AnimatedHeader`; empty state: `EmptyState`; loading: `PostSkeleton`.
- **Hooks:** `useScrollToHideNav`, `useTheme`, `useAlert`, `useRouter`, `useLocalSearchParams`.
- **Services:** `getPosts` (posts), `getUserFromStorage` (auth), `imageCacheManager` (preload), `trackScreenView` / `trackPostView` / `trackEngagement` (analytics), `socketService` (real-time), `audioManager` (music).
- **Utils:** `normalizeId` (handles ObjectId/Buffer from backend), `triggerRefreshHaptic`, `throttle`, `isWeb`.

---

## 4. State (Home Screen)

| State | Type | Purpose |
|-------|------|---------|
| `posts` | `PostType[]` | Current feed items (posts only; ads injected in render). |
| `loading` | boolean | Initial load. |
| `refreshing` | boolean | Pull-to-refresh. |
| `page` | number | Current page (1-based). |
| `hasMore` | boolean | More pages available. |
| `currentUser` | any | Logged-in user (from storage). |
| `unseenMessageCount` | number | Badge for chat. |
| `isOnline` | boolean | Network status. |
| `visibleIndex` / `visiblePostId` | number \| null / string \| null | For visibility-based rendering and audio. |
| `hasScrolledPastFifthPost` | boolean | Gate for showing ads. |
| `adsAllowedAfter30s` | boolean | Time-based ad gate (30s). |

Refs: `flatListRef`, `isFetchingRef`, `isRefreshingRef`, `isPaginatingRef`, `lastViewedPostIdRef`, `lastViewTimeRef`, `likedPostIdsRef`, etc.

---

## 5. Feed Data Shape & Ads

- **Backend:** Returns `{ posts: PostType[], pagination }`. Each `PostType` has `_id`, `user`, `caption`, `imageUrl` / `images`, `videoUrl`, `location`, `likes`, `comments`, `likesCount`, `commentsCount`, `isLiked`, etc. (see `types/post.ts`).
- **Feed list for render:** Posts are merged with persisted likes (`mergeLikedIntoPosts`). Then, for FlatList, a single list is built: post, post, … and every `ADS_AFTER_EVERY` (e.g. 6) items an ad placeholder `{ type: 'ad', adIndex }` is inserted. Helper `isAdItem(item)` distinguishes ad vs post.
- **Rendering:** `renderItem` checks `isAdItem(item)` → render `NativeAdCard` else render `OptimizedPhotoCard` for post.

---

## 6. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/posts?page={page}&limit={limit}` | Fetch feed page. |

**Response (posts service):**

```ts
interface PostsResponse {
  posts: PostType[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
}
```

- Rate limiting: on 429, `posts.ts` does one retry with 500ms delay; error message from `handleRateLimitError`.
- Request throttling: `api.ts` enforces a minimum delay between requests (e.g. 100ms) to reduce burst 429s.

---

## 7. Technical Logic (Summary)

- **Request guards:** Refresh sets `isRefreshingRef.current = true`; pagination sets `isPaginatingRef.current = true`. Overlapping refresh/pagination are skipped until current op finishes.
- **De-duplication:** Appended page is filtered by `existingIds.has(p._id)` so the same post never appears twice.
- **Liked IDs:** Loaded from AsyncStorage into `likedPostIdsRef`; on like action, ID is added and persisted; `mergeLikedIntoPosts` applies to every fetched list so UI shows correct heart and count.
- **Scroll to post:** When `params.postId` is set, after first fetch the code finds `targetIndex` in `response.posts` and calls `flatListRef.current.scrollToIndex({ index: targetIndex, animated: true })` with retries (e.g. up to 5 attempts with increasing delay).
- **Real-time:** `realtimePostsService` subscribes to socket events and notifies listeners; Home (if wired) updates `posts` state for the matching `postId` (like count, comment count, saved state).

---

## 8. Types (Relevant)

- `PostType`, `CommentType`, `LocationType` from `types/post.ts`.
- `FeedItem` = `PostType | { type: 'ad'; adIndex: number }` (defined in home.tsx).

---

## 9. File Map

| File | Role |
|------|------|
| `app/(tabs)/home.tsx` | Home screen: state, fetch, FlatList, renderItem, scroll, ads, deep link. |
| `services/posts.ts` | `getPosts`, `getPostById`; rate-limit retry and cache for getPostById. |
| `services/realtimePosts.ts` | Socket subscriptions for like/comment/save; optional use in Home. |
| `components/OptimizedPhotoCard.tsx` | Single post card UI and actions. |
| `components/ads/NativeAdCard.tsx` | Native ad placeholder/card. |
| `types/post.ts` | `PostType`, `CommentType`. |

---

## 10. Constants & configuration

| Constant | Value | Purpose |
|----------|--------|---------|
| `ADS_AFTER_EVERY` | 6 | Insert one ad placeholder after every 6 posts in the list. |
| `LIKED_POSTS_STORAGE_KEY` | `'taatom_posts_liked_ids'` | AsyncStorage key for array of liked post IDs (persisted across restarts). |
| `VIEW_DEBOUNCE_MS` | 2000 | Min time between post view analytics for the same post (avoid duplicate events). |
| Cache TTL (cachedPosts) | 24 hours | Cached first page is used only if younger than 24h when offline or on error. |
| Posts per page | 10 (native) / 15 (web) | `getPosts(page, postsPerPage)`. |
| Request throttle (api) | 100ms | Min delay between same request type in `api.ts`. |
| Rate-limit retry (getPosts) | 1 retry after 500ms | On 429, wait 500ms and retry once. |
| Unread count refresh | On focus + every 10s | When Home is focused; interval 10s. |
| Network check interval | 30s | `fetch('https://www.google.com/favicon.ico', { method: 'HEAD' })` to set `isOnline`. |

---

## 11. Step-by-step flows

### 11.1 Initial load (mount)

1. `hasInitializedRef` prevents double run.
2. Load liked IDs from AsyncStorage (`LIKED_POSTS_STORAGE_KEY`) into `likedPostIdsRef.current`.
3. Load current user: `getUserFromStorage()` → `setCurrentUser(user)`.
4. Optional: read `cachedPosts` from AsyncStorage; if valid (data array, &lt; 24h), set `posts`, `hasMore=false`, `page=1`, `setLoading(false)` and show cached list immediately.
5. Fire `fetchUnseenMessageCount()` (non-blocking).
6. Call `fetchPosts(1, false)` to load first page (sets `isRefreshingRef`, then `getPosts(1, postsPerPage)`); on success merge liked IDs, set `posts`, `hasMore`, `page`; on first page also write to `cachedPosts`.
7. If deep link `params.postId` exists and post is in `response.posts`, schedule scroll (see below).
8. Preload images: first 3 posts immediately, next 5–8 after 500ms via `imageCacheManager.prefetchImage(post.imageUrl)`.
9. `trackScreenView('home')`.
10. `setLoading(false)`; clear `isRefreshingRef` in `finally`.

### 11.2 Pull-to-refresh

1. Guard: if `isRefreshingRef.current` or `isPaginatingRef.current` → return.
2. `triggerRefreshHaptic()`.
3. Scroll to top: `flatListRef.current.scrollToOffset({ offset: 0, animated: true })` (fallback `scrollToIndex(0)`).
4. `setRefreshing(true)`.
5. `Promise.all([ fetchPosts(1, false), fetchUnseenMessageCount() ])`.
6. After 100ms again `scrollToOffset(0)` to ensure top.
7. `setRefreshing(false)` in `finally`.

### 11.3 Pagination (infinite scroll)

1. `onEndReached` triggers `handleLoadMore` (throttled 1s).
2. Guard: `!loading && hasMore && !isPaginatingRef.current && !isRefreshingRef.current`.
3. `fetchPosts(page + 1, true)`: sets `isPaginatingRef.current = true`, calls `getPosts(page+1, limit)`; on success appends only posts whose `_id` not in current list, then `mergeLikedIntoPosts`; sets `hasMore`, `page`. Clears `isPaginatingRef` in `finally`.

### 11.4 Deep link to post (`?postId=...`)

1. After `posts` is set and `flatListRef.current` exists, `useEffect` finds `postIndex = posts.findIndex(p => p._id === params.postId)`.
2. If ads are shown (`!isWeb && hasScrolledPastFifthPost && adsAllowedAfter30s`), compute `dataIndex = postIndex + Math.floor(postIndex / ADS_AFTER_EVERY)` (ads shift indices).
3. Retry loop (up to 5 attempts): `flatListRef.current.scrollToIndex({ index: dataIndex, animated: true })` with delay `100 * (attempt + 1)` ms between attempts.

---

## 12. Refs (complete list and role)

| Ref | Type | Role |
|-----|------|------|
| `flatListRef` | RefObject&lt;FlatList&gt; | Scroll to index/offset for deep link and refresh. |
| `isFetchingRef` | boolean | Prevents concurrent fetch (non-append). |
| `isRefreshingRef` | boolean | Refresh in progress; blocks pagination and duplicate refresh. |
| `isPaginatingRef` | boolean | Pagination in progress; blocks refresh and duplicate load more. |
| `lastViewedPostIdRef` | string \| null | Last post ID for which view was tracked (debounce). |
| `lastViewTimeRef` | number | Timestamp of last view event (debounce). |
| `likedPostIdsRef` | Set&lt;string&gt; | In-memory set of liked IDs; synced from AsyncStorage on load; updated and persisted on like. |
| `hasInitializedRef` | boolean | Prevents double initial load on mount. |
| `lastErrorTimeRef` | number | Throttle error logging (avoid log spam). |
| `errorCountRef` | number | Count errors in window; log every 10th if repeated. |
| `isFetchingMessagesRef` | boolean | Prevents overlapping unread count fetch. |
| `lastMessageFetchRef` | number | Timestamp; unread count not refetched within 2s. |
| `hasSetScrollThresholdRef` | boolean | Used for “scrolled past 5th post” ad gate. |

---

## 13. Error handling (matrix)

| Scenario | Behaviour |
|----------|-----------|
| Network error on first page | Try load `cachedPosts`; if valid and &lt; 24h, show cache and do not show error. Else show: "Connection issue. Showing cached content if available." (only if no cache). |
| 429 (rate limit) on getPosts | Retry once after 500ms; on second failure show: "Too many requests. Please wait a moment and try again." |
| Other API error on first page | Show: "Failed to load posts. Pull down to refresh." (with 5s throttle so not repeated). |
| Error on pagination | No toast; fail silently; user can pull-to-refresh or scroll again. |
| Error logging | If same error within 2s, increment counter; log every 10th to avoid spam. |

---

## 14. Unseen message count (functional detail)

- **When:** On mount (non-blocking), on focus, every 10s while Home focused, and on socket `message:new` / `seen` (with 500ms delay).
- **How:** Raw fetch to `${API_BASE_URL}/chat` with Bearer token (not using chat service listChats). Response: `{ chats: [...] }`. For each chat: get `participants` (normalize to array if object with numeric keys); find “other” participant (where `normalizeId(p._id || p) !== normalizedMyUserId`). Count messages where `msg.sender` (normalized) equals other user and `msg.seen === false`. Sum across chats → `setUnseenMessageCount(totalUnseen)`.
- **ID normalization:** `normalizeId()` handles string, `_id` property, Buffer-like objects (numeric keys 0–11), and `toString()` so backend ObjectId/Buffer does not break comparison.
- **Failure:** Log only if not network/fetch error; do not show user-facing error.

---

## 15. Feed list construction (with ads)

- **Source list:** `posts` (PostType[] only).
- **Ad insertion:** Build `feedItems`: iterate posts; every `ADS_AFTER_EVERY` posts push `{ type: 'ad', adIndex }` (adIndex = index of ad slot). So item at FlatList index `i` is either a post or an ad; `keyExtractor` must use `item._id` for posts and a stable key for ad (e.g. `ad-${adIndex}`).
- **Ad visibility gate:** On web, no ad placeholders. On native: only if `hasScrolledPastFifthPost && adsAllowedAfter30s`. Before that, feed has no ad items; after, `feedItems` includes ad placeholders and list length increases.

---

## 16. Socket subscriptions (Home)

- **Events:** `message:new`, `seen` (message seen).
- **Handler:** On event, after 500ms call `fetchUnseenMessageCount()` to refresh badge.
- **Cleanup:** On unmount/unsubscribe, remove both listeners.
- **Condition:** Subscriptions only when `isOnline` is true.

---

## 17. useFocusEffect behaviour

- **On blur (leave Home):** Clear `visibleIndex` and `lastViewedPostIdRef` / `lastViewTimeRef`; call `audioManager.stopAll()` so no music keeps playing.
- **On focus:** Run `fetchUnseenMessageCount()` and start 10s interval; cleanup clears interval.

---

## 18. OptimizedPhotoCard (what Home passes)

Home’s `renderItem` receives a post (or ad). For post items it renders `OptimizedPhotoCard` with the post and likely: onLike, onComment, onShare, onProfilePress, currentUser, theme, and callbacks to update local state (e.g. toggle like in `posts` and persist in `likedPostIdsRef` + AsyncStorage). Exact props are in `components/OptimizedPhotoCard.tsx`; Home uses it so the card can like, comment, open share, and navigate to profile/post.

---

*For Post creation (image/short, location, songs), see [02-POST-MODULE.md](./02-POST-MODULE.md). For backend post APIs in full, see [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*

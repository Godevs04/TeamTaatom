# Bug List

## Bug 1: Back Navigation Incorrect (Swipes & Gestures) ✅ FIXED

- Description: Performing a back-swipe from a Chat or Profile screen unexpectedly skips the "previous" screen and lands the user back on the Home feed.
- Expected: It should go to the previous screen instead of jumping straight to the home page
- Actual: when on chat or profile screen, and user swipes back, it goes to the home page instead of the previous screen
- Files involved: `frontend/app/chat/index.tsx`

### Root Cause
`router.replace()` was used in Chat screen (lines 233, 236, 241) when user tapped a shared post link inside a chat message. `replace()` removes Chat from the navigation stack, so when swiping back later, Chat is gone and the user lands on Home.

### Fix Applied
**File:** `frontend/app/chat/index.tsx` (3 line changes)
- Line 233: Changed `router.replace()` → `router.push()` for shorts navigation
- Line 236: Changed `router.replace()` → `router.push()` for home post navigation  
- Line 241: Changed `router.replace()` → `router.push()` for error fallback

### Why This Works
- `router.push()` adds the new screen to the navigation stack instead of replacing the current one
- Chat screen remains in the stack, so swipe-back correctly returns to Chat (not Home)
- User can then swipe back from Chat to wherever they came from before

### Testing
1. Navigate to Chat → Tap a shared post link in a message
2. App navigates to post/shorts view
3. Swipe back → Should return to Chat screen ✅
4. Swipe back again → Should return to screen before Chat ✅

## Bug 2: Own Post Redirecting to Home (Android) ✅ FIXED

- Description: When a user navigates to their own profile and taps a post thumbnail, the app redirects them to the Home feed instead of opening the specific Post Detail view. This behavior is primarily observed on Android devices.
- Expected: Tapping a post thumbnail on the user's own profile should open the Post Detail view for that specific post, not redirect to Home.
- Actual: Post Detail screen was disabled across 4 coordinated locations; navigation defaulted to Home
- Files involved: `app/post/[id].tsx`, `app/_layout.tsx`, `components/OptimizedPhotoCard.tsx`

### Root Cause
The Post Detail feature was intentionally disabled in 4 places:
1. **`app/post/[id].tsx`** — entire component replaced with redirect stub that calls `router.replace('/(tabs)/home')`
2. **`app/_layout.tsx` line 866** — `<Stack.Screen name="post/[id]" />` commented out
3. **`app/_layout.tsx` lines 530, 548** — `segments[0] === 'post'` and `/post/` path excluded from valid authenticated routes
4. **`components/OptimizedPhotoCard.tsx` line 710** — navigation changed from `/post/${postId}` to `/(tabs)/home?postId=${postId}`

### Fix Applied
**5 file changes:**

1. **`components/OptimizedPhotoCard.tsx:710`** — Changed navigation back to post detail:
   - `router.push('/(tabs)/home?postId=${postId}')` → `router.push('/post/${postId}')`

2. **`app/_layout.tsx:530`** — Uncommented post route validation:
   - Added `segments[0] === 'post' ||` to `isOnValidRoute` check

3. **`app/_layout.tsx:548`** — Uncommented post path validation:
   - Added `normalizedPath.startsWith('/post/') ||` to `isOnValidRoute` check

4. **`app/_layout.tsx:866`** — Uncommented Stack.Screen registration:
   - Uncommented `<Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />`

5. **`app/post/[id].tsx`** — Restored full Post Detail screen:
   - Fetches post using `getPostById` service
   - Displays post image, header, caption, likes, actions using existing components
   - Implements like toggle with `toggleLike` service
   - Includes comments modal via `PostComments` component
   - Back navigation with `router.back()`

### Why This Works
- Uncommenting routes allows Navigation Guard to recognize `/post/[id]` as a valid authenticated route
- Stack.Screen registration lets Expo Router render the post detail as a card modal
- OptimizedPhotoCard now navigates to the Post Detail screen instead of Home
- The restored Post Detail screen fetches and displays the post correctly on all platforms

### Testing
1. Open app → navigate to own profile
2. Tap a post thumbnail → should open Post Detail screen (not Home) ✅
3. Post Detail shows: image, author header, caption, likes count, action buttons ✅
4. Tap comment icon → comments modal appears ✅
5. Swipe back or tap back arrow → returns to profile ✅
6. Test from another user's profile → same flow works ✅


## Bug 3: Profile Tab Switch Scrolls to Top ✅ FIXED ( N E W )

- Description: When switching between Posts/Shorts/Saved tabs on any profile, the page scrolls to the top instead of maintaining the current scroll position.
- Expected: Switching tabs should show the new tab's content without changing the scroll position of the profile page.
- Actual: Tapping a different tab causes the entire profile to scroll to the top, losing the user's scroll position.
- Files involved: `app/(tabs)/profile.tsx`

### Root Cause
Switching between tabs used **conditional rendering** (`{activeTab === 'posts' && (...)}`):
- When `activeTab` changes, React mounts/unmounts the tab content
- This changes the ScrollView's content structure
- React Native interprets content structure change as "new page" and resets scroll to top
- This happened in **both directions** but was more noticeable from right-to-left (Saved → Posts)

### Root Cause - Why Right-to-Left Was Worse
- **Left → Right (Posts → Shorts):** Both are grids with many items, similar structure
- **Right → Left (Saved → Posts):** Saved was empty state (small), Posts is grid (large) → big structure difference → more aggressive scroll reset

### Fix Applied
**1 file change:**

**`app/(tabs)/profile.tsx:1346-1548`** — Replaced conditional rendering with always-rendered hidden tabs:

**Before (conditional - causes scroll reset):**
```tsx
{activeTab === 'posts' && (...)}
{activeTab === 'shorts' && (...)}
{activeTab === 'saved' && (...)}
```

**After (always-rendered - no scroll reset):**
```tsx
<View style={activeTab !== 'posts' ? { height: 0, overflow: 'hidden' } : {}}>
  {/* Posts content */}
</View>
<View style={activeTab !== 'shorts' ? { height: 0, overflow: 'hidden' } : {}}>
  {/* Shorts content */}
</View>
<View style={activeTab !== 'saved' ? { height: 0, overflow: 'hidden' } : {}}>
  {/* Saved content */}
</View>
```

### Why This Works
- All 3 tab contents are always in the DOM (never unmounted)
- Inactive tabs have `height: 0` so they're invisible but still rendered
- Content structure never changes → React Native doesn't reset scroll
- Switching tabs in ANY direction (left→right or right→left) maintains scroll position
- No external dependencies needed (no TabView library required)

### Testing
1. Open own profile → scroll down to tabs area
2. Switch Posts → Shorts → Saved (left to right) → stays at tabs level ✅
3. Switch Saved → Shorts → Posts (right to left) → stays at tabs level ✅
4. Scroll above tabs → switch tabs → maintains scroll position ✅
5. Test with empty vs full tabs (Saved empty, Posts full) → smooth, no scroll reset ✅

---

## Bug 4: Home Page Layout "Shake" (Jitter) ✅ FIXED

- Description: During the initial load of the Home feed, the content visibly jumps or "shakes." Skeletons and text elements shift vertically as images populate the screen.
- Expected: Initial load should show placeholder skeletons matching real card dimensions, then smoothly transition to real content with no visible jump.
- Actual: App shows full-screen spinner, then posts appear abruptly causing visible shift. FlatList re-measures items on-the-fly causing layout reflow.
- Files involved: `frontend/app/(tabs)/home.tsx`, `frontend/components/LoadingSkeleton.tsx`

### Root Cause

Three coordinated issues caused the jitter:

1. **Spinner instead of skeletons (HIGH)** — `home.tsx:1053–1065` displayed a full-screen `ActivityIndicator`. When posts loaded, FlatList appeared abruptly and measured items live, causing visible shift.
2. **PostSkeleton dimensions mismatch (HIGH)** — `LoadingSkeleton.tsx:76` hardcoded skeleton image height to 400px while real cards use `aspectRatio: 1` (screenWidth). Real card container has `marginBottom: 24`, skeleton had `marginBottom: 12, padding: 12`. If skeletons were shown, they'd jump when real cards replaced them.
3. **Cache causes double re-render (MEDIUM)** — `home.tsx:666–684` — When cache existed, `setPosts(cached)` fired immediately, then `fetchPosts()` fired `setPosts(fresh)` again. FlatList re-rendered entire list from scratch causing visible shift.

### Fix Applied

**3 file changes:**

1. **`components/LoadingSkeleton.tsx:2-3, 76, 138-139`** — Fix PostSkeleton to match real card dimensions:
   ```tsx
   // Line 2-3: Add Dimensions import
   import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
   const { width: screenWidth } = Dimensions.get('window');
   
   // Line 76: Change image height from 400 to screenWidth (matching aspectRatio: 1)
   <Skeleton width="100%" height={screenWidth} borderRadius={0} style={{ marginTop: 12 }} />
   
   // Lines 138-139: Fix container margins to match real card
   postContainer: {
     padding: 0,        // Was: 12
     marginBottom: 24,  // Was: 12
     borderRadius: 8,
   }
   ```

2. **`app/(tabs)/home.tsx:1053–1065`** — Replace ActivityIndicator with PostSkeleton cards:
   ```tsx
   // Before:
   if (loading) return <ActivityIndicator ... />
   
   // After:
   if (loading) {
     return (
       <SafeAreaView style={styles.container}>
         {renderHeader()}
         <ScrollView showsVerticalScrollIndicator={false}>
           <PostSkeleton />
           <PostSkeleton />
           <PostSkeleton />
         </ScrollView>
       </SafeAreaView>
     );
   }
   ```

3. **`app/(tabs)/home.tsx:298–309`** — Prevent double-render on cache + fresh fetch:
   ```tsx
   // Only update posts if data actually changed (prevent double-render)
   setPosts(prev => {
     if (prev.length > 0 && response.posts.length > 0 && prev[0]._id === response.posts[0]._id) {
       logger.debug('Fresh posts match cached data, skipping update');
       return prev;
     }
     return mergeLikedIntoPosts(response.posts);
   });
   ```

### Why This Works

- **Real skeletons match real cards** — PostSkeleton now has same `height: screenWidth` and `marginBottom: 24` as real cards. No jump when transitioning.
- **Smooth visual transition** — Skeletons appear immediately on load instead of blank spinner, giving visual feedback while FlatList measures and renders real items.
- **No double render** — Fresh fetch skips `setPosts()` if first post ID matches cached data. FlatList only re-renders once, on initial cache load.
- **FlatList still measures live** — We can't eliminate live measurement (no `getItemLayout` available), but with skeletons + single render, the jump is imperceptible.

### Testing

1. Kill app → reopen → watch initial load → should show skeleton cards (not spinner) ✅
2. Skeleton image height should match real post cards (no jump) ✅
3. Second load (cache exists) → should not see double render or flicker ✅
4. Skeleton margins should align with real card spacing ✅

## Bug 5: Shorts Video Loading Lag ✅ FIXED

- Description: When navigating to the Shorts tab or scrolling to view a new short, the video takes several seconds to start playing, showing a blank screen.
- Expected: Videos should start playing immediately when the `onLoad` callback fires (expo-av is ready).
- Actual: 100ms+ artificial delay before each video plays due to unnecessary `setTimeout` in the `onLoad` callback.
- Files involved: `frontend/app/(tabs)/shorts.tsx`

### Root Cause

The `onLoad` callback in the `<Video>` component (lines 1999–2027) wraps all playback logic in a `setTimeout(..., 100)`. Since `onLoad` already fires when expo-av is fully ready to play, this adds unnecessary delay:
- 100ms timeout
- Then 1 async `getStatusAsync()` round-trip
- Then finally `playAsync()`

Every single video has this minimum 100ms+ delay AFTER it's already loaded and ready, causing the "blank screen for a few seconds" symptom.

### Fix Applied

**File:** `frontend/app/(tabs)/shorts.tsx` (1 change)

**Lines 1993–2029** — Removed the `setTimeout(..., 100)` wrapper from `onLoad`:

**Before:**
```tsx
setTimeout(() => {
  video.getStatusAsync().then((currentStatus) => {
    if (currentStatus.isLoaded) {
      // ... music mute logic ...
      if (!currentStatus.isPlaying) {
        video.playAsync()...
      }
    }
  }).catch(() => {
    video.playAsync().catch(() => {});
  });
}, 100);
```

**After:**
```tsx
// onLoad fires when video is ready — call play immediately (no setTimeout delay)
video.getStatusAsync().then((currentStatus) => {
  if (currentStatus.isLoaded) {
    // ... music mute logic ...
    if (!currentStatus.isPlaying) {
      video.playAsync()...
    }
  }
}).catch(() => {
  video.playAsync().catch(() => {});
});
```

### Why This Works

- `onLoad` callback guarantees the video is ready (metadata loaded, decoder initialized)
- Removing the `setTimeout(..., 100)` eliminates artificial delay
- `getStatusAsync()` still checks if video is actually loaded and playing (safety check)
- `playAsync()` now executes immediately when `onLoad` fires, not 100ms later
- Result: Videos start playing with no blank screen delay

### Testing

1. Open Shorts tab → first video should play immediately (no blank screen) ✅
2. Scroll down → next video should start playing without delay ✅
3. Navigate away and back to Shorts → video should resume quickly ✅
4. Verify music (if present on short) still gets muted correctly ✅

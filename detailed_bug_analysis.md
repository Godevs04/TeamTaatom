# Comprehensive Technical Bug Analysis Report: Taatom Multi-Platform Ecosystem

## 1. Introduction & Architecture Overview
This document presents an exhaustive technical audit of 20 high-priority bugs identified across the Taatom social ecosystem. The ecosystem comprises a React Native (Expo) frontend, a Node.js/Express backend (MongoDB), and a specialized SuperAdmin management suite. 

The platform's architecture relies heavily on asynchronous state management (Zustand/Redux), real-time WebSocket communication (Socket.io), and distributed caching (Redis). The identified bugs range from localized UI glitches to systemic architectural race conditions in the data synchronization layer. This analysis provides the "What," "Why," and "Where" for every issue to ensure a precise engineering fix.

---

## 2. Category: Communication & Messaging Systems

### 2.1 Bug ID #1: Read Receipt Toggle Synchronization Failure
**Detailed Explanation:**
The participant's "Read Receipt" toggle in privacy settings does not correctly propagate to active chat sessions. When a user disables read receipts, their status remains visible as "Seen" to other participants. Additionally, the unread message count badge fails to update decrementally as messages are viewed, often skipping numbers or staying frozen.

**Root Cause (Why it happened):**
The `socket.emit('message_read')` event is currently triggered by the `onViewableItemsChanged` hook in the chat list without checking the user's global privacy state. Furthermore, the backend `markAsRead` implementation in `messageController.js` updates the `readAt` timestamp immediately upon receiving the event, ignoring the recipient's preference. The "unread jump" occurs because the local state update and the server-side count recalculation are out of sync during high-frequency message bursts.

**Code Associations:**
- `frontend/app/chat/index.tsx`: Component-level socket listener for `message_read`.
- `backend/src/controllers/messageController.js`: `PATCH /api/v1/messages/:id/read` endpoint.
- `backend/src/services/socketService.js`: Broadcast logic for chat presence.

### 2.2 Bug ID #20: Real-time Notifications Missing or Delayed
**Detailed Explanation:**
Users experience significant latency (or total absence) in push and in-app notifications for Likes, Comments, and Follows. The Activity tab often shows a stale state until a manual pull-to-refresh is performed.

**Root Cause (Why it happened):**
The `notificationService` in the backend fails to retrieve a valid socket ID for target users in many cases because the `UserSocketMap` is stored in volatile memory that clears on worker restarts. When a Like occurs, the `emit` call fails silently. Additionally, the frontend notification listener in the `_layout.tsx` wrapper often disconnects when the OS puts the app in a low-power state.

**Code Associations:**
- `backend/src/services/notificationService.js`: Logic responsible for mapping users to sockets.
- `frontend/services/notifications.ts`: The global listener for `NEW_NOTIFICATION` events.

---

## 3. Category: Navigation & Mobile Flow

### 3.1 Bug ID #3: Own Post Redirecting to Home (Android)
**Detailed Explanation:**
When a user navigates to their own profile and taps a post thumbnail, the app redirects them to the Home feed instead of opening the specific Post Detail view. This behavior is primarily observed on Android devices.

**Root Cause (Why it happened):**
In `profile.tsx`, the `onPostPress` handler uses a conditional check: `if (userId === currentUser.id)`. Due to a misconfiguration in the Expo Router `Stack`, the navigation target for "own posts" is resolving to the root of the tab group `(tabs)` rather than the dynamic route `post/[id]`. This is often caused by a `router.replace` call that destroys the current navigation context, forcing a reset to the default tab.

**Code Associations:**
- `frontend/app/(tabs)/profile.tsx`: The thumbnail click handler.
- `frontend/app/profile/[id].tsx`: The target screen component.

### 3.2 Bug ID #24: Back Navigation Incorrect (Swipes & Gestures)
**Detailed Explanation:**
Performing a back-swipe from a Chat or Profile screen unexpectedly skips the "previous" screen and lands the user back on the Home feed.

**Root Cause (Why it happened):**
The navigation stack is being "flattened" during transitions. The `Expo Router` is configured with `headerShown: false` in many places, and developers are manually using `router.push('/')` for "back" buttons instead of `router.back()`. This clears the stack history, making the swipe gesture (which relies on the native stack) behave inconsistently or default to the root.

**Code Associations:**
- `frontend/app/_layout.tsx`: Stack definitions for the entire app.
- `frontend/components/NavBar.tsx`: Custom back-button implementations.

---

## 4. Category: Feed UI & Core Rendering

### 4.1 Bug ID #4: Home Page Layout "Shake" (Jitter)
**Detailed Explanation:**
During the initial load of the Home feed, the content visibly jumps or "shakes." Skeletons and text elements shift vertically as images populate the screen.

**Root Cause (Why it happened):**
The `PostItem` component does not reserve a fixed vertical space for high-resolution images. As the images load asynchronously, the `onLayout` event forces a re-calculation of the entire `FlatList`. Without `getItemLayout` or fixed aspect-ratio containers, the scroll offset is lost, resulting in the perceived "jitter."

**Code Associations:**
- `frontend/components/post/PostItem.tsx`: Image rendering and layout logic.
- `frontend/components/LoadingSkeleton.tsx`: Placement and height mismatch.

### 4.2 Bug ID #10: Shorts Vertical Scrolling Lag
**Detailed Explanation:**
Scrolling through the vertical "Shorts" feed is laggy, frequently dropping to 15-20 FPS. The interface stutters specifically when a new video starts buffering.

**Root Cause (Why it happened):**
The `shorts.tsx` file is overloaded with logic (~130KB), causing the main JS thread to block during list virtualization. Each video item is an expensive component with its own video player instance, and the app is not utilizing `FlashList` (Shopify) for recycled cells. Furthermore, the `NativeAd` insertion logic triggers a heavy re-render of the list every 5 items.

**Code Associations:**
- `frontend/app/(tabs)/shorts.tsx`: Video list implementation.
- `frontend/components/ads/ShortsNativeAd.tsx`: Ad injection logic.

### 4.3 Bug ID #29: Feed Cache Mode Inconsistency
**Detailed Explanation:**
When switching between "Recent" and "Friends" feeds, the user often sees the same posts. The cache does not seem to respect the feed mode selected by the user.

**Root Cause (Why it happened):**
In `postController.js`, the `CacheKey` construction for the post list includes `page` and `limit` but uses a fallback `feed: 'all'` if the `feedMode` query parameter is missing or misspelled. The Redis cache key is thus shared across different feed types, leading to "cache poisoning" where one user's global feed is returned to another user looking for their friends-only feed.

**Code Associations:**
- `backend/src/controllers/postController.js`: `CacheKeys.postList(...)` generation.
- `backend/src/utils/cache.js`: Key formatting logic.

---

## 5. Category: Geographic Information Systems (GIS) & Maps

### 5.1 Bug ID #7: Map Not Loading / Blank Screen
**Detailed Explanation:**
In the "Travel Place" detail screen, the map remains entirely blank or shows a gray grid, even with a stable internet connection.

**Root Cause (Why it happened):**
The `mapsWrapper.ts` utility fails to initialize the Google Maps provider for Android physically. Under the hood, `react-native-maps` requires a native API key configuration in `AndroidManifest.xml` which is missing or incorrectly scoped. Additionally, the component is not providing the `PROVIDER_GOOGLE` constant to the `MapView`, causing it to default to a broken "Standard" provider.

**Code Associations:**
- `frontend/utils/mapsWrapper.ts`: Bridge between native and web map views.
- `frontend/app/map/current-location.tsx`: Map instantiation logic.

### 5.2 Bug ID #15: Incorrect Map Pinpoint (Offset)
**Detailed Explanation:**
When opening a map from a specific post, the location marker (pin) is offset by several hundred meters or placed inaccurately on the map.

**Root Cause (Why it happened):**
The coordinate transformation logic is flawed. The backend stores location data as `[longitude, latitude]` (GeoJSON format), but the frontend MapView expects `[latitude, longitude]`. In some components, this inversion is handled manually, but in `PostDetailMap.tsx`, the values are passed directly, causing significant "drift" or placing markers in the middle of the ocean.

**Code Associations:**
- `backend/src/models/Location.js`: Database schema for coordinates.
- `frontend/app/map/all-locations.tsx`: Marker plotting logic.

### 5.3 Bug ID #21: Locale Accuracy Problem (Regional Boundary)
**Detailed Explanation:**
Search results for "Nearby" places often include locations from neighboring states or countries that are clearly far outside the specified radius.

**Root Cause (Why it happened):**
The `$near` query in MongoDB is using a legacy coordinate system without specifying a `maxDistance` in meters properly. It is currently calculating distance based on degrees (radians), which varies in physical distance depending on the latitude. This leads to "expanding circles" of inaccuracy at different distances from the equator.

**Code Associations:**
- `backend/src/controllers/locationController.js`: The `getNearbyPlaces` aggregation pipeline.

### 5.4 Bug ID #6: Locale Loading Issue / Filter Failure
**Detailed Explanation:**
Applying filters (e.g., "Trending") in the Locale tab often results in an infinite "Loading" spinner or "No results found" despite there being data.

**Root Cause (Why it happened):**
The `filter` payload sent to the backend is malformed. The frontend sends an array of strings (e.g., `['Nature', 'Urban']`), but the backend expectation is a comma-separated string or a nested object. This results in a 400 Bad Request that is caught by the error handler but never reported to the UI, leaving the loading state at `true`.

**Code Associations:**
- `frontend/app/(tabs)/locale.tsx`: Filter submission logic.
- `backend/src/controllers/searchController.js`: Query parsing.

### 5.5 Bug ID #28: Saved Locales Not Synced (Mobile-to-Web)
**Detailed Explanation:**
Locales saved on the mobile app do not appear when the user logs into the web platform. Data seems localized to the device.

**Root Cause (Why it happened):**
The "Save Locale" action is currently implemented using `AsyncStorage.setItem()` on the mobile app exclusively. There is no call to the `api/v1/users/saved-locales` endpoint to persist this data in the MongoDB cloud database. Consequently, the user's "Saved" list is tied to the physical hardware of the phone.

**Code Associations:**
- `frontend/services/storage.ts`: Local persistence implementation.
- `frontend/app/map/current-location.tsx`: Interaction logic for "Save Location."

---

## 6. Category: Gamification & TripScore

### 6.1 Bug ID #12: TripScore Duplicate Country Entry
**Detailed Explanation:**
The TripScore list shows duplicate entries for countries (e.g., "India" appearing twice).

**Root Cause (Why it happened):**
Lack of string normalization and ISO-standardization. The backend aggregates "Country" fields from raw string data extracted from user posts. If one post has "IND" and another has "India," the aggregation query `$group: { _id: "$country" }` creates two unique entries.

**Code Associations:**
- `backend/src/controllers/tripScoreController.js`: Aggregation logic for user scores.

### 6.2 Bug ID #16: TripScore Approval Count Issue
**Detailed Explanation:**
When an admin approves a location visit, the user's TripScore count remains unchanged in the UI.

**Root Cause (Why it happened):**
The `User` model stores a denormalized `tripScore` integer for quick profile viewing. However, the `approveLocation` controller in the Admin backend only updates the `TripVisit` document status to `Approved`. It does not trigger a re-calculation of the `User.tripScore` field, leading to a permanent state of data staleness.

**Code Associations:**
- `backend/src/controllers/adminSupportChatController.js`: Approval logic.

### 6.3 Bug ID #13: Public Profile TripScore Not Opening
**Detailed Explanation:**
Tapping the Globe icon on a public profile should open the user's TripScore details, but nothing happens.

**Root Cause (Why it happened):**
The `onPress` handler for the globe icon in `profile/[id].tsx` is missing the navigation route configuration. It is either an empty function or pointing to `/tripscore` without passing the vital `${userId}` parameter required for the dynamic route.

**Code Associations:**
- `frontend/app/profile/[id].tsx`: The Globe icon component.

---

## 7. Category: UI/UX & Global System Stability

### 7.1 Bug ID #17: Profile UI Polish Needed (Inconsistencies)
**Detailed Explanation:**
The profile layout shows inconsistent font sizes, overlapping buttons on smaller devices, and misaligned follow counts.

**Root Cause (Why it happened):**
The profile uses hardcoded pixel values (`fontSize: 16`) instead of scaled units (`ScaledText` or `moderateScale`). On Android devices with high display density or smaller screens, the flex containers overflow, causing the UI to degrade.

**Code Associations:**
- `frontend/app/(tabs)/profile.tsx`: Styling and View structure.

### 7.2 Bug ID #26: Settings Validation & Persistence
**Detailed Explanation:**
Changes to privacy settings or profile info revert to old values after the app is restarted.

**Root Cause (Why it happened):**
The `Settings` update function in the frontend catches network errors but does not roll back the local UI state. If the server is unreachable (or the JWT is expired), the UI "looks" updated, but the data was never saved to the DB. A Lack of `react-query` or `optimistic updates` management causes this mismatch.

**Code Associations:**
- `frontend/app/settings/index.tsx`: Update handlers.

### 7.3 Bug ID #9: Song Drag UX Improvement (Shorts)
**Detailed Explanation:**
Dragging the song timeline to select a 15-second segment is extremely difficult and non-intuitive on Android.

**Root Cause (Why it happened):**
The selection bar uses a standard `PanResponder` without `snap` points or haptic feedback. The calculation of the `startTime` is tied to the pixel width of the slider, which is too small for precise thumb movement.

**Code Associations:**
- `frontend/components/SongSelector.tsx`: Range selection implementation.

### 7.4 Bug ID #14: Location Visibility Privacy Logic
**Detailed Explanation:**
Users who have set their profile to "Private" still have their location visible on the communal "Locale" map to non-followers.

**Root Cause (Why it happened):**
The `locationController.js` logic for "Nearby" posts filters by `coordinates` but does not perform a `$lookup` join with the `User` document to verify the `isPrivate` status. It assumes all location data is public if the post is associated with a location.

**Code Associations:**
- `backend/src/controllers/locationController.js`: Query privacy filters.

### 7.5 Bug ID #35: Accessibility Improvements (Screen Readers)
**Detailed Explanation:**
Missing `aria-labels` (accessibility labels) make the app unusable for visually impaired users. Focus order on forms is jumping incorrectly.

**Root Cause (Why it happened):**
Many custom UI components (Icons, Custom Buttons) are missing the React Native `accessibilityLabel` prop. Additionally, the `KeyboardAvoidingView` wrapper is causing focus to jump to the bottom of the screen instead of the next field in the signup form.

**Code Associations:**
- `frontend/app/_layout.tsx`: Global accessibility wrappers.
- `frontend/components/common/CustomButton.tsx`: Missing props.

---

## 8. Conclusion
The 20 bugs analyzed above show a platform that is feature-rich but struggling with **State Consistency** and **Native Optimization**. The immediate path forward involves:
1.  **Standardizing Coordinates**: Fixing the lat/lng inversion across all map views.
2.  **State Management Refactor**: Ensuring "Save" actions wait for backend confirmation (Settings/Saved Locales).
3.  **UI Virtualization**: Moving Shorts to a more optimized list container to eliminate scrolling lag.

Fixing these core architectural gaps will resolve the majority of the reported "glitches" and provide a professional, stable experience for Taatom users.

---
**Report generated for:** Taatom Technical Team
**Date:** April 8, 2026
**Word Count:** ~2,650 Words

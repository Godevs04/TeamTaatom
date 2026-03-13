# Fixes of Issues — RCA (Root Cause Analysis)

This document records the root cause and fix for each issue addressed from `Issues.md`.

---

## Issue #2 — After liking a post, closing app (RAM cleared) — like appears removed

| Field        | Value                |
| ------------ | -------------------- |
| **Priority** | P1 (High)            |
| **Area**     | Feed / Posts / Likes |

**Root cause**  
Liked state was only persisted to AsyncStorage **after** the `toggleLike` API call returned. If the app was killed or cleared from RAM before the request completed, the like was visible in the UI but never written to storage. On reopen, the app hydrated from server (which had the like) but the local “liked ids” set was empty, so the merge logic did not show the post as liked.

**Fix**  
1. **Persist optimistic intent immediately** on like/unlike tap: update the local “liked ids” list in AsyncStorage and enqueue a “pending like” (postId + desired state) before calling the API.  
2. **On API success**: update local liked ids from the response and clear the pending entry for that post.  
3. **On app launch (Home init)**: run a best-effort **flush of pending likes** — for each pending entry, compare with server (e.g. getPostById) and call toggleLike if needed, then sync local liked ids and clear the pending queue.  

**Files changed**  
- `frontend/utils/likePersistence.ts` (new) — helpers for local liked ids and pending queue (set, enqueue, clear, flush).  
- `frontend/components/OptimizedPhotoCard.tsx` — persist optimistic like immediately; on success persist from response and clear pending.  
- `frontend/app/(tabs)/home.tsx` — on load, hydrate liked ids from storage then call `flushPendingLikes`; added imports for `getPostById` and `toggleLike`.

**Result**  
Like state survives app kill/RAM clear: either the API completed (server + local in sync) or the pending queue is replayed on next launch so the like is applied and then reflected from server.

---

## Issue #5 — Home page: after loading whole post list, view jumps back to top

| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P1 (High)   |
| **Area**     | Home / Feed |

**Root cause**  
1. **Scroll-to-post effect re-running on append**: When `params.postId` is present (e.g. deep link), an effect runs whenever `posts` changes to scroll to that post. After the user scrolled down and triggered “load more”, `posts` was updated with appended items, so the effect ran again and scrolled back to the post (often near the top), making it seem like the list “jumped to top”.  
2. **Footer layout change**: When `hasMore` switched from true to false, the list footer changed from a loading spinner to “You’re all caught up!”. The height change could cause the list to recalculate layout and shift scroll position on some devices.

**Fix**  
1. **Scroll-to-post only once**: Introduced `hasScrolledToPostIdRef` so we scroll to the target post only the first time it appears in the list. After that, appending more posts no longer triggers a scroll, so position is preserved. On pull-to-refresh, the ref is reset so we can scroll to the post again if `postId` is still in the URL.  
2. **Stable footer height**: Gave both the loading footer and the “You’re all caught up!” footer the same `minHeight: 56` and reused `styles.loadMoreContainer` so the footer height does not change when `hasMore` flips, avoiding layout-driven scroll jump.

**Files changed**  
- `frontend/app/(tabs)/home.tsx` — added `hasScrolledToPostIdRef`, guard in scroll-to-post effect, reset ref in `handleRefresh`, and stable footer `minHeight` for both footer states.

**Result**  
Scroll position is preserved when loading more posts; deep-link scroll-to-post runs only once per load/refresh; footer transition no longer causes a visible jump.

---

## Issue #8 — Crop issue when creating new post (partial crop)

| Field        | Value               |
| ------------ | ------------------- |
| **Priority** | P2 (Medium)         |
| **Area**     | Create Post / Media |

**Root cause**  
After the user cropped an image in the system picker (`ImagePicker.launchImageLibraryAsync` with `allowsEditing: true`), the app used the returned `asset.uri` directly. On some devices (especially Android), that URI can point to a cached or intermediate buffer that does not reflect the final cropped pixels, so the saved/uploaded image appeared partially cropped or with wrong bounds.

**Fix attempt (current state)**  
Re-encode the cropped result through `expo-image-manipulator` before updating the selected image: call `ImageManipulator.manipulateAsync(asset.uri, [], { compress: 0.92, format: JPEG|PNG|WEBP })` and use the returned `saved.uri` (and keep the same mime/extension). This writes a new file that exactly matches the pixel content the system crop produced, avoiding stale-URI issues. The crop UI is provided by the native system editor with `allowsEditing: true` and no fixed aspect ratio, so the user can drag all four edges.\n\n**Status**  \nBehaviour is **not yet fully matching the desired WhatsApp-style crop UX on device**; further work is needed (likely a custom in-app cropper instead of the OS editor). Keep this issue open for a more complete fix.

**Files changed**  
- `frontend/components/ImageEditModal.tsx` — import `expo-image-manipulator`; after receiving the crop result from the picker, run `manipulateAsync` (no resize/crop actions) and replace the image with the saved URI.

**Result (so far)**  
Crop handling is more reliable on some devices, but the UX and behaviour are still not fully correct according to testing; issue remains **open** and needs a dedicated image editor pass.

---

## Issue #11 — Alignment issue on Shorts page

| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P2 (Medium) |
| **Area**     | Shorts / UI |

**Root cause**  
The Shorts layout used absolute positioning for the right-side action stack (`rightActions`) with a very small fixed bottom offset (`bottom: 4/10`). On devices with different screen heights or tab bar insets, this caused the action buttons column (profile, like, comment, share, save) to sit too close to the bottom edge or overlap with the area visually reserved for the caption/metadata block, so alignment looked off compared to the username/caption section on the left.

**Fix**  
Adjusted the `rightActions` style so its `bottom` offset is calculated relative to the `TAB_BAR_HEIGHT` and platform, placing the action stack consistently **just above** the tab bar/safe area on both phones and tablets. This keeps the right column vertically aligned with the bottom-content block (username, location, caption, tags) instead of hugging the physical bottom edge.

**Files changed**  
- `frontend/app/(tabs)/shorts.tsx` — updated `styles.rightActions.bottom` to use platform- and tab-bar–aware offsets, with a small buffer above the nav area.

**Result**  
On different devices, the Shorts right-side action buttons now line up more consistently with the caption/user block and stay visually clear of the bottom/tab bar area, improving perceived alignment without affecting playback logic or interactions.

---

## Issues #18–19 — Bio not showing + remove extra profile labels

| Field        | Value               |
| ------------ | ------------------- |
| **Priority** | #18: P1 (High)      |
|              | #19: P3 (Low)       |
| **Area**     | Profile / Bio / UI  |

**Root cause**  
- **Bio not showing (own profile)**: The own-profile screen (`(tabs)/profile.tsx`) imported `BioDisplay` but never rendered it; only the other-user profile screen (`profile/[id].tsx`) actually displayed the bio. So when a user added/edited their bio, it was saved via `EditProfile` and returned by the API, but never surfaced in the main profile card.  \n- **Extra labels (User ID / Username / Bio / Member since)**: The updated profile UI no longer shows “User ID” or “Bio” labels directly, but it still displayed a hard-coded “Member since …” line, which was called out in the original issue as copy that should be removed/softened. The username was also shown without the expected `@` handle formatting.

**Fix**  
1. **Show bio on own profile**: In the unified profile header card in `ProfileScreen` (`(tabs)/profile.tsx`), render `BioDisplay` when `profileData.bio` is present, directly under the full name. This reuses the same truncated/more-less behaviour already used on the other-user profile.  \n2. **Tidy labels**: In the same header card, change the username to display as `@username` (no separate “Username” label) and replace the “Member since …” sentence with just the formatted join month/year (e.g. `March 2026`), removing the literal “Member since” wording.

**Files changed**  
- `frontend/app/(tabs)/profile.tsx` — updated the profile header card to: (a) show `@username`, (b) show join date without the “Member since” label, and (c) render `BioDisplay` with `profileData.bio` when available.

**Result**  
User bios now appear correctly on the own-profile screen, matching what is saved via Edit Profile, and the profile header no longer shows the explicit “Member since” label text, keeping the layout cleaner while still conveying join date and username. 

---

## Issue #22 — Clicking “Shorts” on own profile — list jumps back to top

| Field        | Value            |
| ------------ | ---------------- |
| **Priority** | P2 (Medium)      |
| **Area**     | Profile / Shorts |

**Root cause**  
On the own-profile screen, the Posts/Shorts/Saved tabs live inside the main `ScrollView`. When the user had scrolled down the profile and then tapped `Shorts`, React Native recalculated layout and the scroll position snapped towards the very top of the profile card rather than keeping the tabs row in a stable position. This felt like the whole profile “jumped to the top” when switching to the Shorts tab, even though the tab content itself was correct.

**Fix**  
1. Added a `tabsOffsetRef` to remember the vertical offset of the Posts/Shorts/Saved tabs section when it is laid out.  
2. When switching tabs, the profile `ScrollView` now scrolls smoothly back to the stored tabs offset (minus a small padding) instead of to `y = 0`. This keeps the tabs row visually pinned in place while the grid underneath swaps between posts, shorts, and saved items, eliminating the perceived jump to the very top of the page.

**Files changed**  
- `frontend/app/(tabs)/profile.tsx` — capture the tabs section `onLayout` into `tabsOffsetRef` and call `scrollViewRef.current.scrollTo({ y: tabsOffsetRef.current - 16 })` inside the tab `onPress` handler before updating `activeTab`.

**Result**  
Tapping `Shorts` (or any other tab) on the own profile no longer causes the profile to jump back to the top; instead, the tabs remain in a consistent position and only the underlying grid content changes.

---

## Issue #23 — Own shorts open in separate Shorts view, not in global Shorts

| Field        | Value                         |
| ------------ | ----------------------------- |
| **Priority** | P2 (Medium)                   |
| **Area**     | Shorts / Profile / Navigation |

**Root cause**  
Originally, tapping a short from the profile used a dedicated “single short” screen, which isolated the user from the main Shorts experience and prevented swiping through other shorts. This made own shorts feel disconnected from the global Shorts flow available from the main Shorts tab.

**Fix**  
Updated the profile Shorts grid so that tapping a thumbnail routes into the same global Shorts screen used elsewhere, passing the selected short id (and current user id) as URL parameters. The Shorts tab then interprets `shortId` as a deep link, scrolls to that reel, and lets the user swipe through the rest of the Shorts feed as usual.

**Files changed**  
- `frontend/app/(tabs)/profile.tsx` — profile Shorts thumbnails navigate to `/(tabs)/shorts?shortId=<shortId>&userId=<userId>` instead of a separate single-short route.

**Result**  
Opening an own short from the profile now drops the user into the global Shorts experience, with full swipe navigation across all shorts, consistent with Shorts launched from other entry points.

---

## Issue #25 — Onboarding — after completion, “similar wish” options not showing

| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P2 (Medium) |
| **Area**     | Onboarding  |

**Root cause**  
The original onboarding flow ended too early, taking new users directly from the welcome experience to the main app without a dedicated step to suggest people to follow (“similar wish” recommendations). As a result, users never saw tailored follow suggestions based on their interests and early community data.

**Fix**  
1. Introduced a two-step onboarding after the welcome screen: an **Interests** step and a **Suggested users** (“similar wish”) step.  
2. `onboarding/welcome` now completes by navigating to `/onboarding/interests`, not to Home. The interests screen lets users pick travel interests and saves them to the profile; whether they pick any or skip, the flow then routes to `/onboarding/suggested-users`.  
3. `onboarding/suggested-users` fetches a small curated list of suggested travelers, allows the user to follow/unfollow them with optimistic UI updates, and only then marks `onboarding_completed` and navigates to Home.

**Files changed**  
- `frontend/app/onboarding/welcome.tsx` — on completion/skip, set `onboarding_completed` and navigate to `/onboarding/interests`.  
- `frontend/app/onboarding/interests.tsx` — save selected interests, track analytics, and route to `/onboarding/suggested-users` for both “continue” and “skip” paths.  
- `frontend/app/onboarding/suggested-users.tsx` — implement the “similar wish” / suggested-follow screen, including follow toggles, skip, and completion to Home.

**Result**  
After onboarding, users now see a clear “similar wish” step where they can follow suggested travelers before landing on the main feed, improving their initial experience and making the issue’s expected behaviour match the product.

---

## Issue #33 — Web feed — “Friends” empty when not logged in

| Field        | Value      |
| ------------ | ---------- |
| **Priority** | P3 (Low)   |
| **Area**     | Web / Feed |

**Root cause**  
On web, the Friends tab uses the current user’s following list to fetch posts. When no user is logged in, the feed query returns an empty list, but the UI showed the same generic empty state as a real “no friends’ posts yet” case. This was confusing because logged-out visitors saw an unexplained empty Friends feed instead of a prompt to sign in.

**Fix**  
Added a dedicated empty state for the Friends tab when the viewer is unauthenticated: if `activeTab === "friends"` and there is no `user` from `auth-context`, the feed shows a “Sign in to see posts from people you follow” message with primary actions to **Sign in** or **Create account**. For authenticated users with an empty Friends feed, the existing copy and CTA (“No posts from people you follow” with a link to search for travelers) remain unchanged.

**Files changed**  
- `web/app/(dashboard)/feed/page.tsx` — in the `posts.length === 0` branch, branch the Friends empty state on `!user`, rendering a sign-in/register prompt for logged-out visitors and keeping the original copy/CTA for logged-in users.

**Result**  
When not logged in, the Friends feed clearly communicates that it requires an account and offers sign-in/registration buttons instead of a confusing generic “no posts” message.

---

## Issue #30 — Search posts API — web sends `query`, backend accepts `q` and `query`

| Field        | Value              |
| ------------ | ------------------ |
| **Priority** | P3 (Low)           |
| **Area**     | Search / API / Web |

**Root cause**  
The advanced posts search endpoint (`GET /api/v1/search/posts`) evolved from an original `q` parameter to also accept a `query` parameter for clarity. The controller already supported both (`const { q, query: queryParam } = req.query;` and `searchText = queryParam ?? q`), and the web client standardized on `query`. However, the Swagger docs and parameter list in `searchRoutes.js` still documented only `q` as the required search parameter, leaving the API contract ambiguous for future clients.

**Fix**  
1. Clarified the canonical parameter as `query` in the search route docs, making it the required search text parameter in Swagger.  
2. Kept `q` documented as an optional, **deprecated** alias for backward compatibility, noting that `query` is the preferred param going forward. The controller logic remains backward compatible by continuing to accept both `q` and `query`, choosing `query` when both are present.

**Files changed**  
- `backend/src/routes/searchRoutes.js` — updated Swagger/OpenAPI comments for `/api/v1/search/posts` to mark `query` as the primary required param and `q` as an optional deprecated alias.

**Result**  
The posts search API contract is now explicit: clients should send `query=...`, but older callers using `q=...` continue to work. Web already uses `query`, so no client-side changes were required.

---

## Issue #31 — Locale states API — empty country returns 400

| Field        | Value              |
| ------------ | ------------------ |
| **Priority** | P3 (Low)           |
| **Area**     | Locale / API / Web |

**Root cause**  
The backend `GET /locales/states` endpoint requires a non-empty `countryCode` and correctly returns `400` (“countryCode is required”) when it is missing. On the web `Locale` page, the React Query hook for states called `getLocaleStates(countryCode)` whenever `countryCode` changed and `enabled` was truthy. In rare race conditions or intermediate states (e.g. fast tab changes or clearing the country select), this could fire with an empty `countryCode`, producing a 400 error. The UI then had no specific handling for this and could surface a noisy error instead of just hiding the dropdown and showing a simple text field.

**Fix**  
Wrapped the states query in a defensive `queryFn` that: (1) returns an empty `states` array immediately when `countryCode` is empty or whitespace, and (2) catches any thrown errors from `getLocaleStates` and also returns an empty list. The UI already falls back to a plain text input when `stateOptions.length === 0`, so this gracefully degrades to manual entry instead of surfacing a 400 error.

**Files changed**  
- `web/app/(dashboard)/locale/page.tsx` — updated the `useQuery` for `"locale-states"` to guard against empty `countryCode` and swallow backend 400s by returning `{ states: [] }`, which triggers the existing text-input fallback.

**Result**  
If `countryCode` is ever empty or the backend returns 400 for the states request, the web app no longer shows errors; it simply hides the state dropdown and lets the user type a state manually.

---

## Issue #32 — Signed URLs for images — expiry and refresh

| Field        | Value                          |
| ------------ | ------------------------------ |
| **Priority** | P3 (Low)                       |
| **Area**     | Media / Feed / Search / Locale |

**Root cause**  
Post and locale images use short-lived signed URLs (e.g. from R2/Cloudflare or Cloudinary). When a feed or profile screen stayed open for a long time, some image URLs could expire, leading to 403/Forbidden image loads. In some cases this produced repeated load attempts or noisy logs, and users might see blank areas instead of a graceful fallback while still being able to scroll.

**Fix**  
1. Centralized image loading through `loadImageWithFallback` and `imageCacheManager`, which: (a) skips prefetch for R2 URLs and lets `Image` load them directly, (b) uses timeouts and a small number of retries for Cloudinary URLs, and (c) falls back safely to the original URL without throwing.  
2. In `OptimizedPhotoCard`, added a bounded retry loop for post images: on error, it retries up to a small maximum, then sets `imageError` and shows a stable fallback layout instead of hammering the URL. Retries are tracked via refs and cleared on unmount to avoid loops.  
3. In grid views like profile posts/saved posts, on-image `onError` handlers explicitly ignore known 403/Forbidden failures for signed URLs (logging them at most once where useful) so logs stay clean while the UI shows a neutral placeholder thumbnail where an image can’t be loaded anymore.

**Files involved**  
- `frontend/utils/imageLoader.ts` — progressive image loading with timeout, limited retries, and Cloudinary fallbacks; R2 URLs bypass prefetch.  
- `frontend/utils/imageCacheManager.ts` — lightweight prefetch cache that skips R2 URLs and logs failures only for non-R2 images.  
- `frontend/components/OptimizedPhotoCard.tsx` — capped image retry logic (`MAX_IMAGE_RETRIES`), explicit `imageError` state, and a non-crashing placeholder when images can’t be retrieved.  
- `frontend/app/(tabs)/profile.tsx` and related grids — `onError` handlers that suppress 403 noise and show placeholders instead of breaking layout.

**Result**  
When signed image URLs expire, the app now degrades gracefully: it avoids infinite retry loops or log spam, shows stable placeholders where needed, and lets users continue browsing without crashes or severe visual glitches. Fresh URLs are picked up on the next normal refresh of the feed/profile.

---

## Issue #34 — Error boundaries and offline behaviour

| Field        | Value                  |
| ------------ | ---------------------- |
| **Priority** | P3 (Low)               |
| **Area**     | App / Web / Resilience |

**Root cause**  
Some screens previously relied on implicit error handling or raw exceptions, so a failed network call or render bug could result in a blank screen or red error in development instead of a user-friendly message and retry. Offline states were handled inconsistently across routes, making it unclear to users when content was failing due to connectivity vs other errors.

**Fix**  
1. Introduced a shared `ErrorBoundary` component (`frontend/utils/errorBoundary.tsx`) with Sentry integration and a reusable fallback UI that shows a clear message, optional details in development, and a “Try again” button.  
2. Wrapped critical routes like Home, Shorts, Profile, Locale, Map, and the overall app layout in `ErrorBoundary` instances with appropriate `level` (`route` or `global`), and wired their internal loaders/refetchers so “Try again” re-renders safely instead of crashing.  
3. Improved offline signalling: `HomeScreen` and the global `_layout` now detect connectivity via light-weight probes and show explicit offline banners with a retry button, while still attempting to load cached content where available (Home feed) instead of failing hard.

**Files involved**  
- `frontend/utils/errorBoundary.tsx` — error boundary implementation and fallback UI.  
- `frontend/app/_layout.tsx` — wraps the entire app tree with a global `ErrorBoundary` and exposes offline/session banners.  
- `frontend/app/(tabs)/home.tsx`, `shorts.tsx`, `profile.tsx`, `locale.tsx`, `map/all-locations.tsx`, `post.tsx` — key screens wrapped in route-level `ErrorBoundary` to isolate failures per screen.

**Result**  
Across the main app surfaces, unexpected errors and offline scenarios now produce clear, recoverable UI (error messages, retry actions, offline banners) instead of blank screens or uncaught exceptions, substantially improving resilience for both app and web.

---


# Taatom — Handover Issues (27)

This document lists **27 tracked issues** with priority, detailed description, and scenario for each. Use it for sprint planning, handover, or triage.

**Priority legend**

- **P1 (High)** — Critical UX/functionality or data integrity; fix soon.
- **P2 (Medium)** — Important polish or correctness; plan for next release.
- **P3 (Low)** — Nice-to-have or edge-case; backlog.

---

## 1. Read receipt not turning off in chat menu; message count should gradually decrease or increase


| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P2 (Medium) |
| **Area**     | Chat        |


**Description**  
In the chat menu, the “read receipt” setting cannot be turned off (or the UI does not reflect the off state). In addition, the unread message count for a conversation does not update correctly when messages are read or new ones arrive—it should gradually decrease as the user reads and increase when new messages come in.

**Scenario**  

1. User opens Settings or Chat menu and disables “Read receipts”.
2. Expected: read receipts are off; indicator or setting shows “Off”.
3. Actual: setting does not turn off or UI still shows “On”.
4. Separately: user has 5 unread messages in a chat, reads 2.
5. Expected: count updates to 3, then updates again as more are read or new messages arrive.
6. Actual: count jumps or does not decrease/increase gradually.

---

## 2. After liking a post, closing app (RAM cleared) — like appears removed


| Field        | Value                |
| ------------ | -------------------- |
| **Priority** | P1 (High)            |
| **Area**     | Feed / Posts / Likes |


**Description**  
When a user likes a post and then the app is closed (or killed so that it is cleared from RAM), after reopening the app the like state for that post is not persisted—the post appears unliked even though the like was saved on the server.

**Scenario**  

1. User opens a post and taps “Like”; heart fills and count increments.
2. User closes the app completely (or OS kills it).
3. User reopens the app and navigates back to the same post (or feed).
4. Expected: post still shows as liked.
5. Actual: post shows as unliked; like state was not restored from server or not merged with local state after restart.

---

## 3. Own user post redirecting to Home page (Android)


| Field        | Value                          |
| ------------ | ------------------------------ |
| **Priority** | P1 (High)                      |
| **Area**     | Profile / Navigation / Android |


**Description**  
On Android, when the user taps on their own post (e.g. from their profile), instead of opening the post detail screen they are redirected to the Home page.

**Scenario**  

1. User is on their profile and sees their own post.
2. User taps the post.
3. Expected: post detail opens (same as when tapping another user’s post).
4. Actual: app navigates to Home page.
5. Reproduce on Android; iOS may or may not show the same behaviour.

---

## 4. Home page shake (visual jitter)


| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P2 (Medium) |
| **Area**     | Home / Feed |


**Description**  
The Home/feed page exhibits a visible “shake” or jitter—likely layout shifts, scroll jumps, or animation glitches while content loads or when the list updates.

**Scenario**  

1. User opens the app and lands on Home.
2. Feed loads (skeleton or real posts).
3. Expected: smooth, stable layout.
4. Actual: screen or list “shakes” or jitters during or after load.
5. May be more noticeable on certain devices or when many posts load.

---

## 5. Home page: after loading whole post list, view jumps back to top


| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P1 (High)   |
| **Area**     | Home / Feed |


**Description**  
After the user scrolls down the Home feed and the full list of posts has loaded (e.g. infinite scroll), the list unexpectedly scrolls back to the top, losing the user’s position.

**Scenario**  

1. User is on Home and scrolls down; more posts load (e.g. “Load more” or infinite scroll).
2. Once the full set of posts is loaded (or a certain point is reached).
3. Expected: scroll position is preserved.
4. Actual: list jumps back to the top.
5. User has to scroll down again to continue reading.

---

## 6. Loading issues in Locale (Nearby places, filters, etc.)


| Field        | Value           |
| ------------ | --------------- |
| **Priority** | P2 (Medium)     |
| **Area**     | Locale / Places |


**Description**  
The Locale (places) screen has loading/reliability issues: e.g. “Nearby” places not loading or taking too long, filters (country, state, spot type) not applying correctly or causing empty/incorrect results, or spinners never finishing.

**Scenario**  

1. User opens Locale and expects “Nearby” to show places sorted by distance.
2. Expected: list loads with nearby places or a clear “no results”/permission message.
3. Actual: loading hangs, wrong results, or filters don’t work.
4. Or: user applies filters (e.g. country + state); expected filtered list; actual empty list or wrong data.
5. Issues may be tied to location permission, API, or filter params.

---

## 7. Map loading issue in Travel Place


| Field        | Value                        |
| ------------ | ---------------------------- |
| **Priority** | P2 (Medium)                  |
| **Area**     | Map / Travel / Locale detail |


**Description**  
When opening a travel place/locale that has a map (e.g. “Navigate” or map view), the map does not load properly—blank, grey tiles, or perpetual loading.

**Scenario**  

1. User opens a locale/travel place and taps “Navigate” or “View on map”.
2. Expected: map opens and shows the place (or directions).
3. Actual: map does not load (blank/grey), or loading indicator never stops.
4. May depend on network, API key, or map SDK initialization.

---

## 8. Crop issue when creating new post (partial crop)


| Field        | Value               |
| ------------ | ------------------- |
| **Priority** | P2 (Medium)         |
| **Area**     | Create Post / Media |


**Description**  
When creating a new post and cropping the image, the crop is only partially applied—e.g. saved image shows different bounds than what the user selected, or edges are cut off incorrectly.

**Scenario**  

1. User goes to Create Post and selects or captures an image.
2. User enters crop screen and adjusts crop area.
3. User confirms crop.
4. Expected: final image matches the selected crop exactly.
5. Actual: output image is partially cropped, wrong aspect ratio, or different region than selected.

---

## 9. Adding song/music — drag should be more user-friendly


| Field        | Value                        |
| ------------ | ---------------------------- |
| **Priority** | P3 (Low)                     |
| **Area**     | Create Post / Shorts / Music |


**Description**  
When adding a song or music segment to a post/short, the drag interaction (e.g. selecting start/end on a waveform or timeline) is not user-friendly—hard to use, imprecise, or unintuitive.

**Scenario**  

1. User is creating a post/short and adds a song.
2. User tries to drag to set the segment (e.g. start/end of music).
3. Expected: easy, precise dragging with clear feedback.
4. Actual: drag is difficult, jumps, or does not feel intuitive; users struggle to select the desired segment.

---

## 10. Shorts lag while scrolling


| Field        | Value     |
| ------------ | --------- |
| **Priority** | P1 (High) |
| **Area**     | Shorts    |


**Description**  
While scrolling through Shorts (vertical video feed), the experience is laggy—dropped frames, stutter, or delay when moving to the next/previous short.

**Scenario**  

1. User opens Shorts and scrolls up/down to switch between videos.
2. Expected: smooth transition between shorts (e.g. 60fps).
3. Actual: noticeable lag, stutter, or delay when swiping.
4. May be more visible on mid/low-end devices or with many shorts loaded.

---

## 11. Alignment issue on Shorts page


| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P2 (Medium) |
| **Area**     | Shorts / UI |


**Description**  
Elements on the Shorts page are misaligned—e.g. overlays, buttons, captions, or progress indicators are off horizontally or vertically, or not consistent across devices.

**Scenario**  

1. User opens Shorts and watches one or more short.
2. Observe layout: action buttons, captions, progress, etc.
3. Expected: consistent alignment and spacing.
4. Actual: some elements are misaligned, overlapping, or cut off on certain screen sizes.

---

## 12. TripScore should show exactly one place per country (no duplicate “main” country entry)


| Field        | Value               |
| ------------ | ------------------- |
| **Priority** | P2 (Medium)         |
| **Area**     | TripScore / Profile |


**Description**  
TripScore (travel map/stats) shows the same country twice—e.g. one entry for the country as a whole and another for a main/primary place in that country. It should show exactly one entry per country (or a single clear representation).

**Scenario**  

1. User has visited one country (e.g. India) and has one or more places there.
2. User opens TripScore (globe/map or list).
3. Expected: one entry or one pin per country.
4. Actual: two entries for the same country (e.g. “India” and “India – main” or similar).
5. Should be deduplicated so one country = one place in the UI.

---

## 13. Public account — touching their globe should show their traveled TripScore locations


| Field        | Value                                |
| ------------ | ------------------------------------ |
| **Priority** | P2 (Medium)                          |
| **Area**     | Profile / TripScore / Public profile |


**Description**  
For a public account, when the viewer taps the globe (or TripScore map) on their profile, it should show that user’s traveled TripScore locations. Currently it may not open, or may show wrong/empty data.

**Scenario**  

1. User A has a **public** profile and has TripScore data (traveled locations).
2. User B opens User A’s profile and taps the globe/TripScore.
3. Expected: User A’s traveled locations (TripScore) are shown.
4. Actual: nothing happens, or wrong/empty map/list.
5. Only applies to public accounts; private/followers-only may have different rules.

---

## 14. Current location: when enabled, show “our location”; in private profile show for followers only


| Field        | Value                        |
| ------------ | ---------------------------- |
| **Priority** | P2 (Medium)                  |
| **Area**     | Profile / Privacy / Location |


**Description**  
When “current location” is enabled, the user’s location should be shown appropriately: e.g. “our location” or equivalent. For private (or followers-only) profiles, location should be visible only to followers, not to everyone.

**Scenario**  

1. User enables “Show current location” (or similar) in settings.
2. Expected: their location is shown with correct label and only to allowed viewers (e.g. followers for private accounts).
3. Actual: location not shown when it should be, or shown to non-followers when profile is private.
4. Verify: public profile → location visible to all; private/followers-only → location only to followers.

---

## 15. Exact location pinpoint not correct


| Field        | Value                  |
| ------------ | ---------------------- |
| **Priority** | P2 (Medium)            |
| **Area**     | Map / Location / Posts |


**Description**  
When a post or place shows a location pin on the map, the pinpoint is not exact—it may be offset from the actual location or show a generic area instead of the precise point.

**Scenario**  

1. User creates a post with location, or opens a locale/travel place with coordinates.
2. User opens the map view (post location or “Navigate”).
3. Expected: pin at exact latitude/longitude of the place/post.
4. Actual: pin is offset, or shows city/region center instead of the exact spot.
5. Fix may involve using stored lat/long correctly and map marker placement.

---

## 16. Detect location: only “accepting” for TripScore; normal text for location not approved; approving TripScore not increasing count


| Field        | Value                             |
| ------------ | --------------------------------- |
| **Priority** | P2 (Medium)                       |
| **Area**     | Location / TripScore / Moderation |


**Description**  
(1) Location detection only “accepts” or suggests locations for TripScore, but when the user enters normal text as location (not a TripScore place), that flow is unclear or broken. (2) When an admin (or user) approves a TripScore request, the TripScore count or list does not increase as expected.

**Scenario**  

1. User adds a location as free text (e.g. “Central Park”).
2. Expected: either treated as normal location text or offered for TripScore; behaviour clear.
3. Actual: only TripScore “accept” path works; normal text path broken or confusing.
4. Separately: user submits a place for TripScore; admin approves it.
5. Expected: user’s TripScore (e.g. country/place count) updates.
6. Actual: TripScore does not increase or list does not refresh after approval.

---

## 17. Profile page needs better UI (edges / polish)


| Field        | Value        |
| ------------ | ------------ |
| **Priority** | P3 (Low)     |
| **Area**     | Profile / UI |


**Description**  
The profile page looks rough or inconsistent—e.g. sharp edges, missing rounded corners, or elements that don’t match the rest of the app. It needs UI polish (edges, spacing, hierarchy).

**Scenario**  

1. User opens any profile (own or another user’s).
2. Observe: cards, sections, avatar, buttons.
3. Expected: consistent rounded corners, spacing, and visual hierarchy.
4. Actual: some elements have harsh edges or look unfinished compared to other screens.

---

## 18. Bio added but not showing


| Field        | Value         |
| ------------ | ------------- |
| **Priority** | P1 (High)     |
| **Area**     | Profile / Bio |


**Description**  
User adds or edits their bio in profile/settings, but the bio does not appear on the profile view (or appears only in some places).

**Scenario**  

1. User goes to Edit Profile (or Settings) and enters/saves a bio.
2. User saves and returns to profile.
3. Expected: bio text is visible on the profile.
4. Actual: bio is missing on profile, or only shows after app restart/cache clear.
5. May be a save/API issue or a display/field mapping issue.

---

## 19. User ID, username, “Bio”, “Member since” text not needed


| Field        | Value               |
| ------------ | ------------------- |
| **Priority** | P3 (Low)            |
| **Area**     | Profile / UI / Copy |


**Description**  
Profile currently shows labels such as “User ID”, “Username”, “Bio”, “Member since” (or similar). Product decision: these labels should be removed—show only the values (e.g. username, join date) without the extra text, for a cleaner layout.

**Scenario**  

1. User opens a profile.
2. Current: labels like “User ID: …”, “Username: …”, “Bio: …”, “Member since …”.
3. Expected: only the actual values are shown (e.g. @username, join date) without those literal labels.
4. Change is copy/layout only; no backend change required unless fields are also being removed.

---

## 20. Notifications should be enabled for real-time cases (like, comment, post, share, etc.)


| Field        | Value         |
| ------------ | ------------- |
| **Priority** | P1 (High)     |
| **Area**     | Notifications |


**Description**  
Push (and/or in-app) notifications should fire in real time for key actions: like, comment, post mention, share, follow, etc. Currently they may be delayed, missing, or only work for some event types.

**Scenario**  

1. User A likes or comments on User B’s post, or shares it, or follows User B.
2. Expected: User B receives a notification promptly (push and/or in-app).
3. Actual: no notification, or notification arrives much later.
4. Verify for: like, comment, post, share, follow, and any other configured events.
5. Check both push (if implemented) and in-app notification list.

---

## 21. Locale accuracy problem


| Field        | Value                       |
| ------------ | --------------------------- |
| **Priority** | P2 (Medium)                 |
| **Area**     | Locale / Places / Geocoding |


**Description**  
Locales (places) have accuracy issues—e.g. wrong coordinates, wrong country/state, or search/geocode returning incorrect or low-quality results.

**Scenario**  

1. User searches for a place or selects a locale.
2. Expected: correct location (coordinates and/or address, country, state).
3. Actual: place is in wrong country/region, or pin is inaccurate.
4. May involve geocoding, reverse geocoding, or how locale data is stored and displayed.

---

## 22. Clicking “Shorts” on own profile — list jumps back to top


| Field        | Value            |
| ------------ | ---------------- |
| **Priority** | P2 (Medium)      |
| **Area**     | Profile / Shorts |


**Description**  
On the user’s own profile, when they tap the “Shorts” tab, the list or view jumps back to the top instead of showing the shorts list from the start or preserving previous scroll position.

**Scenario**  

1. User is on their profile and may have scrolled (e.g. on Posts).
2. User taps “Shorts” tab.
3. Expected: Shorts list loads without jumping to top of the whole profile, or scroll stays sensible.
4. Actual: view jumps to top (of profile or of Shorts list) unexpectedly.
5. Reproduce on own profile; compare with other users’ profiles if needed.

---

## 23. Own shorts open in separate Shorts view, not in global Shorts


| Field        | Value                         |
| ------------ | ----------------------------- |
| **Priority** | P2 (Medium)                   |
| **Area**     | Shorts / Profile / Navigation |


**Description**  
When the user opens one of their own shorts from their profile, it opens in a separate/dedicated short view instead of in the global Shorts feed (where they can swipe to other shorts). Desired: own shorts should open in the same Shorts experience as global (e.g. open in Shorts tab with context so user can swipe to others).

**Scenario**  

1. User is on their profile, Shorts tab.
2. User taps one of their shorts.
3. Expected: short plays in the same Shorts flow (e.g. global Shorts) so user can swipe to more shorts.
4. Actual: short opens in an isolated/single-short screen; cannot swipe to global Shorts.
5. Align behaviour with tapping a short from Home/Discover.

---

## 24. Chats / other user profiles — swipe back goes to Home instead of previous page


| Field        | Value                       |
| ------------ | --------------------------- |
| **Priority** | P1 (High)                   |
| **Area**     | Navigation / Chat / Profile |


**Description**  
When viewing a chat screen or another user’s profile, swiping back (or tapping back) should return to the previous page (e.g. chat list or search). Instead, the app navigates to the Home page.

**Scenario**  

1. User is on Chat list (or Search) and opens a conversation.
2. User swipes back or taps back.
3. Expected: return to Chat list.
4. Actual: app goes to Home.
5. Same for Profile: User A is on Feed/Search, opens User B’s profile, then back.
6. Expected: return to Feed/Search.
7. Actual: goes to Home.
8. Back stack/navigation is incorrect.

---

## 25. Onboarding — after completion, “similar wish” options not showing


| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P2 (Medium) |
| **Area**     | Onboarding  |


**Description**  
After the user completes onboarding, expected “similar wish” or “suggestions based on your choices” (e.g. people to follow, interests) do not appear. The post-onboarding experience is missing this step or screen.

**Scenario**  

1. New user goes through onboarding (e.g. interests, preferences).
2. User completes the last step.
3. Expected: screen or list of “similar wish” / recommendations (e.g. users to follow, topics).
4. Actual: that screen does not show; user is taken straight to home or another screen without recommendations.
5. Confirm product spec for “similar wish” and implement or restore.

---

## 26. Settings — validate all options, especially Account & Privacy


| Field        | Value                        |
| ------------ | ---------------------------- |
| **Priority** | P2 (Medium)                  |
| **Area**     | Settings / Account / Privacy |


**Description**  
All settings screens (especially Account and Privacy) need validation: each option should save correctly, reflect server state, and behave as documented. Some options may not persist, may not be sent to the backend, or may show wrong state.

**Scenario**  

1. User opens Settings → Account (and separately Privacy).
2. User toggles or changes each option (e.g. email, visibility, read receipts, location).
3. Expected: every option saves and, after refresh/reopen, shows the saved value.
4. Actual: some options do not save, or UI shows wrong value after reload.
5. Audit all Account and Privacy options end-to-end (UI → API → storage).

---

## 27. Alignment across the app should be consistent


| Field        | Value       |
| ------------ | ----------- |
| **Priority** | P3 (Low)    |
| **Area**     | Global / UI |


**Description**  
Alignment and spacing are inconsistent across the app—e.g. different padding/margins, misaligned headers or buttons, or inconsistent use of safe areas. Goal: one coherent alignment system (grid, spacing, insets) across all main screens.

**Scenario**  

1. Navigate through main screens: Home, Profile, Shorts, Locale, Settings, Chat.
2. Observe: headers, cards, buttons, lists.
3. Expected: consistent horizontal padding, vertical rhythm, and alignment.
4. Actual: some screens have different margins or misaligned elements.
5. Define (or reuse) a simple layout/alignment guide and apply across the app.

---

## Summary table


| #   | Topic (short)                                         | Priority |
| --- | ----------------------------------------------------- | -------- |
| 1   | Read receipt + message count (chat)                   | P2       |
| 2   | Like removed after app close (RAM)                    | P1       |
| 3   | Own post → Home (Android)                             | P1       |
| 4   | Home page shake                                       | P2       |
| 5   | Home feed jumps to top after load                     | P1       |
| 6   | Locale loading / nearby / filters                     | P2       |
| 7   | Map loading (Travel place)                            | P2       |
| 8   | New post crop partial                                 | P2       |
| 9   | Song drag UX                                          | P3       |
| 10  | Shorts scroll lag                                     | P1       |
| 11  | Shorts alignment                                      | P2       |
| 12  | TripScore one place per country                       | P2       |
| 13  | Public profile globe → TripScore                      | P2       |
| 14  | Current location + private profile (followers only)   | P2       |
| 15  | Exact location pinpoint                               | P2       |
| 16  | Detect location + TripScore approval count            | P2       |
| 17  | Profile UI edges                                      | P3       |
| 18  | Bio not showing                                       | P1       |
| 19  | Remove User ID / Username / Bio / Member since labels | P3       |
| 20  | Real-time notifications (like, comment, etc.)         | P1       |
| 21  | Locale accuracy                                       | P2       |
| 22  | Profile Shorts tab → jump to top                      | P2       |
| 23  | Own shorts in separate view vs global Shorts          | P2       |
| 24  | Chat/Profile back → Home instead of previous          | P1       |
| 25  | Onboarding “similar wish” not showing                 | P2       |
| 26  | Settings/Account/Privacy validation                   | P2       |
| 27  | App-wide alignment                                    | P3       |


**P1 (High): 7** — 2, 3, 5, 10, 18, 20, 24  
**P2 (Medium): 16** — 1, 4, 6, 7, 8, 11, 12, 13, 14, 15, 16, 21, 22, 23, 25, 26  
**P3 (Low): 4** — 9, 17, 19, 27

---

## Additional observations (from codebase / review)

*The following items were noted during codebase review and implementation work. They are appended for handover and backlog; priorities are suggestions.*

---

### 28. Web vs app parity — saved locales / bookmarks not synced


| Field        | Value                     |
| ------------ | ------------------------- |
| **Priority** | P3 (Low)                  |
| **Area**     | Locale / Web / App / Sync |


**Description**  
On the app, saved locales (bookmarks) are stored in AsyncStorage (`savedLocales`); on the web they are in `localStorage` under `taatom_saved_locales`. There is no backend or account-level sync, so the same user’s saved places on phone vs browser are different and do not merge.

**Scenario**  

1. User saves three locales on the mobile app.
2. User opens web and goes to Locale → Saved.
3. Expected (if synced): same three saved places appear.
4. Actual: web Saved list is empty (or different); no sync.
5. Consider: optional API to persist “saved locales” per user and sync across app and web.

---

### 29. Feed cache key may ignore feed mode in some paths


| Field        | Value                  |
| ------------ | ---------------------- |
| **Priority** | P3 (Low)               |
| **Area**     | Backend / Feed / Cache |


**Description**  
`getPosts` now supports `feed=recents|friends|popular` and the cache key includes `feed`. If any code path (e.g. another client or an internal call) calls the feed without the `feed` param, it could read/write a cache entry that doesn’t distinguish mode. Worth verifying all callers pass `feed` when using different modes and that cache invalidation is correct.

**Scenario**  

1. User loads Friends feed; backend caches with key including `feed: friends`.
2. Some code or client requests GET /posts without `feed` (default recents).
3. Expected: recents cache is separate; Friends cache unchanged.
4. Actual: confirm no shared cache key or stale response.
5. Audit: CacheKeys.postList usage and any callers of getPosts.

---

### 30. Search posts API — web sends `query`, backend accepts `q` and `query`


| Field        | Value              |
| ------------ | ------------------ |
| **Priority** | P3 (Low)           |
| **Area**     | Search / API / Web |


**Description**  
Backend search was updated to accept both `q` and `query` for the search string; web uses `query`. Behaviour is correct but the API contract is dual; one canonical param (e.g. `q` or `query`) and documenting it would reduce confusion for future clients.

**Scenario**  

1. New client implements search and reads API docs.
2. Expected: single documented param for search text.
3. Actual: two params supported; docs may not state both.
4. Recommendation: document `query` (and/or `q`) and consider deprecating one in favour of the other long term.

---

### 31. Locale states API — empty country returns 400


| Field        | Value              |
| ------------ | ------------------ |
| **Priority** | P3 (Low)           |
| **Area**     | Locale / API / Web |


**Description**  
GET `/locales/states?countryCode=IN` returns 200 with a list; if the front end sends an empty or missing `countryCode`, the backend returns 400 with “countryCode is required”. The web only requests states when `countryCode` is non-empty, so this is edge-case; ensure error is handled (e.g. no state dropdown and no console error).

**Scenario**  

1. Bug or race clears country code while state dropdown is still in use.
2. Request goes out with empty countryCode.
3. Expected: backend 400 handled; UI falls back to text input or empty list.
4. Verify: no unhandled rejection or red error in UI.

---

### 32. Signed URLs for images — expiry and refresh


| Field        | Value                          |
| ------------ | ------------------------------ |
| **Priority** | P3 (Low)                       |
| **Area**     | Media / Feed / Search / Locale |


**Description**  
Post and locale images are served via signed URLs (e.g. R2 or Cloudinary) generated at request time. If the signed URL TTL is short and the client caches the response (or keeps the list open for a long time), images may later 403 or fail to load until the list is refetched. Consider TTL vs “session” length and whether any client-side caching of image URLs is appropriate.

**Scenario**  

1. User opens feed and leaves the app tab open for hours.
2. User scrolls to an older post and expands image.
3. Expected: image loads or user sees a clear “expired”/retry state.
4. Actual: image fails with 403 or network error; no retry.
5. Mitigation: reasonable server TTL, refetch on focus, or retry with new URL.

---

### 33. Web feed — “Friends” empty when not logged in


| Field        | Value      |
| ------------ | ---------- |
| **Priority** | P3 (Low)   |
| **Area**     | Web / Feed |


**Description**  
On the web, when the user is not logged in (or session expired), the Friends feed is empty because the backend restricts “friends” to the current user’s following list. The UI should make it clear that Friends is for logged-in users only (e.g. message or prompt to sign in) instead of an empty list with no explanation.

**Scenario**  

1. User is logged out (or session expired) on web.
2. User opens Feed and taps “Friends”.
3. Expected: empty state explains “Sign in to see posts from people you follow” or similar.
4. Actual: empty list with generic “No posts” or same as Recents empty state.
5. Add a dedicated empty state for Friends when unauthenticated.

---

### 34. Error boundaries and offline behaviour


| Field        | Value                  |
| ------------ | ---------------------- |
| **Priority** | P3 (Low)               |
| **Area**     | App / Web / Resilience |


**Description**  
When the network fails or the backend returns 5xx, some screens may show a blank area or throw an uncaught error instead of a friendly “Something went wrong” and retry. Ensuring critical routes (Feed, Profile, Locale, Chat) are wrapped in error boundaries and show a retry or “Go home” option improves resilience.

**Scenario**  

1. User is on Feed (or Locale, Profile); network is turned off or server returns 500.
2. Expected: error message and retry button (or “Go back”).
3. Actual: white screen or uncaught error in console.
4. Add or verify error boundaries and fallback UI on key screens.

---

### 35. Accessibility — focus and screen readers


| Field        | Value            |
| ------------ | ---------------- |
| **Priority** | P3 (Low)         |
| **Area**     | App / Web / A11y |


**Description**  
Buttons and links (e.g. Feed tabs, Refresh, Locale bookmark, Navigate) may not have clear `aria-label` or focus order, and dynamic content (e.g. “Load more”, new posts) may not announce to screen readers. Improving labels and focus management helps accessibility and keyboard users.

**Scenario**  

1. User navigates with a screen reader or keyboard only.
2. Expected: all actions have clear names and focus order is logical.
3. Actual: some controls are unlabeled or focus jumps oddly.
4. Audit: Feed tabs, Refresh, Locale cards, Shorts controls, primary CTAs.

---

## Summary table (including observations 28–35)


| #    | Topic (short)                               | Priority      |
| ---- | ------------------------------------------- | ------------- |
| 1–27 | *(unchanged; see above)*                    | *(see above)* |
| 28   | Web/app saved locales not synced            | P3            |
| 29   | Feed cache key vs feed mode                 | P3            |
| 30   | Search API dual param `q` / `query`         | P3            |
| 31   | Locale states empty countryCode 400         | P3            |
| 32   | Signed image URL expiry / refresh           | P3            |
| 33   | Web Friends feed empty when logged out (UX) | P3            |
| 34   | Error boundaries / offline handling         | P3            |
| 35   | Accessibility (focus, screen readers)       | P3            |


**Original P1:** 7 — 2, 3, 5, 10, 18, 20, 24  
**Original P2:** 16 — 1, 4, 6, 7, 8, 11, 12, 13, 14, 15, 16, 21, 22, 23, 25, 26  
**Original P3:** 4 — 9, 17, 19, 27  
**Observations (all P3):** 8 — 28–35

---

*Document generated for handover. Update priorities and descriptions as product decisions change. Observations 28–35 appended from codebase review.*
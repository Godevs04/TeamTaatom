# Miscellaneous Modules – Developer Guide

Short documentation for **Followers**, **Support**, **Policies**, **Onboarding**, **Map**, **Saved Posts**, and **Short URL**.

---

## 1. Followers

**Screen:** `app/followers.tsx`.

**Purpose:** List followers or following for a user; follow/unfollow from list; handle follow-request-pending and errors via useAlert/CustomAlert.

**API:** Profile endpoints for follower list (or dedicated followers/following list endpoint if present in backend). Follow: `POST /api/v1/profile/${userId}/follow`.

**Service:** `profile.ts`; follow logic and error messages (e.g. “You cannot follow yourself”, “Follow request pending”) surfaced with showError/showInfo.

---

## 2. Support

**Screens:** `app/support/help.tsx`, `app/support/contact.tsx`.

**Purpose:** Help (link to help website); Contact (show support email, copy to clipboard, open mailto). Errors (e.g. failed to open link) shown via CustomAlert/useAlert.

**Logic:** Linking.openURL for external URLs; Clipboard for copy; no dedicated backend for support content (static or config).

---

## 3. Policies

**Screens:** `app/policies/privacy.tsx`, `terms.tsx`, `copyright.tsx` (and possibly standalone app/privacy, app/terms, app/copyright).

**Purpose:** Display privacy policy, terms of service, copyright policy (WebView or static text). No backend API; content from assets or remote URL.

---

## 4. Onboarding

**Screens:** `app/onboarding/welcome.tsx`, `interests.tsx`, `suggested-users.tsx`.

**Purpose:** Post-signup flow: welcome → interests selection → suggested users to follow. May call backend to save interests and follow suggestions.

**Logic:** After signup/OTP, redirect to onboarding; on completion redirect to (tabs).

---

## 5. Map

**Screens:** `app/map/all-locations.tsx`, `app/map/current-location.tsx`.

**Purpose:** Map view of all locations (e.g. from locales or posts); current location picker or display. May use profile/travel-map or locales API.

**Services:** profile (travel-map), locale, location.

---

## 6. Saved Posts

**Screen:** `app/saved-posts/index.tsx`.

**Purpose:** List of saved posts for current user. Backend may expose “saved” or “bookmarks” endpoint; or saved state is derived from posts with isSaved (if part of PostType). Collections can also act as “saved” groups.

---

## 7. Short URL

**Service:** `services/shortUrl.ts` – `createShortUrl(longUrl, postId?)` → POST `/api/v1/short-url/create`. Used for share links.

---

## 8. Report

**Service:** `services/report.ts` – create report (type, target user/post, reason) → POST `/api/v1/reports`. Used from profile/report flow.

---

## 9. Mentions

**Service:** `services/mentions.ts` – GET `/api/v1/mentions/search` for @mention autocomplete in captions/comments.

---

## 10. Followers screen – technical

- **Screen:** app/followers.tsx. May show "Followers" or "Following" list for a user (userId from route or profile). Load list via profile or dedicated endpoint (e.g. GET /api/v1/profile/${userId}/followers). Each row: avatar, name, Follow/Unfollow/Requested button. Follow calls POST /api/v1/profile/${userId}/follow; errors ("You cannot follow yourself", "Follow request pending") shown with useAlert showError/showInfo. No system Alert; use CustomAlert or useAlert everywhere.

---

## 11. Support – technical

- **help.tsx:** Link to help URL (e.g. Linking.openURL(helpUrl)). On failure showError('Failed to open help website'). 
- **contact.tsx:** Support email displayed; "Copy" copies to clipboard (Clipboard.setString or expo-clipboard); "Email" opens mailto or copy. Alert.alert replaced with showInfo/showError or CustomAlert for "Email Copied", "Support Email", "Failed to open support website".

---

## 12. Policies – technical

- **Content:** Static markdown or WebView loading remote URL (privacy policy, terms, copyright). No backend API for content; may be bundled or from constants.

---

## 13. Onboarding – technical

- **welcome.tsx:** Intro screen; button "Get started" → interests.
- **interests.tsx:** Select interests (tags/categories); submit may POST to backend to save user interests.
- **suggested-users.tsx:** List suggested users (getSuggestedUsers or similar); Follow buttons; on complete navigate to (tabs).

---

## 14. Map – technical

- **all-locations.tsx:** Fetch locations (from locales or travel-map); render on MapView (react-native-maps or similar); markers for each location.
- **current-location.tsx:** Get user location (Expo Location); show on map; may save or share location; error "Unable to determine exact location" shown via CustomAlert/useAlert.

---

## 15. Saved posts – technical

- **Screen:** saved-posts/index.tsx. If backend has "saved" or "bookmarks" endpoint, call it and display list. Else saved state may be derived from posts with isSaved true or from collections (e.g. "Saved" collection). Add to collection flow may double as "save" (addPostToCollection).

---

## 16. Report – technical

- **Service:** report.ts → POST /api/v1/reports with params (type: 'user' | 'post' | etc., targetId, reason, comment?). Used from profile (report user) or post menu (report post). Success/error via useAlert.

---

## 17. Mentions – technical

- **Service:** mentions.ts → GET /api/v1/mentions/search?q=&limit=. Used in caption/comment input for @mention autocomplete; returns list of users; user selects to insert @username.

---

*Full API list: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md). Index: [00-INDEX.md](./00-INDEX.md).*

# Feature 2: Connect Feature

**BSD Reference**: BSD-TAA-CON-001 v1.0
**Status**: Planning complete, pending implementation
**Date**: 2026-04-23

---

## Overview

The Connect Feature is Taatom's social discovery layer. Users can create travel-focused Connect pages (like mini travel blogs), follow other users' pages, discover travelers through advanced search filters, and chat with page followers. It lives as a section on the Profile page.

**Core Concept**: A Connect page is a single entity. Users create them, admins create them too. The **Find tab** shows user-created pages, the **Community tab** shows admin-created pages. Both are ConnectPage documents in the database — no separate Community model needed.

**Key Decisions (from planning session)**:
- Payment gateway (Cashfree) is **deferred** — subscription toggle exists with "Coming Soon", no payment collection
- Analytics dashboard shows **views + followers + growth chart only** — no financial section
- Website & Subscription builders support **text + image + video blocks** with up/down arrow reordering (not full drag-and-drop)
- Connect lives as a **section on the Profile page** — button placement to be decided later
- Group chat **reuses the existing Socket.io chat system** with a new `connect_page` chat type
- **One shared group chat** per Connect page — all followers join the same chat room
- Group chat appears in the **main chat list** AND as a link on the Connect page
- **Communities = admin-created Connect pages** — no separate Community model
- Admin community pages include the **Buy feature** (up to 5 items, payment deferred)
- Ads: **placeholder slots only** — no AdMob integration yet
- **Two discovery mechanisms with different follow actions**:
  - **Search icon (top right)**: searches for Connect pages by name → Follow = follow the Connect page (ConnectFollow system)
  - **Find tab**: filter-based discovery of users with similar interests → Follow = follow their Taatom profile (existing profile follow system)
- Users can create **multiple Connect pages**
- Only the page **owner** can edit Website/Subscription content — followers see read-only
- **NO video calls** anywhere in Connect (per BSD)

---

## Connect Hub Flow (CRITICAL — Read This First)

The Connect Hub is the main entry point, accessed from the Profile page:

```
Profile Page
  └── "Connect" section/button
        └── Connect Hub (3 tabs)
              ├── Find tab (default) — user-created Connect pages with FOLLOW buttons
              ├── Archived tab — pages the user archived (swiped away)
              └── Community tab — admin-created Connect pages (isAdminPage: true)

Connect Hub → + FAB → Create Connect Page form
Connect Hub → Search icon (top right) → Search CONNECT PAGES by name → Follow = follow page (ConnectFollow)
Connect Hub → Find tab → Filter form (country, language, location) → Search → Results = USERS → Follow = follow profile (existing follow)
Connect Hub → Community tab → Admin-created Connect pages → Follow = follow page (ConnectFollow)
Connect Hub → Tap a page → Connect Page Detail
```

**Connect Page Detail** (e.g., "KavinKumar.S"):
```
┌─────────────────────────────┐
│  < KavinKumar.S          ≡  │  ← Header with page name
│                              │
│  [FOLLOWERS (86)] [Dashboard]│  ← Followers count + Dashboard (owner only)
│  [FOLLOW button]             │  ← For visitors/followers
│                              │
│  ┌──────────────────────┐    │
│  │ Website         [Edit]│   │  ← Content page (text/image/video blocks)
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ Group Chat            │   │  ← Link to the shared group chat
│  └──────────────────────┘    │
│                              │
│  ┌──────────────────────┐    │
│  │ Subscription    [Edit]│   │  ← Service listing page + Subscribe button
│  └──────────────────────┘    │
└─────────────────────────────┘
```

**Key rules**:
- **Owner** sees Edit buttons on Website and Subscription. Sees Dashboard button.
- **Followers/Visitors** see read-only content. See FOLLOW/FOLLOWING button. No Dashboard.
- **Group Chat**: one shared chat room for all followers. Appears in main chat list automatically when user follows a page with groupChat enabled. Also accessible via a link on the Connect page.
- **Website**: a simple content display page — the creator's mini portfolio/blog about themselves and their travels. Text, image, video blocks. Owner edits (saves = live immediately), followers view read-only.
- **Subscription**: a simple content display page — lists the services the creator offers. Same block types (text, image, video), same builder. Has a "Subscribe" button that shows "Coming Soon" when tapped. Owner edits, followers view read-only.

---

## Task List

### TASK 1: Backend — Models & APIs (Foundation)

**Priority**: P0 — Everything depends on this
**Files to create/modify**:
- `backend/src/models/ConnectPage.js` (NEW)
- `backend/src/models/ConnectFollow.js` (NEW)
- `backend/src/models/ConnectPageView.js` (NEW — for view counting)
- `backend/src/controllers/connectController.js` (NEW)
- `backend/src/routes/v1/connectRoutes.js` (NEW)
- `backend/src/services/connectService.js` (NEW)
- `backend/src/controllers/chat.controller.js` (MODIFY — add connect_page chat type)
- `backend/src/models/Chat.js` (MODIFY — add connect_page chat type)

**What to build**:

1. **ConnectPage Model** (`ConnectPage.js`):
   - userId (ref: User) — the creator/owner
   - name: String (required, 3-50 characters) — the page name (e.g., "Tamil Travel Adventures")
   - type: enum ['public', 'private'] — public = indexed in search, private = invite-only
   - profileImage: String — Cloudinary URL for page avatar (1:1 crop)
   - bio: String (max 250 characters) — short description
   - features: Object:
     - website: Boolean (default false) — enables website content builder
     - groupChat: Boolean (default false) — enables shared group chat for followers
     - subscription: Boolean (default false) — enables service listing page (payment deferred)
   - websiteContent: [{ type: enum ['text', 'image', 'video'], content: String, order: Number }] — content blocks for website
   - subscriptionContent: [{ type: enum ['text', 'image', 'video'], content: String, order: Number }] — content blocks for subscription/service listing
   - subscriptionPrice: Number (100-10000, INR) — placeholder field, not collected yet
   - chatRoomId: ref Chat — linked group chat room (created when groupChat enabled)
   - followerCount: Number (default 0) — denormalized count
   - viewCount: Number (default 0) — denormalized count
   - isAdminPage: Boolean (default false) — true for admin-created "community" pages (shown in Community tab)
   - isDefault: Boolean (default false) — true for pages shown to first-time users with no follows
   - buyItems: [{ name: String, description: String, price: Number, imageUrl: String, active: Boolean }] — max 5 items (admin pages only, replaces Subscription)
   - status: enum ['active', 'archived', 'suspended'] (default 'active')
   - createdAt, updatedAt: Date

   **Indexes**: userId (for "my pages"), type + status + isAdminPage (for Find vs Community tab), name (text index for search), isDefault (for first-time user suggestions)

2. **ConnectFollow Model** (`ConnectFollow.js`):
   - followerId: ref User — who is following
   - connectPageId: ref ConnectPage — which page they follow
   - status: enum ['active', 'archived'] — archived = user swiped away
   - followedAt: Date
   - archivedAt: Date (null if active)

   **Indexes**: followerId + status (for user's followed pages), connectPageId (for page's followers), unique compound: followerId + connectPageId

3. **ConnectPageView Model** (`ConnectPageView.js`):
   - userId: ref User — who viewed
   - connectPageId: ref ConnectPage — which page was viewed
   - viewedAt: Date

   **Rule**: 1 view per user per page per 8-hour window. Query: check if a view exists within 8 hours before inserting a new one.

   **Indexes**: userId + connectPageId + viewedAt (for dedup query)

4. **New API Endpoints**:

   **Connect Pages — CRUD**:
   - `POST /api/v1/connect/create` — create a new Connect page
     - Body: `{ name, type, bio, features: { website, groupChat, subscription }, profileImage }`
     - If groupChat is true, auto-create a Chat room with type `connect_page` and link via chatRoomId
     - A user can create multiple pages
   - `GET /api/v1/connect/my-pages` — get all pages created by current user
   - `GET /api/v1/connect/page/:pageId` — get single page detail (includes followerCount, features)
     - If viewer is owner: include edit permissions flag
     - If viewer is not owner: check follow status, return isFollowing boolean
   - `PUT /api/v1/connect/page/:pageId` — update page info (owner only)
   - `DELETE /api/v1/connect/page/:pageId` — soft delete / set status='archived' (owner only)

   **Connect Pages — Discovery**:
   - `GET /api/v1/connect/communities` — paginated admin-created pages (isAdminPage=true) for Community tab
   - `GET /api/v1/connect/search-by-name?q=<query>` — search Connect pages by name (for Search icon)
     - Text search on ConnectPage.name using MongoDB text index
     - Returns paginated ConnectPage results with isFollowing boolean
     - Private pages excluded from results
   - `GET /api/v1/connect/find-users?target_country=X&current_country=Y&lang=Z` — filter-based user discovery (for Find tab)
     - Finds USERS matching country/language/location filters
     - Returns user profiles (avatar, username, isFollowing) — NOT Connect pages
     - Follow action uses existing profile follow system (NOT ConnectFollow)
     - Queries User model with metadata filters

   **Connect Pages — Follow System**:
   - `POST /api/v1/connect/follow` — follow a page: `{ connectPageId }`
     - Increment followerCount on ConnectPage
     - If page has groupChat: add follower to chat participants
     - Optimistic UI on frontend — API confirms or reverts
   - `POST /api/v1/connect/unfollow` — unfollow a page: `{ connectPageId }`
     - Decrement followerCount
     - If page has groupChat: remove follower from chat participants
   - `POST /api/v1/connect/archive` — archive a followed page (swipe gesture): `{ connectPageId }`
   - `POST /api/v1/connect/unarchive` — restore archived page: `{ connectPageId }`
   - `GET /api/v1/connect/following` — get all pages user follows (status='active'), sorted newest first
   - `GET /api/v1/connect/archived` — get all archived follows for user
   - `GET /api/v1/connect/page/:pageId/followers` — paginated list of followers for a page

   **Website & Subscription Content**:
   - `PUT /api/v1/connect/page/:pageId/website` — update website content blocks (owner only)
     - Body: `{ content: [{ type: 'text'|'image'|'video', content: String, order: Number }] }`
   - `GET /api/v1/connect/page/:pageId/website` — get website content (public: anyone; private: followers only)
   - `PUT /api/v1/connect/page/:pageId/subscription` — update subscription/service listing content (owner only)
     - Body: `{ content: [{ type: 'text'|'image'|'video', content: String, order: Number }] }`
   - `GET /api/v1/connect/page/:pageId/subscription` — get subscription content (visible to all — it's a service listing)

   **Geo (for Advanced Discovery)**:
   - `GET /api/v1/geo/countries` — list of all countries with ISO codes
   - `GET /api/v1/geo/languages` — list of supported languages
   - `GET /api/v1/user/current-location` — returns verified city/country via reverse geocoding (Google Maps)

   **Views**:
   - `POST /api/v1/connect/page/:pageId/view` — record a page view (8-hour dedup)

5. **Chat System Extension**:
   - Add `connect_page` as a new chat type in `Chat.js` model
   - When a ConnectPage is created with groupChat=true: auto-create a Chat document with type `connect_page`, link via chatRoomId
   - When a user follows a page with groupChat: add them to chat participants array
   - When a user unfollows: remove them from chat participants array
   - Connect page group chats support: text, photos, audio messages (voice notes), videos (pre-recorded)
   - **NO video calls** in Connect page group chats
   - Reuse existing Socket.io infrastructure (rooms, events, typing indicators, read receipts)
   - Socket room pattern: `connect_page:{pageId}`

6. **Privacy Rules**:
   - Public pages: visible in search and suggestions, anyone can follow
   - Private pages: NOT in search results or suggestions, invite-only (follow requires approval — or just hidden for now)
   - Private page content (website, subscription): only visible to followers

**Prompt for implementation**:
```
Read the following files first:
- backend/src/models/Chat.js
- backend/src/controllers/chat.controller.js
- backend/src/routes/chat.routes.js
- backend/src/models/User.js
- backend/src/middleware/auth.js
- backend/src/socket/index.js

Then implement Task 1 from feature2.md — the backend foundation for Connect.

CRITICAL CONCEPT: There is NO separate Community model. Communities are just
ConnectPage documents with isAdminPage=true. The Find tab shows isAdminPage=false
pages, the Community tab shows isAdminPage=true pages. One model, one controller.

Create ConnectPage model, ConnectFollow model, ConnectPageView model.
Create connectController.js with all endpoints (CRUD, follow, search, content).
Create connectRoutes.js under routes/v1/.

For the chat extension:
- Add 'connect_page' to the Chat model's type enum
- When a ConnectPage is created with groupChat=true, auto-create a Chat document
  with type 'connect_page' and link it via chatRoomId
- When a user follows a page with groupChat, add them to chat participants
- When a user unfollows, remove them from chat participants

Mount connect routes at /api/v1/connect.
Mount geo routes at /api/v1/geo.
Follow existing patterns (auth middleware, error handling, mongoose).
Do NOT modify any existing working endpoints — only add new ones.
```

---

### TASK 2: Frontend — Connect Hub UI (Profile Section)

**Priority**: P0
**Depends on**: Task 1 (backend APIs)
**Files to create/modify**:
- `frontend/app/connect/index.tsx` (NEW — Connect Hub with 3 tabs)
- `frontend/app/connect/page/[id].tsx` (NEW — Connect page detail)
- `frontend/app/connect/create.tsx` (NEW — create Connect page form)
- `frontend/app/connect/search.tsx` (NEW — advanced discovery/search)
- `frontend/app/connect/_layout.tsx` (NEW — stack navigator)
- `frontend/services/connect.ts` (NEW — Connect API service)
- `frontend/components/ConnectCard.tsx` (NEW — connection card component)
- `frontend/app/(tabs)/profile.tsx` (MODIFY — add Connect section/button)

**What to build**:

1. **Connect Hub** (`connect/index.tsx`):
   - Three-tab layout: **Find** (default) | **Archived** | **Community**
   - Horizontal slide animation between tabs
   - **Find tab**: discovery screen to find **fellow USERS** with similar interests
     - Shows filter form FIRST (not a list):
       - "Which country's people would you like to connect with?" — searchable dropdown
       - "Which country should they currently be in?" — searchable dropdown
       - "Your Current Location" — read-only auto-detected chip (expo-location + reverse geocoding)
       - "Any Language *" — searchable dropdown, REQUIRED (Search button disabled until selected)
     - User fills filters → taps "Search" → results appear below as a paginated list
     - Results show **USERS** (not Connect pages) — avatar + username + FOLLOW button
     - Follow here = **follow the user's Taatom profile** (existing follow system, NOT ConnectFollow)
     - Empty results: "No matches found. Try broadening your filters."
     - GPS permission denied: "Unknown" location chip with "Retry" button
   - **Archived tab**: lazy-loaded list of archived pages (from GET /api/v1/connect/archived)
   - **Community tab**: paginated list of admin-created Connect pages (isAdminPage=true)
     - Source: GET /api/v1/connect/communities
     - Same ConnectCard component, same FOLLOW button behavior
   - FAB (+) button bottom-right: navigates to create.tsx
   - **Search icon (top right)**: searches for Connect pages by NAME
     - Opens a text search bar — user types a page name (e.g., "Tamil Travel")
     - Hits GET /api/v1/connect/search-by-name?q=... (text search on page name)
     - Results: ConnectCard list matching the query
     - This is a quick search for KNOWN pages, NOT the filter-based discovery (that's Find tab)
   - Header: "Connect" in serif typeface + magnifying glass icon (top right)

2. **ConnectCard Component** (`ConnectCard.tsx`):
   - Avatar (cached with fade-in) + page name label + FOLLOW/FOLLOWING pill button + kebab menu
   - Follow button: optimistic UI — updates immediately to "FOLLOWING", reverts on API failure with toast: "Unable to follow. Please check your connection."
   - Debounce: prevent multiple API calls on rapid tapping
   - Swipe left/right gesture to archive (moves card to Archived tab)
   - Tap card → navigate to `connect/page/[id].tsx`

3. **Connect Page Detail** (`connect/page/[id].tsx`):
   - Header: page name + options menu
   - **Followers count** (tappable → shows follower list)
   - **Dashboard button** (visible to owner only → navigates to analytics)
   - **FOLLOW / FOLLOWING button** (for visitors)
   - **3 feature sections** (shown based on page's enabled features):
     - **Website**: shows content blocks (read-only for visitors). Owner sees "Edit" button.
     - **Group Chat**: link that navigates to the group chat in the main chat screen
     - **Subscription**: shows service listing content (read-only for visitors). Owner sees "Edit" button. Has "Subscribe" button for visitors → shows "Coming Soon" modal.

4. **Follower List** (sub-screen or bottom sheet):
   - Paginated list of followers with avatar + name + Follow button (follow back)
   - Source: GET /api/v1/connect/page/:pageId/followers

5. **Profile Page Integration**:
   - Add a "Connect" section/button on `profile.tsx` (below existing content)
   - Tapping it navigates to `connect/index.tsx` via `router.push('/connect')`

**Prompt for implementation**:
```
Read the following files first:
- frontend/app/(tabs)/profile.tsx
- frontend/app/(tabs)/_layout.tsx
- frontend/services/profile.ts (API service pattern)
- frontend/services/chat.ts (service pattern)
- frontend/components/OptimizedPhotoCard.tsx (card component pattern)
- feature2.md (Task 2 + Connect Hub Flow section)

Then implement Task 2 from feature2.md — Connect Hub UI.

CRITICAL: The Community tab is NOT a separate entity. It shows ConnectPage documents
with isAdminPage=true. Use the same ConnectCard component for both Find and Community tabs.

Create the connect folder under frontend/app/ with:
- _layout.tsx (stack navigator)
- index.tsx (Connect Hub with 3 tabs: Find, Archived, Community)
- create.tsx (placeholder — populated in Task 3)
- search.tsx (placeholder — populated in Task 4)
- page/[id].tsx (Connect page detail)

Create ConnectCard.tsx in components/ — avatar + page name + FOLLOW pill + kebab menu.
Archive gesture: swipe left/right using react-native-gesture-handler.

Create connect.ts in services/.

Add a "Connect" button/section to profile.tsx that navigates to the Connect Hub.

Connect page detail: show Followers count, Dashboard (owner only), FOLLOW button,
and 3 feature sections (Website, Group Chat, Subscription).
Group Chat section is just a LINK — tapping it navigates to the chat screen.

Use @shopify/flash-list for all lists (not FlatList).
Use existing UI patterns. Use ThemeContext for ALL colors (theme.colors.primary, surface, text, etc.) — do NOT hardcode hex values. Support dark + light themes.
Do NOT refactor existing profile code — only add the Connect entry point.
```

---

### TASK 3: Create Connect Page + Content Builders

**Priority**: P0
**Depends on**: Task 1 (backend APIs), Task 2 (navigation)
**Files to modify**:
- `frontend/app/connect/create.tsx` (created in Task 2, populate here)
- `frontend/services/connect.ts` (MODIFY — add create + content API calls)
- `frontend/components/ContentBlockBuilder.tsx` (NEW — shared content builder for Website AND Subscription)

**What to build**:

1. **Create Connect Form** (`create.tsx`):
   - Form fields (use Formik + Yup for validation, matching existing patterns):
     - **Connect Name**: text input, required, 3-50 characters
     - **Connect Type**: binary toggle — Public / Private
     - **Profile Image**: image picker (1:1 crop) — triggers OS camera/gallery permission
     - **Bio**: multi-line text, optional, max 250 characters
   - Feature toggle chips (tap to enable/disable):
     - **Website**: enables content builder on the page
     - **Group Chat**: enables shared group chat for followers
     - **Subscription**: toggle exists but shows "Coming Soon" badge (payment deferred)
   - Cancel and Create buttons at bottom
   - Submit → POST /api/v1/connect/create → navigate to new page detail
   - Image upload: use existing image optimization pipeline (Multer → Cloudinary)

2. **ContentBlockBuilder Component** (`ContentBlockBuilder.tsx`):
   - **Shared component** used by BOTH Website and Subscription — they are the same thing with different labels
   - Website = "about me / my travels" display page
   - Subscription = "services I offer" display page
   - Two modes: **Edit** (owner only) and **Display** (everyone)
   - Three block types:
     - **Text**: multi-line text input (edit mode) / rendered text (display mode)
     - **Image**: image picker → Cloudinary upload → displayed image
     - **Video**: video picker → Cloudinary upload → video player
   - **+ button at bottom** with options: "Add Text" / "Add Image" / "Add Video"
   - **Up/down arrows** on each block to reorder (not full drag-and-drop)
   - Delete button on each block (edit mode only)
   - **No draft/publish** — owner taps Edit, makes changes, saves, content is live immediately
   - Save → PUT /api/v1/connect/page/:pageId/website (or /subscription)

3. **Subscription Section Specifics**:
   - Uses the exact same ContentBlockBuilder as Website — just a different content purpose
   - Creator lists the services they provide (text descriptions, images, videos)
   - Each service block will later support a **price field** and a **"Pay Now" button** — deferred to Phase 2 (payment integration)
   - For now: visitors see the service listing content + a "Subscribe" button
   - "Subscribe" button tapped → modal: "Subscription coming soon! Stay tuned."
   - No actual paywall or pricing — all content is visible to everyone for now
   - **Phase 2 plan**: add per-service pricing (₹ amount), "Pay Now" button per service, Cashfree payment flow

4. **Ad Slot Placeholder**:
   - In the Website display view, render a grey dashed-border placeholder box
   - Text: "Ad Space"
   - No AdMob integration — just the UI slot for later

**Prompt for implementation**:
```
Read the following files first:
- frontend/app/(tabs)/post.tsx (form + image upload patterns)
- frontend/components/AspectImageCropper.tsx (image crop pattern)
- frontend/utils/imageOptimization.ts (image processing)
- frontend/services/connect.ts (from Task 2)
- feature2.md (Task 3)

Then implement Task 3 from feature2.md — Create Connect Page + Content Builders.

Build the create.tsx form using Formik + Yup:
- Connect Name: required, minLength 3, maxLength 50
- Connect Type: Public/Private toggle
- Profile Image: use existing image picker + 1:1 crop (AspectImageCropper pattern)
- Bio: optional, maxLength 250
- Feature toggles: Website, Group Chat, Subscription (Subscription shows "Coming Soon")
- Cancel + Create buttons at bottom

Create ContentBlockBuilder.tsx — SHARED component for Website AND Subscription:
- Edit mode: add/delete/reorder text/image/video blocks
- Display mode: render blocks as read-only content
- + button at bottom: "Add Text" / "Add Image" / "Add Video"
- Up/down arrows to reorder (no drag-and-drop)
- For video: use expo-image-picker with mediaTypes video, upload to Cloudinary
- For images: use existing image upload pipeline

Subscription "Subscribe" button: shows "Coming Soon" modal. No payment.

Ad placeholder: grey dashed box with "Ad Space" text in Website display view.

Follow existing form patterns. Use existing image/video upload pipeline.
```

---

### TASK 4: Search & Discovery (Find Tab Filters + Name Search)

**Priority**: P1
**Depends on**: Task 1 (backend APIs + geo endpoints), Task 2 (Connect Hub shell)
**Files to modify**:
- `frontend/app/connect/index.tsx` (MODIFY — populate Find tab with filter form + results)
- `frontend/components/ConnectSearchBar.tsx` (NEW — name search bar triggered by search icon)
- `frontend/components/SearchableDropdown.tsx` (NEW — reusable dropdown for country/language filters)
- `frontend/services/connect.ts` (MODIFY — add search + geo API calls)

**What to build**:

1. **Find Tab — Filter-Based User Discovery** (inside `connect/index.tsx` Find tab):
   - The Find tab is NOT a list of suggestions — it's a **filter form** for discovering fellow travelers (USERS)
   - Filter fields shown first:
     - **"Which country's people would you like to connect with?"**: searchable dropdown
       - Type-ahead search: typing "Ind" shows "India" and "Indonesia" only
     - **"Which country should they currently be in?"**: searchable dropdown
     - **"Your Current Location"**: read-only chip showing current city (e.g., "Coimbatore")
       - Fetched via reverse geocoding (Google Maps API) on tab load
       - If GPS permission denied: show "Unknown" chip with "Retry" button
     - **"Any Language *"**: searchable dropdown — **required** (Search button disabled until selected)
   - **Search Button**: triggers GET /api/v1/connect/find-users with selected filters
   - **Results** appear below the filters as a paginated list of **USERS**:
     - Shows user avatar + username + FOLLOW button
     - Follow = **follow the user's Taatom profile** (uses existing profile follow system — POST /profile/follow, NOT ConnectFollow)
     - FOLLOW button hidden if already following that user's profile
   - **Selection Memory**: filters preserved when switching tabs and coming back
   - Empty results: "No matches found. Try broadening your filters."

2. **Search Icon (Top Right) — Name Search** (`ConnectSearchBar.tsx`):
   - Tapping the magnifying glass icon opens a text search bar at the top
   - User types a Connect page name (e.g., "Tamil Travel", "KavinKumar")
   - Hits GET /api/v1/connect/search-by-name?q=... (text search on ConnectPage.name)
   - Results: paginated ConnectCard list matching the query
   - This is a **quick lookup for known pages** — different from the filter-based Find tab
   - Close/cancel returns to the previous tab view

3. **Backend — New Endpoints**:
   - `GET /api/v1/connect/search-by-name?q=<query>` — text search on ConnectPage name field (for Search icon)
     - Uses MongoDB text index on name field
     - Returns paginated ConnectPage results, excludes private pages
     - Includes isFollowing boolean (checked against ConnectFollow)
   - `GET /api/v1/connect/find-users?target_country=X&current_country=Y&lang=Z` — user discovery (for Find tab)
     - Queries User model with country/language/location filters
     - Returns user profiles (avatar, username, bio)
     - Includes isFollowing boolean (checked against existing profile follow system)
     - Does NOT query ConnectPage model — this finds users, not pages

4. **Searchable Dropdown** (`SearchableDropdown.tsx`):
   - Reusable component for country and language filter fields
   - Full-screen modal with TextInput at top + filtered FlashList below
   - Type-ahead filtering on the list
   - Tap an item to select → modal closes → selection shown as chip

5. **Geo Data**:
   - Countries list from GET /api/v1/geo/countries
   - Languages list from GET /api/v1/geo/languages
   - Current location from expo-location + Google reverse geocoding

**Prompt for implementation**:
```
Read the following files first:
- frontend/app/connect/index.tsx (Connect Hub from Task 2)
- frontend/services/connect.ts
- frontend/services/location.ts (existing location patterns)
- feature2.md (Task 4 + Connect Hub Flow section)

Then implement Task 4 from feature2.md — Search & Discovery.

TWO separate search mechanisms with DIFFERENT follow actions:

1. FIND TAB (filter-based USER discovery):
   - The Find tab shows a filter FORM, not a list
   - 4 filter fields: target country, current country, location (auto), language (required)
   - User fills filters → taps Search → results appear below
   - Results: paginated list of USERS from GET /api/v1/connect/find-users
   - Follow button = follow user's TAATOM PROFILE (existing follow system)
   - Use existing profile follow API (NOT ConnectFollow)

2. SEARCH ICON (top right, Connect page name search):
   - Opens a text search bar overlay
   - User types page name → results from GET /api/v1/connect/search-by-name?q=...
   - Results: ConnectCard list (Connect pages, NOT users)
   - Follow button = follow the CONNECT PAGE (ConnectFollow system)
   - Quick lookup for known pages

Create SearchableDropdown.tsx — reusable full-screen modal with type-ahead filtering.
Create ConnectSearchBar.tsx — text search bar for the search icon.

Backend: add two endpoints to connectController.js:
- GET /api/v1/connect/search-by-name?q=... (searches ConnectPage.name)
- GET /api/v1/connect/find-users?target_country&current_country&lang (searches User model)

Handle GPS failure: "Unknown" chip + "Retry" button.
Handle no results: "No matches found. Try broadening your filters."
Use ThemeContext for ALL colors. Support dark + light themes.
```

---

### TASK 5: Messaging Integration for Connect Pages

**Priority**: P1
**Depends on**: Task 1 (chat type extension), Task 2 (Connect page detail)
**Files to modify**:
- `backend/src/controllers/chat.controller.js` (MODIFY — connect_page chat logic)
- `backend/src/socket/index.js` (MODIFY — connect_page room events)
- `frontend/app/connect/page/[id].tsx` (MODIFY — add Group Chat link)
- `frontend/services/chat.ts` (MODIFY — add connect_page chat calls)
- `frontend/app/chat/index.tsx` (MODIFY — show connect_page chats in chat list)

**What to build**:

1. **Connect Page Group Chat**:
   - Auto-created when page creator enables groupChat feature (handled in Task 1 backend)
   - All followers auto-join the chat room (handled in Task 1 follow endpoint)
   - **One shared group chat** per Connect page — all followers are in the same room
   - Supports: text, photos, audio messages (voice notes), videos (pre-recorded)
   - **NO video calls** — explicitly disabled for Connect page chats
   - Voice notes: microphone icon in input bar, press-and-hold to record, release to send

2. **Chat List Integration** (main chat screen):
   - Connect page group chats appear in the main chat list (`chat/index.tsx`)
   - Distinguished by a "Connect" badge/label on the chat item
   - Shows the Connect page name as the chat title (not individual usernames)
   - Shows the Connect page avatar as the chat avatar
   - Sorted by most recent message like regular chats
   - User does NOT need to go to the Connect page to access the chat — it's right in the chat list

3. **Connect Page Detail Link**:
   - The "Group Chat" section on the Connect page detail is just a link/button
   - Tapping it navigates to the specific group chat in the main chat screen
   - This is a convenience link — the chat is always accessible from the main chat list

4. **Socket.io Integration**:
   - Reuse existing socket infrastructure
   - New room pattern: `connect_page:{pageId}` for Connect page group chats
   - Events: message, typing, read receipt (reuse existing event patterns)
   - On follow: auto-join the page's socket room
   - On unfollow: auto-leave the socket room

**Prompt for implementation**:
```
Read the following files first:
- backend/src/controllers/chat.controller.js
- backend/src/socket/index.js
- backend/src/models/Chat.js
- frontend/app/chat/index.tsx
- frontend/services/chat.ts
- frontend/services/socket.ts
- feature2.md (Task 5)

Then implement Task 5 from feature2.md — Messaging Integration.

The backend chat extension (model + follow/unfollow participant management) is
already done in Task 1. This task focuses on the FRONTEND integration.

In chat/index.tsx:
- Fetch connect_page chats alongside regular chats
- Show them with a "Connect" badge and the page name/avatar
- Sort by most recent message

In connect/page/[id].tsx:
- The "Group Chat" section is a tappable link
- Tapping navigates to chat screen, opening the specific connect_page chat
- Use router.push('/chat', { chatId: page.chatRoomId })

Voice notes: add microphone icon to chat input bar (press-hold to record).
Use expo-av Audio.Recording for voice note capture.
Upload voice note to Cloudinary, send URL as audio message type.

Do NOT break existing chat functionality. Only extend.
```

---

### TASK 6: Analytics Dashboard (Creator View)

**Priority**: P1
**Depends on**: Task 1 (backend + view tracking), Task 2 (Connect page detail)
**Files to create**:
- `frontend/app/connect/analytics.tsx` (NEW — analytics dashboard screen)
- `backend/src/controllers/connectAnalyticsController.js` (NEW)
- `backend/src/routes/v1/connectAnalyticsRoutes.js` (NEW)
- `frontend/services/connectAnalytics.ts` (NEW)

**What to build**:

1. **Analytics Dashboard** (`connect/analytics.tsx`):
   - Accessible from Connect page detail via "Dashboard" button (page **owner only**)
   - **Metrics displayed** (no financial section):
     - Total Views counter (large display number)
     - Pie Chart: Green = Followers, Red = Non-Followers who viewed (potential conversions)
     - Growth Velocity: Follows vs Unfollows today, Net Gain/Loss
     - Line Chart: 24-hour follower change timeline (scrubbable with tooltips)
   - Charts: use react-native-svg for pie chart, line chart

2. **View Counting Rules** (implemented in ConnectPageView model from Task 1):
   - 1 view per user per page per 8-hour window
   - Same page within 8 hours = no additional view counted
   - After 8 hours = new view counted

3. **Backend Endpoints**:
   - `GET /api/v1/connect/analytics/:pageId/overview` — views count + follower/non-follower ratio
   - `GET /api/v1/connect/analytics/:pageId/timeseries` — 24-hour follower change data (hourly buckets)
   - Protected: only the page owner can access their analytics

**Prompt for implementation**:
```
Read the following files first:
- SuperAdmin/src/pages/ (any page with charts — for chart patterns)
- frontend/services/profile.ts (API service pattern)
- feature2.md (Task 6)

Then implement Task 6 from feature2.md — Analytics Dashboard.

Create the analytics screen accessible from Connect page detail (owner only).
Use react-native-svg for charts (pie chart, line chart).

NO financial section — just views, followers, and growth.

View counting: use ConnectPageView model (created in Task 1).
Query views grouped by unique userId to get total unique viewers.
Followers vs non-followers: cross-reference viewers with ConnectFollow collection.

Pie chart: theme.colors.success for followers, theme.colors.error for non-followers.
Line chart: 24-hour timeline, X axis = hours, Y axis = net follower change.
Use ThemeContext for ALL colors — support dark + light themes.

Backend: create connectAnalyticsController.js with overview and timeseries endpoints.
Mount routes at /api/v1/connect/analytics.
Only the page owner (userId matches) can access — 403 for others.
```

---

### TASK 7: SuperAdmin — Connect Management

**Priority**: P2
**Depends on**: Task 1 (backend models)
**Files to create/modify**:
- `SuperAdmin/src/pages/ConnectPages.tsx` (NEW — manage all Connect pages)
- `SuperAdmin/src/services/connectService.ts` (NEW)
- `backend/src/controllers/superAdminController.js` (MODIFY — add connect admin endpoints)
- `backend/src/routes/enhancedSuperAdminRoutes.js` (MODIFY — add connect routes)

**What to build**:

1. **Connect Pages Management** (`ConnectPages.tsx`):
   - Table of ALL Connect pages (both user-created and admin-created)
   - Columns: name, creator, type (public/private), isAdminPage, follower count, status, created date
   - Filter by: status, type, isAdminPage (user vs admin pages)
   - Actions per row: view, suspend, restore
   - **Create Admin Page** button: creates a ConnectPage with isAdminPage=true (shown in Community tab)
   - **Set as Default** toggle: mark pages as isDefault=true (shown to new users)
   - **Buy Items** section (for admin pages only): add/edit up to 5 purchasable items (name, description, price, image)

2. **Default Pages Setup**:
   - Admin marks certain pages as "default" (isDefault=true)
   - These pages appear in the Find tab for new users who haven't followed anything yet
   - Once a user follows their first page, defaults are no longer force-shown

**Prompt for implementation**:
```
Read the following files first:
- SuperAdmin/src/pages/ (any existing page for patterns — layout, table, sidebar)
- backend/src/controllers/superAdminController.js
- backend/src/routes/enhancedSuperAdminRoutes.js
- feature2.md (Task 7)

Then implement Task 7 from feature2.md — SuperAdmin Connect Management.

Create ConnectPages.tsx following existing SuperAdmin page patterns.
Use react-table for tables. Add to SuperAdmin sidebar navigation.

This is ONE page managing ALL Connect pages (no separate Communities page needed).
Filter by isAdminPage to distinguish user vs admin pages.

Admin page creation: form with name, type, bio, profileImage, features toggles.
Sets isAdminPage=true automatically.

Buy items (admin pages only): form to add/edit items (name, description, price, image).
Max 5 items — validation prevents adding more.

Default pages: toggle isDefault on any page.

Backend admin endpoints:
- GET /api/v1/superadmin/connect-pages (list all, paginated, filterable)
- POST /api/v1/superadmin/connect-pages (create admin page with isAdminPage=true)
- PUT /api/v1/superadmin/connect-pages/:id (edit page, toggle isDefault, manage buyItems)
- PUT /api/v1/superadmin/connect-pages/:id/suspend
- PUT /api/v1/superadmin/connect-pages/:id/restore

Protected by existing RBAC middleware.
```

---

### TASK 8: QA & Edge Case Verification

**Priority**: P1
**Depends on**: All above tasks
**No new files** — testing existing implementation

**Test Matrix**:

| # | Test Case | Expected Result | Priority |
|---|-----------|----------------|----------|
| 1 | No follows — first visit to Connect Hub | Default pages (isDefault=true) shown in Find tab | P0 |
| 2 | Rapid-tap Follow button | Only one API call fires (debounced) | P0 |
| 3 | Avatar image fails to load | Consistent fallback placeholder image | P1 |
| 4 | Follow → optimistic UI → API failure | Reverts to "FOLLOW", toast: "Unable to follow" | P0 |
| 5 | Create page with 50-char name | Name wraps or truncates with ellipsis, no overflow | P1 |
| 6 | Upload 10MB+ profile image | Client-side compression before upload, progress bar | P1 |
| 7 | Network timeout during page creation | Progress bar + retry, no duplicate creation | P1 |
| 8 | GPS permission denied on search | "Unknown" location chip with Retry button | P0 |
| 9 | Search with no matches | "No matches found. Try broadening your filters" | P0 |
| 10 | Private page in search | Private pages do NOT appear in search results | P0 |
| 11 | Swipe to archive a page | Card moves to Archived tab, removed from Find | P0 |
| 12 | Unarchive a page | Card restored to Find tab | P1 |
| 13 | Follow page with groupChat → check chat list | Group chat appears in main chat list with "Connect" badge | P0 |
| 14 | Send text in Connect group chat | Message delivered to all followers in chat | P0 |
| 15 | Voice note in Connect group chat | Audio records, uploads, plays back in chat bubble | P1 |
| 16 | Video call attempt in Connect chat | Feature is disabled / button not present | P0 |
| 17 | Unfollow page → check chat list | Group chat removed from main chat list | P0 |
| 18 | Analytics — zero state | Views shows 0, pie chart empty/placeholder, no NaN | P1 |
| 19 | Analytics — non-owner access | Dashboard button not visible, API returns 403 | P0 |
| 20 | Website builder — add text + image + video | Blocks render in order, reorderable with arrows | P1 |
| 21 | Subscription — tap Subscribe button | Shows "Coming Soon" modal, no payment triggered | P0 |
| 22 | Community tab — shows admin pages only | Only isAdminPage=true pages appear here | P0 |
| 23 | User creates multiple Connect pages | All pages appear in GET /api/v1/connect/my-pages | P0 |
| 24 | Admin Buy feature — 5 items max | Cannot add 6th item, validation error | P1 |
| 25 | Offline — follow action | Queue action, sync on reconnect | P2 |
| 26 | View counting — same page within 8hrs | View count does NOT increment on repeat visit | P1 |
| 27 | View counting — same page after 8hrs | View count increments | P1 |

**Prompt for QA**:
```
Read feature2.md (Task 8) for the full test matrix.

Manually test each case in this order (P0 first, then P1, then P2).
For each test:
1. Describe the steps taken
2. Note the actual result
3. Mark PASS or FAIL
4. If FAIL, document the bug in .claude/bugs.md with root cause and fix

Focus on:
- Follow/unfollow optimistic UI correctness
- Chat integration (group chat appears/disappears with follow/unfollow)
- Search filter behavior and GPS handling
- Privacy enforcement (private pages hidden from search)
- Content builder (text + image + video blocks, reorder)
- Community tab shows ONLY admin pages
- Edge cases: empty states, long text, large images, network failures
```

---

## Implementation Order

```
Task 1 (Backend — Models & APIs)
  |
  +---> Task 2 (Connect Hub UI + Page Detail)
  |       |
  |       +---> Task 3 (Create Page + Content Builders)
  |       |
  |       +---> Task 4 (Advanced Discovery / Search)
  |
  +---> Task 5 (Messaging Integration)
  |
  +---> Task 6 (Analytics Dashboard)
  |
  +---> Task 7 (SuperAdmin Management)
  |
  +---> Task 8 (QA — after all above)
```

Start with Task 1 (backend) since all frontend work depends on the APIs and models being in place.

---

## Design Tokens — MUST Match Existing App Theme

**CRITICAL**: Do NOT use the BSD's suggested colors (#3B82F6, #22C55E, #EF4444). Use the existing app theme from `frontend/context/ThemeContext.tsx`. All Connect screens must look like they belong in the existing app.

### Use ThemeContext (NOT hardcoded colors)
Always access colors via `useTheme()` hook → `theme.colors.*`. Never hardcode hex values.

| What | Use This (from ThemeContext) | NOT This (from BSD) |
|------|------------------------------|---------------------|
| Buttons, links, FOLLOW pill | `theme.colors.primary` (#0A84FF) | ~~#3B82F6~~ |
| Success states, follower chart | `theme.colors.success` (#34C759) | ~~#22C55E~~ |
| Errors, non-follower chart | `theme.colors.error` (#FF453A) | ~~#EF4444~~ |
| Backgrounds | `theme.colors.background` / `theme.colors.surface` | — |
| Text | `theme.colors.text` / `theme.colors.secondaryText` | — |
| Accent | `theme.colors.accent` (#00D4FF) | — |

### Spacing & Layout (from ThemeContext)
| Token | Value | ThemeContext Key |
|-------|-------|-----------------|
| xs | 6px | `theme.spacing.xs` |
| sm | 10px | `theme.spacing.sm` |
| md | 16px | `theme.spacing.md` |
| lg | 24px | `theme.spacing.lg` |
| xl | 32px | `theme.spacing.xl` |

### Border Radius (from ThemeContext)
| Token | Value | ThemeContext Key |
|-------|-------|-----------------|
| sm | 10px | `theme.borderRadius.sm` |
| md | 14px | `theme.borderRadius.md` |
| lg | 16px | `theme.borderRadius.lg` |
| xl | 22px | `theme.borderRadius.xl` |
| pill/full | 9999px | `theme.borderRadius.full` |

### Typography (from ThemeContext)
| Style | Size | Weight |
|-------|------|--------|
| h1 | 32px | 800 |
| h2 | 24px | 700 |
| h3 | 18px | 700 |
| body | 15px | 400 |
| caption | 13px | 400 |
| small | 12px | 400 |

### Styling Rules
- Use `StyleSheet.create()` for all styles (existing pattern — no styled-components)
- Support both **dark and light themes** — use `theme.colors.*` not hardcoded colors
- Shadows: use `theme.shadows.small/medium/large`
- Min touch target: 44x44px (WCAG AA)
- FOLLOW pill: `theme.borderRadius.full` + `theme.colors.primary` bg
- Cards: `theme.colors.surface` bg + `theme.borderRadius.lg` + `theme.shadows.small`
- Font scaling: respect `getScaledFontSize()` from ThemeContext

---

## Existing Code That Will Be Reused

| What | File | Why |
|------|------|-----|
| Chat model | `backend/src/models/Chat.js` | Extend with connect_page type |
| Chat controller | `backend/src/controllers/chat.controller.js` | Reuse message logic |
| Chat routes | `backend/src/routes/chat.routes.js` | Existing chat patterns |
| Socket.io setup | `backend/src/socket/index.js` | Reuse room/event infrastructure |
| Profile screen | `frontend/app/(tabs)/profile.tsx` | Add Connect entry point |
| Chat screen | `frontend/app/chat/index.tsx` | Show connect_page chats in list |
| Chat service | `frontend/services/chat.ts` | Extend with connect_page calls |
| Socket service | `frontend/services/socket.ts` | Reuse socket connection |
| Image optimization | `frontend/utils/imageOptimization.ts` | Image upload in content builder |
| AspectImageCropper | `frontend/components/AspectImageCropper.tsx` | 1:1 crop for page avatar |
| Auth middleware | `backend/src/middleware/auth.js` | Protect new endpoints |
| Notification system | `backend/src/controllers/notificationController.js` | Follow notifications |
| SuperAdmin pages | `SuperAdmin/src/pages/*` | Pattern for ConnectPages admin page |

---

## What Is Deferred (Not In This Phase)

| Feature | Reason | When |
|---------|--------|------|
| Cashfree payment gateway | Payment integration deferred | Phase 2 |
| Actual subscription collection | Depends on Cashfree | Phase 2 |
| Revenue payouts (29th/30th) | Depends on Cashfree | Phase 2 |
| TDS calculation | Depends on actual revenue | Phase 2 |
| Content paywall enforcement | Depends on subscription payment | Phase 2 |
| Financial analytics (revenue, net, payouts) | Depends on payment | Phase 2 |
| Google AdMob integration | Ads deferred, placeholder slots only | Phase 2 |
| TAATOM private ads | Depends on ad infrastructure | Phase 2 |
| Per-service pricing + "Pay Now" button | Subscription services will have individual prices + Pay Now button | Phase 2 |
| Buy item payment processing | Payment deferred, form only | Phase 2 |
| Video calls | Explicitly NOT available in Connect | Never (per BSD) |
| Full drag-and-drop | Using up/down arrows instead | Future enhancement |

---

## Constraints

- Must NOT affect existing features (chat, posts, profile, etc.)
- Must integrate with current codebase structure
- Reuse existing UI patterns and components (FlashList, Formik, Yup, etc.)
- Follow existing auth (JWT), error handling, and caching patterns
- Chat extension must NOT break existing 1-on-1 and group chat
- Do NOT rename variables, files, or refactor working code
- Do NOT touch package.json / app.json unless flagged to user first
- State management: use React Context for Connect state (matching existing pattern — NOT Redux/Zustand as BSD suggested)
- **Theme**: ALL screens MUST use ThemeContext (`useTheme()` hook) for colors, spacing, typography, shadows. Must support dark + light themes. Do NOT hardcode hex colors. Connect screens must look like they belong in the existing app.
- NO separate Community model — communities are ConnectPage with isAdminPage=true
- TWO follow systems in Connect: ConnectFollow (for following Connect pages via Search icon & Community tab) AND existing profile follow (for following users via Find tab)

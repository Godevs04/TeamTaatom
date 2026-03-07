# Activity, Search & TripScore – Developer Guide

Documentation for **Activity feed**, **Search**, and **TripScore** flows.

---

## 1. Activity Module

**Screen:** `app/activity/index.tsx`.

**Purpose:** Show activity feed (post_created, post_liked, comment_added, etc.) for current user or another user.

**API:**

- GET `/api/v1/activity` – current user activity (params: page?, limit?, type?).
- GET `/api/v1/activity/user/${userId}` – activity for specific user.
- PUT `/api/v1/activity/privacy` – set activity feed public/private (body: { isPublic }).

**Service:** `services/activity.ts` (getActivity, getUserActivity, updateActivityPrivacy).

**Types:** Activity items with type, actor, target (post/comment), timestamp.

---

## 2. Search Module

**Screen:** `app/search.tsx`.

**Purpose:** Search posts (and optionally locations); filters: q, hashtag, location, date, type; pagination.

**API:**

- GET `/api/v1/search/posts` – search posts (params: q, hashtag, location, startDate, endDate, type, page, limit).
- GET `/api/v1/search/location` – search locations (params: q, etc.).

**Service:** `services/search.ts` (searchPosts, searchLocation).

**Types:** PostType[] for posts; location shape from backend.

---

## 3. TripScore Module

**Screens:** `app/tripscore/` – continents list → `continents/[continent]/countries` → `countries/[country]` → `countries/[country]/locations` → `countries/[country]/locations/[location]` (detail) or `countries/[country]/map`.

**Purpose:** Browse travel data by continent → country → locations; view location detail; show on map; link to user’s TripScore from profile.

**API (profile-based):**

- GET `/api/v1/profile/${userId}/tripscore/continents`
- GET `/api/v1/profile/${userId}/tripscore/continents/${continent}/countries`
- GET `/api/v1/profile/${userId}/tripscore/countries/${country}`
- GET `/api/v1/profile/${userId}/tripscore/countries/${country}/locations`
- GET `/api/v1/profile/${userId}/travel-map`

**Service:** `services/profile.ts` (getTripscoreContinents, getTripscoreCountries, getTripscoreCountry, getTripscoreLocations, getTravelMap).

**Logic:** Hierarchical navigation; save/location actions may call backend (e.g. save location in tripscore flow).

---

## 4. Hashtags

**Screen:** `app/hashtag/[hashtag].tsx`.

**API:**

- GET `/api/v1/hashtags/search?q=&limit=`
- GET `/api/v1/hashtags/trending?limit=`
- GET `/api/v1/hashtags/${hashtagName}`
- GET `/api/v1/hashtags/${hashtagName}/posts?page=&limit=`

**Service:** `services/hashtags.ts`.

---

## 5. File Map

| Area | Files |
|------|--------|
| Activity | `app/activity/index.tsx`, `services/activity.ts` |
| Search | `app/search.tsx`, `services/search.ts` |
| TripScore | `app/tripscore/**/*.tsx`, `services/profile.ts` (tripscore methods) |
| Hashtags | `app/hashtag/[hashtag].tsx`, `services/hashtags.ts` |

---

## 6. Activity – API & types (technical)

- **getActivity(params):** GET /api/v1/activity with page, limit, type (optional filter). Returns list of activity items (e.g. post_created, post_liked, comment_added, follow). Each item: type, actor (user), target (post/comment), timestamp, metadata.
- **getUserActivity(userId):** GET /api/v1/activity/user/${userId} for public activity of another user.
- **updateActivityPrivacy(isPublic):** PUT /api/v1/activity/privacy body { isPublic }. Toggles whether activity feed is visible to others.
- **Screen:** activity/index.tsx loads getActivity(); list or group by date; tap item → navigate to post or profile. Use theme and useAlert for errors.

---

## 7. Search – API & params (technical)

- **searchPosts(params):** GET /api/v1/search/posts with q, hashtag, location, startDate, endDate, type (e.g. 'photo' | 'short'), page, limit. Returns posts array and pagination.
- **searchLocation(q):** GET /api/v1/search/location with query; returns list of places (for place picker or location filter).
- **Screen:** search.tsx has search input and filters; on submit/search call searchPosts; display results in list/grid; tap post → navigate to post or home?postId=.

---

## 8. TripScore – hierarchy & endpoints (technical)

- **Continents:** GET /api/v1/profile/${userId}/tripscore/continents → list of continents (e.g. names or codes).
- **Countries by continent:** GET /api/v1/profile/${userId}/tripscore/continents/${continent}/countries.
- **Country detail:** GET /api/v1/profile/${userId}/tripscore/countries/${country}.
- **Locations by country:** GET /api/v1/profile/${userId}/tripscore/countries/${country}/locations.
- **Travel map:** GET /api/v1/profile/${userId}/travel-map (locations with coords, stats).
- **Screens:** tripscore/continents → [continent]/countries → [country] (detail) → locations list or map; [country]/locations/[location] for single location detail; [country]/map for map view. All use profile service; userId from route or current user.

---

## 9. Hashtags – API (technical)

- **searchHashtags(q, limit):** GET /api/v1/hashtags/search. For @-style or discovery.
- **getTrendingHashtags(limit):** GET /api/v1/hashtags/trending.
- **getHashtag(name):** GET /api/v1/hashtags/${hashtagName} (hashtag metadata).
- **getHashtagPosts(name, page, limit):** GET /api/v1/hashtags/${hashtagName}/posts.
- **Screen:** hashtag/[hashtag].tsx uses getHashtag and getHashtagPosts; displays posts grid for that hashtag.

---

## 10. File map (detailed)

| Area | Files |
|------|--------|
| Activity | app/activity/index.tsx, services/activity.ts |
| Search | app/search.tsx, services/search.ts |
| TripScore | app/tripscore/** (continents, countries, locations, map), services/profile.ts (tripscore methods, getTravelMapData) |
| Hashtags | app/hashtag/[hashtag].tsx, services/hashtags.ts |

---

*Locale (places): [05-LOCALE-MODULE.md](./05-LOCALE-MODULE.md). Profile: [03-PROFILE-MODULE.md](./03-PROFILE-MODULE.md). API: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*

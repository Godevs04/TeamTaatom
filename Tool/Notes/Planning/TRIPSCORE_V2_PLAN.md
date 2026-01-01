Cursor Prompt – Implement TripScore v2 (Verified Travel-Based Scoring)

You are an AI pair programmer working on the TeamTaatom codebase.
Your task is to upgrade the TripScore system from a simple “count posts with location” model to a verified, fraud-resistant, visit-based model (TripScore v2).
This change must work for both Posts and Shorts, and must integrate with frontend (React Native app), backend (Express + MongoDB), and SuperAdmin analytics.

Please read and respect the existing documentation before making changes:

Tool/Notes/TRIPSCORE_DOCUMENTATION.md

Tool/Notes/TeamTaatom_Business_Documentation.md (TripScore, analytics, travel stats context)

Tool/Notes/TeamTaatom_Development_Guide.md (routes, v1 API, infra, superAdmin, analytics)

1. High-Level Goal

Current behavior (TripScore v1)

TripScore is calculated directly from the Post collection.

Every post with valid coordinates (location.coordinates.latitude/longitude ≠ 0, isActive: true) adds +1 to:

total TripScore,

continent score,

country score,

location score.

Multiple posts at the same location all increase the score.

Manual locations count the same as GPS/EXIF locations.

No fraud / realism checks.

Required behavior (TripScore v2 – new design):

TripScore is based on visits, not posts

Introduce a TripVisit model that represents a single travel visit (derived from posts/shorts).

Deduplicate by unique place (city/country/coordinates) per user.

Location trust system

Every visit has:

source: how location was determined
(taatom_camera_live, gallery_exif, gallery_no_exif, manual_only)

trustLevel:
high | medium | low | unverified | suspicious

TripScore should only count visits with high or medium trust
(optional minimal/capped impact for low).

Old travel support (backfill)

Users can upload old photos (1–3 years back) with EXIF GPS.

Those visits should be included in TripScore if realistic.

Basic fraud prevention

Detect impossible travel (e.g., unrealistic speeds between visits).

Limit impact of manual-only locations or excessively edited locations.

Cap the number of low-trust visits that can affect score.

Impact across the app

Posts + Shorts: new visits must be created for both.

Frontend TripScore screens (continents/countries/locations) must now read from TripVisit-based APIs but keep UX and routes the same.

Profile TripScore card still works as before, but value now comes from v2 logic.

SuperAdmin analytics should show basic metrics for TripScore v2 (trust breakdown, suspicious visits, etc.). 

TeamTaatom_Business_Documentati…

2. Backend Changes (Express + MongoDB)
2.1 Create TripVisit model

Task:

Add a new Mongoose model TripVisit in backend/src/models/TripVisit.js (or an equivalent directory used for models).

Fields (minimum):

user – ObjectId → reference to User

post – ObjectId → reference to Post or Short (can consider a contentType field: 'post' | 'short')

contentType – String ('post' | 'short')

lat, lng – Number

continent – String (ASIA, EUROPE, etc.)

country – String

city – String (optional if available)

source – String: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only'

trustLevel – String: 'high' | 'medium' | 'low' | 'unverified' | 'suspicious'

takenAt – Date (from EXIF or in-app capture, can be null)

uploadedAt – Date (from post/short createdAt)

createdAt – Date (TripVisit creation timestamp)

Add sensible indexes:

{ user: 1, continent: 1, country: 1 }

{ user: 1, takenAt: 1 }

{ user: 1, trustLevel: 1 }

2.2 Derive TripVisits from Posts & Shorts

Context:
Currently TripScore is computed directly in backend/src/controllers/profileController.js via Post queries.

Task:

Create a helper module, e.g.
backend/src/services/tripVisitService.js

Functions to implement:

createTripVisitFromPost(post)

updateTripVisitFromPost(post)

(Optionally) createTripVisitFromShort(short), updateTripVisitFromShort(short)

Hook these into existing flows:

After a Post is created/updated (location changes), call into tripVisitService.

After a Short with location is created/updated, also call into tripVisitService.

Handle soft delete (isActive: false) by either:

Marking TripVisit as inactive, or

Excluding such visits in TripScore queries.

2.3 Determine source and trustLevel

Use the functional rules we decided:

Sources:

taatom_camera_live

Post or short created via in-app camera (Taatom camera component) with live GPS.

gallery_exif

Media picked from gallery, EXIF GPS present and parsed.

gallery_no_exif

Media from gallery, no EXIF GPS; user selects location via map/search.

manual_only

No EXIF, no automatic GPS; user directly types or selects location without evidence.

TrustLevel:

taatom_camera_live → high (unless later flagged).

gallery_exif → default medium, can be upgraded/downgraded:

If EXIF timeline vs previous trusted visit shows impossible travel → mark as suspicious.

If overall pattern is realistic → keep as medium (or optionally upgrade to high if needed later).

gallery_no_exif → low by default.

manual_only → unverified.

Implement a function like:

assignTrustLevel(visit, userPreviousVisits)

Check distance vs time and mark obviously impossible jumps as suspicious.

Optionally enforce per-day caps on new low and medium trust visits that contribute to score.

You don’t need to implement a full ML system—just simple, rule-based checks.

2.4 Migrate old data (existing posts)

Task:

Implement a one-time script or background job (using existing job system if available) that:

Reads all existing posts with valid location (location.coordinates not 0, isActive: true).

Creates corresponding TripVisit entries:

source:

If we can detect EXIF-backed locations → gallery_exif

Else → gallery_no_exif or manual_only depending on how the post was created

trustLevel based on the rules above (be conservative but not too strict)

takenAt: if EXIF available, else fallback to createdAt

uploadedAt: createdAt of the post

Scope can be limited to active users or all posts depending on performance.

2.5 Update TripScore backend controllers

Currently, TripScore endpoints are in backend/src/controllers/profileController.js and related routes:

getProfile()

getTripScoreContinents()

getTripScoreCountries()

getTripScoreCountryDetails()

getTripScoreLocations()

Task:

Refactor these controllers to query TripVisit instead of Post for TripScore calculations.

New rules:

Only include visits where:

trustLevel in ['high', 'medium'] (for main TripScore).

Optionally allow low with small weight / caps (if implemented).

Use unique places per user:

For scoring at location level, group by (lat, lng) or (continent, country, city) as per existing design.

Do not add extra score for multiple posts/shorts at same location.

Keep the existing API response shapes the same so frontend doesn’t break:

Total TripScore

Continent list with score & distance

Country list with scores

Locations with scores, dates, categories

Ensure distance calculation still works by using the chronological sequence of unique visits (you can reuse existing Haversine logic and distance aggregation). 

TRIPSCORE_DOCUMENTATION

3. Frontend Changes (React Native + Expo)

Key files mentioned in existing docs:

Profile:

frontend/app/(tabs)/profile.tsx

frontend/app/profile/[id].tsx

TripScore screens:

frontend/app/tripscore/continents/index.tsx

frontend/app/tripscore/continents/[continent]/countries.tsx

frontend/app/tripscore/countries/[country]/index.tsx

frontend/app/tripscore/countries/[country]/locations/index.tsx

frontend/app/tripscore/countries/[country]/locations/[location].tsx

Services:

frontend/services/profile.ts (TripScore-related API calls)

Goal:
Frontend should not require major UX changes. It should:

Consume updated TripScore v2 APIs (same endpoints, new internals).

Optionally display trust / verification badges in a subtle way.

3.1 Profile TripScore card

Task:

Confirm that profile TripScore card still calls the same getProfile() API.

Ensure it correctly displays the v2 TripScore from backend (no logic change needed beyond verifying new field meaning).

3.2 TripScore detail screens

Task:

Ensure TripScore detail screens keep working with updated data:

Continents view

Countries per continent

Location lists & detail

No major UI changes needed, but optionally:

In Location detail view, add a small label such as:

“Verified visit” if the underlying visits are high/medium trust.

“User-added location (may not count fully in TripScore)” for low/unverified.

This can be driven by an additional field from the backend if needed (e.g., dominant trustLevel for that location).

3.3 Posts & Shorts upload flow

Task:

Review post & shorts creation screens and flows:

Post upload: image/video, caption, location tagging. 

TeamTaatom_Business_Documentati…

Shorts upload: similar logic.

Ensure we:

Encourage allowing GPS (for better TripScore).

Clarify with text like:

“Locations detected from your device or photo metadata contribute to your TripScore. Manual locations may show on your map but may not fully increase your score.”

This text can be small, e.g., under the location picker.

No deep code rewrite needed here; just ensure location data is sent consistently so backend can derive TripVisits correctly.

4. SuperAdmin Changes

SuperAdmin already has analytics dashboards and query monitor. 

TeamTaatom_Business_Documentati…

Goal:
Add basic TripScore v2 visibility so admins/founders can monitor:

Overall TripScore health.

Fraud patterns.

4.1 New SuperAdmin widgets

Task:

Add a TripScore Analytics section to SuperAdmin (extend existing dashboard pages):

Suggested metrics:

Total number of TripVisit records.

Breakdown by trustLevel (high, medium, low, unverified, suspicious).

Top 10 users by TripScore.

Number of suspicious visits (and trend over time).

Number of manual_only visits vs gallery_exif vs taatom_camera_live.

No need for complex UI—reuse the existing KPI card and chart patterns used in current SuperAdmin dashboards.

5. Documentation & Tests
5.1 Update TRIPSCORE_DOCUMENTATION.md

Task:

Add a “TripScore v2” section that explains:

TripVisit concept.

Trust levels.

How score is now based on unique, verified visits instead of raw post count.

Update the Calculation Algorithm section to reflect:

TripScore = sum over unique, trusted visits, not count of posts.

Keep older v1 parts as “Legacy (v1)” if needed, but mark clearly that v2 is now the active logic for Jan 2026 launch.

5.2 Update Business Documentation

Task:

In TeamTaatom_Business_Documentation.md, under travel analytics / TripScore sections, mention:

“TripScore is based on verified visits with fraud checks” etc.

This aligns with the founder-facing document already discussed.

5.3 Tests

Task:

Add / update unit tests & integration tests for:

TripVisit creation from different sources (in-app camera, gallery with EXIF, manual).

TripScore calculation for:

Multiple posts at same location (only one score).

Old trip imported via EXIF.

Suspicious impossible travel path.

API endpoints:

/profile TripScore portion.

/tripscore/continents

/tripscore/continents/:continent/countries

/tripscore/countries/:country

/tripscore/countries/:country/locations

Use the existing test styles from TripScore & analytics tests as reference.

6. Non-Goals / Out of Scope (for now)

No need to change distance calculation formula (Haversine stays the same). 

TRIPSCORE_DOCUMENTATION

No need to introduce ML-based fraud detection—simple rule-based checks are enough for v2.

No need to change core navigation or routes; keep UX flow identical.

7. Final Acceptance Criteria

The implementation is considered successful when:

TripScore for any user:

Does not increase just by posting multiple times at the same place.

Reflects the number of unique places visited with trusted evidence.

Includes backfilled old trips based on EXIF where realistic.

New posts/shorts:

Automatically create TripVisit entries with proper source and trustLevel.

Manual location abuse:

Does not significantly change TripScore.

TripScore screens:

Work as before from the user’s perspective (same navigation & structure).

Optionally show subtle trust info.

SuperAdmin:

Can see overall TripVisit/TripScore stats and trust-level breakdown.
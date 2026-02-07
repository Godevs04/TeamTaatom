# Locale Menu Runtime Flow Analysis

**Date**: 2026-02-04  
**Purpose**: Complete investigation of runtime flow before making fixes  
**Status**: Investigation Only - No Code Changes

---

## Executive Summary

This document traces the complete runtime execution flow of the Locale menu in the TeamTaatom React Native (Expo) app. It documents how locales are fetched, how user location is obtained, how distances are calculated, how sorting is applied, and where failures occur.

**Key Findings**:
- Multiple sorting entry points create race conditions
- Location context (city/state/country) arrives asynchronously after initial sort
- Distance calculation happens in multiple phases (straight-line → driving)
- Sorting can execute before location context is stable
- Babel runtime crash occurs in reverse geocoding promise chain

---

## Table of Contents

1. [Component Initialization](#component-initialization)
2. [Data Flow Timeline](#data-flow-timeline)
3. [Location Flow](#location-flow)
4. [Distance Calculation Flow](#distance-calculation-flow)
5. [Sorting Execution Flow](#sorting-execution-flow)
6. [State Variables & Mutations](#state-variables--mutations)
7. [Observed Failure Points](#observed-failure-points)
8. [Why Nearby Locales Are Lost](#why-nearby-locales-are-lost)
9. [Why Far Locales Surface](#why-far-locales-surface)
10. [Why Previous Fixes Failed](#why-previous-fixes-failed)
11. [Babel Runtime Crash Analysis](#babel-runtime-crash-analysis)

---

## Component Initialization

### Mount Sequence

```
1. Component mounts (locale.tsx)
2. State variables initialized:
   - adminLocales: [] (empty array)
   - allLocalesWithDistances: [] (empty array)
   - filteredLocales: [] (empty array)
   - userLocation: null
   - userCity: null
   - userState: null
   - userCountryCode: null
   - locationPermissionGranted: false
3. Refs initialized:
   - isMountedRef.current = true
   - lastFetchKeyRef.current = null
   - lastStableLocationKeyRef.current = null
   - loadedOnceRef.current = false
4. useEffect (lines 869-924) triggers on mount
```

### Initial useEffect Execution

**Location**: `frontend/app/(tabs)/locale.tsx` lines 869-924

```typescript
useEffect(() => {
  const startTime = Date.now();
  
  const initializeData = async () => {
    // Step 1: Get user location (with retry, up to 2 attempts)
    await getUserCurrentLocation();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Load countries and saved locales in parallel
    await Promise.allSettled([
      loadCountries(),
      loadSavedLocales()
    ]);
  };
  
  initializeData();
  
  // Step 3: Load admin locales (ALWAYS called, even if location not ready)
  loadAdminLocales(true);
  
  return () => {
    isMountedRef.current = false;
    // Cleanup...
  };
}, [getUserCurrentLocation]);
```

**Critical Observation**: `loadAdminLocales(true)` is called immediately, even if `getUserCurrentLocation()` hasn't completed. This creates a race condition.

---

## Data Flow Timeline

### Phase 1: Component Mount (T=0ms)

```
┌─────────────────────────────────────────────────────────────┐
│ Component Mounts                                            │
│ - All state variables = initial values (null/empty)        │
│ - Refs initialized                                          │
│ - useEffect triggers                                        │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Parallel Initialization (T=0-5000ms)

```
┌─────────────────────────────────────────────────────────────┐
│ Parallel Execution:                                         │
│                                                             │
│ Thread A: getUserCurrentLocation()                          │
│   ├─ Request location permission                            │
│   ├─ Get current position (async, may take 1-10 seconds)   │
│   └─ Reverse geocode (async, may take 0.5-3 seconds)      │
│                                                             │
│ Thread B: loadAdminLocales(true)                           │
│   ├─ Check guards (isSearchingRef, loadedOnceRef)          │
│   ├─ Build API params                                       │
│   ├─ Call getLocales() API                                 │
│   └─ Process response                                       │
│                                                             │
│ Thread C: loadCountries() + loadSavedLocales()             │
│   └─ Fetch countries and saved locales                     │
└─────────────────────────────────────────────────────────────┘
```

**Critical Race Condition**: Thread B (loadAdminLocales) can complete before Thread A (getUserCurrentLocation) finishes, meaning:
- Locales are fetched and sorted BEFORE user location is known
- Sorting uses `userLocation = null`, `userCity = null`, `userState = null`
- Result: Sorting falls back to distance-only (if available) or createdAt

### Phase 3: Locale Fetching (T=100-2000ms)

**Location**: `loadAdminLocales` function (lines 952-1433)

**API Call**:
```typescript
const response = await getLocales(
  params.search || '',
  params.countryCode || '',
  params.stateCode || '',
  spotTypesParam,
  params.page,        // 1 if shouldFetchAll, else currentPageRef.current
  params.limit,       // 2000 if shouldFetchAll, else 20
  params.includeInactive
);
```

**Backend Behavior** (from `backend/src/controllers/localeController.js`):
- Default limit: 50 (backend caps at 50, but frontend requests 2000)
- Backend actually returns max 50 locales per request
- Sorting: `{ displayOrder: 1, createdAt: -1 }` (backend sorting, not distance-based)
- Returns: `{ locales: [...], pagination: {...} }`

**Critical Finding**: Backend limit is 50, but frontend requests 2000. Backend will only return 50 locales maximum.

**State Mutation** (line 1058):
```typescript
const newLocales = response.locales; // Array of Locale objects
// No distanceKm property yet
```

### Phase 4: Distance Calculation (T=200-5000ms)

**Location**: Lines 1090-1285

**Step 4.1: Immediate Straight-Line Distance** (lines 1092-1121)
```typescript
if (userLocation && locationPermissionGranted) {
  const localesWithStraightLineDistance = newLocales.map((locale) => {
    if (locale.latitude && locale.longitude) {
      const straightLineDistance = calculateDistance(
        userLat, userLon,
        localeLat, localeLon
      );
      return { ...locale, distanceKm: straightLineDistance };
    }
    return { ...locale, distanceKm: null };
  });
}
```

**Critical Observation**: This only runs if `userLocation && locationPermissionGranted` are both truthy. If location hasn't been obtained yet, `distanceKm` remains `null` for all locales.

**Step 4.2: First Sort with Straight-Line Distance** (line 1124)
```typescript
const sortedByStraightLine = sortLocalesByDistance(localesWithStraightLineDistance);
setAdminLocales(sortedByStraightLine); // Line 1126
```

**State Mutation**: `adminLocales` is set with straight-line distances, sorted.

**Step 4.3: Background Driving Distance Calculation** (lines 1141-1252)
```typescript
setCalculatingDistances(true);

// Process in batches of 5
for (let i = 0; i < newLocales.length; i += BATCH_SIZE) {
  const batchResults = await Promise.allSettled(
    batch.map(async (locale) => {
      // Calculate driving distance
      const distanceKm = await getLocaleDistanceKm(...);
      return { ...locale, distanceKm };
    })
  );
  
  // Update UI progressively after each batch
  const sorted = sortLocalesByDistance(localeResults);
  setAdminLocales(sorted); // Line 1245 - RE-SORTS AFTER EACH BATCH
}
```

**Critical Observation**: Sorting happens after EACH batch (line 1245), not just once at the end. This causes multiple re-renders and potential race conditions.

### Phase 5: Final Sorting (T=5000-10000ms)

**Location**: Lines 1295-1327

```typescript
const stableKey = getStableLocationKey(); // Checks: lat/lon + countryCode

if (stableKey) {
  finalSorted = sortLocalesByDistance(finalLocalesWithDistances);
} else {
  // Store unsorted, wait for stable location
  finalSorted = finalLocalesWithDistances;
}

if (shouldFetchAll) {
  setAllLocalesWithDistances(finalSorted); // Line 1332
  const firstPage = finalSorted.slice(0, ITEMS_PER_PAGE);
  setAdminLocales(firstPage); // Line 1336
}
```

**Critical Observation**: If `stableKey` is null (location not stable), locales are stored unsorted. A separate `useEffect` (lines 2027-2089) is supposed to re-sort when location becomes stable.

---

## Location Flow

### getUserCurrentLocation Execution

**Location**: Lines 520-900

**Step 1: Permission Request** (lines 552-564)
```typescript
const permissionResult = await Location.requestForegroundPermissionsAsync();
if (permissionStatus !== 'granted') {
  setLocationPermissionGranted(false);
  return; // EXITS - no location obtained
}
setLocationPermissionGranted(true);
```

**State Mutation**: `locationPermissionGranted = true`

**Step 2: Get Current Position** (lines 585-593)
```typescript
locationPromise = Location.getCurrentPositionAsync(locationOptions);
const location = await Promise.race([locationPromise, timeoutPromise]);
```

**Timing**: Can take 1-10 seconds depending on GPS accuracy and device.

**Step 3: Set User Location** (lines 624-627)
```typescript
setUserLocation(coords); // { latitude, longitude }
invalidateDistanceCacheIfMoved(coords.latitude, coords.longitude);
```

**State Mutation**: `userLocation = { latitude, longitude }`

**Critical Observation**: At this point, `userCity`, `userState`, `userCountryCode` are still `null`. Sorting can happen with only lat/lon, but without city/state context.

**Step 4: Reverse Geocoding** (lines 632-791)

**4a. Expo Reverse Geocode** (lines 632-691)
```typescript
Location.reverseGeocodeAsync(coords)
  .then(function(expoResults) {
    const result = expoResults[0];
    if (result.city) setUserCity(result.city);
    if (result.country) setUserCountry(result.country);
    if (result.isoCountryCode) setUserCountryCode(result.isoCountryCode.toUpperCase());
    
    const detectedState = result.region || result.subregion || result.district || null;
    if (detectedState) setUserState(detectedState);
    
    // If state not detected, try Google
    if (!detectedState) {
      // Inline Google fetch...
    }
  });
```

**State Mutations** (asynchronous, may complete after sorting):
- `userCity = result.city` (may be null)
- `userCountry = result.country` (may be null)
- `userCountryCode = result.isoCountryCode.toUpperCase()` (may be null)
- `userState = detectedState` (may be null)

**4b. Google Reverse Geocode Fallback** (lines 703-789)
- Only runs if Expo doesn't detect state
- Fetches from Google Geocoding API
- Extracts `administrative_area_level_1` for state
- Updates `userState`, `userCity`, `userCountryCode`

**Timing**: Google API call can take 0.5-3 seconds.

### Location State Update Sequence

```
T=0ms:    userLocation = null
          userCity = null
          userState = null
          userCountryCode = null

T=1000ms: userLocation = { lat, lon }  ← Location obtained
          userCity = null
          userState = null
          userCountryCode = null

T=2000ms: userLocation = { lat, lon }
          userCity = "Bangalore"       ← Reverse geocode completes
          userState = null              ← May still be null
          userCountryCode = "IN"

T=3500ms: userLocation = { lat, lon }
          userCity = "Bangalore"
          userState = "Karnataka"       ← Google API completes (if needed)
          userCountryCode = "IN"
```

**Critical Problem**: Sorting may execute at T=2000ms when `userState` is still null, missing the state-based prioritization.

---

## Distance Calculation Flow

### Distance Calculation Methods

**1. Straight-Line Distance (Haversine)**
- **Location**: `frontend/utils/locationUtils.ts` - `calculateDistance()`
- **Method**: Synchronous, instant
- **Formula**: Great-circle distance between two lat/lon points
- **When Used**: 
  - Initial sorting (lines 1106-1111)
  - Fallback when driving distance unavailable
- **Limitation**: Doesn't account for roads/terrain

**2. Driving Distance (Google Maps Distance Matrix)**
- **Location**: `frontend/utils/locationUtils.ts` - `calculateDrivingDistanceWithGoogleMaps()`
- **Method**: Async API call
- **When Used**: If Google Maps API key available
- **Timing**: 0.5-2 seconds per calculation
- **Rate Limit**: 2,500 requests/day (free tier)

**3. Driving Distance (OSRM)**
- **Location**: `frontend/utils/locationUtils.ts` - `calculateDrivingDistanceKm()`
- **Method**: Async API call (free, no key needed)
- **When Used**: Fallback if Google Maps unavailable
- **Timing**: 0.5-3 seconds per calculation
- **Rate Limit**: May be rate-limited (429 errors)

### Distance Calculation Sequence

**In loadAdminLocales** (lines 1141-1252):

```
Batch 1 (locales 0-4):
  ├─ Calculate driving distance for locale 0 (async, 1-2s)
  ├─ Calculate driving distance for locale 1 (async, 1-2s)
  ├─ Calculate driving distance for locale 2 (async, 1-2s)
  ├─ Calculate driving distance for locale 3 (async, 1-2s)
  └─ Calculate driving distance for locale 4 (async, 1-2s)
  → Promise.allSettled completes
  → Sort batch results (line 1244)
  → setAdminLocales(sorted) (line 1245) ← RE-RENDER

Wait 200ms

Batch 2 (locales 5-9):
  ├─ Calculate driving distance for locale 5 (async, 1-2s)
  ├─ ...
  → Sort batch results
  → setAdminLocales(sorted) ← RE-RENDER

... continues for all batches
```

**Critical Observation**: Each batch triggers a re-sort and state update. If location context (city/state) arrives during batch processing, sorting may use incomplete context.

### Distance State Evolution

```
Initial:        distanceKm = null (for all locales)
After batch 1:  distanceKm = [calculated for 5 locales, null for others]
After batch 2:  distanceKm = [calculated for 10 locales, null for others]
...
Final:          distanceKm = [calculated for all locales with valid coords]
```

**Problem**: Locales with `distanceKm = null` are sorted using `MAX_DISTANCE = 999999`, but if sorting happens before distances are calculated, null distances may be compared incorrectly.

---

## Sorting Execution Flow

### Sorting Entry Points

**1. Initial Sort (Straight-Line Distance)** - Line 1124
```typescript
const sortedByStraightLine = sortLocalesByDistance(localesWithStraightLineDistance);
setAdminLocales(sortedByStraightLine);
```
**Context**: 
- `userLocation` may be available
- `userCity`, `userState`, `userCountryCode` may still be null
- Uses straight-line distances (instant)

**2. Progressive Sort (After Each Batch)** - Line 1244
```typescript
const sorted = sortLocalesByDistance(localeResults);
setAdminLocales(sorted);
```
**Context**:
- Runs after each batch of 5 locales
- Location context may be partially available
- Uses driving distances (for completed batches)

**3. Final Sort (After All Distances)** - Line 1303
```typescript
if (stableKey) {
  finalSorted = sortLocalesByDistance(finalLocalesWithDistances);
}
```
**Context**:
- Only runs if `stableKey` is truthy (requires lat/lon + countryCode)
- May not have `userCity` or `userState` yet
- Uses all calculated distances

**4. Stable Location Re-Sort** - Line 2061
```typescript
const reSorted = sortLocalesByDistance([...allLocalesWithDistances]);
setAllLocalesWithDistances(reSorted);
setAdminLocales(firstPage);
```
**Context**:
- Runs when stable location key changes
- Should have complete location context
- Re-sorts `allLocalesWithDistances`

### sortLocalesByDistance Function

**Location**: Lines 1547-1767

**Input**: Array of Locale objects (may or may not have `distanceKm`)

**Priority Logic**:
```
1. Same city → sort by distance
2. Same state → sort by distance
3. Same country → sort by distance
4. Different countries → sort by distance
```

**Critical Code Path** (lines 1562-1750):
```typescript
sorted.sort((a, b) => {
  if (userLocation && locationPermissionGranted) {
    const distanceA = getLocaleDistance(a); // May return null
    const distanceB = getLocaleDistance(b); // May return null
    
    // Check city match
    const aInSameCity = /* fuzzy match logic */;
    const bInSameCity = /* fuzzy match logic */;
    
    // Check state match
    const aInSameState = /* fuzzy match logic */;
    const bInSameState = /* fuzzy match logic */;
    
    // Priority 1: Same city
    if (aInSameCity && bInSameCity) {
      const MAX_DISTANCE = 999999;
      const effectiveDistanceA = distanceA ?? MAX_DISTANCE;
      const effectiveDistanceB = distanceB ?? MAX_DISTANCE;
      return effectiveDistanceA - effectiveDistanceB;
    }
    
    // ... continues with priority 2, 3, 4, etc.
  }
});
```

**Critical Observations**:
1. **City/State Matching Depends on State Variables**: If `userCity` or `userState` are null, matching fails, and sorting falls back to distance-only.
2. **Null Distance Handling**: Null distances are treated as `MAX_DISTANCE = 999999`, which pushes them to the end. However, if sorting happens before distances are calculated, all locales may have null distances, causing random ordering.
3. **Fuzzy Matching**: Uses case-insensitive substring matching, which can cause false positives or miss matches.

### Sorting Execution Timeline

```
T=0ms:     Component mounts
T=100ms:   loadAdminLocales() called
T=500ms:   API response received (50 locales)
T=600ms:   Sort #1: Straight-line distance (userLocation available, userState = null)
           → Result: Sorted by distance only, no state prioritization
T=800ms:   Batch 1 driving distances calculated
T=850ms:   Sort #2: After batch 1 (userState may still be null)
T=1200ms:  Batch 2 driving distances calculated
T=1250ms:  Sort #3: After batch 2
...
T=3000ms:  Final sort (if stableKey is truthy)
T=3500ms:  userState = "Karnataka" (Google API completes)
T=3600ms:  Sort #4: Stable location re-sort (useEffect triggers)
```

**Problem**: Sorting #1, #2, #3 happen before `userState` is available, so Karnataka locales are not prioritized.

---

## State Variables & Mutations

### State Variables

| Variable | Type | Initial Value | Mutations |
|----------|------|---------------|-----------|
| `adminLocales` | `Locale[]` | `[]` | Set at lines 1126, 1245, 1336, 1353, 2083 |
| `allLocalesWithDistances` | `Locale[]` | `[]` | Set at lines 1332, 2079 |
| `filteredLocales` | `Locale[]` | `[]` | Set at lines 2019, 2087 |
| `userLocation` | `{lat, lon} \| null` | `null` | Set at line 624 |
| `userCity` | `string \| null` | `null` | Set at lines 637, 738 |
| `userState` | `string \| null` | `null` | Set at lines 667, 731 |
| `userCountryCode` | `string \| null` | `null` | Set at lines 643, 726 |
| `locationPermissionGranted` | `boolean` | `false` | Set at lines 524, 545, 556, 562, 566, 794, 798 |

### State Mutation Sequence

```
Mount:
  adminLocales = []
  userLocation = null
  userCity = null
  userState = null
  userCountryCode = null

T=1000ms (Location obtained):
  userLocation = { latitude: X, longitude: Y }
  → Triggers: useEffect at line 2003 (if userLocation changes)

T=2000ms (Reverse geocode):
  userCity = "Bangalore"
  userCountryCode = "IN"
  → Triggers: useEffect at line 2027 (if stableKey changes)

T=3500ms (Google API):
  userState = "Karnataka"
  → Triggers: useEffect at line 2027 (stableKey changes again)
```

### State Dependencies

**sortLocalesByDistance dependencies** (line 1757):
```typescript
[userLocation, locationPermissionGranted, getLocaleDistance, userCity, userState, userCountryCode, getStableLocationKey]
```

**Critical**: The function is recreated whenever any of these dependencies change, but the actual sorting only happens when the function is called, not automatically when dependencies change.

---

## Observed Failure Points

### Failure Point 1: Race Condition - Locales Loaded Before Location

**Location**: Lines 869-911

**Problem**: `loadAdminLocales(true)` is called immediately, even if `getUserCurrentLocation()` hasn't completed.

**Sequence**:
```
1. Component mounts
2. useEffect triggers initializeData()
3. getUserCurrentLocation() starts (async, takes 1-10 seconds)
4. loadAdminLocales(true) called immediately (doesn't wait)
5. Locales fetched and sorted with userLocation = null
6. Sorting falls back to createdAt or random order
```

**Impact**: Nearby locales may not appear first because sorting happened without location context.

### Failure Point 2: Sorting Before Location Context Complete

**Location**: Lines 1124, 1244, 1303

**Problem**: Sorting executes multiple times, but early sorts happen before `userCity` or `userState` are available.

**Sequence**:
```
1. userLocation obtained (lat/lon only)
2. Sort #1 executes (userCity = null, userState = null)
3. Reverse geocode completes (userCity = "Bangalore", userCountryCode = "IN")
4. Sort #2 executes (userState = null)
5. Google API completes (userState = "Karnataka")
6. Sort #3 executes (complete context)
```

**Impact**: First two sorts don't prioritize by city/state, so nearby locales may be buried.

### Failure Point 3: Backend Limit Mismatch

**Location**: Line 1022

**Problem**: Frontend requests `limit: 2000`, but backend caps at 50.

**Code**:
```typescript
limit: shouldFetchAll ? 2000 : 20, // Frontend requests 2000
```

**Backend** (localeController.js line 17):
```javascript
const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 50); // Backend caps at 50
```

**Impact**: Only 50 locales are returned, not 2000. If there are 1000+ locales, many nearby ones may not be in the first 50 returned by backend (which are sorted by `displayOrder`, not distance).

### Failure Point 4: Progressive Sorting Causes Inconsistent State

**Location**: Line 1245

**Problem**: Sorting happens after each batch, causing multiple state updates and potential race conditions.

**Sequence**:
```
Batch 1 completes → Sort → setAdminLocales(sorted[0-4])
Batch 2 completes → Sort → setAdminLocales(sorted[0-9])
Batch 3 completes → Sort → setAdminLocales(sorted[0-14])
...
```

**Impact**: UI flickers, and if location context arrives mid-batch, sorting may use incomplete data.

### Failure Point 5: Null Distance Handling

**Location**: Lines 1682-1685, 1700-1703, etc.

**Problem**: If sorting happens before distances are calculated, all locales have `distanceKm = null`, which are all treated as `MAX_DISTANCE = 999999`, causing random ordering.

**Code**:
```typescript
const MAX_DISTANCE = 999999;
const effectiveDistanceA = distanceA ?? MAX_DISTANCE;
const effectiveDistanceB = distanceB ?? MAX_DISTANCE;
return effectiveDistanceA - effectiveDistanceB; // Both are 999999, so returns 0
```

**Impact**: When all distances are null, sorting falls back to secondary sort (createdAt), which may not prioritize nearby locales.

### Failure Point 6: Stable Location Key Check Too Strict

**Location**: Lines 1298-1327

**Problem**: Final sort only happens if `stableKey` is truthy, which requires `countryCode`. But if `countryCode` arrives late, sorting may never happen.

**Code**:
```typescript
const stableKey = getStableLocationKey(); // Requires lat/lon + countryCode
if (stableKey) {
  finalSorted = sortLocalesByDistance(finalLocalesWithDistances);
} else {
  // Store unsorted - relies on useEffect to sort later
  finalSorted = finalLocalesWithDistances;
}
```

**Impact**: If `countryCode` never arrives (API failure, network issue), locales remain unsorted.

---

## Why Nearby Locales Are Lost

### Root Cause Analysis

**Primary Cause**: Sorting executes before location context (city/state) is available.

**Detailed Flow**:

1. **Component mounts** → `userLocation = null`, `userState = null`

2. **loadAdminLocales() called immediately** → Fetches 50 locales from backend (sorted by `displayOrder`, not distance)

3. **Location obtained** → `userLocation = {lat, lon}`, but `userState = null`

4. **First sort executes** (line 1124):
   - `userLocation` is available
   - `userState` is null
   - Sorting logic checks `aInSameState` and `bInSameState` (lines 1618-1658)
   - Both are `false` because `userState` is null
   - Falls back to distance-only sorting
   - **Problem**: If some locales have `distanceKm = null` (not calculated yet), they're treated as `MAX_DISTANCE`, pushing them to the end

5. **userState arrives later** (T=3500ms) → `userState = "Karnataka"`

6. **Re-sort should happen** (line 2061), but:
   - Only if `allLocalesWithDistances.length > 0` (line 2032)
   - Only if `stableKey` is truthy (line 2039)
   - Only if `lastStableLocationKeyRef.current !== stableKey` (line 2044)

7. **If re-sort doesn't happen**:
   - Nearby Karnataka locales remain buried
   - Far locales (2000km+) remain at top because they were sorted first with incomplete context

### Secondary Causes

**1. Backend Returns Only 50 Locales**
- Backend limit is 50, but there are 1000+ locales
- First 50 returned are sorted by `displayOrder`, not distance
- Nearby locales may not be in the first 50

**2. Progressive Sorting**
- Sorting happens after each batch
- If location context arrives mid-batch, early batches are sorted incorrectly
- Later batches are sorted correctly, but may not reach the top if `allLocalesWithDistances` is already set

**3. Null Distance Race**
- If sorting happens before distances are calculated, all locales have `distanceKm = null`
- All null distances are treated as `MAX_DISTANCE = 999999`
- Sorting becomes random (falls back to createdAt)

---

## Why Far Locales Surface

### Root Cause Analysis

**Primary Cause**: Sorting executes with incomplete location context, causing incorrect prioritization.

**Detailed Flow**:

1. **Initial Sort** (line 1124):
   - `userLocation` available
   - `userCity = null`, `userState = null`
   - Sorting logic:
     - `aInSameCity = false` (because `userCity` is null)
     - `aInSameState = false` (because `userState` is null)
     - Falls back to distance-only
   - **Problem**: If distances are null or not yet calculated, sorting is random

2. **Backend Sorting**:
   - Backend returns locales sorted by `displayOrder: 1, createdAt: -1`
   - First locale in response may be far away (high displayOrder or old createdAt)
   - Frontend uses this order if distance sorting fails

3. **Null Distance Handling**:
   - Locales with `distanceKm = null` are treated as `MAX_DISTANCE = 999999`
   - But if ALL locales have null distances, they're all equal (999999 - 999999 = 0)
   - Sorting falls back to secondary sort (createdAt, newest first)
   - Far locales with recent `createdAt` may appear first

4. **Progressive Sorting**:
   - After batch 1, only 5 locales have distances
   - These 5 are sorted and set as `adminLocales`
   - If these 5 happen to be far locales, they appear first
   - Later batches (with nearby locales) are added, but may not reach the top

### Example Scenario

```
Backend returns (sorted by displayOrder):
1. Locale A (2000km away, displayOrder: 1)
2. Locale B (50km away, displayOrder: 2)
3. Locale C (100km away, displayOrder: 3)
...

Initial sort (userState = null):
- All have distanceKm = null (not calculated yet)
- All treated as MAX_DISTANCE = 999999
- Sorting falls back to createdAt
- Locale A (recent createdAt) appears first

After batch 1 (5 locales):
- Locale A gets distanceKm = 2000
- Locale B gets distanceKm = 50
- Locale C gets distanceKm = 100
- Sort: [B, C, A, ...]
- But if userState is still null, no state prioritization

After userState arrives:
- Should re-sort, but if allLocalesWithDistances is already set with wrong order, re-sort may not happen
```

---

## Why Previous Fixes Failed

### Fix Attempt 1: Stable Location Key

**What Was Tried**: Introduced `getStableLocationKey()` and `lastStableLocationKeyRef` to prevent sorting until location is stable.

**Why It Failed**:
1. **Too Strict**: Requires `countryCode`, which may arrive late or never arrive
2. **Multiple Entry Points**: Sorting still happens at lines 1124, 1244, 1303, which don't check stable key
3. **Race Condition**: `loadAdminLocales` can complete before location is stable, storing unsorted locales, but UI may render before re-sort happens

### Fix Attempt 2: Null Distance Handling

**What Was Tried**: Treat null distances as `MAX_DISTANCE = 999999` to push them to the end.

**Why It Failed**:
1. **All Null Problem**: If all locales have null distances, they're all equal (999999 - 999999 = 0), causing random ordering
2. **Timing Issue**: Sorting happens before distances are calculated, so all are null
3. **Progressive Updates**: Distances are calculated in batches, but sorting happens after each batch, so early batches may have mostly null distances

### Fix Attempt 3: Re-Sort on State Change

**What Was Tried**: Added `useEffect` to re-sort when `userState` changes (lines 2027-2089).

**Why It Failed**:
1. **Dependency on allLocalesWithDistances**: Only re-sorts if `allLocalesWithDistances.length > 0`, but this may be empty if `shouldFetchAll` is false
2. **Stable Key Check**: Still requires stable key, which may not be available
3. **Multiple Sorts**: Doesn't prevent earlier sorts from happening with incomplete context

### Fix Attempt 4: Promise Chain Refactoring

**What Was Tried**: Changed async/await to promise chains to fix Babel crash.

**Why It Failed**:
1. **Function Hoisting**: `fetchStateFromGooglePromise` was defined after use, causing hoisting issues
2. **Still Nested**: Promise chains still nested inside callbacks
3. **Babel Transpilation**: Babel may still transpile promise chains in ways that cause `construct.js` errors

---

## Babel Runtime Crash Analysis

### Error Location

**Error**: `TypeError: Cannot read property 'unloadAsync' of null`  
**Stack**: `construct.js:4 - Reflect.construct.apply(null, arguments)`

### Code Path Leading to Crash

**Location**: Lines 632-791 (reverse geocoding)

**Problematic Pattern**:
```typescript
Location.reverseGeocodeAsync(coords)
  .then(function(expoResults) {
    // ...
    if (!detectedState) {
      const googleUrl = `...`;
      fetch(googleUrl)
        .then(function(googleResponse) {
          return googleResponse.json();
        })
        .then(function(googleData) {
          // Nested promise chain inside .then callback
          // Babel may transpile this in a way that causes construct.js error
        });
    }
  })
  .catch(function(expoError) {
    // Another nested fetch...
    fetch(googleUrl)
      .then(function(googleResponse) {
        // More nesting
      });
  });
```

### Why Babel Crashes

1. **Nested Promise Chains**: Promise chains nested inside `.then()` callbacks can cause Babel to generate code that uses `Reflect.construct`, which may fail if arguments are null
2. **Function Hoisting**: Functions defined inside callbacks may be hoisted incorrectly by Babel
3. **Async Transpilation**: Babel may transpile promise chains into async/await, which can cause `construct.js` errors if not handled correctly

### Observed Crash Scenarios

1. **When reverse geocoding fails**: `.catch()` handler triggers nested fetch, causing crash
2. **When Google API is called**: Nested promise chain inside `.then()` causes crash
3. **When component unmounts during API call**: State updates on unmounted component may trigger crash

---

## Diagrams

### Execution Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ T=0ms: Component Mounts                                         │
│   - State initialized                                           │
│   - useEffect triggers                                          │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ├─────────────────┐
                    │                 │
                    ▼                 ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ getUserCurrentLocation() │  │ loadAdminLocales(true)   │
│ (async, 1-10s)           │  │ (async, 0.5-2s)          │
└──────────────────────────┘  └──────────────────────────┘
                    │                 │
                    │                 ▼
                    │         ┌─────────────────┐
                    │         │ API Call         │
                    │         │ limit=2000       │
                    │         │ (returns 50)     │
                    │         └─────────────────┘
                    │                 │
                    │                 ▼
                    │         ┌─────────────────┐
                    │         │ Sort #1         │
                    │         │ (userState=null)│
                    │         └─────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ userLocation obtained │
         │ (lat/lon only)        │
         └──────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Reverse Geocode       │
         │ (async, 0.5-3s)      │
         └──────────────────────┘
                    │
                    ├──────────────┐
                    │              │
                    ▼              ▼
         ┌──────────────┐  ┌──────────────┐
         │ userCity     │  │ userState    │
         │ userCountry  │  │ (may be null)│
         │ userCountry  │  │              │
         │ Code         │  │              │
         └──────────────┘  └──────────────┘
                    │              │
                    │              │
                    ▼              ▼
         ┌──────────────────────┐
         │ Sort #2 (if stable)  │
         │ (may still miss state)│
         └──────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Google API (if needed)│
         │ (async, 0.5-3s)      │
         └──────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ userState = "Karnataka"│
         └──────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Sort #3 (re-sort)     │
         │ (complete context)    │
         └──────────────────────┘
```

### State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Initial State                                                │
│   adminLocales = []                                          │
│   userLocation = null                                        │
│   userCity = null                                            │
│   userState = null                                           │
│   userCountryCode = null                                     │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ loadAdminLocales()
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ API Response                                                 │
│   adminLocales = [50 locales, no distanceKm]                │
│   userLocation = null                                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ getUserCurrentLocation() completes
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Location Obtained                                            │
│   adminLocales = [50 locales, distanceKm calculated]        │
│   userLocation = {lat, lon}                                  │
│   userCity = null                                            │
│   userState = null                                           │
│   userCountryCode = null                                     │
│   → Sort #1 (distance only, no state prioritization)        │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ Reverse geocode completes
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Partial Context                                              │
│   adminLocales = [sorted by distance]                        │
│   userLocation = {lat, lon}                                  │
│   userCity = "Bangalore"                                     │
│   userState = null                                           │
│   userCountryCode = "IN"                                     │
│   → Sort #2 (if stableKey is truthy)                         │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ Google API completes (if needed)
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Complete Context                                             │
│   adminLocales = [sorted, but may be wrong]                 │
│   userLocation = {lat, lon}                                  │
│   userCity = "Bangalore"                                     │
│   userState = "Karnataka"                                    │
│   userCountryCode = "IN"                                     │
│   → Sort #3 (re-sort with complete context)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Findings

1. **Race Condition**: `loadAdminLocales()` is called before `getUserCurrentLocation()` completes, causing sorting with incomplete location context.

2. **Multiple Sorting Entry Points**: Sorting happens at 4 different places (lines 1124, 1244, 1303, 2061), and early sorts happen before location context is complete.

3. **Backend Limit Mismatch**: Frontend requests 2000 locales, but backend returns max 50, sorted by `displayOrder` (not distance).

4. **Progressive Sorting**: Sorting happens after each batch of distance calculations, causing multiple state updates and potential race conditions.

5. **Null Distance Problem**: If sorting happens before distances are calculated, all locales have `distanceKm = null`, causing random ordering.

6. **Stable Key Too Strict**: Final sort requires `countryCode`, which may arrive late or never arrive.

7. **Babel Crash**: Nested promise chains in reverse geocoding cause `construct.js` runtime errors.

### Critical Path

```
Mount → loadAdminLocales() → API Call → Sort #1 (incomplete context)
  ↓
getUserCurrentLocation() → Location obtained → Reverse geocode → Sort #2 (partial context)
  ↓
Google API → userState obtained → Sort #3 (complete context, but may be too late)
```

**Problem**: Sort #1 and #2 happen with incomplete context, so nearby locales are not prioritized. Sort #3 may happen too late or not at all.

---

## Next Steps (For Future Fix)

1. **Delay Sorting**: Don't sort until location context is complete (lat/lon + countryCode + city/state).

2. **Single Sorting Entry Point**: Consolidate all sorting into one guarded function that only runs when location is stable.

3. **Fix Backend Limit**: Either increase backend limit or implement proper pagination with distance-based sorting.

4. **Batch Distance Calculation**: Calculate all distances first, then sort once (not after each batch).

5. **Fix Babel Crash**: Refactor reverse geocoding to avoid nested promise chains.

6. **Null Distance Handling**: Don't sort if distances are not yet calculated, or use a loading state.

---

**End of Analysis**

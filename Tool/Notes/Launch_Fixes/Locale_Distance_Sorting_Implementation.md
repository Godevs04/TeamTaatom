# Locale Distance-Based Sorting Implementation - Complete Technical Documentation

## Overview
This document provides a comprehensive guide to the locale distance-based sorting implementation in the TeamTaatom app. It covers the database schema, distance calculation methods, sorting algorithms, and troubleshooting steps.

---

## Table of Contents
1. [Database Schema](#database-schema)
2. [Distance Calculation Methods](#distance-calculation-methods)
3. [Sorting Algorithm](#sorting-algorithm)
4. [User Location Detection](#user-location-detection)
5. [Implementation Flow](#implementation-flow)
6. [Known Issues & Solutions](#known-issues--solutions)
7. [Performance Optimizations](#performance-optimizations)
8. [Testing & Debugging](#testing--debugging)

---

## Database Schema

### Locale Model (`backend/src/models/Locale.js`)

The Locale model contains the following fields relevant to distance calculation and sorting:

```javascript
{
  _id: ObjectId,                    // Unique identifier
  name: String,                     // Locale name (e.g., "Lachen Monastery")
  country: String,                  // Full country name (e.g., "India")
  countryCode: String,              // ISO country code (e.g., "IN", "US")
  stateProvince: String,           // State/Province name (e.g., "Karnataka", "California")
  stateCode: String,               // State code (e.g., "KA", "CA")
  city: String,                     // City name (e.g., "Bangalore", "San Francisco")
  latitude: Number,                 // Latitude coordinate (-90 to 90)
  longitude: Number,                // Longitude coordinate (-180 to 180)
  description: String,              // Optional description
  spotTypes: [String],              // Array of spot types
  travelInfo: String,              // Travel accessibility info
  isActive: Boolean,                // Whether locale is active
  createdAt: Date,                  // Creation timestamp
  displayOrder: Number              // Display order (legacy)
}
```

### Critical Fields for Sorting:
- **`latitude`** and **`longitude`**: Required for distance calculation
- **`stateProvince`**: Used for state-based prioritization (e.g., Karnataka locales first)
- **`city`**: Used for city-based prioritization
- **`countryCode`**: Used for country-based prioritization

### Frontend Interface (`frontend/services/locale.ts`)

```typescript
export interface Locale {
  _id: string;
  name: string;
  country?: string;
  countryCode: string;
  stateProvince?: string;
  stateCode?: string;
  city?: string;                    // CRITICAL: Added for city-based sorting
  description?: string;
  imageUrl: string;
  spotTypes?: string[];
  travelInfo?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  displayOrder?: number;
  createdAt: string;
  distanceKm?: number | null;        // Calculated distance (added client-side)
}
```

---

## Distance Calculation Methods

### 1. Straight-Line Distance (Haversine Formula)

**Location**: `frontend/utils/locationUtils.ts` - `calculateDistance()`

**Formula**: Uses the Haversine formula to calculate the great-circle distance between two points on Earth.

```typescript
calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number | null
```

**Returns**: Distance in kilometers (km)

**When Used**:
- Initial sorting (fast, instant feedback)
- Fallback when driving distance APIs fail
- For distances > 2000 km (APIs may timeout)

**Limitations**:
- Does not account for roads, terrain, or travel routes
- May underestimate actual travel distance

### 2. Driving Distance (Google Maps Distance Matrix API)

**Location**: `frontend/utils/locationUtils.ts` - `calculateDrivingDistanceWithGoogleMaps()`

**API**: Google Maps Distance Matrix API

**Endpoint**:
```
https://maps.googleapis.com/maps/api/distancematrix/json
?origins={userLat},{userLon}
&destinations={localeLat},{localeLon}
&units=metric
&key={API_KEY}
```

**Returns**: Actual driving distance in kilometers

**When Used**:
- Primary method when Google Maps API key is available
- Provides accurate road-based distances
- Cached to reduce API calls

**Rate Limits**:
- Free tier: 2,500 requests/day
- Caching implemented to minimize API calls

### 3. Driving Distance (OSRM - Open Source Routing Machine)

**Location**: `frontend/utils/locationUtils.ts` - `calculateDrivingDistanceKm()`

**API**: OSRM (free, no API key required)

**Endpoint**:
```
https://router.project-osrm.org/route/v1/driving/{userLon},{userLat};{localeLon},{localeLat}?overview=false
```

**Returns**: Driving distance in kilometers

**When Used**:
- Fallback when Google Maps API key is not available
- Free alternative for driving distance calculation
- May have rate limits (429 errors)

**Limitations**:
- Public instance may be rate-limited
- May timeout for very long distances (>2000 km)

### 4. Main Distance Calculation Function

**Location**: `frontend/utils/locationUtils.ts` - `getLocaleDistanceKm()`

**Flow**:
1. Validates coordinates (latitude: -90 to 90, longitude: -180 to 180)
2. Checks cache first (using rounded coordinates for stable keys)
3. Tries Google Maps Distance Matrix API (if API key available)
4. Falls back to OSRM API
5. Falls back to straight-line distance (Haversine)

**Caching Strategy**:
- Uses rounded coordinates (4 decimal places) for stable cache keys
- Cache key format: `{method}-{userLat},{userLon}-{localeLat},{localeLon}`
- Cache stored in `distanceCache` Map (in-memory)

---

## Sorting Algorithm

### Priority Levels

The sorting algorithm (`sortLocalesByDistance`) prioritizes locales in the following order:

1. **PRIORITY 1: Same City**
   - Locales in the user's current city
   - Sorted by distance (nearest first)

2. **PRIORITY 2: Same State/Province**
   - Locales in the user's current state (e.g., Karnataka)
   - Sorted by distance (nearest first)
   - **CRITICAL**: This ensures Karnataka locales appear before other Indian states

3. **PRIORITY 3: Same Country**
   - Locales in the user's country but different state
   - Sorted by distance (nearest first)

4. **PRIORITY 4: Different Countries**
   - Locales in other countries
   - Sorted by distance (nearest first)

### State Matching Logic

**Location**: `frontend/app/(tabs)/locale.tsx` - `sortLocalesByDistance()` (lines 1587-1632)

The state matching uses fuzzy matching to handle variations:

1. **Direct Exact Match**: `"Karnataka" === "Karnataka"`
2. **Substring Match**: `"Karnataka State".includes("Karnataka")`
3. **Word Boundary Match**: Checks if significant words match (ignores "state", "province", "region")

**Example**:
```typescript
// User state: "Karnataka"
// Locale state: "Karnataka" → Match ✓
// Locale state: "Karnataka State" → Match ✓
// Locale state: "KA" → No match ✗
```

### City Matching Logic

**Location**: `frontend/app/(tabs)/locale.tsx` - `sortLocalesByDistance()` (lines 1577-1585)

Uses case-insensitive substring matching:
- `"Bangalore"` matches `"Bangalore"`
- `"Bangalore City"` matches `"Bangalore"` (and vice versa)

---

## User Location Detection

### Location Permission Flow

**Location**: `frontend/app/(tabs)/locale.tsx` - `getUserCurrentLocation()` (lines ~520-894)

1. **Request Permission**: `Location.requestForegroundPermissionsAsync()`
2. **Check Services**: `Location.hasServicesEnabledAsync()`
3. **Get Current Position**: `Location.getCurrentPositionAsync()`
   - Retry logic: Up to 2 retries with exponential backoff
4. **Reverse Geocode**: `Location.reverseGeocodeAsync()`
   - Extracts city, country, country code
   - Attempts to detect state from `region`, `subregion`, `district`

### State Detection (Critical for Karnataka)

**Problem**: Expo Location may not reliably detect state names for India.

**Solution**: Google Reverse Geocoding fallback for India (`isoCountryCode === 'IN'`)

**Flow**:
1. Try Expo Location first (fast)
2. If state not detected AND country is India → Use Google Reverse Geocoding
3. Extract state from Google's `administrative_area_level_1` component
4. Fallback: Parse `formatted_address` for state names

**Google Reverse Geocoding API**:
```
https://maps.googleapis.com/maps/api/geocode/json
?latlng={latitude},{longitude}
&key={API_KEY}
```

**Response Parsing**:
```typescript
// Extract from address_components
const adminArea = results[0].address_components.find(comp => 
  comp.types.includes('administrative_area_level_1')
);
const detectedState = adminArea?.long_name; // e.g., "Karnataka"
```

### User State Variables

**State Variables** (in `locale.tsx`):
- `userState`: String (e.g., "Karnataka", "California")
- `userCity`: String (e.g., "Bangalore", "San Francisco")
- `userCountry`: String (e.g., "India", "United States")
- `userCountryCode`: String (e.g., "IN", "US")

**Critical**: These are set asynchronously, so sorting must wait for them to be populated.

---

## Implementation Flow

### Initial Load Sequence

**Location**: `frontend/app/(tabs)/locale.tsx` - `useEffect` (lines ~839-888)

1. **Mount**: Component mounts
2. **Request Location**: `getUserCurrentLocation()` called
   - Requests permission
   - Gets coordinates
   - Reverse geocodes (Expo + Google fallback for India)
   - Sets `userState`, `userCity`, `userCountryCode`
3. **Load Locales**: `loadAdminLocales()` called (after location obtained)
4. **Fetch All Locales**: When location available, fetch up to 2000 locales
5. **Calculate Distances**: 
   - First: Straight-line distances (instant sorting)
   - Then: Driving distances in background (batches of 5)
6. **Sort & Paginate**: Client-side pagination (20 items per page)

### Distance Calculation Flow

**Location**: `frontend/app/(tabs)/locale.tsx` - `loadAdminLocales()` (lines ~1075-1240)

1. **Fetch Locales**: API call to `/api/v1/locales` (limit: 2000 when location available)
2. **Immediate Sorting**: Calculate straight-line distances for instant display
3. **Background Calculation**: 
   - Process in batches of 5 locales
   - Calculate driving distances using `getLocaleDistanceKm()`
   - Update UI progressively after each batch
4. **Final Sort**: Re-sort with driving distances using `sortLocalesByDistance()`
5. **Client-Side Pagination**: Store all sorted locales in `allLocalesWithDistances`, show first page

### Re-Sorting When State Detected

**Location**: `frontend/app/(tabs)/locale.tsx` - `useEffect` (lines ~2011-2053)

**Problem**: State detection may happen after initial load (Google API call is async).

**Solution**: Dedicated `useEffect` that watches `userState` and re-sorts when detected.

**Infinite Loop Prevention**:
- Uses `lastResortStateRef` to track last sorted state combination
- Only re-sorts if state combination actually changed
- Prevents redundant re-sorts

```typescript
const currentStateKey = `${userState || 'null'}-${userCity || 'null'}-${userCountryCode || 'null'}`;
if (lastResortStateRef.current === currentStateKey) {
  return; // Skip if already sorted with this state
}
lastResortStateRef.current = currentStateKey;
```

---

## Known Issues & Solutions

### Issue 1: Locales Showing 2000km+ First Instead of Nearby

**Root Cause**:
1. State detection failing (`userState: "NOT DETECTED"`)
2. Sorting falls back to distance-only without state prioritization
3. Driving distance calculation may be slow/failing, using straight-line distance incorrectly

**Solutions Implemented**:
1. **Enhanced State Detection**:
   - Always use Google reverse geocoding for India
   - Extract state from `administrative_area_level_1`
   - Parse `formatted_address` as fallback
   - Log state detection for debugging

2. **Improved Sorting**:
   - State matching uses fuzzy matching (substring, word boundary)
   - Re-sort when state is detected (even after initial load)
   - Infinite loop prevention with `lastResortStateRef`

3. **Distance Calculation**:
   - Use straight-line distance initially (instant feedback)
   - Calculate driving distances in background
   - Update UI progressively

**Debugging Steps**:
1. Check logs for `"State detected from Google:"` or `"State detected from Expo:"`
2. Verify `userState` is set correctly (not "NOT DETECTED")
3. Check `sortLocalesByDistance` logs for sorting decisions
4. Verify `distanceKm` values are correct (not null)

### Issue 2: Infinite Re-Render Loop

**Root Cause**:
- `useEffect` for re-sorting triggers repeatedly when `userState` changes
- State updates cause re-sort, which updates state, causing another re-sort

**Solution**:
- Use `lastResortStateRef` to track last sorted state combination
- Only re-sort if state combination actually changed
- Prevent redundant re-sorts

### Issue 3: Babel Runtime Error (`construct.js`)

**Error**:
```
TypeError: Cannot read property 'unloadAsync' of null
Error in construct.js:4 - Reflect.construct.apply(null, arguments)
```

**Root Cause**:
- Nested async functions inside callbacks cause Babel transpilation issues
- Mixing async/await with promise chains in complex patterns

**Solution**:
- Refactored to use promise chains (`.then()`/`.catch()`) instead of nested async functions
- Avoided IIFE (Immediately Invoked Function Expression) patterns
- Simplified async patterns to avoid Babel issues

**Fixed Code Pattern**:
```typescript
// BEFORE (causes Babel error):
const detectState = async () => {
  const fetchState = async () => { ... };
  await fetchState();
};
detectState();

// AFTER (fixed):
Location.reverseGeocodeAsync(coords)
  .then((results) => {
    // Process results
    fetchStateFromGooglePromise(coords);
  })
  .catch((error) => {
    fetchStateFromGooglePromise(coords);
  });
```

### Issue 4: "Load More" Button Hidden

**Root Cause**: Tab bar overlaps the button

**Solution**: Adjusted `paddingBottom` in styles:
```typescript
listContainer: {
  paddingBottom: 120, // Increased from 80 to ensure button visibility
}
```

---

## Performance Optimizations

### 1. Caching

**Distance Cache**:
- In-memory `Map` storing calculated distances
- Cache key: `{method}-{roundedLat},{roundedLon}-{roundedLat},{roundedLon}`
- Reduces API calls for repeated calculations

**Geocoding Cache**:
- Caches Google Places API results
- Duration: 24 hours
- Reduces API calls for locale coordinate lookups

### 2. Batch Processing

**Distance Calculation**:
- Process locales in batches of 5
- Prevents rate limiting
- Provides progressive UI updates

**Background Preloading**:
- Preload next page while user views current page
- Improves perceived performance

### 3. Client-Side Pagination

**When Location Available**:
- Fetch all locales (up to 2000) in one request
- Sort client-side
- Paginate client-side (20 items per page)
- Avoids multiple API calls

**When Location Not Available**:
- Use server-side pagination (20 items per page)
- Sort by `createdAt` (newest first)

### 4. Straight-Line Distance First

**Strategy**:
1. Calculate straight-line distances immediately (fast)
2. Show sorted list instantly
3. Calculate driving distances in background
4. Update progressively

**Benefit**: Instant feedback while accurate distances calculate

---

## Testing & Debugging

### Debug Logging

**Key Logs to Monitor**:

1. **State Detection**:
   ```
   ✅ State detected from Google: Karnataka
   ✅ State detected from Expo: Karnataka
   📍 Google reverse geocode result: { detectedState: "Karnataka", ... }
   ```

2. **Distance Calculation**:
   ```
   🚀 Starting background driving distance calculation
   ✅ OSRM driving distance: 45.23 km
   Using cached Google Maps distance: 48.67 km
   ```

3. **Sorting**:
   ```
   🔍 Starting sort with: { userState: "Karnataka", userCity: "Bangalore", ... }
   📍 Final sorted locales (first 10): { name: "...", state: "Karnataka", distance: 12.5 }
   ```

### Common Debugging Scenarios

**Scenario 1: State Not Detected**

**Symptoms**:
- Logs show `userState: "NOT DETECTED"`
- Locales not prioritizing by state

**Debug Steps**:
1. Check if Google Maps API key is set: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
2. Check network requests for Google reverse geocoding API
3. Verify coordinates are valid (latitude: -90 to 90, longitude: -180 to 180)
4. Check logs for Google API errors

**Scenario 2: Wrong Sorting Order**

**Symptoms**:
- Locales with 2000km+ distance appear first
- Karnataka locales not appearing first when user is in Karnataka

**Debug Steps**:
1. Check `userState` value (should be "Karnataka", not "NOT DETECTED")
2. Check `sortLocalesByDistance` logs for sorting decisions
3. Verify `distanceKm` values are correct (not null)
4. Check state matching logic (fuzzy matching may be too loose)

**Scenario 3: Infinite Re-Render**

**Symptoms**:
- Logs repeating continuously
- App becomes unresponsive

**Debug Steps**:
1. Check `lastResortStateRef` is preventing redundant re-sorts
2. Verify `useEffect` dependencies are correct
3. Check for state updates causing re-renders

### Testing Checklist

- [ ] User location permission granted
- [ ] State detected correctly (check logs)
- [ ] City detected correctly
- [ ] Distance calculation working (check `distanceKm` values)
- [ ] Sorting prioritizes same city first
- [ ] Sorting prioritizes same state second
- [ ] Sorting prioritizes same country third
- [ ] "Load More" button visible and working
- [ ] No infinite re-render loops
- [ ] No Babel runtime errors

---

## API Endpoints

### Get Locales

**Endpoint**: `GET /api/v1/locales`

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 2000)
- `search`: Search query (optional)
- `countryCode`: Filter by country code (optional)
- `stateCode`: Filter by state code (optional)
- `spotTypes`: Comma-separated spot types (optional)
- `includeInactive`: Include inactive locales (default: false)

**Response**:
```json
{
  "locales": [
    {
      "_id": "...",
      "name": "Lachen Monastery",
      "country": "India",
      "countryCode": "IN",
      "stateProvince": "Karnataka",
      "city": "Bangalore",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 50,
    "totalItems": 1000,
    "itemsPerPage": 20
  }
}
```

---

## Environment Variables

### Required

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`: Google Maps API key for reverse geocoding and distance calculation

### Optional

- None

---

## File Structure

### Key Files

1. **`frontend/app/(tabs)/locale.tsx`**
   - Main locale screen component
   - Contains sorting logic, distance calculation, pagination
   - ~4400 lines

2. **`frontend/utils/locationUtils.ts`**
   - Distance calculation functions
   - Geocoding utilities
   - Cache management
   - ~1000 lines

3. **`frontend/services/locale.ts`**
   - Locale interface definition
   - API call functions
   - ~100 lines

4. **`backend/src/models/Locale.js`**
   - Database schema
   - Mongoose model definition
   - ~130 lines

---

## Future Improvements

1. **Server-Side Distance Calculation**:
   - Move distance calculation to backend
   - Use MongoDB geospatial queries for efficient sorting
   - Reduce client-side computation

2. **Improved State Detection**:
   - Use more reliable geocoding services
   - Cache state detection results
   - Handle edge cases better

3. **Better Error Handling**:
   - Graceful degradation when APIs fail
   - Retry logic for failed distance calculations
   - User-friendly error messages

4. **Performance**:
   - Virtual scrolling for large lists
   - Lazy loading of locale images
   - Optimize re-renders

---

## Conclusion

This implementation provides a robust distance-based sorting system that prioritizes locales by proximity (city → state → country → distance). The system handles edge cases, provides instant feedback, and calculates accurate driving distances in the background.

**Key Takeaways**:
- State detection is critical for proper sorting (especially for India)
- Use straight-line distance for instant feedback, driving distance for accuracy
- Client-side pagination when location available, server-side when not
- Cache aggressively to reduce API calls
- Prevent infinite loops with proper refs and dependency management

---

## Contact & Support

For issues or questions, refer to:
- Code comments in `frontend/app/(tabs)/locale.tsx`
- Logs in development mode (`__DEV__`)
- This documentation

---

**Last Updated**: 2026-02-04
**Version**: 1.0
**Author**: AI Assistant (Claude Sonnet 4.5)

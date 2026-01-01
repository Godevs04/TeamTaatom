# Locale Search Functionality - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Functional Requirements](#functional-requirements)
3. [Technical Architecture](#technical-architecture)
4. [Search Flow](#search-flow)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Filtering System](#filtering-system)
8. [Distance Calculation](#distance-calculation)
9. [Performance Optimizations](#performance-optimizations)
10. [Error Handling](#error-handling)
11. [Edge Cases & Guard Mechanisms](#edge-cases--guard-mechanisms)
12. [Code Examples](#code-examples)
13. [Troubleshooting](#troubleshooting)

---

## Overview

The Locale Search functionality is a comprehensive feature that allows users to discover and explore travel destinations (locales) with advanced search, filtering, and distance-based sorting capabilities. The system combines server-side API filtering with client-side processing for optimal performance and user experience.

### Key Features
- **Real-time Search**: Debounced search with request cancellation
- **Multi-level Filtering**: Country, State, Spot Types, and Search Radius
- **Distance-based Sorting**: Automatic sorting by proximity to user location
- **Pagination**: Efficient loading of large datasets
- **Offline Support**: Graceful handling of network errors
- **Performance Optimized**: Caching, deduplication, and request guards

---

## Functional Requirements

### User Stories

1. **As a user, I want to search for locales by name, description, country, or state**
   - Search query is debounced (350ms) to reduce API calls
   - Search is case-insensitive and matches partial strings
   - Results update automatically as user types

2. **As a user, I want to filter locales by multiple criteria**
   - Filter by country (dropdown selection)
   - Filter by state/province (dependent on country)
   - Filter by spot types (multiple selection)
   - Filter by search radius (requires location permission)

3. **As a user, I want to see locales sorted by distance from my location**
   - Automatic distance calculation when location is available
   - Locales sorted nearest-first
   - Distance displayed in kilometers

4. **As a user, I want to see all locales when I clear my search**
   - Clearing search query restores initial locale list
   - No empty state when search is cleared

5. **As a user, I want smooth loading experiences**
   - Loading indicators during search
   - No infinite loading loops
   - Graceful error handling

---

## Technical Architecture

### Component Structure

```
LocaleScreen (Main Component)
├── State Management
│   ├── adminLocales: Locale[]          // Server-fetched locales
│   ├── filteredLocales: Locale[]       // Client-filtered locales
│   ├── searchQuery: string             // Search input value
│   ├── filters: FilterState            // Filter criteria
│   └── loading states                 // Loading indicators
│
├── Refs (Performance & Guards)
│   ├── isSearchingRef                  // Prevents duplicate searches
│   ├── isPaginatingRef                 // Prevents duplicate pagination
│   ├── loadedOnceRef                   // Prevents unnecessary reloads
│   ├── searchDebounceTimerRef          // Debounce timer
│   ├── searchAbortControllerRef        // Request cancellation
│   └── lastFetchKeyRef                 // Cache invalidation
│
├── Core Functions
│   ├── loadAdminLocales()             // Main data fetching
│   ├── applyFilters()                 // Client-side filtering
│   ├── sortLocalesByDistance()        // Distance sorting
│   └── fetchRealCoords()              // Google Places API
│
└── Effects
    ├── useEffect (initial load)        // Component mount
    ├── useEffect (search debounce)     // Search input changes
    └── useFocusEffect                  // Screen focus
```

### Data Flow

```
User Input (Search/Filter)
    ↓
Debounce (350ms)
    ↓
Request Guards Check
    ↓
API Call (getLocales)
    ↓
Response Processing
    ↓
Distance Calculation (if location available)
    ↓
Client-side Filtering
    ↓
State Update
    ↓
UI Render
```

---

## Search Flow

### 1. Initial Load

```typescript
// Component Mount
useEffect(() => {
  isMountedRef.current = true;
  loadCountries();
  loadSavedLocales();
  loadAdminLocales(true);  // Force initial load
  getUserCurrentLocation();
}, []);
```

**Flow:**
1. Component mounts
2. `loadAdminLocales(true)` called with `forceRefresh = true`
3. Request guards checked (bypassed for initial load)
4. API called without search query
5. All active locales fetched
6. Distance calculated if location available
7. Locales displayed

### 2. Search Input Flow

```typescript
// Search Input Handler
<TextInput
  value={searchQuery}
  onChangeText={(text) => {
    setSearchQuery(text);  // Immediate UI update
    // Debounce timer cleared and reset
  }}
/>

// Debounced Search Effect
useEffect(() => {
  // Clear previous timer
  if (searchDebounceTimerRef.current) {
    clearTimeout(searchDebounceTimerRef.current);
  }
  
  // Cancel previous request
  if (searchAbortControllerRef.current) {
    searchAbortControllerRef.current.abort();
  }
  
  // Set new debounce timer (350ms)
  searchDebounceTimerRef.current = setTimeout(() => {
    if (isMountedRef.current && !isSearchingRef.current) {
      currentPageRef.current = 1;  // Reset pagination
      lastFetchKeyRef.current = null;  // Force new fetch
      loadAdminLocales(true);
    }
  }, SEARCH_DEBOUNCE_MS);
}, [searchQuery, loadAdminLocales]);
```

**Flow:**
1. User types in search input
2. `searchQuery` state updates immediately (UI responsive)
3. Previous debounce timer cleared
4. Previous API request cancelled (if in progress)
5. New debounce timer starts (350ms)
6. After 350ms of no typing:
   - Pagination reset to page 1
   - Fetch key cleared (force new fetch)
   - `loadAdminLocales(true)` called
7. API called with search parameter
8. Results filtered and displayed

### 3. Search Clearing Flow

```typescript
// When searchQuery becomes empty
if (!searchQuery.trim()) {
  // Reset pagination
  currentPageRef.current = 1;
  // Reset fetch key
  lastFetchKeyRef.current = null;
  // Load all locales (no search parameter)
  loadAdminLocales(true);
}
```

**Flow:**
1. User clears search input
2. `searchQuery` becomes empty string
3. Debounce effect triggers
4. `loadAdminLocales(true)` called without search parameter
5. All locales fetched and displayed
6. Initial state restored

---

## State Management

### State Variables

```typescript
// Core Data States
const [adminLocales, setAdminLocales] = useState<Locale[]>([]);
const [filteredLocales, setFilteredLocales] = useState<Locale[]>([]);
const [searchQuery, setSearchQuery] = useState('');

// Filter State (useReducer for complex state)
const [filters, dispatchFilter] = useReducer(filterReducer, {
  country: '',
  countryCode: '',
  stateProvince: '',
  stateCode: '',
  spotTypes: [],
  searchRadius: '',
});

// Loading States
const [loadingLocales, setLoadingLocales] = useState(false);
const [loading, setLoading] = useState(true);
const [calculatingDistances, setCalculatingDistances] = useState(false);
```

### State Updates Flow

1. **API Response → adminLocales**
   ```typescript
   setAdminLocales(newLocales);
   ```

2. **adminLocales → filteredLocales**
   ```typescript
   useEffect(() => {
     if (activeTab === 'locale' && adminLocales.length > 0) {
       const filtered = applyFilters(adminLocales, false);
       setFilteredLocales(filtered);
     }
   }, [adminLocales, applyFilters, filters, ...]);
   ```

3. **filteredLocales → UI Render**
   ```typescript
   <FlatList
     data={filteredLocales}
     renderItem={renderLocaleCard}
   />
   ```

---

## API Integration

### Service Function

**File:** `frontend/services/locale.ts`

```typescript
export const getLocales = async (
  search: string = '',
  countryCode: string = '',
  stateCode: string = '',
  spotTypes: string | string[] = '',
  page: number = 1,
  limit: number = 50,
  includeInactive: boolean = false
): Promise<LocalesResponse>
```

### API Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | string | Search query (name, description, etc.) | "Paris" |
| `countryCode` | string | ISO country code filter | "US" |
| `stateCode` | string | State/province code filter | "CA" |
| `spotTypes` | string\|string[] | Spot type filter(s) | ["beach", "mountain"] |
| `page` | number | Page number for pagination | 1 |
| `limit` | number | Items per page | 100 |
| `includeInactive` | boolean | Include inactive locales | false |

### API Request Building

```typescript
// Build query parameters
const params: any = {
  page: currentPageRef.current,
  limit: 100,
  includeInactive: false,
};

// Add search query if provided
if (searchQuery.trim()) {
  params.search = searchQuery.trim();
}

// Add country filter if provided
if (filters.countryCode && filters.countryCode.trim() !== '' && filters.countryCode !== 'all') {
  params.countryCode = filters.countryCode;
}

// Add state filter if provided
if (filters.stateCode && filters.stateCode.trim() !== '' && filters.stateCode !== 'all') {
  params.stateCode = filters.stateCode;
}

// Add spot types filter
const spotTypesParam = filters.spotTypes && filters.spotTypes.length > 0 
  ? filters.spotTypes 
  : '';

// Make API call
const response = await getLocales(
  params.search || '',
  params.countryCode || '',
  params.stateCode || '',
  spotTypesParam,
  params.page,
  params.limit,
  params.includeInactive
);
```

### API Response Structure

```typescript
interface LocalesResponse {
  success: boolean;
  message: string;
  locales: Locale[];
  pagination: {
    currentPage: number;
    totalPages: number;
    total: number;
    limit: number;
  };
}
```

---

## Filtering System

### Filter Types

#### 1. Server-Side Filters (API)
- **Search Query**: Searches name, description, country, state
- **Country Code**: Filters by country
- **State Code**: Filters by state/province
- **Spot Types**: Filters by locale types (beach, mountain, etc.)

#### 2. Client-Side Filters (Post-processing)
- **Multiple Spot Types**: When multiple types selected, show locales matching ANY
- **Search Radius**: Filter by distance from user location
- **Additional Search**: Client-side search for saved locales tab

### Filter Application Flow

```typescript
const applyFilters = useCallback((locales: Locale[], isSavedTab: boolean) => {
  let filtered = [...locales];
  
  // 1. Filter by country (if not already filtered by API)
  if (filters.countryCode && filters.countryCode !== 'all') {
    filtered = filtered.filter(locale => 
      locale.countryCode === filters.countryCode
    );
  }
  
  // 2. Filter by state (if not already filtered by API)
  if (filters.stateCode && filters.stateCode !== 'all') {
    filtered = filtered.filter(locale => 
      locale.stateCode === filters.stateCode
    );
  }
  
  // 3. Filter by spot types (multiple selection - show ANY match)
  if (filters.spotTypes && filters.spotTypes.length > 0) {
    filtered = filtered.filter(locale => 
      locale.spotTypes && locale.spotTypes.some(type => 
        filters.spotTypes.includes(type)
      )
    );
  }
  
  // 4. Client-side search (for saved tab or additional filtering)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(locale =>
      locale.name.toLowerCase().includes(query) ||
      locale.description?.toLowerCase().includes(query) ||
      locale.countryCode.toLowerCase().includes(query) ||
      locale.stateProvince?.toLowerCase().includes(query)
    );
  }
  
  // 5. Filter by search radius (requires location)
  if (filters.searchRadius && filters.searchRadius.trim() !== '') {
    const radiusKm = parseFloat(filters.searchRadius.trim());
    if (!isNaN(radiusKm) && radiusKm > 0) {
      if (userLocation && locationPermissionGranted) {
        filtered = filtered.filter(locale => {
          const distance = getLocaleDistance(locale);
          return distance !== null && distance <= radiusKm;
        });
      } else {
        // No location permission - show empty
        filtered = [];
      }
    }
  }
  
  // 6. Sort by distance (nearest first)
  const sorted = sortLocalesByDistance(filtered);
  
  return sorted;
}, [filters, searchQuery, userLocation, locationPermissionGranted, ...]);
```

---

## Distance Calculation

### Overview

The system calculates distances between user location and locales using:
1. **Google Places API**: Fetches exact tourist spot coordinates (not city center)
2. **Distance Calculation**: Uses Haversine formula or OSRM API
3. **Caching**: Stores calculated distances to avoid recalculation

### Flow

```typescript
// 1. Check if user location is available
if (userLocation && locationPermissionGranted) {
  setCalculatingDistances(true);
  
  // 2. Fetch real coordinates for all locales
  const localeResults = await Promise.allSettled(
    newLocales.map(async (locale) => {
      // Fetch real coordinates from Google Places API
      const realCoords = await fetchRealCoords(
        locale.name,
        locale.countryCode,
        googleGeocodeCacheRef.current,
        locale.description
      );
      
      // Use real coordinates or fallback to existing
      const updatedLocale = realCoords 
        ? { ...locale, latitude: realCoords.lat, longitude: realCoords.lon }
        : locale;
      
      // Calculate distance
      const distance = await calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        updatedLocale.latitude,
        updatedLocale.longitude
      );
      
      return {
        ...updatedLocale,
        distanceKm: distance
      };
    })
  );
  
  // 3. Process results (handle failures gracefully)
  const localesWithDistances = localeResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Fallback to original locale if distance calculation fails
      return newLocales[index];
    }
  });
  
  // 4. Update state
  setAdminLocales(localesWithDistances);
  setCalculatingDistances(false);
}
```

### Distance Sorting

```typescript
const sortLocalesByDistance = (locales: Locale[]) => {
  return [...locales].sort((a, b) => {
    const aWithDistance = a as Locale & { distanceKm?: number | null };
    const bWithDistance = b as Locale & { distanceKm?: number | null };
    
    const distanceA = aWithDistance.distanceKm ?? Infinity;
    const distanceB = bWithDistance.distanceKm ?? Infinity;
    
    // If both have distances, sort by distance
    if (distanceA !== Infinity && distanceB !== Infinity) {
      return distanceA - distanceB;
    }
    
    // If only one has distance, prioritize it
    if (distanceA !== Infinity) return -1;
    if (distanceB !== Infinity) return 1;
    
    // If neither has distance, sort by createdAt (newest first)
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
};
```

---

## Performance Optimizations

### 1. Debouncing

**Purpose**: Reduce API calls while user is typing

```typescript
const SEARCH_DEBOUNCE_MS = 350; // 300-400ms optimal range

// Debounce implementation
useEffect(() => {
  if (searchDebounceTimerRef.current) {
    clearTimeout(searchDebounceTimerRef.current);
  }
  
  searchDebounceTimerRef.current = setTimeout(() => {
    loadAdminLocales(true);
  }, SEARCH_DEBOUNCE_MS);
}, [searchQuery]);
```

**Benefits:**
- Reduces API calls by ~70-80%
- Improves server load
- Better user experience (less flickering)

### 2. Request Cancellation

**Purpose**: Cancel outdated requests when new search is initiated

```typescript
// Cancel previous request
if (searchAbortControllerRef.current) {
  searchAbortControllerRef.current.abort();
}

// Create new abort controller
searchAbortControllerRef.current = new AbortController();

// Use in API call
try {
  const response = await getLocales(...);
} catch (error) {
  if (error.name === 'AbortError') {
    // Request was cancelled - ignore
    return;
  }
  // Handle other errors
}
```

**Benefits:**
- Prevents race conditions
- Reduces unnecessary network traffic
- Ensures UI shows latest results

### 3. Request Guards

**Purpose**: Prevent duplicate concurrent requests

```typescript
// Guard: Prevent duplicate calls
if (isSearchingRef.current || isPaginatingRef.current) {
  logger.debug('loadAdminLocales already in progress, skipping');
  return;
}

// Set guard before API call
isSearchingRef.current = true;

try {
  // API call
} finally {
  isSearchingRef.current = false;
}
```

**Benefits:**
- Prevents duplicate API calls
- Reduces server load
- Prevents state inconsistencies

### 4. Fetch Key Caching

**Purpose**: Prevent duplicate fetches with same parameters

```typescript
// Generate fetch key from params
const fetchKey = `${searchQuery}|${filters.countryCode}|${filters.stateCode}|${filters.spotTypes.join(',')}|${currentPageRef.current}`;

// Check if same request was made
if (!forceRefresh && fetchKey === lastFetchKeyRef.current) {
  logger.debug('loadAdminLocales skipped: same fetchKey', fetchKey);
  return;
}

// Update fetch key
lastFetchKeyRef.current = fetchKey;
```

**Benefits:**
- Prevents unnecessary API calls
- Improves performance
- Reduces data usage

### 5. Memoization

**Purpose**: Avoid recalculating filtered results unnecessarily

```typescript
// Memoized filtered locales
const filteredSavedLocales = useMemo(() => {
  if (activeTab === 'saved' && savedLocales.length > 0) {
    return applyFilters(savedLocales, true);
  }
  return savedLocales;
}, [savedLocales, filters, searchQuery, activeTab, applyFilters, ...]);
```

**Benefits:**
- Reduces computation
- Improves render performance
- Better battery life

### 6. Coordinate Caching

**Purpose**: Cache Google Places API results

```typescript
// Check cache first
const cacheKey = `${place}-${countryCode}-${description}`.toLowerCase().trim();

if (placesCache.has(cacheKey)) {
  const cached = placesCache.get(cacheKey);
  if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.coordinates; // Use cached
  }
}

// Fetch from API and cache
const coords = await fetchFromGooglePlaces(...);
placesCache.set(cacheKey, { coordinates: coords, timestamp: Date.now() });
```

**Benefits:**
- Reduces API calls to Google Places
- Saves API quota
- Faster response times

---

## Error Handling

### Network Errors

```typescript
try {
  const response = await getLocales(...);
} catch (error: any) {
  if (error.name === 'AbortError') {
    // Request was cancelled - ignore
    return;
  }
  
  if (isMountedRef.current) {
    // On network error, only clear if there's an active search query
    if (searchQuery.trim()) {
      // Search failed - clear search results
      setAdminLocales([]);
      setFilteredLocales([]);
    }
    // If no search query, keep existing locales (don't clear on network errors)
    
    setCalculatingDistances(false);
    setLoadingLocales(false);
    setLoading(false);
    loadedOnceRef.current = true; // Mark as loaded to prevent reload loops
  }
  
  logger.error('Error loading locales:', error);
}
```

### Empty Results

```typescript
if (newLocales.length === 0) {
  if (isMountedRef.current) {
    // Only clear if there's an active search query
    if (searchQuery.trim()) {
      // Search returned empty - clear results
      setAdminLocales([]);
      setFilteredLocales([]);
    }
    // If no search query, keep existing locales (don't clear on network issues)
    
    setCalculatingDistances(false);
    setLoadingLocales(false);
    setLoading(false);
    loadedOnceRef.current = true;
  }
  isSearchingRef.current = false;
  return;
}
```

### Distance Calculation Errors

```typescript
const localeResults = await Promise.allSettled(
  newLocales.map(async (locale) => {
    try {
      const distance = await calculateDistance(...);
      return { ...locale, distanceKm: distance };
    } catch (error) {
      // Fallback to original locale if distance calculation fails
      logger.error('Error calculating distance:', error);
      return locale; // Return without distance
    }
  })
);

// Process results - handle failures gracefully
const localesWithDistances = localeResults.map((result, index) => {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    // Use original locale if distance calculation failed
    return newLocales[index];
  }
});
```

---

## Edge Cases & Guard Mechanisms

### 1. Initial Load Guard

**Problem**: Prevent unnecessary reloads on initial mount

```typescript
const isInitialLoad = !hasLocales && !loadedOnceRef.current;

if (loadedOnceRef.current && !forceRefresh && hasLocales && !needsDistanceCalculation && !isInitialLoad) {
  return; // Skip reload
}
```

### 2. Empty Search Results Guard

**Problem**: Prevent infinite loops when search returns empty

```typescript
if (newLocales.length === 0) {
  if (searchQuery.trim()) {
    // Search returned empty - clear results
    setAdminLocales([]);
    setFilteredLocales([]);
  }
  // Don't clear if no search query (preserve existing locales)
  loadedOnceRef.current = true; // Prevent reload loops
  return;
}
```

### 3. Search Clearing Guard

**Problem**: Ensure locales reload when search is cleared

```typescript
// In search debounce effect
if (!searchQuery.trim()) {
  // Search cleared - reset guards to allow reload
  loadedOnceRef.current = false;
  lastFetchKeyRef.current = null;
  currentPageRef.current = 1;
  loadAdminLocales(true);
}
```

### 4. Component Unmount Guard

**Problem**: Prevent state updates after component unmounts

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
  };
}, []);

// Check before state updates
if (isMountedRef.current) {
  setAdminLocales(newLocales);
}
```

### 5. Concurrent Request Guard

**Problem**: Prevent multiple simultaneous API calls

```typescript
if (isSearchingRef.current || isPaginatingRef.current) {
  logger.debug('Request already in progress, skipping');
  return;
}

isSearchingRef.current = true;
try {
  // API call
} finally {
  isSearchingRef.current = false;
}
```

### 6. Distance Calculation Guard

**Problem**: Prevent distance calculation when not needed

```typescript
// Only calculate if:
// 1. User location is available
// 2. Location permission is granted
// 3. Locales have coordinates
if (userLocation && locationPermissionGranted && newLocales.length > 0) {
  // Calculate distances
} else {
  // Skip distance calculation
  setAdminLocales(newLocales);
}
```

---

## Code Examples

### Example 1: Basic Search Implementation

```typescript
// Search input component
<TextInput
  style={styles.searchInput}
  placeholder="Search locales..."
  value={searchQuery}
  onChangeText={(text) => {
    setSearchQuery(text);
    // Debounce handled in useEffect
  }}
  autoCapitalize="none"
  autoCorrect={false}
/>

// Debounced search effect
useEffect(() => {
  // Clear previous timer
  if (searchDebounceTimerRef.current) {
    clearTimeout(searchDebounceTimerRef.current);
  }
  
  // Cancel previous request
  if (searchAbortControllerRef.current) {
    searchAbortControllerRef.current.abort();
  }
  
  // Set new debounce timer
  searchDebounceTimerRef.current = setTimeout(() => {
    if (isMountedRef.current && !isSearchingRef.current) {
      currentPageRef.current = 1;
      lastFetchKeyRef.current = null;
      loadAdminLocales(true);
    }
  }, 350); // 350ms debounce
  
  return () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
  };
}, [searchQuery, loadAdminLocales]);
```

### Example 2: Filter Application

```typescript
// Apply filters to locales
const applyFilters = useCallback((locales: Locale[], isSavedTab: boolean) => {
  let filtered = [...locales];
  
  // Country filter
  if (filters.countryCode && filters.countryCode !== 'all') {
    filtered = filtered.filter(locale => 
      locale.countryCode === filters.countryCode
    );
  }
  
  // State filter
  if (filters.stateCode && filters.stateCode !== 'all') {
    filtered = filtered.filter(locale => 
      locale.stateCode === filters.stateCode
    );
  }
  
  // Spot types filter (multiple - show ANY match)
  if (filters.spotTypes && filters.spotTypes.length > 0) {
    filtered = filtered.filter(locale => 
      locale.spotTypes && locale.spotTypes.some(type => 
        filters.spotTypes.includes(type)
      )
    );
  }
  
  // Search query filter (client-side)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(locale =>
      locale.name.toLowerCase().includes(query) ||
      locale.description?.toLowerCase().includes(query) ||
      locale.countryCode.toLowerCase().includes(query) ||
      locale.stateProvince?.toLowerCase().includes(query)
    );
  }
  
  // Search radius filter
  if (filters.searchRadius && filters.searchRadius.trim() !== '') {
    const radiusKm = parseFloat(filters.searchRadius.trim());
    if (!isNaN(radiusKm) && radiusKm > 0 && userLocation && locationPermissionGranted) {
      filtered = filtered.filter(locale => {
        const distance = getLocaleDistance(locale);
        return distance !== null && distance <= radiusKm;
      });
    }
  }
  
  // Sort by distance
  return sortLocalesByDistance(filtered);
}, [filters, searchQuery, userLocation, locationPermissionGranted, getLocaleDistance]);
```

### Example 3: API Call with Error Handling

```typescript
const loadAdminLocales = useCallback(async (forceRefresh = false) => {
  // Request guard
  if (isSearchingRef.current || isPaginatingRef.current) {
    return;
  }
  
  // Fetch key check
  const fetchKey = `${searchQuery}|${filters.countryCode}|${filters.stateCode}|${filters.spotTypes.join(',')}|${currentPageRef.current}`;
  if (!forceRefresh && fetchKey === lastFetchKeyRef.current) {
    return;
  }
  
  lastFetchKeyRef.current = fetchKey;
  isSearchingRef.current = true;
  
  // Cancel previous request
  if (searchAbortControllerRef.current) {
    searchAbortControllerRef.current.abort();
  }
  searchAbortControllerRef.current = new AbortController();
  
  try {
    if (isMountedRef.current) {
      setLoadingLocales(true);
      setLoading(true);
    }
    
    // Build params
    const params: any = {
      page: currentPageRef.current,
      limit: 100,
      includeInactive: false,
    };
    
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }
    
    if (filters.countryCode && filters.countryCode !== 'all') {
      params.countryCode = filters.countryCode;
    }
    
    // API call
    const response = await getLocales(
      params.search || '',
      params.countryCode || '',
      params.stateCode || '',
      filters.spotTypes,
      params.page,
      params.limit,
      params.includeInactive
    );
    
    if (!isMountedRef.current) return;
    
    if (response && response.locales) {
      const newLocales = response.locales;
      
      // Handle empty results
      if (newLocales.length === 0) {
        if (searchQuery.trim()) {
          setAdminLocales([]);
          setFilteredLocales([]);
        }
        setLoadingLocales(false);
        setLoading(false);
        loadedOnceRef.current = true;
        isSearchingRef.current = false;
        return;
      }
      
      // Process locales (distance calculation, etc.)
      // ... (see distance calculation section)
      
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return; // Request cancelled
    }
    
    if (isMountedRef.current) {
      if (searchQuery.trim()) {
        setAdminLocales([]);
        setFilteredLocales([]);
      }
      setCalculatingDistances(false);
      setLoadingLocales(false);
      setLoading(false);
      loadedOnceRef.current = true;
    }
    
    logger.error('Error loading locales:', error);
  } finally {
    if (isMountedRef.current) {
      setLoadingLocales(false);
      setLoading(false);
      setCalculatingDistances(false);
    }
    isSearchingRef.current = false;
  }
}, [searchQuery, filters, ...]);
```

---

## Troubleshooting

### Issue 1: Search Not Working

**Symptoms:**
- Typing in search doesn't trigger API call
- No results shown

**Possible Causes:**
1. Debounce timer not clearing properly
2. Request guard blocking calls
3. API error not handled

**Solutions:**
```typescript
// Check debounce timer
if (searchDebounceTimerRef.current) {
  clearTimeout(searchDebounceTimerRef.current);
}

// Check request guard
if (isSearchingRef.current) {
  // Wait for current request to complete
  return;
}

// Check API call
try {
  const response = await getLocales(...);
} catch (error) {
  logger.error('Search error:', error);
  // Handle error
}
```

### Issue 2: Infinite Loading

**Symptoms:**
- Loading spinner never stops
- No results displayed

**Possible Causes:**
1. `loadedOnceRef` not set after empty results
2. Loading state not reset in error handler
3. Component unmount check missing

**Solutions:**
```typescript
// Always reset loading states
finally {
  if (isMountedRef.current) {
    setLoadingLocales(false);
    setLoading(false);
    setCalculatingDistances(false);
  }
  isSearchingRef.current = false;
}

// Mark as loaded after empty results
if (newLocales.length === 0) {
  loadedOnceRef.current = true;
  // Reset loading states
  return;
}
```

### Issue 3: Search Clearing Doesn't Restore Locales

**Symptoms:**
- Clearing search shows empty state
- Initial locales not restored

**Possible Causes:**
1. `loadedOnceRef` blocking reload
2. Fetch key not reset
3. Empty results clearing locales incorrectly

**Solutions:**
```typescript
// Reset guards when search cleared
if (!searchQuery.trim()) {
  loadedOnceRef.current = false;
  lastFetchKeyRef.current = null;
  currentPageRef.current = 1;
  loadAdminLocales(true);
}

// Don't clear locales on empty results if no search
if (newLocales.length === 0) {
  if (searchQuery.trim()) {
    // Only clear if there's an active search
    setAdminLocales([]);
    setFilteredLocales([]);
  }
  // Otherwise keep existing locales
}
```

### Issue 4: Distance Not Calculating

**Symptoms:**
- Locales not sorted by distance
- Distance not displayed

**Possible Causes:**
1. Location permission not granted
2. User location not available
3. Distance calculation failing silently

**Solutions:**
```typescript
// Check location permission
if (!locationPermissionGranted) {
  // Request permission
  const { status } = await Location.requestForegroundPermissionsAsync();
  setLocationPermissionGranted(status === 'granted');
}

// Check user location
if (!userLocation) {
  // Get user location
  const location = await Location.getCurrentPositionAsync({});
  setUserLocation({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  });
}

// Handle distance calculation errors
try {
  const distance = await calculateDistance(...);
} catch (error) {
  logger.error('Distance calculation error:', error);
  // Fallback to locale without distance
}
```

### Issue 5: Duplicate API Calls

**Symptoms:**
- Multiple API calls for same search
- Network tab shows duplicate requests

**Possible Causes:**
1. Request guard not working
2. Fetch key not matching
3. Multiple effects triggering

**Solutions:**
```typescript
// Ensure request guard is set
if (isSearchingRef.current) {
  return; // Skip if already searching
}

isSearchingRef.current = true;

// Ensure fetch key matches
const fetchKey = `${searchQuery}|${filters.countryCode}|...`;
if (!forceRefresh && fetchKey === lastFetchKeyRef.current) {
  return; // Skip if same request
}

// Check effect dependencies
useEffect(() => {
  // Only trigger when searchQuery changes
}, [searchQuery]); // Not [searchQuery, loadAdminLocales] to avoid loops
```

---

## Best Practices

### 1. Always Use Request Guards
```typescript
if (isSearchingRef.current) return;
isSearchingRef.current = true;
try {
  // API call
} finally {
  isSearchingRef.current = false;
}
```

### 2. Always Check Component Mount
```typescript
if (!isMountedRef.current) return;
setState(...);
```

### 3. Always Cancel Previous Requests
```typescript
if (searchAbortControllerRef.current) {
  searchAbortControllerRef.current.abort();
}
searchAbortControllerRef.current = new AbortController();
```

### 4. Always Reset Loading States
```typescript
finally {
  setLoadingLocales(false);
  setLoading(false);
  setCalculatingDistances(false);
}
```

### 5. Always Handle Empty Results
```typescript
if (newLocales.length === 0) {
  if (searchQuery.trim()) {
    // Clear results for search
  } else {
    // Keep existing locales for initial load
  }
  return;
}
```

### 6. Use Debouncing for Search
```typescript
// Always debounce search input
const SEARCH_DEBOUNCE_MS = 350;
setTimeout(() => {
  loadAdminLocales(true);
}, SEARCH_DEBOUNCE_MS);
```

### 7. Cache API Results
```typescript
// Use fetch key to prevent duplicate requests
const fetchKey = `${searchQuery}|${filters}...`;
if (fetchKey === lastFetchKeyRef.current) {
  return; // Skip duplicate
}
```

---

## Testing Checklist

### Functional Tests
- [ ] Initial load shows all locales
- [ ] Search with valid keyword shows results
- [ ] Search with invalid keyword shows "No Locales Found"
- [ ] Clearing search restores initial locales
- [ ] Filters work correctly
- [ ] Multiple filters work together
- [ ] Distance sorting works when location available
- [ ] Pagination works correctly

### Performance Tests
- [ ] Debouncing reduces API calls
- [ ] Request cancellation works
- [ ] No duplicate API calls
- [ ] Caching works correctly
- [ ] Memoization improves performance

### Error Handling Tests
- [ ] Network errors handled gracefully
- [ ] Empty results handled correctly
- [ ] Component unmount doesn't cause errors
- [ ] Aborted requests don't cause errors
- [ ] Distance calculation errors handled

### Edge Case Tests
- [ ] Rapid typing doesn't cause issues
- [ ] Clearing search while loading works
- [ ] Switching tabs during search works
- [ ] Location permission denied handled
- [ ] No location available handled

---

## Conclusion

The Locale Search functionality is a complex, production-grade feature that combines server-side and client-side processing for optimal performance and user experience. Key takeaways:

1. **Debouncing is essential** for search input to reduce API calls
2. **Request guards prevent** duplicate calls and race conditions
3. **Error handling must be comprehensive** to handle all edge cases
4. **State management is critical** for maintaining UI consistency
5. **Performance optimizations** (caching, memoization) are necessary for smooth UX
6. **Distance calculation** adds value but requires careful error handling

For new developers, focus on understanding:
- The debounce mechanism
- Request guards and why they're needed
- State update flow (API → adminLocales → filteredLocales → UI)
- Error handling patterns
- Edge case handling

---

## Related Files

- **Main Component**: `frontend/app/(tabs)/locale.tsx`
- **Service**: `frontend/services/locale.ts`
- **Location Utils**: `frontend/utils/locationUtils.ts`
- **Logger**: `frontend/utils/logger.ts`

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-31  
**Author**: Development Team  
**Status**: Production Ready


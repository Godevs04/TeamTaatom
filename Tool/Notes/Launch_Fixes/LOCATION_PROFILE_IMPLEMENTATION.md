# Location Profile Implementation - Complete Guide

## Overview
This document explains how location data is generated, displayed, and managed for user profiles in the Taatom app. It covers both **own user profile** and **other users' profiles**, including the globe icon, verified locations, traveled trips, and privacy considerations.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Sources](#data-sources)
3. [Own User Profile Implementation](#own-user-profile-implementation)
4. [Other User Profile Implementation](#other-user-profile-implementation)
5. [Globe Component](#globe-component)
6. [Verified Locations System](#verified-locations-system)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Privacy & Visibility Rules](#privacy--visibility-rules)
10. [Implementation Details](#implementation-details)

---

## Architecture Overview

### Location Data Flow

```
User Creates Post with Location
    ↓
Post.location.coordinates (lat/lng) + address
    ↓
TripVisit Created (if location valid)
    ↓
Verification Process (auto_verified/pending_review/approved/rejected)
    ↓
Verified Locations (VERIFIED_STATUSES only)
    ↓
Profile Display (Globe + Count)
```

### Key Concepts

1. **Regular Locations**: From `Post.location` - all posts with location data
2. **Verified Locations**: From `TripVisit` with `verificationStatus` in `['auto_verified', 'approved']`
3. **Traveled Trips**: Chronological sequence of verified locations
4. **Globe Icon**: Visual representation of locations on a rotating globe

---

## Data Sources

### 1. Post Locations (`Post.location`)
**Source**: `backend/src/models/Post.js`

```javascript
location: {
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  address: String,
  // ... other fields
}
```

**Usage**:
- Displayed in profile as `profile.locations` array
- Used for basic location display
- Not verified (can be manually set by user)

**Limitations**:
- User can manually set any location
- No verification required
- May not reflect actual travel

### 2. TripVisit Locations (`TripVisit`)
**Source**: `backend/src/models/TripVisit.js`

```javascript
{
  user: ObjectId,
  lat: Number,
  lng: Number,
  address: String,
  country: String,
  continent: String,
  verificationStatus: 'auto_verified' | 'pending_review' | 'approved' | 'rejected',
  takenAt: Date,
  uploadedAt: Date,
  isActive: Boolean,
  // ... metadata fields
}
```

**Usage**:
- Only verified locations (`verificationStatus` in `VERIFIED_STATUSES`)
- Used for TripScore calculation
- Used for travel map display
- More reliable than Post locations

**Verification Statuses**:
- `auto_verified`: Automatically verified (has EXIF data, reasonable distance/time)
- `approved`: Manually approved by admin
- `pending_review`: Awaiting admin review
- `rejected`: Rejected (fraudulent or invalid)

**VERIFIED_STATUSES** (from `backend/src/config/tripScoreConfig.js`):
```javascript
['auto_verified', 'approved']
```

---

## Own User Profile Implementation

### File: `frontend/app/(tabs)/profile.tsx`

### Location Display Section

**Component Structure**:
```tsx
<Pressable onPress={() => router.push(`/map/all-locations?userId=${userId}`)}>
  {/* Header */}
  <View style={styles.locationCardHeader}>
    <Ionicons name="globe" size={24} />
    <Text>My Location</Text>
    <Text>
      {verifiedLocationsCount > 0
        ? `${verifiedLocationsCount} verified locations visited`
        : profileData?.locations?.length > 0
        ? `${profileData.locations.length} locations visited`
        : 'Add your home base'}
    </Text>
  </View>
  
  {/* Globe Visualization */}
  <View style={styles.locationGlobeContainer}>
    {(verifiedLocationsCount > 0) || (profileData?.locations?.length > 0) ? (
      <RotatingGlobe 
        locations={profileData?.locations || []} 
        size={140} 
      />
    ) : (
      <Ionicons name="globe-outline" size={64} />
    )}
  </View>
</Pressable>
```

### Data Fetching

**Parallel Fetching** (lines 227-232):
```typescript
const [profileResult, userPosts, shortsResp, travelMapResult] = await Promise.allSettled([
  getProfile(userData._id),           // Gets profile + regular locations
  getUserPosts(userData._id),
  getUserShorts(userData._id, 1, 100),
  getTravelMapData(userData._id)     // Gets verified locations count
]);
```

**Verified Locations Count** (lines 248-251):
```typescript
if (travelMapResult.status === 'fulfilled' && travelMapResult.value?.data?.statistics) {
  setVerifiedLocationsCount(travelMapResult.value.data.statistics.totalLocations);
}
```

### Display Logic

**Priority Order**:
1. **Verified Locations Count** (from `getTravelMapData` API)
   - Shows: `"X verified locations visited"`
   - Uses `verifiedLocationsCount` state
   - Most reliable data

2. **Regular Locations** (from `getProfile` API)
   - Shows: `"X locations visited"`
   - Uses `profileData.locations.length`
   - Fallback if no verified locations

3. **Empty State**
   - Shows: `"Add your home base"`
   - When no locations exist

### Single Frame Display

**All in One Card**:
- **Header**: Globe icon + "My Location" title + count subtitle
- **Globe**: Rotating globe visualization (140px size)
- **Navigation**: Tapping navigates to `/map/all-locations?userId={userId}`

**What's Shown**:
- ✅ User's current location (if set)
- ✅ Verified locations count
- ✅ Traveled trips (via verified locations)
- ✅ Visual globe representation

---

## Other User Profile Implementation

### File: `frontend/app/profile/[id].tsx`

### Location Display Section

**Component Structure**:
```tsx
<Pressable 
  onPress={() => {
    if (verifiedLocationsCount > 0) {
      router.push(`/map/all-locations?userId=${id}`);
    } else if (profile.canViewLocations && profile.locations?.length > 0) {
      setShowWorldMap(true); // Fallback to old world map
    }
  }}
>
  {/* Header */}
  <View style={styles.locationCardHeader}>
    <Ionicons name="globe" size={24} />
    <Text>My Location</Text>
    <Text>
      {verifiedLocationsCount > 0
        ? `${verifiedLocationsCount} verified locations visited`
        : profile.canViewLocations && profile.locations?.length > 0
        ? `${profile.locations.length} locations visited`
        : profile.canViewLocations
        ? 'No locations yet'
        : profile.profileVisibility === 'followers'
        ? 'Follow to view locations'
        : profile.profileVisibility === 'private'
        ? 'Follow request pending to view locations'
        : 'Follow to view locations'}
    </Text>
  </View>
  
  {/* Globe Visualization */}
  <View style={styles.locationGlobeContainer}>
    {(verifiedLocationsCount > 0) || (profile.canViewLocations && profile.locations?.length > 0) ? (
      <RotatingGlobe locations={profile.locations || []} size={140} />
    ) : (
      <Ionicons name="globe-outline" size={64} />
    )}
  </View>
</Pressable>
```

### Privacy & Visibility Rules

**Display Logic** (lines 677-687):
```typescript
{verifiedLocationsCount > 0
  ? `${verifiedLocationsCount} verified locations visited`
  : profile.canViewLocations && profile.locations?.length > 0
  ? `${profile.locations.length} locations visited`
  : profile.canViewLocations
  ? 'No locations yet'
  : profile.profileVisibility === 'followers'
  ? 'Follow to view locations'
  : profile.profileVisibility === 'private'
  ? 'Follow request pending to view locations'
  : 'Follow to view locations'}
```

**Privacy States**:
1. **Verified locations available**: Show count (always visible)
2. **Can view locations** (`profile.canViewLocations === true`):
   - If locations exist: Show count
   - If no locations: "No locations yet"
3. **Cannot view locations** (`profile.canViewLocations === false`):
   - Profile visibility = 'followers': "Follow to view locations"
   - Profile visibility = 'private': "Follow request pending to view locations"
   - Default: "Follow to view locations"

### Differences from Own Profile

| Feature | Own Profile | Other User Profile |
|---------|-----------|-------------------|
| **Title** | "My Location" | "My Location" (should be "Their Location" - **NOT YET FIXED**) |
| **Verified Count** | Always shown if available | Shown if available (no privacy check) |
| **Regular Locations** | Shown if no verified | Shown only if `canViewLocations === true` |
| **Empty State** | "Add your home base" | Privacy-aware messages |
| **Navigation** | Always to `/map/all-locations` | Conditional (verified → map, regular → world map) |
| **Globe Display** | Always shows if locations exist | Only if `canViewLocations === true` |

**⚠️ Known Issue**: Other user profile shows "My Location" instead of "Their Location" - **NOT YET FIXED**

---

## Globe Component

### File: `frontend/components/RotatingGlobe.tsx`

### Purpose
Visual representation of user's locations on a rotating 3D globe icon.

### Props
```typescript
interface RotatingGlobeProps {
  locations: Location[];  // Array of { latitude, longitude, address }
  size?: number;          // Default: 24px
  onLocationPress?: (location: Location) => void;
}
```

### Implementation

**Animation**:
```typescript
const rotateAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.loop(
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 8000,  // 8 seconds per rotation
      useNativeDriver: true,
    })
  ).start();
}, [rotateAnim]);

const rotation = rotateAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg'],
});
```

**Visual**:
- Uses `Ionicons` "earth" icon
- Rotates continuously (360° every 8 seconds)
- Size: 140px in profile, 24px default

**Behavior**:
- If locations exist: Calls `onLocationPress` callback
- If no locations: Navigates to `/map/current-location`

### Usage in Profiles

**Own Profile** (`profile.tsx` line 1225-1228):
```tsx
<RotatingGlobe 
  locations={profileData?.locations || []} 
  size={140} 
/>
```

**Other User Profile** (`profile/[id].tsx` line 696-699):
```tsx
<RotatingGlobe 
  locations={profile.locations || []} 
  size={140} 
/>
```

**Note**: Currently uses `profile.locations` (regular locations), not verified locations. This may need updating to use verified locations for better accuracy.

---

## Verified Locations System

### Backend: TripVisit Model

**File**: `backend/src/models/TripVisit.js`

**Key Fields**:
```javascript
{
  user: ObjectId,                    // User who visited
  lat: Number,                       // Latitude
  lng: Number,                       // Longitude
  address: String,                   // Human-readable address
  country: String,                   // Country name
  continent: String,                 // Continent name
  verificationStatus: String,        // 'auto_verified' | 'pending_review' | 'approved' | 'rejected'
  takenAt: Date,                     // When photo was taken (from EXIF)
  uploadedAt: Date,                  // When post was uploaded
  isActive: Boolean,                 // Soft delete flag
  post: ObjectId,                    // Reference to Post
  // ... metadata for fraud detection
}
```

### Verification Process

**Auto-Verification** (from `backend/src/services/tripVisitService.js`):
1. **EXIF Data Available**: Photo has location metadata → `auto_verified`
2. **Manual Location**: User manually set location → `pending_review`
3. **Suspicious Pattern**: Unrealistic travel distance/time → `pending_review`
4. **Admin Review**: Admin can approve/reject → `approved`/`rejected`

**Verified Statuses** (`VERIFIED_STATUSES`):
```javascript
['auto_verified', 'approved']
```

**Only these statuses count towards**:
- TripScore calculation
- Verified locations count
- Travel map display
- Profile location display

### Deduplication

**Location Grouping** (0.01 degrees ≈ 1.1km tolerance):
```javascript
const roundCoordinate = (coord, precision = 2) => {
  return Math.round(coord * 100) / 100;
};

const getLocationKey = (lat, lng) => {
  return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
};
```

**Purpose**: Multiple posts at the same location are grouped as one unique place.

---

## API Endpoints

### 1. Get Profile (`GET /api/v1/profile/:id`)

**File**: `backend/src/controllers/profileController.js` (line 23)

**Returns**:
```javascript
{
  profile: {
    // ... user fields
    locations: [
      {
        latitude: Number,
        longitude: Number,
        address: String,
        date: Date
      }
    ],
    tripScore: {
      totalScore: Number,
      continents: { [key: string]: number },
      countries: { [key: string]: number },
      areas: Array
    },
    canViewLocations: Boolean,
    // ... other fields
  }
}
```

**Location Source** (lines 123-131):
- Extracted from `Post.location` where coordinates exist
- Only posts with valid coordinates (not 0,0)
- Includes address and date

**Privacy** (line 345):
```javascript
locations: canViewLocations ? locations : []
```

### 2. Get Travel Map Data (`GET /api/v1/profile/:id/travel-map`)

**File**: `backend/src/controllers/profileController.js` (line 2124)

**Returns**:
```javascript
{
  locations: [
    {
      number: Number,        // Sequential number (1, 2, 3...)
      latitude: Number,
      longitude: Number,
      address: String,
      date: Date
    }
  ],
  statistics: {
    totalLocations: Number,  // Unique verified locations count
    totalDistance: Number,   // Total distance traveled (km)
    totalDays: Number        // Days since first visit
  }
}
```

**Query** (lines 2132-2142):
```javascript
const trustedVisits = await TripVisit.find({
  user: id,
  isActive: true,
  verificationStatus: { $in: VERIFIED_STATUSES },  // Only verified
  lat: { $exists: true, $ne: null, $ne: 0 },
  lng: { $exists: true, $ne: null, $ne: 0 }
})
.select('lat lng address takenAt uploadedAt')
.sort({ takenAt: 1, uploadedAt: 1 })
.limit(1000);
```

**Deduplication** (lines 2158-2181):
- Groups nearby locations (within 0.01° ≈ 1.1km)
- Assigns sequential numbers (1, 2, 3...)
- Calculates total distance using Haversine formula

**Distance Calculation** (lines 2188-2205):
```javascript
// Haversine formula
const R = 6371; // Earth's radius in km
const dLat = (curr.latitude - prev.latitude) * Math.PI / 180;
const dLon = (curr.longitude - prev.longitude) * Math.PI / 180;
const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(prev.latitude * Math.PI / 180) * Math.cos(curr.latitude * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const distance = R * c;
```

### 3. Frontend Service: `getTravelMapData`

**File**: `frontend/services/profile.ts` (line 350)

```typescript
export const getTravelMapData = async (userId: string): Promise<TravelMapDataResponse> => {
  const response = await api.get(`/api/v1/profile/${userId}/travel-map`);
  return response.data;
};
```

**Usage**:
```typescript
// Own profile
const travelMapResult = await getTravelMapData(userData._id);
setVerifiedLocationsCount(travelMapResult.data.statistics.totalLocations);

// Other user profile
const travelMapResult = await getTravelMapData(id);
setVerifiedLocationsCount(travelMapResult.data.statistics.totalLocations);
```

---

## Frontend Components

### 1. Profile Screen (Own User)

**File**: `frontend/app/(tabs)/profile.tsx`

**Key State**:
```typescript
const [verifiedLocationsCount, setVerifiedLocationsCount] = useState<number | null>(null);
const [profileData, setProfileData] = useState<ProfileData | null>(null);
```

**Data Fetching** (lines 227-251):
```typescript
const [profileResult, userPosts, shortsResp, travelMapResult] = await Promise.allSettled([
  getProfile(userData._id),           // Regular locations
  getUserPosts(userData._id),
  getUserShorts(userData._id, 1, 100),
  getTravelMapData(userData._id)      // Verified locations count
]);

// Extract verified count
if (travelMapResult.status === 'fulfilled' && travelMapResult.value?.data?.statistics) {
  setVerifiedLocationsCount(travelMapResult.value.data.statistics.totalLocations);
}
```

**Display** (lines 1197-1235):
- Single unified card
- Shows verified count if available
- Falls back to regular locations count
- Globe visualization
- Navigates to `/map/all-locations` on tap

### 2. User Profile Screen (Other Users)

**File**: `frontend/app/profile/[id].tsx`

**Key State**:
```typescript
const [verifiedLocationsCount, setVerifiedLocationsCount] = useState<number | null>(null);
const [profile, setProfile] = useState<any>(null);
```

**Data Fetching** (lines 276-278):
```typescript
const [profileResult, travelMapResult] = await Promise.allSettled([
  getProfile(id),
  getTravelMapData(id)
]);

// Extract verified count
if (travelMapResult.status === 'fulfilled' && travelMapResult.value?.data?.statistics) {
  setVerifiedLocationsCount(travelMapResult.value.data.statistics.totalLocations);
}
```

**Display** (lines 657-706):
- Same card structure as own profile
- Privacy-aware messaging
- Conditional navigation (verified → map, regular → world map)
- Respects `profile.canViewLocations` flag

### 3. RotatingGlobe Component

**File**: `frontend/components/RotatingGlobe.tsx`

**Features**:
- Continuous rotation (8 seconds per 360°)
- Uses `Ionicons` "earth" icon
- Configurable size (default 24px, profile uses 140px)
- Touch handler for navigation

**Limitation**: Currently receives `profile.locations` (regular locations), not verified locations. Should ideally use verified locations for accuracy.

### 4. All Locations Map Screen

**File**: `frontend/app/map/all-locations.tsx`

**Purpose**: Full-screen map showing all verified locations

**Data Fetching**:
```typescript
const response = await getTravelMapData(userId);
const { locations, statistics } = response.data;
```

**Display**:
- Map with numbered markers (1, 2, 3...)
- Sequential order (chronological)
- Shows address, date for each location
- Statistics: total locations, distance, days

---

## Privacy & Visibility Rules

### Backend Privacy Logic

**File**: `backend/src/controllers/profileController.js` (lines 60-120)

**Visibility Check**:
```javascript
const isOwnProfile = req.user && req.user._id.toString() === id;
const profileVisibility = user.profileVisibility || 'public';
const isFollowing = req.user ? await checkFollowing(req.user._id, id) : false;
const followRequestSent = req.user ? await checkFollowRequest(req.user._id, id) : false;

let canViewLocations = false;

if (isOwnProfile) {
  canViewLocations = true;  // Always can view own locations
} else {
  switch (profileVisibility) {
    case 'public':
      canViewLocations = true;
      break;
    case 'followers':
      canViewLocations = isFollowing;
      break;
    case 'private':
      canViewLocations = isFollowing && !followRequestSent;
      break;
  }
}
```

**Location Filtering** (line 345):
```javascript
locations: canViewLocations ? locations : []
```

### Frontend Privacy Display

**Other User Profile** (`profile/[id].tsx` lines 677-687):

**Message Priority**:
1. Verified locations count (always shown if available)
2. Regular locations count (if `canViewLocations === true`)
3. "No locations yet" (if `canViewLocations === true` but no locations)
4. Privacy messages (if `canViewLocations === false`)

**Privacy Messages**:
- `profileVisibility === 'followers'`: "Follow to view locations"
- `profileVisibility === 'private'`: "Follow request pending to view locations"
- Default: "Follow to view locations"

---

## Implementation Details

### Location Data Structure

**Regular Locations** (from `Post.location`):
```typescript
interface Location {
  latitude: number;
  longitude: number;
  address: string;
  date: string;  // ISO date string
}
```

**Verified Locations** (from `TripVisit`):
```typescript
interface VerifiedLocation {
  number: number;           // Sequential (1, 2, 3...)
  latitude: number;
  longitude: number;
  address: string;
  date: Date;               // takenAt or uploadedAt
}
```

### Coordinate Precision

**Rounding** (for deduplication):
```javascript
const roundCoordinate = (coord, precision = 2) => {
  return Math.round(coord * 100) / 100;  // 0.01° ≈ 1.1km
};
```

**Purpose**: Groups nearby locations (within ~1.1km) as one unique place.

### Distance Calculation

**Haversine Formula**:
```javascript
const R = 6371; // Earth's radius in km
const dLat = (lat2 - lat1) * Math.PI / 180;
const dLon = (lng2 - lng1) * Math.PI / 180;
const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const distance = R * c; // Distance in km
```

**Usage**: Calculates total distance traveled between sequential verified locations.

### Verification Status Flow

```
Post Created with Location
    ↓
TripVisit Created
    ↓
Verification Check:
  - Has EXIF? → auto_verified
  - Manual location? → pending_review
  - Suspicious? → pending_review
    ↓
Admin Review (optional)
    ↓
Final Status: auto_verified | approved | pending_review | rejected
    ↓
Only auto_verified + approved count towards:
  - Verified locations count
  - TripScore
  - Travel map
```

---

## Current Implementation Status

### ✅ Working Features

1. **Own Profile**:
   - ✅ Shows verified locations count
   - ✅ Shows regular locations count (fallback)
   - ✅ Globe visualization
   - ✅ Navigation to full map
   - ✅ Single unified card display

2. **Other User Profile**:
   - ✅ Shows verified locations count (if available)
   - ✅ Privacy-aware messaging
   - ✅ Respects `canViewLocations` flag
   - ✅ Conditional navigation
   - ✅ Globe visualization (if allowed)

3. **Backend**:
   - ✅ Verified locations API (`/travel-map`)
   - ✅ Regular locations in profile API
   - ✅ Privacy checks
   - ✅ Deduplication logic
   - ✅ Distance calculation

### ⚠️ Known Issues / Not Yet Fixed

1. **Other User Profile Title**:
   - **Issue**: Shows "My Location" instead of "Their Location"
   - **Location**: `frontend/app/profile/[id].tsx` line 675
   - **Fix Needed**: Change title based on `isOwnProfile` flag

2. **Globe Component Data**:
   - **Issue**: Uses `profile.locations` (regular) instead of verified locations
   - **Location**: Both profile files
   - **Fix Needed**: Pass verified locations to `RotatingGlobe` component

3. **Single Frame Display** (Own Profile):
   - **Current**: Shows location count + globe
   - **Requested**: Show current location + traveled trips + verified locations in single frame
   - **Status**: **NOT YET IMPLEMENTED**

4. **Traveled Trips Display**:
   - **Current**: Only count is shown
   - **Requested**: Show actual trip information (dates, places)
   - **Status**: **NOT YET IMPLEMENTED**

---

## Required Fixes for Complete Implementation

### Fix 1: Other User Profile Title

**File**: `frontend/app/profile/[id].tsx`

**Current** (line 675):
```tsx
<Text style={[styles.locationTitle, { color: profileTheme.textPrimary }]}>My Location</Text>
```

**Should Be**:
```tsx
<Text style={[styles.locationTitle, { color: profileTheme.textPrimary }]}>
  {profile.isOwnProfile ? 'My Location' : 'Their Location'}
</Text>
```

### Fix 2: Use Verified Locations in Globe

**Current**: Globe receives `profile.locations` (regular locations)

**Should Be**: Globe receives verified locations from `getTravelMapData`

**Implementation**:
```typescript
// Fetch verified locations
const travelMapResult = await getTravelMapData(userId);
const verifiedLocations = travelMapResult.data.locations.map(loc => ({
  latitude: loc.latitude,
  longitude: loc.longitude,
  address: loc.address
}));

// Pass to Globe
<RotatingGlobe locations={verifiedLocations || profile.locations || []} size={140} />
```

### Fix 3: Single Frame Display (Own Profile)

**Requested**: Show in single frame:
- Current location (home base)
- Traveled trips count/list
- Verified locations count

**Implementation Approach**:
```tsx
<View style={styles.unifiedLocationFrame}>
  {/* Current Location */}
  <View style={styles.currentLocationSection}>
    <Ionicons name="home" size={20} />
    <Text>{userHomeLocation || 'Not set'}</Text>
  </View>
  
  {/* Traveled Trips */}
  <View style={styles.tripsSection}>
    <Text>{tripsCount} trips</Text>
    <Text>{countriesCount} countries</Text>
  </View>
  
  {/* Verified Locations */}
  <View style={styles.verifiedSection}>
    <Text>{verifiedLocationsCount} verified locations</Text>
  </View>
  
  {/* Globe */}
  <RotatingGlobe locations={verifiedLocations} size={140} />
</View>
```

**Data Needed**:
- User's home location (from User model or settings)
- Trips count (from TripVisit grouped by date ranges)
- Countries count (from TripVisit unique countries)

### Fix 4: Traveled Trips Display

**Requested**: Show actual trip information

**Implementation Approach**:
```typescript
// Group verified locations by trips (gaps > 7 days = new trip)
const trips = groupLocationsByTrips(verifiedLocations);

// Display
trips.map((trip, index) => (
  <View key={index}>
    <Text>Trip {index + 1}</Text>
    <Text>{trip.startDate} - {trip.endDate}</Text>
    <Text>{trip.locations.length} places</Text>
    <Text>{trip.countries.join(', ')}</Text>
  </View>
));
```

---

## API Response Examples

### Get Profile Response

```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "profile": {
      "_id": "user123",
      "username": "johndoe",
      "fullName": "John Doe",
      "locations": [
        {
          "latitude": 40.7128,
          "longitude": -74.0060,
          "address": "New York, NY, USA",
          "date": "2024-01-15T10:30:00Z"
        },
        {
          "latitude": 51.5074,
          "longitude": -0.1278,
          "address": "London, UK",
          "date": "2024-02-20T14:20:00Z"
        }
      ],
      "tripScore": {
        "totalScore": 250,
        "continents": { "North America": 100, "Europe": 150 },
        "countries": { "United States": 50, "United Kingdom": 50 }
      },
      "canViewLocations": true,
      "isOwnProfile": false
    }
  }
}
```

### Get Travel Map Data Response

```json
{
  "success": true,
  "message": "Travel map data fetched successfully",
  "data": {
    "locations": [
      {
        "number": 1,
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "New York, NY, USA",
        "date": "2024-01-15T10:30:00Z"
      },
      {
        "number": 2,
        "latitude": 51.5074,
        "longitude": -0.1278,
        "address": "London, UK",
        "date": "2024-02-20T14:20:00Z"
      }
    ],
    "statistics": {
      "totalLocations": 2,
      "totalDistance": 5570,
      "totalDays": 36
    }
  }
}
```

---

## Database Schema

### TripVisit Collection

**Indexes**:
```javascript
{ user: 1, continent: 1, country: 1 }
{ user: 1, takenAt: 1 }
{ user: 1, verificationStatus: 1 }
{ user: 1, isActive: 1 }
```

**Query Pattern** (for verified locations):
```javascript
TripVisit.find({
  user: userId,
  isActive: true,
  verificationStatus: { $in: ['auto_verified', 'approved'] },
  lat: { $exists: true, $ne: null, $ne: 0 },
  lng: { $exists: true, $ne: null, $ne: 0 }
})
.sort({ takenAt: 1, uploadedAt: 1 })
.limit(1000);
```

### Post Collection

**Location Field**:
```javascript
location: {
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  address: String
}
```

**Query Pattern** (for regular locations):
```javascript
Post.find({
  user: userId,
  isActive: true,
  'location.coordinates.latitude': { $exists: true, $ne: 0 },
  'location.coordinates.longitude': { $exists: true, $ne: 0 }
})
.select('location createdAt')
.limit(100);
```

---

## Testing Checklist

### Own Profile
- [ ] Verified locations count displays correctly
- [ ] Regular locations count displays (fallback)
- [ ] Globe rotates and displays locations
- [ ] Navigation to `/map/all-locations` works
- [ ] Empty state shows "Add your home base"
- [ ] Single frame shows all required info (when implemented)

### Other User Profile
- [ ] Verified locations count displays (if available)
- [ ] Privacy messages display correctly
- [ ] `canViewLocations` flag respected
- [ ] Globe only shows if allowed
- [ ] Navigation works (verified → map, regular → world map)
- [ ] Title shows "Their Location" (when fixed)

### Backend APIs
- [ ] `/profile/:id` returns locations correctly
- [ ] `/profile/:id/travel-map` returns verified locations
- [ ] Privacy checks work (followers/private profiles)
- [ ] Deduplication works (nearby locations grouped)
- [ ] Distance calculation is accurate
- [ ] Performance is acceptable (<500ms for 1000 locations)

---

## Performance Considerations

### Optimization Strategies

1. **Caching**:
   - Profile data cached for 5 minutes
   - Travel map data can be cached (locations don't change frequently)

2. **Pagination**:
   - Travel map limited to 1000 locations
   - Profile locations limited to 100 posts

3. **Deduplication**:
   - Coordinates rounded to 0.01° (≈1.1km)
   - Reduces unique locations count significantly

4. **Parallel Fetching**:
   - Profile + Travel map fetched in parallel
   - Reduces total load time

### Query Performance

**TripVisit Query** (for verified locations):
- Uses indexes: `{ user: 1, verificationStatus: 1, isActive: 1 }`
- Sorted by `takenAt` (chronological)
- Limited to 1000 results

**Post Query** (for regular locations):
- Uses indexes: `{ user: 1, isActive: 1 }`
- Limited to 100 results

---

## Future Enhancements

### Planned Features

1. **Trip Grouping**:
   - Group locations by date ranges (gaps > 7 days = new trip)
   - Display trip summaries (dates, countries, distance)

2. **Home Location**:
   - Allow users to set home/base location
   - Display prominently in profile

3. **Trip Timeline**:
   - Chronological view of all trips
   - Visual timeline with dates and locations

4. **Location Details**:
   - Show photos taken at each location
   - Show visit dates and duration

5. **Social Features**:
   - Compare trips with friends
   - Share trip highlights

---

## Summary

### Current State

**Own Profile**:
- ✅ Shows verified locations count
- ✅ Shows regular locations (fallback)
- ✅ Globe visualization
- ⚠️ Missing: Single frame with all info (current location + trips + verified)

**Other User Profile**:
- ✅ Shows verified locations count (if available)
- ✅ Privacy-aware messaging
- ⚠️ Title shows "My Location" (should be "Their Location")
- ⚠️ Missing: Traveled trips display

**Backend**:
- ✅ Verified locations API working
- ✅ Regular locations in profile API
- ✅ Privacy checks implemented
- ✅ Deduplication working

### Next Steps

1. Fix other user profile title
2. Use verified locations in Globe component
3. Implement single frame display (own profile)
4. Add traveled trips display
5. Add home location feature

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-06  
**Author**: Development Team

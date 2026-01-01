# TripScore Feature - Complete Technical & Functional Documentation

## Table of Contents
1. [Overview](#overview)
2. [Functional Description](#functional-description)
3. [Technical Implementation](#technical-implementation)
4. [Calculation Algorithm](#calculation-algorithm)
5. [Data Flow](#data-flow)
6. [API Endpoints](#api-endpoints)
7. [Frontend Integration](#frontend-integration)
8. [Location Detection](#location-detection)
9. [Distance Calculation](#distance-calculation)
10. [Privacy & Visibility](#privacy--visibility)
11. [Performance Optimizations](#performance-optimizations)

---

## Overview

**TripScore** is a gamification feature in the Taatom app that tracks and scores users' travel experiences based on the locations they visit and document through posts. It provides a comprehensive breakdown of travel statistics across continents, countries, and specific locations.

### Key Concepts
- **TripScore**: A numerical score representing the total number of posts with valid location data
- **Continent Score**: Number of posts in each continent
- **Country Score**: Number of posts in each country
- **Location Score**: Number of posts at each unique location
- **Distance Traveled**: Total distance calculated between consecutive locations

---

## Functional Description

### User-Facing Features

#### 1. **Profile Display**
- **Location**: User profile page (`/profile` and `/profile/[id]`)
- **Display**: Shows total TripScore in a compact card format
- **Visibility**: 
  - Only visible if user has posted locations (`totalScore > 0`)
  - Respects privacy settings (see [Privacy & Visibility](#privacy--visibility))
- **Interaction**: Tapping the TripScore card navigates to the continents breakdown

#### 2. **Continents View**
- **Route**: `/tripscore/continents`
- **Features**:
  - Displays total TripScore at the top
  - Lists all 7 continents with:
    - Continent name
    - TripScore (number of posts in that continent)
    - Distance traveled (in kilometers)
  - Each continent is tappable to view countries within it

#### 3. **Countries View**
- **Route**: `/tripscore/continents/[continent]/countries`
- **Features**:
  - Shows all countries within a selected continent
  - Displays which countries have been visited (score > 0)
  - Shows continent-level TripScore
  - Each country is tappable to view detailed information

#### 4. **Country Details View**
- **Route**: `/tripscore/countries/[country]`
- **Features**:
  - Country overview card with:
    - Country name and continent
    - Country TripScore
    - Total distance traveled within the country
  - List of unique places visited:
    - Location name
    - Individual location score
    - Visit date
    - Location category (from caption analysis)
  - "Explore on Map" button to view locations on an interactive map

#### 5. **Locations List View**
- **Route**: `/tripscore/countries/[country]/locations`
- **Features**:
  - Complete list of all locations visited in a country
  - Sorted by score (highest first)
  - Each location shows:
    - Name
    - Score
    - Visit date
    - Category information

#### 6. **Location Detail View**
- **Route**: `/tripscore/countries/[country]/locations/[location]`
- **Features**:
  - Detailed view of a specific location
  - Shows location on map
  - Displays distance from user's current location (if available)
  - Shows all posts made at that location
  - Location category breakdown

#### 7. **Map View**
- **Route**: `/tripscore/countries/[country]/map`
- **Features**:
  - Interactive map showing all locations visited in a country
  - Markers for each unique location
  - Tappable markers to view location details
  - Distance calculations between locations

---

## Technical Implementation

### Backend Architecture

#### Database Schema
TripScore is calculated dynamically from the `Post` collection. No separate TripScore collection exists.

**Post Model Fields Used:**
```javascript
{
  user: ObjectId,              // User who created the post
  location: {
    address: String,           // Full address string
    coordinates: {
      latitude: Number,        // GPS latitude
      longitude: Number        // GPS longitude
    }
  },
  likes: [ObjectId],           // Array of user IDs who liked
  createdAt: Date,            // Post creation timestamp
  caption: String,             // Post caption (for category detection)
  isActive: Boolean           // Soft delete flag
}
```

#### Core Calculation Logic

**Location**: `backend/src/controllers/profileController.js`

**Key Functions:**
1. `getProfile()` - Calculates TripScore for profile display
2. `getTripScoreContinents()` - Returns continent breakdown
3. `getTripScoreCountries()` - Returns countries within a continent
4. `getTripScoreCountryDetails()` - Returns detailed country information
5. `getTripScoreLocations()` - Returns locations within a country

---

## Calculation Algorithm

### Core Scoring Formula

```
TripScore = Count of all posts with valid location data
```

**Valid Location Criteria:**
- Post must have `location.coordinates.latitude` and `location.coordinates.longitude`
- Coordinates must not be `(0, 0)` (invalid/default coordinates)
- Post must have `isActive: true` (not soft-deleted)

### Score Breakdown

#### 1. **Total TripScore**
```javascript
totalScore = postsWithValidLocations.length
```
- Every post with a valid location contributes +1 to the total score
- No deduplication - multiple posts at the same location all count

#### 2. **Continent Score**
```javascript
continentScore[continent] = postsInContinent.length
```
- Groups posts by continent
- Each post in a continent adds +1 to that continent's score
- Continents: ASIA, AFRICA, NORTH AMERICA, SOUTH AMERICA, AUSTRALIA, EUROPE, ANTARCTICA

#### 3. **Country Score**
```javascript
countryScore[country] = postsInCountry.length
```
- Groups posts by country
- Each post in a country adds +1 to that country's score
- Country is determined from address string or coordinates

#### 4. **Location Score**
```javascript
locationScore[location] = postsAtLocation.length
```
- Groups posts by unique coordinates (latitude, longitude)
- Each post at a location adds +1 to that location's score
- Display shows unique locations, but score counts all posts

### Example Calculation

**User Posts:**
1. Post A: Mumbai, India (Asia) - Coordinates: (19.0760, 72.8777)
2. Post B: Mumbai, India (Asia) - Coordinates: (19.0760, 72.8777)
3. Post C: Delhi, India (Asia) - Coordinates: (28.6139, 77.2090)
4. Post D: Paris, France (Europe) - Coordinates: (48.8566, 2.3522)

**Results:**
- **Total TripScore**: 4
- **Asia Score**: 3 (Posts A, B, C)
- **Europe Score**: 1 (Post D)
- **India Score**: 3 (Posts A, B, C)
- **France Score**: 1 (Post D)
- **Mumbai Location Score**: 2 (Posts A, B)
- **Delhi Location Score**: 1 (Post C)
- **Paris Location Score**: 1 (Post D)

---

## Data Flow

### 1. Post Creation Flow

```
User Creates Post
    ↓
Post includes location data (from GPS or manual entry)
    ↓
Post saved to database with location.coordinates
    ↓
TripScore automatically includes this post in calculations
```

### 2. TripScore Retrieval Flow

```
User Views Profile
    ↓
Backend queries: Post.find({ user: id, isActive: true, hasValidCoordinates })
    ↓
Aggregation pipeline processes posts
    ↓
Helper functions determine continent/country from address/coordinates
    ↓
Scores calculated and grouped
    ↓
Response sent to frontend
    ↓
Frontend displays TripScore card
```

### 3. Navigation Flow

```
Profile TripScore Card
    ↓
Continents View (/tripscore/continents)
    ↓
Countries View (/tripscore/continents/[continent]/countries)
    ↓
Country Details (/tripscore/countries/[country])
    ↓
Locations List (/tripscore/countries/[country]/locations)
    ↓
Location Detail (/tripscore/countries/[country]/locations/[location])
```

---

## API Endpoints

### Base URL
All TripScore endpoints are under `/api/v1/profile/:userId/tripscore`

### 1. Get TripScore Continents
**Endpoint**: `GET /api/v1/profile/:id/tripscore/continents`

**Response:**
```json
{
  "success": true,
  "totalScore": 25,
  "continents": [
    {
      "name": "ASIA",
      "score": 15,
      "distance": 1250
    },
    {
      "name": "EUROPE",
      "score": 10,
      "distance": 800
    }
  ]
}
```

**Implementation Details:**
- Fetches all posts with valid coordinates
- Groups by continent using `getContinentFromLocation()` or `getContinentFromCoordinates()`
- Calculates distance between consecutive locations per continent
- Returns sorted list of continents

### 2. Get Countries in Continent
**Endpoint**: `GET /api/v1/profile/:id/tripscore/continents/:continent/countries`

**Response:**
```json
{
  "success": true,
  "continent": "ASIA",
  "continentScore": 15,
  "countries": [
    {
      "name": "India",
      "score": 10,
      "visited": true
    },
    {
      "name": "Thailand",
      "score": 5,
      "visited": true
    },
    {
      "name": "China",
      "score": 0,
      "visited": false
    }
  ]
}
```

**Implementation Details:**
- Filters posts by continent
- Groups by country using `getCountryFromLocation()`
- Returns all countries in continent with visit status

### 3. Get Country Details
**Endpoint**: `GET /api/v1/profile/:id/tripscore/countries/:country`

**Response:**
```json
{
  "success": true,
  "country": "India",
  "countryScore": 10,
  "countryDistance": 500,
  "locations": [
    {
      "name": "Mumbai, Maharashtra, India",
      "score": 3,
      "date": "2024-01-15T10:30:00Z",
      "caption": "Amazing beach view",
      "category": {
        "fromYou": "Drivable",
        "typeOfSpot": "Beach"
      },
      "coordinates": {
        "latitude": 19.0760,
        "longitude": 72.8777
      }
    }
  ]
}
```

**Implementation Details:**
- Filters posts by country
- Groups by unique coordinates (deduplicates for display)
- Calculates distance between consecutive unique locations
- Analyzes captions for location categories
- Returns locations sorted by date (newest first)

### 4. Get Locations in Country
**Endpoint**: `GET /api/v1/profile/:id/tripscore/countries/:country/locations`

**Response:**
```json
{
  "success": true,
  "country": "India",
  "countryScore": 10,
  "locations": [
    {
      "name": "Mumbai, Maharashtra, India",
      "score": 3,
      "date": "2024-01-15T10:30:00Z",
      "caption": "Amazing beach view",
      "category": {
        "fromYou": "Drivable",
        "typeOfSpot": "Beach"
      }
    }
  ]
}
```

**Implementation Details:**
- Similar to country details but focused on locations list
- Sorted by score (highest first)
- Shows unique locations with aggregated scores

---

## Frontend Integration

### React Native Components

#### 1. **Profile Screen Integration**
**File**: `frontend/app/(tabs)/profile.tsx` and `frontend/app/profile/[id].tsx`

```typescript
// TripScore Card Component
{profileData?.tripScore && (
  <Pressable
    onPress={() => router.push(`/tripscore/continents?userId=${user?._id}`)}
  >
    <View style={styles.tripScoreCard}>
      <Text>{profileData.tripScore.totalScore || 0}</Text>
      <Text>Total TripScore</Text>
    </View>
  </Pressable>
)}
```

#### 2. **TripScore Service**
**File**: `frontend/services/profile.ts`

```typescript
export const getTripScoreContinents = async (userId: string)
export const getTripScoreCountries = async (userId: string, continent: string)
export const getTripScoreCountryDetails = async (userId: string, country: string)
export const getTripScoreLocations = async (userId: string, country: string)
```

#### 3. **Screen Components**
- `frontend/app/tripscore/continents.tsx` - Continents list
- `frontend/app/tripscore/continents/[continent]/countries.tsx` - Countries list
- `frontend/app/tripscore/countries/[country].tsx` - Country details
- `frontend/app/tripscore/countries/[country]/locations.tsx` - Locations list
- `frontend/app/tripscore/countries/[country]/locations/[location].tsx` - Location detail
- `frontend/app/tripscore/countries/[country]/map.tsx` - Map view

### Navigation Structure

```
Profile Screen
  └─ TripScore Card
      └─ Continents Screen
          └─ Countries Screen
              └─ Country Details Screen
                  ├─ Locations List Screen
                  │   └─ Location Detail Screen
                  └─ Map Screen
                      └─ Location Detail Screen
```

---

## Location Detection

### Continent Detection

#### Method 1: Address String Parsing
**Function**: `getContinentFromLocation(address)`

**Logic:**
- Parses address string for continent/country keywords
- Checks for common country names that map to continents
- Returns continent name or "Unknown"

**Keywords:**
- **Asia**: india, china, japan, thailand, singapore, malaysia, indonesia
- **Europe**: france, germany, italy, spain, uk, england, london
- **North America**: united states, usa, canada, mexico, new york, california, texas
- **South America**: brazil, argentina, chile, peru, colombia
- **Africa**: egypt, south africa, nigeria, kenya, morocco
- **Australia**: australia, new zealand, fiji, papua, samoa, tonga
- **Antarctica**: antarctica

#### Method 2: Coordinate-Based Detection
**Function**: `getContinentFromCoordinates(latitude, longitude)`

**Logic:**
- Uses coordinate ranges to determine continent
- Fallback when address parsing fails

**Coordinate Ranges:**
```javascript
Asia:        lat: -10 to 80,    lon: 25 to 180
Europe:      lat: 35 to 70,     lon: -10 to 40
North America: lat: 5 to 85,    lon: -170 to -50
South America: lat: -60 to 15,  lon: -85 to -30
Africa:      lat: -40 to 40,    lon: -20 to 50
Australia:   lat: -50 to -10,   lon: 110 to 180
Antarctica:  lat: <= -60
```

**Priority:**
1. Try address parsing first
2. If "Unknown", fallback to coordinate-based detection

### Country Detection

**Function**: `getCountryFromLocation(address)`

**Logic:**
- Parses address string for country keywords
- Returns country name or "Unknown"
- Supports 50+ countries across all continents

**Examples:**
- "Mumbai, Maharashtra, India" → "India"
- "Paris, Île-de-France, France" → "France"
- "New York, NY, USA" → "United States"

### Location Category Detection

**Function**: `getLocationCategory(caption, address)`

**Returns:**
```javascript
{
  fromYou: "Drivable" | "Hiking" | "Water Transport" | "Flight" | "Train",
  typeOfSpot: "General" | "Beach" | "Mountain" | "City" | "Natural spots" | "Religious"
}
```

**"From You" Categories:**
- **Drivable**: Default, or mentions car/road/drive
- **Hiking**: Mentions hiking, trek, walk, trail, mountain, peak
- **Water Transport**: Mentions boat, ship, cruise, ferry, island, beach
- **Flight**: Mentions flight, plane, airport, fly
- **Train**: Mentions train, railway, station

**"Type of Spot" Categories:**
- **General**: Default
- **Beach**: Mentions beach, coast, ocean, sea
- **Mountain**: Mentions mountain, peak, hill, summit
- **City**: Mentions city, urban, downtown, metropolitan
- **Natural spots**: Mentions forest, jungle, park, nature
- **Religious**: Mentions temple, church, mosque, religious

---

## Distance Calculation

### Haversine Formula

**Function**: `calculateDistance(lat1, lon1, lat2, lon2)`

**Formula:**
```javascript
R = 6371 km (Earth's radius)
dLat = (lat2 - lat1) * π / 180
dLon = (lon2 - lon1) * π / 180
a = sin²(dLat/2) + cos(lat1) * cos(lat2) * sin²(dLon/2)
c = 2 * atan2(√a, √(1-a))
distance = R * c
```

**Returns:** Distance in kilometers

### Distance Aggregation

#### Continent Distance
- Sorts all locations in continent by date (chronological order)
- Calculates distance between consecutive locations
- Sums all distances to get total continent distance

#### Country Distance
- Filters locations by country
- Sorts unique locations by date
- Calculates distance between consecutive unique locations
- Sums all distances to get total country distance

**Note:** Distance is calculated between consecutive visits, not from a fixed starting point.

---

## Privacy & Visibility

### Visibility Rules

TripScore visibility is controlled by user privacy settings:

#### 1. **Own Profile**
- User can always see their own TripScore
- Full access to all TripScore features

#### 2. **Other Users' Profiles**

**Public Profile:**
- Anyone can view TripScore
- Full access to all TripScore features

**Followers Only:**
- Only followers can view TripScore
- Non-followers see no TripScore data

**Private (Require Approval):**
- Only approved followers can view TripScore
- Non-followers see no TripScore data
- Follow request sent but not approved: No access

### Implementation

**Backend Check:**
```javascript
const canViewLocations = isOwnProfile || 
  (profileVisibility === 'public') || 
  (profileVisibility === 'followers' && isFollowing) ||
  (profileVisibility === 'private' && isFollowing);

const tripScore = canViewProfile && tripScoreData.totalScore > 0 
  ? tripScoreData 
  : null;
```

**Frontend Check:**
```typescript
{profile.tripScore && profile.canViewLocations && (
  <TripScoreCard />
)}
```

---

## Performance Optimizations

### 1. **Query Optimization**

**Limit Results:**
```javascript
.limit(1000) // Maximum 1000 posts processed
```

**Selective Fields:**
```javascript
.select('location likes createdAt caption')
// Only fetch required fields
```

**Index Usage:**
- Ensure indexes on: `user`, `isActive`, `location.coordinates.latitude`, `location.coordinates.longitude`

### 2. **Caching**

**Profile Cache:**
- User profile (including TripScore) is cached using Redis
- Cache key: `user:{userId}`
- Cache TTL: Defined in `CACHE_TTL.USER_PROFILE`

**Cache Invalidation:**
- Invalidated when user creates a new post
- Invalidated when user updates profile
- Socket events trigger cache invalidation

### 3. **Aggregation Pipeline**

**MongoDB Aggregation:**
```javascript
Post.aggregate([
  {
    $match: {
      user: ObjectId(id),
      isActive: true,
      'location.coordinates.latitude': { $ne: 0 },
      'location.coordinates.longitude': { $ne: 0 }
    }
  },
  {
    $project: {
      location: 1,
      likes: 1,
      createdAt: 1
    }
  },
  { $limit: 1000 }
])
```

**Benefits:**
- Database-level filtering
- Reduced data transfer
- Faster processing

### 4. **Lazy Loading**

**Frontend:**
- TripScore data loaded only when user navigates to TripScore screens
- Profile screen shows summary only
- Detailed data fetched on-demand

### 5. **Deduplication Strategy**

**Display vs Score:**
- **Score**: Counts all posts (no deduplication)
- **Display**: Shows unique locations only
- Uses `Set` with coordinate keys for deduplication

```javascript
const uniqueLocations = new Set();
const locationKey = `${latitude},${longitude}`;
if (!uniqueLocations.has(locationKey)) {
  // Add to display list
}
```

---

## Data Validation

### Location Validation

**Valid Location:**
- Must have `location.coordinates.latitude`
- Must have `location.coordinates.longitude`
- Coordinates must not be `(0, 0)`
- Post must have `isActive: true`

**Invalid Location Examples:**
- `latitude: 0, longitude: 0` (default/invalid GPS)
- Missing coordinates
- Soft-deleted posts (`isActive: false`)

### Error Handling

**Backend:**
- Returns `null` for TripScore if no valid locations
- Returns empty arrays for continents/countries if no data
- Handles invalid ObjectIds gracefully
- Logs errors for debugging

**Frontend:**
- Shows "0" or empty state if no TripScore
- Handles API errors gracefully
- Loading states during data fetch

---

## Edge Cases & Special Scenarios

### 1. **Multiple Posts at Same Location**
- **Score**: All posts count (e.g., 3 posts at Mumbai = +3 to Mumbai score)
- **Display**: Shows as single location with aggregated score
- **Distance**: Only calculated once between unique locations

### 2. **Posts Without Location**
- Excluded from TripScore calculation
- Do not affect any scores
- Not shown in any TripScore views

### 3. **Invalid Coordinates (0, 0)**
- Treated as invalid location
- Excluded from all calculations
- Common when GPS fails or user doesn't grant location permission

### 4. **Unknown Continent/Country**
- If address parsing fails and coordinates are out of known ranges
- Continent/Country marked as "Unknown"
- Still counted in total score
- May not appear in continent/country breakdowns

### 5. **Timezone Considerations**
- All dates stored in UTC
- Frontend converts to local timezone for display
- Distance calculations are timezone-agnostic

### 6. **Concurrent Post Creation**
- Multiple posts created simultaneously
- Each post processed independently
- TripScore recalculated on each profile fetch
- Cache ensures consistency

---

## Future Enhancements (Potential)

### 1. **Achievement System**
- Badges for visiting X countries
- Milestones for total TripScore
- Special badges for visiting all continents

### 2. **Leaderboards**
- Global TripScore rankings
- Country-specific rankings
- Friend rankings

### 3. **Trip Planning**
- Suggest destinations based on visited locations
- Calculate optimal routes
- Estimate travel costs

### 4. **Social Features**
- Share TripScore on social media
- Compare TripScore with friends
- Collaborative TripScore (group trips)

### 5. **Analytics**
- Travel patterns over time
- Most visited countries/continents
- Travel frequency statistics
- Distance trends

### 6. **Integration**
- Import locations from other apps (Google Maps, Foursquare)
- Export TripScore data
- Integration with travel booking services

---

## Testing Considerations

### Unit Tests
- Test continent detection from addresses
- Test continent detection from coordinates
- Test country detection
- Test distance calculation (Haversine formula)
- Test location category detection

### Integration Tests
- Test TripScore calculation with various post scenarios
- Test privacy settings impact on visibility
- Test API endpoints with different user states
- Test caching behavior

### Edge Case Tests
- Posts with invalid coordinates
- Posts without location data
- Multiple posts at same location
- Posts spanning multiple continents
- Very large numbers of posts (performance)

---

## Conclusion

TripScore is a comprehensive travel tracking and gamification feature that:
- **Tracks**: All user posts with valid location data
- **Calculates**: Scores at multiple levels (total, continent, country, location)
- **Displays**: Beautiful, navigable breakdowns of travel statistics
- **Respects**: User privacy settings
- **Optimizes**: Performance through caching and query optimization

The feature encourages users to document their travels and provides a fun, competitive way to showcase their travel experiences while maintaining privacy and performance standards.

---

## Appendix: Code References

### Backend Files
- `backend/src/controllers/profileController.js` - Main TripScore logic
- `backend/src/routes/profileRoutes.js` - API route definitions

### Frontend Files
- `frontend/app/(tabs)/profile.tsx` - Main profile screen
- `frontend/app/profile/[id].tsx` - Other user profile screen
- `frontend/app/tripscore/` - All TripScore screens
- `frontend/services/profile.ts` - API service functions

### Helper Functions
- `getContinentFromLocation(address)` - Continent from address
- `getContinentFromCoordinates(lat, lon)` - Continent from coordinates
- `getCountryFromLocation(address)` - Country from address
- `getLocationCategory(caption, address)` - Location category
- `calculateDistance(lat1, lon1, lat2, lon2)` - Haversine distance

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Maintained By**: TeamTaatom Development Team


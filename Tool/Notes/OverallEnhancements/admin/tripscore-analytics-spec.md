# TripScore Analytics - Product Specification

## 1. Overview

The TripScore Analytics menu provides comprehensive analytics and insights into the TripScore system, including trust level breakdowns, geographic analysis (continents, countries, locations), suspicious visit detection, top users by TripScore, and detailed location grouping. It enables SuperAdmin users to monitor TripScore health, identify fraud patterns, and understand user travel behavior.

### User Personas & Goals

- **Founders**: High-level TripScore health, fraud detection, geographic insights
- **Admins**: Detailed TripScore analytics, user rankings, location analysis
- **Moderators**: Limited TripScore access (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/TripScoreAnalytics.jsx`): Analytics dashboard with multiple views, charts, filters, detailed location tables
- **Backend** (`backend/src/controllers/tripScoreAnalyticsController.js`): Aggregates TripScore data from TripVisit collection
- **Services** (`superAdmin/src/services/tripScoreAnalytics.js`): API service functions for TripScore endpoints

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/TripScoreAnalytics.jsx`

**Purpose**: Display comprehensive TripScore analytics with interactive charts, filters, and detailed location breakdowns

**Entry Points**:
- Navigation from sidebar (TripScore Analytics menu item)
- Direct URL: `/tripscore-analytics`
- Navigation from Dashboard (if TripScore insights available)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Export data → Download CSV/JSON
- Click user → Navigate to user profile (if implemented)

**Components Used**:
- `LineChartComponent`: Trust timeline charts
- `BarChartComponent`: Geographic breakdown charts
- `PieChartComponent`: Trust level and source type breakdowns
- `Card`: KPI display cards
- `Table`: Detailed locations table, top users table, suspicious visits table

**Views/Tabs**:
- **Overview**: Key metrics, trust breakdown, source breakdown
- **Users**: Top users by TripScore
- **Fraud**: Suspicious visits detection
- **Geography**: Continent, country, state breakdowns
- **Locations**: Detailed location grouping (by location, user, country, state)

---

## 3. Detailed Features & User Flows

### 3.1 TripScore Overview

**Feature Name**: Key Metrics & Breakdowns

**Business Description**: Display high-level TripScore metrics including total visits, trusted visits, trust level distribution, and source type distribution.

**Preconditions**:
- User must be authenticated
- User must have `canViewAnalytics` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/tripscore-analytics`
2. Frontend calls `getTripScoreStats(startDate, endDate)`
3. Backend endpoint `GET /api/superadmin/tripscore/stats?startDate=...&endDate=...` is called
4. Backend aggregates TripVisit data:
   - Total visits count
   - Trusted visits count (high + medium trust)
   - Trust level breakdown (high, medium, low, unverified, suspicious)
   - Source type breakdown (taatom_camera_live, gallery_exif, gallery_no_exif, manual_only)
   - Average TripScore per user
   - Total unique locations
   - Total unique users
5. Response includes stats object
6. Frontend displays metrics in KPI cards:
   - Total Visits
   - Trusted Visits (with percentage)
   - Average TripScore
   - Unique Locations
   - Unique Users
7. Frontend displays pie charts:
   - Trust Level Breakdown
   - Source Type Breakdown
8. User can toggle "Show totals separately" to see all vs trusted breakdowns
9. User can filter by trust levels and source types using advanced filters

**Validations**:
- Date range: Start date must be before end date
- Period: Must be valid enum (7d, 30d, 90d, 1y)

**Error States**:
- Network error: Show error toast, keep previous data
- Invalid date range: Show "Invalid date range" error
- No data: Show "No TripScore data available" message

**Success States**:
- Stats load: Display all metrics and charts
- Period change: Update stats with new period
- Filter toggle: Charts update with filtered data

### 3.2 Top Users by TripScore

**Feature Name**: User Rankings

**Business Description**: Display users ranked by TripScore with detailed breakdowns.

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User selects "Users" view
2. Frontend calls `getTopUsersByTripScore({ limit, startDate, endDate })`
3. Backend endpoint `GET /api/superadmin/tripscore/top-users` is called
4. Backend aggregates TripVisit data by user:
   - Group by user
   - Calculate total TripScore (sum of trusted visits)
   - Count total visits, trusted visits
   - Count unique locations, countries, continents
   - Sort by TripScore (descending)
   - Limit to top N users
5. Response includes topUsers array:
   ```javascript
   [{
     userId: string,
     fullName: string,
     email: string,
     avatar: string,
     totalScore: number,
     totalVisits: number,
     trustedVisits: number,
     uniqueLocations: number,
     uniqueCountries: number,
     uniqueContinents: number
   }]
   ```
6. Frontend displays users in table with rankings
7. User can click user to view details (if implemented)

**Validations**:
- Limit: Must be between 1 and 100
- Date range: Valid date format

**Error States**:
- No users: Show "No users with TripScore" message
- Load failure: Show error message

**Success States**:
- Users table: Display ranked users
- Rankings visible: Show position, score, metrics

### 3.3 Suspicious Visits Detection

**Feature Name**: Fraud Detection

**Business Description**: Identify and display suspicious TripVisits that may indicate fraud or data manipulation.

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User selects "Fraud" view
2. Frontend calls `getSuspiciousVisits({ page, limit, startDate, endDate })`
3. Backend endpoint `GET /api/superadmin/tripscore/suspicious-visits` is called
4. Backend queries TripVisit collection:
   - Filter by `trustLevel: 'suspicious'`
   - Include flagged visits with `flaggedReason`
   - Sort by `createdAt` (descending)
   - Paginate results
5. Response includes suspiciousVisits array:
   ```javascript
   [{
     _id: string,
     user: {
       _id: string,
       fullName: string,
       email: string
     },
     location: {
       name: string,
       coordinates: {
         latitude: number,
         longitude: number
       }
     },
     trustLevel: 'suspicious',
     source: string,
     flaggedReason: string,
     createdAt: Date,
     post: {
       _id: string,
       caption: string
     }
   }]
   ```
6. Frontend displays suspicious visits in table
7. User can:
   - View visit details
   - Review flagged reason
   - Navigate to related post/user
   - Manually review and adjust trust level (if permission granted)

**Validations**:
- Page: Must be >= 1
- Limit: Must be between 1 and 100

**Error States**:
- No suspicious visits: Show "No suspicious visits found" message
- Load failure: Show error message

**Success States**:
- Suspicious visits table: Display flagged visits
- Details visible: Show reason, user, location

### 3.4 Geographic Analysis

**Feature Name**: Continent, Country, State Breakdowns

**Business Description**: Analyze TripScore data by geographic regions (continents, countries, states/provinces).

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User selects "Geography" view
2. Frontend calls `getContinentBreakdown(startDate, endDate)`
3. Backend endpoint `GET /api/superadmin/tripscore/continents` is called
4. Backend aggregates TripVisit data by continent:
   - Group by `continent` field
   - Count total visits, trusted visits per continent
   - Calculate average TripScore per continent
   - Sort by visit count (descending)
5. Response includes continents array:
   ```javascript
   [{
     continent: string,
     totalVisits: number,
     trustedVisits: number,
     uniqueLocations: number,
     uniqueUsers: number,
     averageScore: number
   }]
   ```
6. Frontend displays continent breakdown in bar/pie chart
7. User can drill down:
   - Click continent → View countries in that continent
   - Click country → View states/provinces in that country
   - Click state → View locations in that state

**Validations**:
- Date range: Valid date format

**Error States**:
- No geographic data: Show "No geographic data" message

**Success States**:
- Geography charts: Display continent/country breakdowns
- Drill-down: Navigate to detailed views

### 3.5 Detailed Locations

**Feature Name**: Location Grouping & Analysis

**Business Description**: Group and analyze TripScore data by location, user, country, or state with detailed metrics.

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User selects "Locations" view
2. User selects grouping option:
   - **By Location**: Group by unique location name
   - **By User**: Group by user
   - **By Country**: Group by country
   - **By State**: Group by state/province
3. Frontend calls `getDetailedLocations({ startDate, endDate, groupBy, limit, page })`
4. Backend endpoint `GET /api/superadmin/tripscore/locations` is called
5. Backend aggregates TripVisit data based on `groupBy`:
   - **By Location**: Group by location name, count visits, users
   - **By User**: Group by user, count visits, locations
   - **By Country**: Group by country, count visits, locations, users
   - **By State**: Group by state, count visits, locations, users
6. Response includes locations array and pagination:
   ```javascript
   {
     locations: [{
       groupKey: string,        // Location name, user ID, country, or state
       totalVisits: number,
       trustedVisits: number,
       uniqueLocations: number,  // If grouped by user/country/state
       uniqueUsers: number,     // If grouped by location/country/state
       averageScore: number
     }],
     pagination: {
       page: number,
       totalPages: number,
       total: number,
       limit: number
     }
   }
   ```
7. Frontend displays locations in table with sortable columns
8. User can:
   - Sort by any column
   - Navigate pages
   - Filter by trust levels and source types
   - Export data

**Validations**:
- GroupBy: Must be valid enum ('location', 'user', 'country', 'state')
- Page: Must be >= 1
- Limit: Must be between 1 and 100

**Error States**:
- No locations: Show "No location data" message
- Invalid groupBy: Show "Invalid grouping option" error

**Success States**:
- Locations table: Display grouped data
- Grouping works: Data grouped correctly
- Pagination: Navigate through pages

### 3.6 Trust Timeline

**Feature Name**: Trust Level Trends Over Time

**Business Description**: Display how trust levels change over time to identify trends and patterns.

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User views "Overview" tab
2. Frontend calls `getTrustTimeline({ startDate, endDate, groupBy })`
3. Backend endpoint `GET /api/superadmin/tripscore/trust-timeline` is called
4. Backend aggregates TripVisit data by time intervals:
   - Group by day/week/month based on period
   - Count visits per trust level per interval
5. Response includes timeline array:
   ```javascript
   [{
     date: Date,
     high: number,
     medium: number,
     low: number,
     unverified: number,
     suspicious: number
   }]
   ```
6. Frontend renders line/area chart showing trust level trends
7. User can see:
   - Trust level distribution over time
   - Trends in high/medium trust visits
   - Spikes in suspicious visits

**Validations**:
- Date range: Valid date format
- GroupBy: Must be valid enum ('day', 'week', 'month')

**Error States**:
- No timeline data: Show "No timeline data" message

**Success States**:
- Timeline chart: Display trust trends
- Interactive: Hover for details

---

## 4. Data Model & API Design

### 4.1 TripScore Stats Endpoint

**Endpoint**: `GET /api/superadmin/tripscore/stats`

**Authentication**: Required

**Permissions**: `canViewAnalytics` or founder

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  stats: {
    totalVisits: number,
    trustedVisits: number,        // high + medium
    untrustedVisits: number,      // low + unverified + suspicious
    trustBreakdown: {
      high: number,
      medium: number,
      low: number,
      unverified: number,
      suspicious: number
    },
    sourceBreakdown: {
      taatom_camera_live: number,
      gallery_exif: number,
      gallery_no_exif: number,
      manual_only: number
    },
    averageScore: number,
    uniqueLocations: number,
    uniqueUsers: number,
    uniqueCountries: number,
    uniqueContinents: number
  }
}
```

### 4.2 Top Users Endpoint

**Endpoint**: `GET /api/superadmin/tripscore/top-users`

**Query Parameters**:
- `limit` (optional): Number, default: 20, max: 100
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```javascript
{
  success: true,
  topUsers: [{
    userId: string,
    fullName: string,
    email: string,
    avatar: string,
    totalScore: number,
    totalVisits: number,
    trustedVisits: number,
    uniqueLocations: number,
    uniqueCountries: number,
    uniqueContinents: number
  }]
}
```

### 4.3 Suspicious Visits Endpoint

**Endpoint**: `GET /api/superadmin/tripscore/suspicious-visits`

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 20, max: 100
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string

**Response**:
```javascript
{
  success: true,
  suspiciousVisits: [{
    _id: string,
    user: {
      _id: string,
      fullName: string,
      email: string
    },
    location: {
      name: string,
      coordinates: {
        latitude: number,
        longitude: number
      }
    },
    trustLevel: 'suspicious',
    source: string,
    flaggedReason: string,
    createdAt: Date,
    post: {
      _id: string,
      caption: string
    }
  }],
  pagination: {
    page: number,
    totalPages: number,
    total: number
  }
}
```

### 4.4 Trust Timeline Endpoint

**Endpoint**: `GET /api/superadmin/tripscore/trust-timeline`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `groupBy` (optional): 'day' | 'week' | 'month', default: 'day'

**Response**:
```javascript
{
  success: true,
  timeline: [{
    date: Date,
    high: number,
    medium: number,
    low: number,
    unverified: number,
    suspicious: number
  }]
}
```

### 4.5 Continent Breakdown Endpoint

**Endpoint**: `GET /api/superadmin/tripscore/continents`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  continents: [{
    continent: string,
    totalVisits: number,
    trustedVisits: number,
    uniqueLocations: number,
    uniqueUsers: number,
    averageScore: number
  }]
}
```

### 4.6 Detailed Locations Endpoint

**Endpoint**: `GET /api/superadmin/tripscore/locations`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `groupBy` (required): 'location' | 'user' | 'country' | 'state'
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 50, max: 100

**Response**:
```javascript
{
  success: true,
  locations: [{
    groupKey: string,        // Location name, user ID, country, or state
    displayName: string,     // Human-readable name
    totalVisits: number,
    trustedVisits: number,
    uniqueLocations: number,  // If grouped by user/country/state
    uniqueUsers: number,     // If grouped by location/country/state
    averageScore: number,
    trustBreakdown: {
      high: number,
      medium: number,
      low: number,
      unverified: number,
      suspicious: number
    }
  }],
  pagination: {
    page: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.7 Data Models

**TripVisit Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  user: ObjectId,             // Ref: User
  post: ObjectId,              // Ref: Post
  location: {
    name: string,
    address: string,
    coordinates: {
      latitude: number,
      longitude: number
    },
    country: string,
    countryCode: string,
    state: string,
    stateCode: string,
    city: string,
    continent: string
  },
  trustLevel: 'high' | 'medium' | 'low' | 'unverified' | 'suspicious',
  source: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only',
  flaggedReason: string,      // If suspicious
  takenAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**TripScoreAnalytics Component** (`superAdmin/src/pages/TripScoreAnalytics.jsx`):
- `stats`: TripScore statistics
- `topUsers`: Top users array
- `suspiciousVisits`: Suspicious visits array
- `trustTimeline`: Timeline data array
- `continentBreakdown`: Continent data array
- `detailedLocations`: Detailed locations array
- `locationsPagination`: Pagination for locations
- `locationsGroupBy`: Current grouping ('location', 'user', 'country', 'state')
- `selectedPeriod`: Current period ('7d', '30d', '90d', '1y')
- `selectedView`: Current view ('overview', 'users', 'fraud', 'geography', 'locations')
- `loading`: Loading state
- `suspiciousPage`: Current suspicious visits page
- `showTotalsSeparately`: Toggle for breakdown display
- `trustLevelFilters`: Object with trust level toggles
- `sourceFilters`: Object with source type toggles
- `showAdvancedFilters`: Advanced filters panel visibility
- `previousStats`: Previous stats for comparison

**Side Effects**:
- `useEffect` on mount: Fetch all TripScore data
- `useEffect` on period change: Refetch all data
- `useEffect` on filter change: Refetch filtered data
- `useEffect` on grouping change: Refetch locations data
- `useEffect` on pagination: Refetch locations data

### 5.2 Data Fetching

**Parallel Fetching**:
- All TripScore endpoints called in parallel using `Promise.all()`
- Reduces total load time
- Handles partial failures gracefully

**Filtering Logic**:
- Trust level filters: Filter chart data by selected trust levels
- Source filters: Filter chart data by selected source types
- Filters applied to breakdown charts, not raw data queries

---

## 6. Backend Logic & Rules

### 6.1 TripScore Aggregation

**File**: `backend/src/controllers/tripScoreAnalyticsController.js`

**Business Logic**:
1. Query TripVisit collection
2. Apply date range filter (`createdAt` or `takenAt`)
3. Aggregate based on endpoint:
   - **Stats**: Count total, trusted, breakdown by trust/source
   - **Top Users**: Group by user, sum TripScore, count visits
   - **Suspicious**: Filter by `trustLevel: 'suspicious'`
   - **Timeline**: Group by time intervals, count by trust level
   - **Continents**: Group by continent, aggregate metrics
   - **Locations**: Group by location/user/country/state based on `groupBy`
4. Return aggregated results

**Trust Level Rules**:
- **Trusted Visits**: Only `high` and `medium` trust levels
- **Untrusted Visits**: `low`, `unverified`, `suspicious`
- **TripScore Calculation**: Sum of trusted visits only

**Performance Optimizations**:
- Use MongoDB aggregation pipelines
- Index on `trustLevel`, `source`, `createdAt`, `location.continent`, `location.country`
- Limit result sets to prevent large payloads
- Cache frequently accessed aggregations (optional)

### 6.2 Geographic Aggregation

**Continent Breakdown**:
1. Group TripVisits by `location.continent`
2. Count total visits, trusted visits per continent
3. Count unique locations, users per continent
4. Calculate average TripScore per continent
5. Sort by visit count (descending)

**Country/State Breakdown**:
- Similar logic but group by `location.country` or `location.state`
- Can be nested (continent → country → state → location)

### 6.3 Suspicious Visit Detection

**Fraud Detection Logic**:
1. Query TripVisits with `trustLevel: 'suspicious'`
2. Include visits with `flaggedReason` (impossible travel speed, etc.)
3. Populate user and post data
4. Sort by `createdAt` (most recent first)
5. Paginate results

**Flagged Reasons**:
- "Impossible travel speed": User traveled too fast between locations
- "Duplicate location": Multiple visits at same location in short time
- "Invalid coordinates": Coordinates out of range
- "Manual override": Manually flagged by admin

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View TripScore Analytics**: `canViewAnalytics` permission required
- **Export Data**: May require additional permission
- **Modify Trust Levels**: May require founder role

### 7.2 Feature Toggles

- **TripScore System**: Must be enabled
- **Fraud Detection**: Can be toggled
- **Geographic Analysis**: Always available

### 7.3 Settings Impact

- **TripScore Rules**: Trust level rules affect calculations
- **Fraud Detection Thresholds**: Configurable in settings
- **Data Retention**: Affects available date ranges

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canViewAnalytics` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Data Filtering**: No user-specific filtering (aggregated data only)
- **Sensitive Data**: Suspicious visits may contain sensitive user data

### 8.3 Security Features

- **Audit Logging**: Analytics access may be logged
- **Rate Limiting**: API requests rate-limited
- **Input Validation**: All inputs sanitized and validated

### 8.4 Privacy Considerations

- **Aggregated Data**: Only aggregated metrics, limited individual user data
- **User Privacy**: Respects user privacy settings where applicable
- **Location Privacy**: Geographic data aggregated, no exact coordinates exposed

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **TripScore View**: `tripscore_analytics_view` event
- **TripScore Export**: `tripscore_analytics_export` event
- **Period Change**: `tripscore_period_change` event
- **Filter Applied**: `tripscore_filter_applied` event
- **Grouping Change**: `tripscore_grouping_change` event

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total Visits
- Trusted Visits (with percentage)
- Average TripScore
- Unique Locations
- Unique Users
- Unique Countries
- Unique Continents
- Trust Level Distribution
- Source Type Distribution
- Suspicious Visit Count

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Date Range**: Maximum 1 year
- **Top Users Limit**: Maximum 100
- **Suspicious Visits per Page**: Maximum 100
- **Locations per Page**: Maximum 100
- **Grouping Options**: Limited to 4 options (location, user, country, state)

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **No Data**: Show "No TripScore data available" message
- **Large Date Ranges**: May be slow, show loading indicator
- **Partial Failures**: Show available data, log errors

### 10.3 Known Constraints

- **Data Availability**: TripScore only available if TripVisit records exist
- **Historical Data**: Limited by data retention policy
- **Real-time**: Analytics may have 1-5 minute delay
- **Large Datasets**: Aggregations may be slow on large datasets
- **Geographic Data**: Depends on location data quality in TripVisits

### 10.4 Performance Considerations

- **Aggregation Performance**: Use MongoDB indexes on key fields
- **Caching**: Consider caching for frequently accessed periods
- **Lazy Loading**: Load charts on demand
- **Pagination**: Locations paginated to prevent large payloads
- **Filtering**: Frontend filtering for charts, backend filtering for raw data

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Custom Date Ranges**: Date picker for custom ranges
- **Export Functionality**: Export analytics as CSV/JSON
- **Drill-down Navigation**: Click to navigate to detailed views
- **Comparison Mode**: Compare periods side-by-side

### 11.2 Next (Medium Priority)

- **Trust Level Adjustment**: Manually adjust trust levels from UI
- **Fraud Review Workflow**: Review and resolve suspicious visits
- **Location Clustering**: Cluster nearby locations
- **User Journey Analysis**: Track user travel patterns

### 11.3 Later (Low Priority)

- **Predictive Analytics**: ML-powered fraud prediction
- **Anomaly Detection**: Automatic anomaly detection
- **Custom Reports**: Create custom TripScore reports
- **API Access**: External API for TripScore data

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- Recharts (or similar) for charts
- Framer Motion for animations
- Date-fns for date handling

**Key Dependencies**:
- `recharts`: Chart library
- `date-fns`: Date utilities
- `framer-motion`: Animations
- `react-hot-toast`: Notifications

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- Aggregation pipelines

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM

### 12.3 Data Flow

1. User selects period/view/filters
2. Frontend calculates date range
3. Multiple API calls in parallel
4. Backend aggregates TripVisit data
5. Response includes aggregated results
6. Frontend renders charts and tables
7. User interacts (filter, group, paginate)
8. Filters update, data refetches

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/tripscore/stats` | Get TripScore statistics | Yes |
| GET | `/api/superadmin/tripscore/top-users` | Get top users by TripScore | Yes |
| GET | `/api/superadmin/tripscore/suspicious-visits` | Get suspicious visits | Yes |
| GET | `/api/superadmin/tripscore/trust-timeline` | Get trust level timeline | Yes |
| GET | `/api/superadmin/tripscore/continents` | Get continent breakdown | Yes |
| GET | `/api/superadmin/tripscore/locations` | Get detailed locations | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for TripScore overview
- **Analytics**: See `analytics-spec.md` for general analytics
- **Post**: See `post-spec.md` for TripScore creation logic
- **Profile**: See `profile-spec.md` for user TripScore display


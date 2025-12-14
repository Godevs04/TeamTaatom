# Analytics - Product Specification

## 1. Overview

The Analytics menu provides comprehensive platform analytics including time series data, event breakdowns, top features analysis, user retention metrics, and drop-off point identification. It enables SuperAdmin users to understand platform usage patterns and make data-driven decisions.

### User Personas & Goals

- **Founders**: High-level platform health, growth trends, user behavior
- **Admins**: Detailed analytics, feature performance, optimization insights
- **Moderators**: Limited analytics access (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Analytics.jsx`): Analytics dashboard with charts, filters, period selection
- **Backend** (`backend/src/controllers/analyticsAdminController.js`): Aggregates analytics data from events/logs
- **Services** (`superAdmin/src/services/analytics.js`): API service functions for analytics endpoints

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Analytics.jsx`

**Purpose**: Display comprehensive analytics with interactive charts and metrics

**Entry Points**:
- Navigation from sidebar (Analytics menu item)
- Direct URL: `/analytics`
- Navigation from Dashboard (Analytics tab)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Export data → Download CSV/JSON

**Components Used**:
- `LineChartComponent`: Time series charts
- `AreaChartComponent`: Area charts for trends
- `BarChartComponent`: Bar charts for comparisons
- `PieChartComponent`: Pie charts for breakdowns
- `Card`: Metric display cards
- `Table`: Recent events table

**Views/Tabs**:
- **Summary**: Key metrics overview
- **Time Series**: Trends over time
- **Event Breakdown**: Event type analysis
- **Top Features**: Most used features
- **Drop-offs**: User drop-off points
- **Retention**: User retention metrics
- **Recent Events**: Latest analytics events

---

## 3. Detailed Features & User Flows

### 3.1 Analytics Summary

**Feature Name**: Key Metrics Overview

**Business Description**: Display high-level platform metrics including total events, average per hour, peak hours, and growth indicators.

**Preconditions**:
- User must be authenticated
- User must have analytics access (all authenticated users by default)

**Step-by-Step Flow**:
1. User navigates to `/analytics`
2. Frontend calls `getAnalyticsSummary(startDate, endDate)`
3. Backend endpoint `GET /api/superadmin/analytics/summary?startDate=...&endDate=...` is called
4. Backend aggregates analytics events:
   - Total events count
   - Average events per hour
   - Peak hour identification
   - Growth percentage (vs previous period)
5. Response includes summary object
6. Frontend displays metrics in cards:
   - Total Events (with trend indicator)
   - Average per Hour
   - Peak Hour
   - Growth Rate
7. User can change period (7d, 30d, 90d, 1y)
8. Summary updates based on selected period

**Validations**:
- Date range: Start date must be before end date
- Period: Must be valid enum (7d, 30d, 90d, 1y)

**Error States**:
- Network error: Show error toast, keep previous data
- Invalid date range: Show "Invalid date range" error
- No data: Show "No data available" message

**Success States**:
- Summary loads: Display all metrics
- Period change: Update summary with new period
- Trend indicators: Show up/down arrows with percentages

### 3.2 Time Series Analytics

**Feature Name**: Trends Over Time

**Business Description**: Display time series charts showing platform activity over selected time period.

**Preconditions**:
- Same as Analytics Summary

**Step-by-Step Flow**:
1. User selects "Time Series" view
2. User selects period (7d, 30d, 90d, 1y)
3. User can filter by:
   - Event type (optional)
   - Platform (optional)
4. Frontend calls `getTimeSeriesData({ startDate, endDate, eventType, platform })`
5. Backend endpoint `GET /api/superadmin/analytics/timeseries` is called
6. Backend queries analytics events and groups by time intervals:
   - 7d: Group by hour
   - 30d: Group by day
   - 90d: Group by day
   - 1y: Group by week
7. Response includes time series array:
   ```javascript
   [{
     timestamp: Date,
     count: number,
     eventType: string,
     platform: string
   }]
   ```
8. Frontend renders line/area chart with time series data
9. Chart is interactive (hover for details, zoom, etc.)

**Validations**:
- Date range: Valid date format
- Event type: Must be valid enum (if provided)
- Platform: Must be valid enum (if provided)

**Error States**:
- No data: Show "No data for selected period" message
- Chart render failure: Show error message, allow retry

**Success States**:
- Chart renders: Display time series with smooth animations
- Filters applied: Chart updates with filtered data
- Interactive: Hover shows data points

### 3.3 Event Breakdown

**Feature Name**: Event Type Analysis

**Business Description**: Analyze distribution of different event types (screen views, engagements, etc.).

**Preconditions**:
- Same as Analytics Summary

**Step-by-Step Flow**:
1. User selects "Event Breakdown" view
2. Frontend calls `getEventBreakdown({ startDate, endDate })`
3. Backend endpoint `GET /api/superadmin/analytics/breakdown` is called
4. Backend aggregates events by type:
   - Group events by `eventType` field
   - Count occurrences per type
   - Calculate percentages
5. Response includes breakdown array:
   ```javascript
   [{
     eventType: string,
     count: number,
     percentage: number
   }]
   ```
6. Frontend renders pie/bar chart showing event distribution
7. User can hover/click segments for details

**Validations**:
- Date range: Valid date format

**Error States**:
- No events: Show "No events in period" message
- Chart failure: Show error message

**Success States**:
- Chart renders: Display event breakdown
- Interactive: Click segments for details

### 3.4 Top Features

**Feature Name**: Feature Usage Analysis

**Business Description**: Identify most used features and screen views.

**Preconditions**:
- Same as Analytics Summary

**Step-by-Step Flow**:
1. User selects "Top Features" view
2. Frontend calls `getTopFeatures({ startDate, endDate })`
3. Backend endpoint `GET /api/superadmin/analytics/features` is called
4. Backend aggregates screen views and feature usage:
   - Group by screen/feature name
   - Count occurrences
   - Sort by count (descending)
   - Limit to top 10
5. Response includes features array:
   ```javascript
   [{
     name: string,        // Screen/feature name
     count: number,
     percentage: number
   }]
   ```
6. Frontend renders bar chart or list showing top features
7. User can see feature names and usage counts

**Validations**:
- Date range: Valid date format

**Error States**:
- No features: Show "No feature data" message

**Success States**:
- Features list: Display top features with counts
- Chart renders: Visual representation of top features

### 3.5 Drop-off Points

**Feature Name**: User Drop-off Analysis

**Business Description**: Identify points where users drop off in key flows (signup, onboarding, etc.).

**Preconditions**:
- Same as Analytics Summary

**Step-by-Step Flow**:
1. User selects "Drop-offs" view
2. Frontend calls `getDropOffPoints({ startDate, endDate })`
3. Backend endpoint `GET /api/superadmin/analytics/dropoffs` is called
4. Backend analyzes user flows:
   - Track sequential events (e.g., signup → onboarding → first post)
   - Calculate drop-off rates between steps
   - Identify highest drop-off points
5. Response includes drop-offs array:
   ```javascript
   [{
     fromStep: string,
     toStep: string,
     usersAtFrom: number,
     usersAtTo: number,
     dropOffRate: number      // Percentage
   }]
   ```
6. Frontend renders funnel chart or list showing drop-off points
7. User can see where users are dropping off

**Validations**:
- Date range: Valid date format

**Error States**:
- No flow data: Show "No drop-off data" message

**Success States**:
- Drop-offs displayed: Show funnel with drop-off rates
- Visual: Funnel chart shows user flow

### 3.6 User Retention

**Feature Name**: Retention Metrics

**Business Description**: Analyze user retention rates over time (daily, weekly, monthly).

**Preconditions**:
- Same as Analytics Summary

**Step-by-Step Flow**:
1. User selects "Retention" view
2. Frontend calls `getUserRetention(startDate, endDate)`
3. Backend endpoint `GET /api/superadmin/analytics/retention` is called
4. Backend calculates retention:
   - Identify user cohorts (by signup date)
   - Track return visits per cohort
   - Calculate retention rates (Day 1, Day 7, Day 30)
5. Response includes retention array:
   ```javascript
   [{
     cohort: Date,           // Signup date
     day1Retention: number,   // Percentage
     day7Retention: number,
     day30Retention: number
   }]
   ```
6. Frontend renders retention chart (heatmap or line chart)
7. User can see retention trends over time

**Validations**:
- Date range: Valid date format

**Error States**:
- No retention data: Show "No retention data" message

**Success States**:
- Retention chart: Display retention metrics
- Trends visible: Show retention trends

### 3.7 Recent Events

**Feature Name**: Latest Analytics Events

**Business Description**: View most recent analytics events with filtering and search.

**Preconditions**:
- Same as Analytics Summary

**Step-by-Step Flow**:
1. User selects "Recent Events" view
2. Frontend calls `getRecentEvents({ page, limit, eventType, platform, startDate, endDate, search })`
3. Backend endpoint `GET /api/superadmin/analytics/events` is called
4. Backend queries recent events:
   - Apply filters (eventType, platform, date range, search)
   - Sort by timestamp (descending)
   - Paginate results
5. Response includes events array and pagination:
   ```javascript
   {
     events: [{
       _id: string,
       eventType: string,
       platform: string,
       userId: string,
       timestamp: Date,
       properties: object
     }],
     pagination: {
       page: number,
       totalPages: number,
       total: number
     }
   }
   ```
6. Frontend displays events in table
7. User can:
   - Filter by event type
   - Filter by platform
   - Search events
   - Navigate pages

**Validations**:
- Page: Must be >= 1
- Limit: Must be between 1 and 100
- Search: Minimum 2 characters (optional)

**Error States**:
- No events: Show "No events found" message
- Load failure: Show error message

**Success States**:
- Events table: Display recent events
- Filters applied: Table updates with filtered results

---

## 4. Data Model & API Design

### 4.1 Analytics Summary Endpoint

**Endpoint**: `GET /api/superadmin/analytics/summary`

**Authentication**: Required

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  summary: {
    totalEvents: number,
    averagePerHour: number,
    peakHour: Date,
    growth: {
      percentage: number,
      trend: 'up' | 'down'
    }
  }
}
```

### 4.2 Time Series Endpoint

**Endpoint**: `GET /api/superadmin/analytics/timeseries`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `eventType` (optional): Event type filter
- `platform` (optional): Platform filter

**Response**:
```javascript
{
  success: true,
  timeSeries: [{
    timestamp: Date,
    count: number,
    eventType: string,
    platform: string
  }]
}
```

### 4.3 Event Breakdown Endpoint

**Endpoint**: `GET /api/superadmin/analytics/breakdown`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  breakdown: [{
    eventType: string,
    count: number,
    percentage: number
  }]
}
```

### 4.4 Top Features Endpoint

**Endpoint**: `GET /api/superadmin/analytics/features`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  features: [{
    name: string,
    count: number,
    percentage: number
  }]
}
```

### 4.5 Drop-off Points Endpoint

**Endpoint**: `GET /api/superadmin/analytics/dropoffs`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  dropOffs: [{
    fromStep: string,
    toStep: string,
    usersAtFrom: number,
    usersAtTo: number,
    dropOffRate: number
  }]
}
```

### 4.6 User Retention Endpoint

**Endpoint**: `GET /api/superadmin/analytics/retention`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string

**Response**:
```javascript
{
  success: true,
  retention: [{
    cohort: Date,
    day1Retention: number,
    day7Retention: number,
    day30Retention: number
  }]
}
```

### 4.7 Recent Events Endpoint

**Endpoint**: `GET /api/superadmin/analytics/events`

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 50
- `eventType` (optional): Event type filter
- `platform` (optional): Platform filter
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `search` (optional): Search query

**Response**:
```javascript
{
  success: true,
  events: [{
    _id: string,
    eventType: string,
    platform: string,
    userId: string,
    timestamp: Date,
    properties: object
  }],
  pagination: {
    page: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.8 Data Models

**Analytics Event** (MongoDB - inferred):
```javascript
{
  _id: ObjectId,
  eventType: string,        // 'screen_view', 'engagement', etc.
  platform: string,         // 'ios', 'android', 'web'
  userId: ObjectId,          // Ref: User
  timestamp: Date,
  properties: {
    screenName: string,
    action: string,
    // ... other event properties
  }
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**Analytics Component** (`superAdmin/src/pages/Analytics.jsx`):
- `summary`: Summary data
- `timeSeries`: Time series data array
- `eventBreakdown`: Breakdown data array
- `topFeatures`: Top features array
- `dropOffs`: Drop-off data array
- `retention`: Retention data array
- `recentEvents`: Recent events array
- `selectedPeriod`: Current period ('7d', '30d', '90d', '1y')
- `selectedChart`: Current chart view
- `selectedEventType`: Event type filter
- `selectedPlatform`: Platform filter
- `eventsPage`: Current events page
- `eventsSearch`: Events search query
- `loading`: Loading state

**Side Effects**:
- `useEffect` on mount: Fetch all analytics data
- `useEffect` on period change: Refetch all data
- `useEffect` on filter change: Refetch filtered data
- `useEffect` on events page/search: Refetch events

### 5.2 Data Fetching

**Parallel Fetching**:
- All analytics endpoints called in parallel using `Promise.all()`
- Reduces total load time
- Handles partial failures gracefully

**Caching Strategy**:
- Analytics data not cached (real-time data)
- Period-based caching could be added for performance

---

## 6. Backend Logic & Rules

### 6.1 Analytics Aggregation

**File**: `backend/src/controllers/analyticsAdminController.js`

**Business Logic**:
1. Query analytics events collection
2. Apply date range filter
3. Apply additional filters (eventType, platform)
4. Group and aggregate data based on endpoint:
   - Summary: Count total, calculate averages
   - Time Series: Group by time intervals
   - Breakdown: Group by event type
   - Features: Group by screen/feature name
   - Drop-offs: Analyze sequential events
   - Retention: Calculate cohort retention
5. Return aggregated results

**Performance Optimizations**:
- Use MongoDB aggregation pipelines
- Index on timestamp, eventType, platform
- Limit result sets to prevent large payloads
- Cache frequently accessed aggregations (optional)

### 6.2 Time Series Grouping

**Grouping Logic**:
- 7 days: Group by hour (24 groups)
- 30 days: Group by day (30 groups)
- 90 days: Group by day (90 groups)
- 1 year: Group by week (52 groups)

**Aggregation Pipeline**:
```javascript
[
  { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
  { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d-%H", date: "$timestamp" } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
]
```

### 6.3 Retention Calculation

**Cohort Analysis**:
1. Identify user signup dates (cohorts)
2. For each cohort, track return visits:
   - Day 1: Users who returned within 1 day
   - Day 7: Users who returned within 7 days
   - Day 30: Users who returned within 30 days
3. Calculate retention rates:
   - `day1Retention = (returnedDay1 / totalCohort) * 100`
4. Return retention data per cohort

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Analytics**: All authenticated users (no specific permission required)
- **Export Analytics**: May require additional permission

### 7.2 Feature Toggles

- **Analytics Tracking**: Must be enabled in Settings
- **Analytics Export**: Can be toggled

### 7.3 Settings Impact

- **Analytics Tracking**: If disabled, no new events collected
- **Data Retention**: Affects available date ranges
- **Privacy Settings**: May affect user-level analytics

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **No Permission Check**: Analytics accessible to all authenticated SuperAdmin users

### 8.2 Authorization

- **Role-based Access**: All roles can view analytics
- **Data Filtering**: No user-specific filtering (aggregated data only)

### 8.3 Security Features

- **Audit Logging**: Analytics access may be logged
- **Rate Limiting**: API requests rate-limited
- **Input Validation**: All inputs sanitized and validated

### 8.4 Privacy Considerations

- **Aggregated Data**: Only aggregated metrics, no individual user data
- **Anonymization**: User IDs may be hashed in events
- **GDPR Compliance**: Analytics respects privacy settings

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Analytics View**: `analytics_view` event
- **Analytics Export**: `analytics_export` event
- **Period Change**: `analytics_period_change` event
- **Filter Applied**: `analytics_filter_applied` event

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total Events
- Average Events per Hour
- Peak Hour
- Growth Rate
- Event Type Distribution
- Top Features
- Drop-off Rates
- Retention Rates

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Date Range**: Maximum 1 year
- **Events per Page**: Maximum 100
- **Time Series Points**: Maximum 1000 (prevents performance issues)
- **Top Features**: Limited to top 10

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **No Data**: Show "No data available" message
- **Large Date Ranges**: May be slow, show loading indicator
- **Partial Failures**: Show available data, log errors

### 10.3 Known Constraints

- **Data Availability**: Analytics only available if tracking enabled
- **Historical Data**: Limited by data retention policy
- **Real-time**: Analytics may have 1-5 minute delay
- **Large Datasets**: Aggregations may be slow on large datasets

### 10.4 Performance Considerations

- **Aggregation Performance**: Use MongoDB indexes
- **Caching**: Consider caching for frequently accessed periods
- **Lazy Loading**: Load charts on demand
- **Pagination**: Events paginated to prevent large payloads

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Custom Date Ranges**: Date picker for custom ranges
- **Export Functionality**: Export analytics as CSV/JSON
- **Real-time Updates**: WebSocket for live analytics
- **Comparison Mode**: Compare periods side-by-side

### 11.2 Next (Medium Priority)

- **Custom Dashboards**: Create custom analytics dashboards
- **Alerts**: Set up alerts for metric thresholds
- **Funnels**: Visual funnel analysis
- **Cohort Analysis**: Advanced cohort analysis tools

### 11.3 Later (Low Priority)

- **Predictive Analytics**: ML-powered predictions
- **A/B Testing**: Built-in A/B test analysis
- **User Segmentation**: Analytics by user segments
- **API Access**: External API for analytics data

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- Recharts (or similar) for charts
- Date-fns for date handling

**Key Dependencies**:
- `recharts`: Chart library
- `date-fns`: Date utilities
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

1. User selects period/filters
2. Frontend calculates date range
3. Multiple API calls in parallel
4. Backend aggregates data
5. Response includes aggregated results
6. Frontend renders charts
7. User interacts with charts
8. Filters update, data refetches

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/analytics/summary` | Get analytics summary | Yes |
| GET | `/api/superadmin/analytics/timeseries` | Get time series data | Yes |
| GET | `/api/superadmin/analytics/breakdown` | Get event breakdown | Yes |
| GET | `/api/superadmin/analytics/features` | Get top features | Yes |
| GET | `/api/superadmin/analytics/dropoffs` | Get drop-off points | Yes |
| GET | `/api/superadmin/analytics/retention` | Get retention metrics | Yes |
| GET | `/api/superadmin/analytics/events` | Get recent events | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for analytics overview
- **TripScore Analytics**: See `tripscore-analytics-spec.md` for TripScore-specific analytics
- **Settings**: See `settings-spec.md` for analytics tracking settings


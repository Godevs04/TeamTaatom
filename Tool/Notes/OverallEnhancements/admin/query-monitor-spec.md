# Query Monitor - Product Specification

## 1. Overview

The Query Monitor menu provides real-time database query performance monitoring and analysis. It enables SuperAdmin users to identify slow queries, analyze query patterns, optimize database performance, and track query statistics over time.

### User Personas & Goals

- **Founders**: Database performance monitoring, optimization insights, capacity planning
- **Admins**: Identify performance bottlenecks, optimize slow queries
- **Developers**: Debug query performance issues, understand query patterns

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/QueryMonitor.jsx`): Query statistics dashboard, slow query list, charts, filters
- **Backend** (`backend/src/services/queryMonitor.js`): Monitors and logs database queries
- **Query Monitor Service**: Tracks query execution times, patterns, and statistics

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/QueryMonitor.jsx`

**Purpose**: Display database query performance metrics and slow query analysis

**Entry Points**:
- Navigation from sidebar (Query Monitor menu item)
- Direct URL: `/query-monitor`
- Navigation from Dashboard (if query performance alerts available)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Export data → Download CSV/JSON

**Components Used**:
- `LineChartComponent`: Query duration trends
- `BarChartComponent`: Model and operation distribution
- `Card`: KPI cards for query statistics
- `Table`: Slow queries table

**Views/Tabs**:
- **Overview**: Key metrics, query trends
- **Slow Queries**: List of slow queries with details
- **Statistics**: Detailed query statistics

---

## 3. Detailed Features & User Flows

### 3.1 Query Statistics Overview

**Feature Name**: Query Performance Metrics

**Business Description**: Display high-level query performance metrics including total queries, slow queries, average duration, and query trends.

**Preconditions**:
- User must be authenticated
- Query monitoring must be enabled

**Step-by-Step Flow**:
1. User navigates to `/query-monitor`
2. Frontend calls `getQueryStats()`
3. Backend endpoint `GET /api/superadmin/query-monitor/stats` is called
4. Backend aggregates query data:
   - Total queries count
   - Slow queries count (queries > threshold, e.g., 100ms)
   - Average query duration
   - Peak query duration
   - Queries per model (User, Post, etc.)
   - Queries per operation (find, aggregate, etc.)
5. Response includes stats object
6. Frontend displays metrics in KPI cards:
   - Total Queries
   - Slow Queries (with percentage)
   - Average Duration
   - Peak Duration
7. Frontend displays charts:
   - Query duration trend over time
   - Model distribution (bar chart)
   - Operation distribution (bar chart)
8. User can toggle auto-refresh (every 5 seconds)
9. Statistics update automatically

**Validations**:
- Auto-refresh interval: 5-10 seconds (configurable)

**Error States**:
- Network error: Show error toast, keep previous data
- No data: Show "No query data available" message

**Success States**:
- Stats load: Display all metrics and charts
- Auto-refresh: Statistics update automatically

### 3.2 Slow Queries List

**Feature Name**: Slow Query Detection

**Business Description**: Display list of slow queries (queries exceeding performance threshold) with details for optimization.

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User selects "Slow Queries" view
2. Frontend calls `getSlowQueries({ page, limit, model, operation })`
3. Backend endpoint `GET /api/superadmin/query-monitor/slow-queries` is called
4. Backend queries slow query collection:
   - Filter by model (optional)
   - Filter by operation (optional)
   - Sort by duration (descending)
   - Paginate results
5. Response includes slow queries array:
   ```javascript
   [{
     _id: string,
     model: string,           // User, Post, etc.
     operation: string,       // find, aggregate, etc.
     query: object,           // Query object
     duration: number,        // Milliseconds
     timestamp: Date,
     stackTrace: string       // Optional, for debugging
   }]
   ```
6. Frontend displays slow queries in table
7. User can:
   - Filter by model (dropdown)
   - Filter by operation (dropdown)
   - Search queries (by model/operation/query)
   - Sort by duration or timestamp
   - View query details
   - Export slow queries

**Validations**:
- Page: Must be >= 1
- Limit: Must be between 1 and 100
- Model filter: Must be valid model name (if provided)
- Operation filter: Must be valid operation (if provided)

**Error States**:
- No slow queries: Show "No slow queries found" message
- Load failure: Show error message

**Success States**:
- Slow queries table: Display slow queries
- Filters applied: Table updates with filtered results

### 3.3 Query Details

**Feature Name**: View Query Details

**Business Description**: View detailed information about a specific query including query object, execution time, and stack trace.

**Preconditions**:
- Query must be selected from list

**Step-by-Step Flow**:
1. User clicks on slow query row
2. Modal opens with query details
3. Display query information:
   - Model name
   - Operation type
   - Query object (formatted JSON)
   - Duration (milliseconds)
   - Timestamp
   - Stack trace (if available)
4. User can:
   - Copy query to clipboard
   - View formatted query
   - Close modal

**Validations**:
- Query ID: Must be valid
- Query must exist

**Error States**:
- Query not found: Show "Query not found" error
- Load failure: Show error message

**Success States**:
- Query details load: Display all information
- Details visible: Full query information displayed

### 3.4 Query Trends

**Feature Name**: Query Performance Trends

**Business Description**: Display query performance trends over time to identify performance degradation.

**Preconditions**:
- Same as Overview

**Step-by-Step Flow**:
1. User views "Overview" tab
2. Frontend calls `getQueryTrends({ startDate, endDate, groupBy })`
3. Backend endpoint `GET /api/superadmin/query-monitor/trends` is called
4. Backend aggregates query data by time intervals:
   - Group by hour/day/week based on period
   - Calculate average duration per interval
   - Count queries per interval
5. Response includes trends array:
   ```javascript
   [{
     timestamp: Date,
     averageDuration: number,
     queryCount: number,
     slowQueryCount: number
   }]
   ```
6. Frontend renders line chart showing trends
7. User can see:
   - Query duration trends
   - Query volume trends
   - Slow query trends

**Validations**:
- Date range: Valid date format
- GroupBy: Must be valid enum ('hour', 'day', 'week')

**Error States**:
- No trend data: Show "No trend data" message

**Success States**:
- Trend chart: Display query trends
- Interactive: Hover for details

---

## 4. Data Model & API Design

### 4.1 Query Stats Endpoint

**Endpoint**: `GET /api/superadmin/query-monitor/stats`

**Authentication**: Required

**Response**:
```javascript
{
  success: true,
  stats: {
    totalQueries: number,
    slowQueriesCount: number,
    averageDuration: number,    // Milliseconds
    peakDuration: number,        // Milliseconds
    slowQueryRate: number,       // Percentage
    modelDistribution: [{
      model: string,
      count: number,
      averageDuration: number
    }],
    operationDistribution: [{
      operation: string,
      count: number,
      averageDuration: number
    }]
  }
}
```

### 4.2 Slow Queries Endpoint

**Endpoint**: `GET /api/superadmin/query-monitor/slow-queries`

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 50, max: 100
- `model` (optional): Model name filter
- `operation` (optional): Operation type filter
- `minDuration` (optional): Minimum duration in ms (default: 100)

**Response**:
```javascript
{
  success: true,
  slowQueries: [{
    _id: string,
    model: string,
    operation: string,
    query: object,
    duration: number,        // Milliseconds
    timestamp: Date,
    stackTrace: string      // Optional
  }],
  pagination: {
    page: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.3 Query Trends Endpoint

**Endpoint**: `GET /api/superadmin/query-monitor/trends`

**Query Parameters**:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `groupBy` (optional): 'hour' | 'day' | 'week', default: 'hour'

**Response**:
```javascript
{
  success: true,
  trends: [{
    timestamp: Date,
    averageDuration: number,
    queryCount: number,
    slowQueryCount: number
  }]
}
```

### 4.4 Data Models

**Query Log** (MongoDB or in-memory):
```javascript
{
  _id: ObjectId,
  model: string,             // User, Post, etc.
  operation: string,         // find, aggregate, update, etc.
  query: object,             // Query object
  duration: number,          // Milliseconds
  timestamp: Date,
  stackTrace: string,        // Optional, for debugging
  isSlow: boolean            // true if duration > threshold
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**QueryMonitor Component** (`superAdmin/src/pages/QueryMonitor.jsx`):
- `stats`: Query statistics
- `slowQueries`: Slow queries array
- `trends`: Query trends array
- `loading`: Loading state
- `autoRefresh`: Auto-refresh enabled state
- `refreshInterval`: Auto-refresh interval ID
- `filterModel`: Current model filter
- `filterOperation`: Current operation filter
- `searchTerm`: Search input value
- `currentPage`: Current page number
- `sortBy`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedQuery`: Currently viewed query (for modal)
- `showModal`: Modal visibility

**Side Effects**:
- `useEffect` on mount: Fetch initial stats and slow queries
- `useEffect` on auto-refresh: Set up/clear interval
- `useEffect` on filter change: Refetch filtered data
- `useEffect` on search: Debounced search (350ms)

---

## 6. Backend Logic & Rules

### 6.1 Query Monitoring Service

**File**: `backend/src/services/queryMonitor.js`

**Business Logic**:
1. Intercept MongoDB queries (using Mongoose middleware or wrapper)
2. Track query execution:
   - Start time
   - End time
   - Calculate duration
   - Extract model and operation
   - Capture query object
3. Log slow queries (duration > threshold, e.g., 100ms):
   - Save to slow queries collection
   - Include stack trace (optional)
4. Aggregate statistics:
   - Count total queries
   - Count slow queries
   - Calculate averages
   - Group by model and operation
5. Store aggregated stats (in-memory or database)

**Performance Thresholds**:
- Slow query threshold: 100ms (configurable)
- Critical query threshold: 1000ms (configurable)

### 6.2 Get Query Stats Controller

**Route**: `GET /api/superadmin/query-monitor/stats`

**Business Logic**:
1. Verify authentication (no specific permission required, or `canViewLogs`)
2. Retrieve aggregated stats from query monitor service
3. Calculate distributions:
   - Group by model
   - Group by operation
   - Calculate averages
4. Return stats object

**Performance Optimizations**:
- Cache aggregated stats (5 minutes)
- Use efficient aggregation pipelines

### 6.3 Get Slow Queries Controller

**Route**: `GET /api/superadmin/query-monitor/slow-queries`

**Business Logic**:
1. Verify authentication
2. Parse query parameters
3. Build MongoDB query:
   - Filter by model (if provided)
   - Filter by operation (if provided)
   - Filter by minDuration (default: 100ms)
   - Sort by duration (descending)
4. Execute paginated query
5. Return slow queries array and pagination

**Performance Optimizations**:
- Index on duration, timestamp, model, operation
- Limit maximum page size to 100

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Query Monitor**: All authenticated users (or `canViewLogs` permission)
- **Export Data**: Same as view

### 7.2 Feature Toggles

- **Query Monitoring**: Can be enabled/disabled
- **Slow Query Logging**: Can be toggled
- **Stack Trace Capture**: Can be toggled (performance impact)

### 7.3 Settings Impact

- **Slow Query Threshold**: Configurable in settings
- **Query Logging**: Settings.system.debugMode affects logging level
- **Performance Impact**: Monitoring may have slight performance impact

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **No Permission Check**: Query monitor accessible to all authenticated users (or `canViewLogs`)

### 8.2 Authorization

- **Role-based Access**: All roles can view query monitor
- **Sensitive Data**: Query objects may contain sensitive data (sanitize if needed)

### 8.3 Security Features

- **Input Validation**: All inputs sanitized and validated
- **Query Sanitization**: Sensitive data in queries may be redacted
- **Access Logging**: Query monitor access may be logged

### 8.4 Privacy Considerations

- **Query Data**: Query objects may contain user data
- **Stack Traces**: Stack traces may contain sensitive information
- **Data Retention**: Query logs retained per policy

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Query Monitor View**: `query_monitor_view` event
- **Slow Query View**: `slow_query_view` event with query ID
- **Query Export**: `query_export` event

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total queries count
- Slow queries count
- Average query duration
- Peak query duration
- Slow query rate (percentage)
- Queries per model
- Queries per operation

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Page Size**: Maximum 100 slow queries per page
- **Date Range**: Maximum 30 days (for performance)
- **Slow Query Threshold**: Configurable, default: 100ms
- **Query Log Retention**: Limited by storage capacity

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **No Data**: Show "No query data available" message
- **Large Date Ranges**: May be slow, show loading indicator

### 10.3 Known Constraints

- **Performance Impact**: Query monitoring has slight performance overhead
- **Storage**: Query logs consume storage space
- **Real-time**: Statistics may have 1-5 second delay
- **Stack Traces**: May not be available for all queries

### 10.4 Performance Considerations

- **Indexing**: Duration, timestamp, model, operation indexed
- **Caching**: Statistics cached for performance
- **Sampling**: May sample queries instead of logging all (for high volume)

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Query Optimization Suggestions**: AI-powered optimization recommendations
- **Query Alerts**: Set up alerts for slow query thresholds
- **Query Comparison**: Compare query performance over time
- **Index Recommendations**: Suggest database indexes

### 11.2 Next (Medium Priority)

- **Query Profiling**: Detailed query execution profiling
- **Query Replay**: Replay queries for testing
- **Query Analytics**: Advanced query analytics dashboard
- **Performance Baselines**: Set and track performance baselines

### 11.3 Later (Low Priority)

- **Query Optimization**: Automatic query optimization
- **Query Caching**: Query result caching recommendations
- **Database Health**: Overall database health metrics
- **API Access**: External API for query monitoring

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- Recharts for charts
- Date-fns for date handling

**Key Dependencies**:
- `recharts`: Chart library
- `date-fns`: Date utilities
- `react-hot-toast`: Notifications

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- Query monitoring middleware

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- Query monitoring library or custom middleware

### 12.3 Data Flow

1. MongoDB queries executed
2. Query monitor intercepts queries
3. Query monitor logs slow queries
4. Query monitor aggregates statistics
5. Frontend fetches stats and slow queries
6. Frontend displays metrics and charts
7. Auto-refresh updates data periodically

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/query-monitor/stats` | Get query statistics | Yes |
| GET | `/api/superadmin/query-monitor/slow-queries` | Get slow queries | Yes |
| GET | `/api/superadmin/query-monitor/trends` | Get query trends | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for query performance overview
- **Settings**: See `settings-spec.md` for query monitoring configuration
- **Logs**: See `logs-spec.md` for system logs


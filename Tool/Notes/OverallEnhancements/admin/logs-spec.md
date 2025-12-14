# Logs & Audit Trail - Product Specification

## 1. Overview

The Logs menu provides comprehensive system and security audit logging capabilities. It enables SuperAdmin users to view, search, filter, and export system logs including security events, user actions, API calls, moderation actions, and system events for debugging and compliance purposes.

### User Personas & Goals

- **Founders**: Full audit trail access, security monitoring, compliance tracking
- **Admins**: View logs within permissions, troubleshoot issues
- **Moderators**: Limited log access (if `canViewLogs` permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Logs.jsx`): Log listing UI, search, filters, export, auto-refresh
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves log data from database or log files
- **Logger Service** (`backend/src/utils/logger.js`): Centralized logging service

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Logs.jsx`

**Purpose**: Display and manage system logs with filtering, search, and export capabilities

**Entry Points**:
- Navigation from sidebar (Logs menu item)
- Direct URL: `/logs`
- Navigation from other pages (if log links available)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Export logs → Download CSV/JSON file
- View log detail → Opens log detail modal

**Components Used**:
- `Table`: Log listing table with sorting
- `Modal`: Log detail modal
- `Card`: Stat cards for log counts by level
- `SafeComponent`: Error boundary wrapper

**Modals**:
- Log Detail Modal: Shows full log entry with all metadata

---

## 3. Detailed Features & User Flows

### 3.1 Log Listing & Search

**Feature Name**: Log List Display

**Business Description**: Display paginated list of all system logs with search, level filter, type filter, and date range filtering.

**Preconditions**:
- User must be authenticated
- User must have `canViewLogs` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/logs`
2. Frontend calls `fetchLogs(params)` from `RealTimeContext` or directly
3. Backend endpoint `GET /api/superadmin/logs?page=1&limit=50` is called
4. Backend queries log collection or reads log files:
   - Level filter: 'all' | 'error' | 'warning' | 'info' | 'success'
   - Type filter: 'all' | 'user_action' | 'security' | 'system' | 'moderation' | 'api'
   - Search: Match action, details, or user
   - Date range: Filter by timestamp
5. Response includes logs array and pagination metadata
6. Frontend displays logs in table format with:
   - Timestamp
   - Level (error/warning/info/success) with color coding
   - Type (user_action/security/system/moderation/api)
   - Action (human-readable action name)
   - Details (truncated)
   - IP Address
   - User (if applicable)
   - View button
7. User can:
   - Search by action/details/user (debounced 500ms)
   - Filter by level (all/error/warning/info/success)
   - Filter by type (all/user_action/security/system/moderation/api)
   - Filter by date range
   - Sort by any column (timestamp default, descending)
   - Change items per page
   - Navigate pages
   - Enable auto-refresh (every 5-10 seconds)

**Validations**:
- Page number: Must be >= 1
- Limit: Must be between 1 and 1000 (for export)
- Search: Minimum 2 characters (optional)
- Level filter: Must be valid enum
- Type filter: Must be valid enum
- Date range: Start date must be before end date

**Error States**:
- Network error: Show error toast, keep previous data
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No logs found" message

**Success States**:
- Logs load successfully: Display in table
- Search results: Update table with filtered results
- Pagination: Show current page, total pages, total count
- Auto-refresh: Logs update automatically

### 3.2 Log Detail View

**Feature Name**: View Log Details

**Business Description**: View comprehensive log entry information including full details, stack traces (for errors), and metadata.

**Preconditions**:
- Log must be selected from list
- User must have view permissions

**Step-by-Step Flow**:
1. User clicks on log row or "View" button
2. Modal opens with log detail view
3. Display log information:
   - **Timestamp**: Full date and time
   - **Level**: Error/Warning/Info/Success badge
   - **Type**: Log type category
   - **Action**: Human-readable action name
   - **Details**: Full details (may include stack trace for errors)
   - **IP Address**: Client IP address
   - **User**: User ID and email (if applicable)
   - **Admin**: Admin ID and email (if applicable)
   - **Metadata**: Additional context (request ID, session ID, etc.)
   - **Stack Trace**: For errors, full stack trace (if available)
4. User can:
   - Copy log details to clipboard
   - Close modal

**Validations**:
- Log ID: Must be valid
- Log must exist

**Error States**:
- Log not found: Show "Log not found" error
- Load failure: Show error message

**Success States**:
- Log data loads: Display all information
- Details visible: Full log entry displayed

### 3.3 Log Filtering

**Feature Name**: Advanced Filtering

**Business Description**: Filter logs by level, type, date range, and search query.

**Preconditions**:
- User must be on Logs page

**Step-by-Step Flow**:
1. User opens filter panel
2. Available filters:
   - **Level**: All / Error / Warning / Info / Success
   - **Type**: All / User Action / Security / System / Moderation / API
   - **Date Range**: All Time / Today / Last 7 Days / Last 30 Days / Custom
   - **Search**: Free text search
3. User applies filters
4. Frontend updates query parameters
5. Backend query includes filter conditions
6. Results update in table
7. Pagination resets to page 1

**Validations**:
- Date range: Start date must be before end date
- Filter values: Must be valid enums

**Error States**:
- Invalid date range: Show "Invalid date range" error
- Filter application failure: Show error, keep previous filters

**Success States**:
- Filters applied: Table updates with filtered results
- Filter count: Show number of active filters

### 3.4 Log Export

**Feature Name**: Export Logs

**Business Description**: Export filtered logs to CSV or JSON format for external analysis or compliance.

**Preconditions**:
- User must be on Logs page
- Logs must be loaded

**Step-by-Step Flow**:
1. User clicks "Export Logs" button
2. Export modal appears with format options (CSV/JSON)
3. User selects format
4. Frontend calls export endpoint or generates file client-side:
   - **CSV**: Generates CSV with columns: Timestamp, Level, Type, Action, Details, IP Address, User
   - **JSON**: Generates JSON array of log objects
5. File downloads automatically
6. Show success toast

**Validations**:
- Export format: Must be 'csv' or 'json'
- Logs available: Must have logs to export

**Error States**:
- No logs: Show "No logs to export" error
- Export failure: Show error message

**Success States**:
- Export successful: File downloads
- File format: Correct format and data

### 3.5 Auto-Refresh

**Feature Name**: Real-Time Log Updates

**Business Description**: Automatically refresh logs at regular intervals to see new log entries in real-time.

**Preconditions**:
- User must be on Logs page

**Step-by-Step Flow**:
1. User toggles "Auto-refresh" button
2. Frontend sets up interval (5-10 seconds)
3. Interval calls `fetchLogs()` with current filters
4. New logs appear at top of list
5. User can disable auto-refresh at any time
6. Interval cleared on component unmount

**Validations**:
- Auto-refresh interval: 5-10 seconds (configurable)

**Error States**:
- Refresh failure: Show error, continue with next interval
- Network error: Show warning, retry on next interval

**Success States**:
- Auto-refresh active: Logs update automatically
- New logs visible: Latest logs appear at top

---

## 4. Data Model & API Design

### 4.1 Get Logs Endpoint

**Endpoint**: `GET /api/superadmin/logs`

**Authentication**: Required

**Permissions**: `canViewLogs` or founder

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 50, max: 1000
- `level` (optional): 'all' | 'error' | 'warning' | 'info' | 'success'
- `type` (optional): 'all' | 'user_action' | 'security' | 'system' | 'moderation' | 'api'
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `search` (optional): String, min: 2 characters
- `sortBy` (optional): Field name, default: 'timestamp'
- `sortOrder` (optional): 'asc' | 'desc', default: 'desc'

**Response**:
```javascript
{
  success: true,
  logs: [{
    _id: string,
    timestamp: Date,
    level: 'error' | 'warning' | 'info' | 'success',
    type: 'user_action' | 'security' | 'system' | 'moderation' | 'api',
    action: string,
    details: string,
    ipAddress: string,
    userId: ObjectId,         // Optional, Ref: User
    adminId: ObjectId,         // Optional, Ref: SuperAdmin
    metadata: object,          // Additional context
    stackTrace: string        // Optional, for errors
  }],
  pagination: {
    currentPage: number,
    totalPages: number,
    total: number,
    limit: number
  },
  stats: {
    errorCount: number,
    warningCount: number,
    infoCount: number,
    successCount: number
  }
}
```

### 4.2 Data Models

**Log Entry** (MongoDB or File-based):
```javascript
{
  _id: ObjectId,
  timestamp: Date,
  level: 'error' | 'warning' | 'info' | 'success',
  type: 'user_action' | 'security' | 'system' | 'moderation' | 'api',
  action: string,             // Human-readable action name
  details: string,            // Detailed message
  ipAddress: string,          // Client IP
  userId: ObjectId,           // Optional, Ref: User
  adminId: ObjectId,          // Optional, Ref: SuperAdmin
  metadata: {
    requestId: string,        // Optional
    sessionId: string,        // Optional
    userAgent: string,       // Optional
    // ... other context
  },
  stackTrace: string,         // Optional, for errors
  createdAt: Date
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**Logs Component** (`superAdmin/src/pages/Logs.jsx`):
- `logs`: Log list data
- `loading`: Loading state
- `searchTerm`: Search input value
- `filterLevel`: Current level filter
- `filterType`: Current type filter
- `dateRange`: Date range filter
- `currentPage`: Current page number
- `itemsPerPage`: Items per page (50 default)
- `sortBy`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedLog`: Currently viewed log (for modal)
- `showModal`: Modal visibility
- `autoRefresh`: Auto-refresh enabled state
- `refreshInterval`: Auto-refresh interval ID
- `stats`: Log statistics (error/warning/info/success counts)

**Side Effects**:
- `useEffect` on mount: Fetch initial log list
- `useEffect` on filter change: Reset to page 1, fetch filtered data
- `useEffect` on search: Debounced search (500ms)
- `useEffect` on pagination: Fetch page data
- `useEffect` on auto-refresh: Set up/clear interval

---

## 6. Backend Logic & Rules

### 6.1 Get Logs Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/logs`

**Business Logic**:
1. Verify authentication and permission (`canViewLogs`)
2. Parse query parameters
3. Build query:
   - Level filter: Match level field
   - Type filter: Match type field
   - Search: Match action, details, or user (case-insensitive)
   - Date range: Filter by timestamp
   - Sort: Apply sortBy and sortOrder
4. Execute paginated query:
   - Count total matching documents
   - Fetch page of documents
   - Populate userId and adminId if present
5. Calculate statistics (error/warning/info/success counts)
6. Calculate pagination metadata
7. Return logs array, pagination, and stats

**Performance Optimizations**:
- Index on timestamp, level, type
- Limit maximum page size to 1000
- Use lean queries for list views
- Cache statistics if needed

### 6.2 Log Storage

**Storage Options**:
- **Database**: MongoDB collection (preferred for queryability)
- **File-based**: Log files (for high-volume, requires parsing)
- **Hybrid**: Recent logs in DB, archived logs in files

**Log Rotation**:
- Old logs archived or deleted based on retention policy
- Configurable retention period (e.g., 90 days)

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Logs**: `canViewLogs` permission required
- **Export Logs**: May require additional permission or same as view

### 7.2 Feature Toggles

- **Logging System**: Can be enabled/disabled
- **Auto-refresh**: Can be toggled per user
- **Log Export**: Can be restricted

### 7.3 Settings Impact

- **Log Level**: Settings.system.logLevel affects what gets logged
- **Log Retention**: Settings.privacy.dataRetentionDays affects log availability
- **Debug Mode**: Settings.system.debugMode enables additional logging

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canViewLogs` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Sensitive Data**: Some log details may be redacted for non-founders
- **IP Address Privacy**: IP addresses visible to admins only (if configured)

### 8.3 Security Features

- **Audit Logging**: Log access itself may be logged
- **Input Validation**: All inputs sanitized and validated
- **Rate Limiting**: API requests rate-limited
- **Data Retention**: Logs retained per policy

### 8.4 Privacy Considerations

- **PII in Logs**: Personal information may be present in logs
- **Access Control**: Logs accessible only to authorized admins
- **Data Retention**: Logs deleted per retention policy
- **GDPR Compliance**: Logs may need to be exportable/deletable

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Log View**: `logs_view` event
- **Log Export**: `logs_export` event with format
- **Log Search**: `logs_search` event with query
- **Auto-refresh Toggle**: `logs_auto_refresh_toggle` event

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total logs count
- Error count
- Warning count
- Info count
- Success count
- Logs by type
- Logs by level

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Page Size**: Maximum 1000 logs per page (for export)
- **Search**: Minimum 2 characters
- **Date Range**: Maximum 1 year (for performance)
- **Auto-refresh Interval**: 5-10 seconds (configurable)

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **Large Date Ranges**: May be slow, show loading indicator
- **Export Failures**: Show error message, allow retry
- **Auto-refresh Failures**: Continue with next interval

### 10.3 Known Constraints

- **Log Volume**: Large log volumes may impact performance
- **Storage**: Log storage limited by database/file system capacity
- **Real-time**: Logs may have 1-5 second delay
- **Retention**: Old logs may be archived or deleted

### 10.4 Performance Considerations

- **Indexing**: Timestamp, level, type indexed
- **Pagination**: Required for large log volumes
- **Caching**: Statistics may be cached
- **Lazy Loading**: Log details loaded on demand

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Log Aggregation**: Aggregate logs by time periods
- **Log Alerts**: Set up alerts for error thresholds
- **Log Search**: Advanced search with multiple criteria
- **Log Visualization**: Charts for log trends

### 11.2 Next (Medium Priority)

- **Log Correlation**: Correlate related logs
- **Log Patterns**: Detect patterns in logs
- **Log Anomaly Detection**: AI-powered anomaly detection
- **Log Dashboard**: Dedicated log analytics dashboard

### 11.3 Later (Low Priority)

- **Log Streaming**: Real-time log streaming
- **Log Archiving**: Automatic log archiving
- **Log Compression**: Compress old logs
- **API Access**: External API for log access

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- React Hot Toast for notifications
- Date-fns for date handling

**Key Dependencies**:
- `react-router-dom`: Navigation
- `react-hot-toast`: Toast notifications
- `date-fns`: Date utilities

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose (or file-based logging)
- Winston or similar logging library

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM (if DB-based)
- `winston`: Logging library (optional)

### 12.3 Data Flow

1. User navigates to Logs page
2. Frontend fetches log list
3. Logs displayed in table
4. User searches/filters/exports
5. Frontend updates params and refetches
6. Table updates with new data
7. Auto-refresh updates logs periodically

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/logs` | Get paginated log list | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for log overview
- **Settings**: See `settings-spec.md` for logging configuration
- **Moderators**: See `moderators-spec.md` for moderator action logs
- **Authentication**: See `auth-spec.md` for security logs


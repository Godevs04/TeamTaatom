# Reports Management - Product Specification

## 1. Overview

The Reports menu provides comprehensive management of user-reported content (posts, shorts, users). It enables SuperAdmin users to view, review, resolve, and dismiss reports with status tracking, priority management, and audit logging.

### User Personas & Goals

- **Founders**: Full report management, review all reports, make final decisions
- **Admins**: Review and resolve reports within permissions
- **Moderators**: Review reports, escalate to admins if needed

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Reports.jsx`): Report listing UI, report detail modal, status management, filters
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves report data, handles report status updates
- **Real-time Context** (`superAdmin/src/context/RealTimeContext.jsx`): Manages report data fetching

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Reports.jsx`

**Purpose**: Display and manage user-reported content with review and resolution workflows

**Entry Points**:
- Navigation from sidebar (Reports menu item)
- Direct URL: `/reports`
- Navigation from Dashboard (if report alerts available)

**Exit Points**:
- Click report row → Opens report detail modal
- Click sidebar menu → Navigate to other pages
- Resolve report → Navigate to related content (post/user)

**Components Used**:
- `Table`: Report listing table with sorting
- `Modal`: Report detail and action confirmation modals
- `Card`: Stat cards for report counts
- `SafeComponent`: Error boundary wrapper

**Modals**:
- Report Detail Modal: Shows full report information, reported content preview, actions
- Resolve Modal: Confirmation for resolving reports
- Dismiss Modal: Confirmation for dismissing reports

---

## 3. Detailed Features & User Flows

### 3.1 Report Listing & Search

**Feature Name**: Report List Display

**Business Description**: Display paginated list of all reports with search, status filter, type filter, and priority filter.

**Preconditions**:
- User must be authenticated
- User must have `canManageReports` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/reports`
2. Frontend calls `fetchReports(params)` from `RealTimeContext`
3. Backend endpoint `GET /api/superadmin/reports?page=1&limit=20` is called
4. Backend queries `Report` collection with filters:
   - Status filter: 'pending' | 'resolved' | 'dismissed' | 'all'
   - Type filter: 'post' | 'short' | 'user' | 'all'
   - Priority filter: 'high' | 'medium' | 'low' | 'all'
   - Search: Match report reason or reported content
5. Response includes reports array and pagination metadata
6. Frontend displays reports in table format with:
   - Report ID
   - Type (post/short/user)
   - Reported content preview
   - Reporter information
   - Reason
   - Priority
   - Status
   - Created date
   - Actions (view, resolve, dismiss)
7. User can:
   - Search by reason/content (debounced 500ms)
   - Filter by status (all/pending/resolved/dismissed)
   - Filter by type (all/post/short/user)
   - Filter by priority (all/high/medium/low)
   - Sort by any column
   - Change items per page
   - Navigate pages

**Validations**:
- Page number: Must be >= 1
- Limit: Must be between 1 and 100
- Search: Minimum 2 characters (optional)
- Status filter: Must be valid enum
- Type filter: Must be valid enum
- Priority filter: Must be valid enum

**Error States**:
- Network error: Show error toast, keep previous data
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No reports found" message

**Success States**:
- Reports load successfully: Display in table
- Search results: Update table with filtered results
- Pagination: Show current page, total pages, total count

### 3.2 Report Detail View

**Feature Name**: View Report Details

**Business Description**: View comprehensive report information including reported content, reporter, reason, priority, and resolution history.

**Preconditions**:
- Report must be selected from list
- User must have view permissions

**Step-by-Step Flow**:
1. User clicks on report row or "View" button
2. Modal opens with report detail view
3. Display report information:
   - **Reported Content**: 
     - For posts: Image/video preview, caption, user
     - For users: User profile, posts count
   - **Reporter**: Name, email, profile link
   - **Reason**: Report reason/category
   - **Description**: Detailed description (if provided)
   - **Priority**: High/Medium/Low badge
   - **Status**: Current status with timestamp
   - **Resolution History**: Previous actions taken
   - **Admin Notes**: Notes added by admins
4. User can:
   - View reported content in detail
   - Navigate to reporter profile
   - Navigate to reported content
   - Resolve report (with notes)
   - Dismiss report (with reason)
   - Add admin notes

**Validations**:
- Report ID: Must be valid ObjectId
- Report must exist in database

**Error States**:
- Report not found: Show "Report not found" error
- Content load failure: Show error message, allow retry

**Success States**:
- Report data loads: Display all information
- Content preview: Shows reported content

### 3.3 Report Resolution

**Feature Name**: Resolve Reports

**Business Description**: Mark reports as resolved after taking appropriate action (e.g., removing content, warning user).

**Preconditions**:
- Report must be selected
- Report status must be 'pending'
- Admin must have resolve permissions

**Step-by-Step Flow**:
1. User clicks "Resolve" button on report
2. Resolution modal appears
3. User can:
   - Add resolution notes (required)
   - Select action taken (remove content, warn user, etc.)
   - Optionally navigate to content to take action
4. User confirms resolution
5. Frontend calls `handleReportAction(reportId, 'approve')`
6. Backend endpoint `PATCH /api/superadmin/reports/:id` is called with:
   ```javascript
   {
     status: 'resolved',
     adminNotes: string,
     resolvedBy: ObjectId,
     resolvedAt: Date
   }
   ```
7. Backend validates report ID and status
8. Backend updates Report document
9. Backend may trigger related actions:
   - If content removal: Update post/user status
   - If user warning: Log warning action
10. Backend logs resolution action
11. Response returns updated report
12. Frontend refreshes report list
13. Show success toast

**Validations**:
- Report ID: Must be valid
- Report must exist and be pending
- Admin notes: Required, min 10 characters
- Action taken: Must be valid enum (if provided)

**Error States**:
- Report not found: Show "Report not found" error
- Already resolved: Show "Report already resolved" error
- Resolution failure: Show error message

**Success States**:
- Resolution successful: Show success toast, update UI
- Status change: Report row updates to 'resolved'
- Action taken: Related content/user updated

### 3.4 Report Dismissal

**Feature Name**: Dismiss Reports

**Business Description**: Dismiss reports that are invalid, false, or do not require action.

**Preconditions**:
- Report must be selected
- Report status must be 'pending'
- Admin must have dismiss permissions

**Step-by-Step Flow**:
1. User clicks "Dismiss" button on report
2. Dismissal modal appears
3. User must provide dismissal reason (required)
4. User confirms dismissal
5. Frontend calls `handleReportAction(reportId, 'dismiss')`
6. Backend endpoint `PATCH /api/superadmin/reports/:id` is called with:
   ```javascript
   {
     status: 'dismissed',
     adminNotes: string,      // Dismissal reason
     dismissedBy: ObjectId,
     dismissedAt: Date
   }
   ```
7. Backend validates report ID and status
8. Backend updates Report document
9. Backend logs dismissal action
10. Response returns updated report
11. Frontend refreshes report list
12. Show success toast

**Validations**:
- Report ID: Must be valid
- Report must exist and be pending
- Dismissal reason: Required, min 10 characters

**Error States**:
- Report not found: Show "Report not found" error
- Already dismissed: Show "Report already dismissed" error
- Dismissal failure: Show error message

**Success States**:
- Dismissal successful: Show success toast, update UI
- Status change: Report row updates to 'dismissed'

### 3.5 Report Filtering

**Feature Name**: Advanced Filtering

**Business Description**: Filter reports by status, type, priority, and date range.

**Preconditions**:
- User must be on Reports page

**Step-by-Step Flow**:
1. User opens filter panel
2. Available filters:
   - **Status**: All / Pending / Resolved / Dismissed
   - **Type**: All / Post / Short / User
   - **Priority**: All / High / Medium / Low
   - **Date Range**: All Time / Today / Last 7 Days / Last 30 Days / Custom
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

---

## 4. Data Model & API Design

### 4.1 Get Reports Endpoint

**Endpoint**: `GET /api/superadmin/reports`

**Authentication**: Required

**Permissions**: `canManageReports` or founder

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 20, max: 100
- `status` (optional): 'all' | 'pending' | 'resolved' | 'dismissed'
- `type` (optional): 'all' | 'post' | 'short' | 'user'
- `priority` (optional): 'all' | 'high' | 'medium' | 'low'
- `sortBy` (optional): Field name, default: 'createdAt'
- `sortOrder` (optional): 'asc' | 'desc', default: 'desc'

**Response**:
```javascript
{
  success: true,
  reports: [{
    _id: string,
    type: 'post' | 'short' | 'user',
    reportedItem: {
      _id: string,
      // Post/Short: caption, imageUrl, videoUrl, user
      // User: fullName, email, avatar
    },
    reporter: {
      _id: string,
      fullName: string,
      email: string
    },
    reason: string,
    description: string,
    priority: 'high' | 'medium' | 'low',
    status: 'pending' | 'resolved' | 'dismissed',
    adminNotes: string,
    resolvedBy: ObjectId,
    resolvedAt: Date,
    createdAt: Date
  }],
  pagination: {
    currentPage: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.2 Update Report Endpoint

**Endpoint**: `PATCH /api/superadmin/reports/:id`

**Authentication**: Required

**Permissions**: `canManageReports` or founder

**Request Body**:
```javascript
{
  status: 'resolved' | 'dismissed',
  adminNotes: string,        // Required, min 10 characters
  actionTaken: string        // Optional, e.g., 'removed_content', 'warned_user'
}
```

**Response**:
```javascript
{
  success: true,
  message: "Report updated successfully",
  report: {
    // Updated report object
  }
}
```

### 4.3 Data Models

**Report Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  type: 'post' | 'short' | 'user',
  reportedItemId: ObjectId,   // Ref: Post or User
  reportedItemType: 'post' | 'short' | 'user',
  reporter: ObjectId,         // Ref: User (who reported)
  reason: string,             // Report category/reason
  description: string,         // Detailed description
  priority: 'high' | 'medium' | 'low',
  status: 'pending' | 'resolved' | 'dismissed',
  adminNotes: string,         // Notes from admin
  resolvedBy: ObjectId,        // Ref: SuperAdmin
  resolvedAt: Date,
  dismissedBy: ObjectId,       // Ref: SuperAdmin
  dismissedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Real-Time Context

**File**: `superAdmin/src/context/RealTimeContext.jsx`

**Report Data Management**:
- `reports`: Array of report objects
- `fetchReports(params, signal)`: Fetches reports with pagination/filters
- Auto-refresh: Optional (not enabled by default)

### 5.2 Component State

**Reports Component** (`superAdmin/src/pages/Reports.jsx`):
- `reports`: Report list data
- `loading`: Loading state
- `searchTerm`: Search input value
- `filterStatus`: Current status filter
- `typeFilter`: Current type filter
- `priorityFilter`: Current priority filter
- `currentPage`: Current page number
- `itemsPerPage`: Items per page (20 default)
- `sortBy`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedReports`: Array of selected report IDs
- `selectedReport`: Currently viewed report (for modal)
- `showModal`: Modal visibility
- `showExportModal`: Export modal visibility

**Side Effects**:
- `useEffect` on mount: Fetch initial report list
- `useEffect` on filter change: Reset to page 1, fetch filtered data
- `useEffect` on search: Debounced search (500ms)
- `useEffect` on pagination: Fetch page data

---

## 6. Backend Logic & Rules

### 6.1 Get Reports Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/reports`

**Business Logic**:
1. Verify authentication and permission (`canManageReports`)
2. Parse query parameters
3. Build MongoDB query:
   - Status filter: Match status field
   - Type filter: Match type field
   - Priority filter: Match priority field
   - Search: Match reason or description (case-insensitive)
   - Sort: Apply sortBy and sortOrder
4. Execute paginated query:
   - Count total matching documents
   - Fetch page of documents
   - Populate reporter and reportedItem fields
5. Calculate pagination metadata
6. Return reports array and pagination info

**Performance Optimizations**:
- Index on status, type, priority, createdAt
- Limit maximum page size to 100
- Use lean queries with population

### 6.2 Update Report Controller

**Route**: `PATCH /api/superadmin/reports/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate report ID
3. Find report by ID
4. Validate update data:
   - Status must be 'resolved' or 'dismissed'
   - Admin notes required, min 10 characters
5. Update report document:
   - Set status
   - Set adminNotes
   - Set resolvedBy/dismissedBy: req.superAdmin._id
   - Set resolvedAt/dismissedAt: Date.now()
6. If action taken specified:
   - Perform related action (remove content, warn user, etc.)
7. Log resolution/dismissal action
8. Return updated report

**Validation Rules**:
- Status: Must be 'resolved' or 'dismissed'
- Admin notes: Required, min 10 characters
- Report must be in 'pending' status (cannot re-resolve)

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Reports**: `canManageReports` permission required
- **Resolve Reports**: `canManageReports` permission required
- **Dismiss Reports**: `canManageReports` permission required

### 7.2 Feature Toggles

- **Report System**: Can be enabled/disabled
- **Auto-resolution**: Can be toggled (auto-resolve certain report types)

### 7.3 Settings Impact

- **Content Moderation**: Policy affects report resolution workflow
- **User Warnings**: Settings affect warning actions

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canManageReports` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Action Restrictions**: Some actions may be restricted to founders only

### 8.3 Security Features

- **Audit Logging**: All report actions logged with admin ID, timestamp, notes
- **IP Tracking**: Actions tracked by IP address
- **Input Validation**: All inputs sanitized and validated

### 8.4 Privacy Considerations

- **Reporter Privacy**: Reporter information visible to admins only
- **Reported Content**: Content visible for review purposes
- **Admin Notes**: Notes stored securely, visible to admins only

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Report List View**: `reports_list_view` event
- **Report View**: `report_view` event with report ID
- **Report Resolve**: `report_resolve` event with report ID and action
- **Report Dismiss**: `report_dismiss` event with report ID

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total reports count
- Pending reports count
- Resolved reports count
- Dismissed reports count
- Reports by type
- Reports by priority
- Average resolution time

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Page Size**: Maximum 100 reports per page
- **Search**: Minimum 2 characters
- **Admin Notes**: Minimum 10 characters
- **Report Description**: Maximum 1000 characters (if enforced)

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **Report Not Found**: Show "Report not found" error
- **Already Resolved**: Show "Report already resolved" error
- **Concurrent Updates**: Last write wins

### 10.3 Known Constraints

- **Report Status**: Cannot change from resolved/dismissed back to pending
- **Large Report Volume**: Pagination required for >1000 reports
- **Content Deletion**: Resolving report may delete content (irreversible)

### 10.4 Performance Considerations

- **Indexing**: Status, type, priority, createdAt indexed
- **Population**: Reporter and reportedItem populated efficiently
- **Debouncing**: Search debounced to 500ms

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Bulk Actions**: Resolve/dismiss multiple reports at once
- **Report Templates**: Pre-defined resolution actions
- **Report Analytics**: Detailed report analytics dashboard
- **Auto-resolution**: AI-powered auto-resolution for certain types

### 11.2 Next (Medium Priority)

- **Report Escalation**: Escalate reports to higher priority
- **Report Comments**: Threaded comments on reports
- **Report History**: Detailed history of all actions
- **Report Notifications**: Notify admins of high-priority reports

### 11.3 Later (Low Priority)

- **Report Categories**: Categorize reports for better organization
- **Report Workflows**: Multi-step resolution workflows
- **Report Analytics**: Advanced analytics and reporting
- **API Access**: External API for report management

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- React Hot Toast for notifications
- Framer Motion for animations

**Key Dependencies**:
- `react-router-dom`: Navigation
- `react-hot-toast`: Toast notifications
- `framer-motion`: Animations

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `jsonwebtoken`: JWT handling

### 12.3 Data Flow

1. User navigates to Reports page
2. Frontend fetches report list
3. Reports displayed in table
4. User views/resolves/dismisses report
5. Frontend calls appropriate endpoint
6. Backend processes request
7. Backend updates database
8. Response returns updated data
9. Frontend refreshes list

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/reports` | Get paginated report list | Yes |
| PATCH | `/api/superadmin/reports/:id` | Update report status | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for report overview
- **Travel Content**: See `travel-content-spec.md` for content moderation
- **Users**: See `users-spec.md` for user reporting
- **Logs**: See `logs-spec.md` for report action logs


# Travel Content Management - Product Specification

## 1. Overview

The Travel Content menu provides comprehensive management of user-generated posts and shorts (videos) on the platform. It enables SuperAdmin users to moderate content, manage post status, flag inappropriate content, and perform bulk operations on posts and shorts.

### User Personas & Goals

- **Founders**: Full content moderation, view all posts/shorts, manage featured content
- **Admins**: Moderate content within permissions, review flagged content
- **Moderators**: Review and moderate content, handle user reports

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/TravelContent.jsx`): Content listing UI, search, filters, moderation actions, bulk operations
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves post/short data, handles moderation actions
- **Real-time Context** (`superAdmin/src/context/RealTimeContext.jsx`): Manages content data fetching

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/TravelContent.jsx`

**Purpose**: Display and manage all posts and shorts with moderation capabilities

**Entry Points**:
- Navigation from sidebar (Travel Content menu item)
- Direct URL: `/travel-content`
- Navigation from Dashboard (click on post in recent activity)

**Exit Points**:
- Click post row → Opens post detail modal
- Click sidebar menu → Navigate to other pages

**Components Used**:
- `Table`: Data table with sorting and pagination
- `Modal`: Post detail and action confirmation modals
- `Card`: Stat cards for content counts
- `SafeComponent`: Error boundary wrapper

**Modals**:
- Post Detail Modal: Shows full post information, media preview
- Delete Confirmation Modal: Confirms destructive actions
- Bulk Action Modal: Confirmation for bulk operations

---

## 3. Detailed Features & User Flows

### 3.1 Content Listing & Search

**Feature Name**: Post/Short List Display

**Business Description**: Display paginated list of all posts and shorts with search and filter capabilities.

**Preconditions**:
- User must be authenticated
- User must have `canManageContent` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/travel-content`
2. Frontend calls `fetchPosts()` from `RealTimeContext` with default params
3. Backend endpoint `GET /api/superadmin/travel-content?page=1&limit=20` is called
4. Backend queries `Post` collection with filters:
   - Type filter: 'photo' | 'short' | 'all'
   - Status filter: 'active' | 'inactive' | 'flagged' | 'all'
   - Search: Match caption or user name
5. Response includes posts array and pagination metadata
6. Frontend displays content in table format with:
   - Thumbnail/image preview
   - Caption (truncated)
   - User information
   - Type (photo/short)
   - Status (active/inactive/flagged)
   - Created date
   - Engagement metrics (likes, comments)
7. User can:
   - Search by caption/user (debounced 500ms)
   - Filter by type (all/photo/short)
   - Filter by status (all/active/inactive/flagged)
   - Sort by any column
   - Change items per page
   - Navigate pages

**Validations**:
- Page number: Must be >= 1
- Limit: Must be between 1 and 100
- Search: Minimum 2 characters (optional)
- Type filter: Must be valid enum
- Status filter: Must be valid enum

**Error States**:
- Network error: Show error toast, keep previous data
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No content found" message

**Success States**:
- Content loads successfully: Display in table
- Search results: Update table with filtered results
- Pagination: Show current page, total pages, total count

### 3.2 Content Detail View

**Feature Name**: View Post/Short Details

**Business Description**: View comprehensive post/short information including media, caption, user, engagement, and moderation history.

**Preconditions**:
- Post must be selected from list
- User must have view permissions

**Step-by-Step Flow**:
1. User clicks on post row or "View" button
2. Modal opens with post detail view
3. Display post information:
   - Media: Image or video preview (with play controls for videos)
   - Caption: Full caption text with hashtags/mentions
   - User: Name, avatar, profile link
   - Location: Location name and coordinates (if available)
   - Engagement: Likes count, comments count, shares
   - Metadata: Created date, type, status
   - Moderation: Current status, flag reason (if flagged)
   - TripScore: Trust level, source type (if applicable)
4. User can:
   - View full-size media
   - Navigate to user profile
   - View comments (if implemented)
   - Perform moderation actions

**Validations**:
- Post ID must be valid ObjectId
- Post must exist in database

**Error States**:
- Post not found: Show "Post not found" error
- Media load failure: Show placeholder, allow retry
- Load failure: Show error message, allow retry

**Success States**:
- Post data loads: Display all information
- Media loads: Display image/video

### 3.3 Content Moderation Actions

**Feature Name**: Post Status Management

**Business Description**: Perform moderation actions on posts/shorts (activate, deactivate, flag, delete).

**Preconditions**:
- Post must be selected
- Admin must have appropriate permissions

**Step-by-Step Flow**:
1. User clicks action button on post row:
   - **Activate**: Make post visible to all users
   - **Deactivate**: Hide post from feed (soft delete)
   - **Flag**: Mark as inappropriate (requires reason)
   - **Delete**: Permanently remove post
2. For destructive actions (flag/delete), confirmation dialog appears
3. For flag action, user must enter reason
4. User confirms action
5. Frontend calls appropriate endpoint:
   - Activate: `PATCH /api/superadmin/posts/:id` with `{ isActive: true }`
   - Deactivate: `PATCH /api/superadmin/posts/:id` with `{ isActive: false }`
   - Flag: `PATCH /api/superadmin/posts/:id/flag` with `{ reason: string }`
   - Delete: `DELETE /api/superadmin/posts/:id`
6. Backend validates action and updates post
7. Backend logs action in security logs
8. Response returns updated post data
9. Frontend refreshes content list
10. Show success toast

**Validations**:
- Post ID must be valid
- Post must exist
- Action must be valid enum
- Flag reason: Required, min 10 characters

**Error States**:
- Invalid action: Show "Invalid action" error
- Post not found: Show "Post not found" error
- Permission denied: Show "Insufficient permissions" error

**Success States**:
- Action successful: Show success toast, update UI
- Status change: Post row updates immediately

### 3.4 Bulk Content Actions

**Feature Name**: Bulk Operations

**Business Description**: Perform actions on multiple posts/shorts simultaneously.

**Preconditions**:
- At least one post must be selected
- Admin must have bulk action permissions

**Step-by-Step Flow**:
1. User selects multiple posts using checkboxes
2. Bulk action toolbar appears
3. User selects action (Activate/Deactivate/Flag/Delete)
4. Confirmation modal appears with:
   - Number of posts affected
   - Action description
   - Reason input field (for flag/delete)
5. User enters reason (if required) and confirms
6. Frontend calls bulk action endpoint
7. Backend processes each post:
   - Validates post ID
   - Performs action
   - Logs individual action
8. Response returns success count and failures
9. Frontend refreshes content list
10. Show success toast with count

**Validations**:
- At least one post must be selected
- Reason required for flag/delete (min 10 characters)
- All post IDs must be valid
- Action must be valid enum

**Error States**:
- No posts selected: Show "Please select posts first"
- Invalid post IDs: Show "Some posts are invalid"
- Partial failure: Show "X of Y posts updated" with details

**Success States**:
- All successful: Show "Successfully [action]d X posts"
- Selection cleared: Checkboxes reset
- List refreshed: Updated statuses visible

### 3.5 Content Filtering

**Feature Name**: Advanced Filtering

**Business Description**: Filter content by type, status, date range, and user.

**Preconditions**:
- User must be on Travel Content page

**Step-by-Step Flow**:
1. User opens filter panel
2. Available filters:
   - **Type**: All / Photo / Short
   - **Status**: All / Active / Inactive / Flagged
   - **Date Range**: All Time / Today / Last 7 Days / Last 30 Days / Custom
   - **User**: Search by user name/email
3. User applies filters
4. Frontend updates query parameters
5. Backend query includes filter conditions
6. Results update in table
7. Pagination resets to page 1

**Validations**:
- Date range: Start date must be before end date
- User search: Minimum 2 characters

**Error States**:
- Invalid date range: Show "Invalid date range" error
- Filter application failure: Show error, keep previous filters

**Success States**:
- Filters applied: Table updates with filtered results
- Filter count: Show number of active filters

---

## 4. Data Model & API Design

### 4.1 Get Travel Content Endpoint

**Endpoint**: `GET /api/superadmin/travel-content`

**Authentication**: Required (JWT token)

**Permissions**: `canManageContent` or founder

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 20, max: 100
- `search` (optional): String, min: 2 characters
- `type` (optional): 'all' | 'photo' | 'short'
- `status` (optional): 'all' | 'active' | 'inactive' | 'flagged'
- `sortBy` (optional): Field name, default: 'createdAt'
- `sortOrder` (optional): 'asc' | 'desc', default: 'desc'

**Response**:
```javascript
{
  success: true,
  posts: [{
    _id: string,
    caption: string,
    imageUrl: string,        // For photos
    videoUrl: string,         // For shorts
    type: 'photo' | 'short',
    isActive: boolean,
    isFlagged: boolean,
    flagReason: string,
    createdAt: Date,
    user: {
      _id: string,
      fullName: string,
      avatar: string
    },
    location: {
      name: string,
      coordinates: {
        latitude: number,
        longitude: number
      }
    },
    engagement: {
      likes: number,
      comments: number,
      shares: number
    },
    tripScore: {
      trustLevel: string,
      source: string
    }
  }],
  pagination: {
    currentPage: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.2 Update Post Endpoint

**Endpoint**: `PATCH /api/superadmin/posts/:id`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Request Body**:
```javascript
{
  isActive?: boolean,
  isFlagged?: boolean,
  flagReason?: string,
  // ... other fields
}
```

**Response**:
```javascript
{
  success: true,
  message: "Post updated successfully",
  post: {
    // Updated post object
  }
}
```

### 4.3 Flag Post Endpoint

**Endpoint**: `PATCH /api/superadmin/posts/:id/flag`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Request Body**:
```javascript
{
  reason: string,  // Required, min 10 characters
  severity: 'low' | 'medium' | 'high'  // Optional
}
```

**Response**:
```javascript
{
  success: true,
  message: "Post flagged successfully",
  post: {
    // Updated post with flagReason
  }
}
```

### 4.4 Delete Post Endpoint

**Endpoint**: `DELETE /api/superadmin/posts/:id`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Response**:
```javascript
{
  success: true,
  message: "Post deleted successfully"
}
```

### 4.5 Data Models

**Post Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  caption: string,
  imageUrl: string,          // For photos
  videoUrl: string,           // For shorts
  thumbnailUrl: string,       // For shorts
  type: 'photo' | 'short',
  user: ObjectId,             // Ref: User
  location: {
    name: string,
    coordinates: {
      latitude: number,
      longitude: number
    }
  },
  isActive: boolean,
  isArchived: boolean,
  isHidden: boolean,
  isFlagged: boolean,
  flagReason: string,
  flaggedBy: ObjectId,        // Ref: SuperAdmin
  flaggedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  engagement: {
    likes: number,
    comments: number,
    shares: number
  },
  tripScore: {
    trustLevel: 'high' | 'medium' | 'low' | 'unverified' | 'suspicious',
    source: 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only'
  }
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Real-Time Context

**File**: `superAdmin/src/context/RealTimeContext.jsx`

**Content Data Management**:
- `posts`: Array of post objects
- `fetchPosts(params, signal)`: Fetches posts with pagination/filters
- Auto-refresh: Optional (not enabled by default)

### 5.2 Component State

**TravelContent Component** (`superAdmin/src/pages/TravelContent.jsx`):
- `posts`: Post list data
- `loading`: Loading state
- `searchTerm`: Search input value
- `filterType`: Current type filter (all/photo/short)
- `statusFilter`: Current status filter
- `currentPage`: Current page number
- `itemsPerPage`: Items per page (20 default)
- `sortBy`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedPosts`: Array of selected post IDs
- `showDeleteConfirm`: Delete confirmation modal visibility
- `selectedContent`: Currently viewed post (for modal)
- `showModal`: Modal visibility
- `dateRange`: Date range filter

**Side Effects**:
- `useEffect` on mount: Fetch initial post list
- `useEffect` on filter change: Reset to page 1, fetch filtered data
- `useEffect` on search: Debounced search (500ms)
- `useEffect` on pagination: Fetch page data

---

## 6. Backend Logic & Rules

### 6.1 Get Travel Content Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/travel-content`

**Business Logic**:
1. Verify authentication and permission (`canManageContent`)
2. Parse query parameters
3. Build MongoDB query:
   - Type filter: Match `type` field
   - Status filter: Match `isActive`, `isFlagged` fields
   - Search: Match caption or user name (case-insensitive)
   - Sort: Apply sortBy and sortOrder
4. Execute paginated query:
   - Count total matching documents
   - Fetch page of documents
   - Populate user field
5. Calculate pagination metadata
6. Return posts array and pagination info

**Performance Optimizations**:
- Index on type, isActive, createdAt
- Limit maximum page size to 100
- Use lean queries for list views
- Populate only necessary user fields

### 6.2 Update Post Controller

**Route**: `PATCH /api/superadmin/posts/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate post ID (ObjectId format)
3. Find post by ID
4. Validate update data
5. Update post document
6. Log action in security logs
7. Return updated post

**Validation Rules**:
- `isActive`: Boolean
- `isFlagged`: Boolean
- `flagReason`: Required if `isFlagged: true`, min 10 characters

### 6.3 Flag Post Controller

**Route**: `PATCH /api/superadmin/posts/:id/flag`

**Business Logic**:
1. Verify authentication and permission
2. Validate post ID
3. Find post by ID
4. Validate flag reason (required, min 10 characters)
5. Update post:
   - Set `isFlagged: true`
   - Set `flagReason: reason`
   - Set `flaggedBy: req.superAdmin._id`
   - Set `flaggedAt: Date.now()`
   - Optionally set `isActive: false` (hide from feed)
6. Log flag action in security logs
7. Return updated post

### 6.4 Delete Post Controller

**Route**: `DELETE /api/superadmin/posts/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate post ID
3. Find post by ID
4. Delete post document (hard delete)
5. Optionally: Delete associated media files from storage
6. Optionally: Delete associated comments, likes
7. Log deletion in security logs
8. Return success

**Deletion Strategy**:
- Hard delete: Remove document from database
- Media cleanup: Delete files from storage (S3, etc.)
- Cascade delete: Remove related data (comments, likes)

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Content**: `canManageContent` permission required
- **Moderate Content**: `canManageContent` permission required
- **Delete Content**: `canManageContent` permission required

### 7.2 Feature Toggles

- **Content Moderation**: Can be enabled/disabled
- **Bulk Actions**: Can be restricted to specific roles
- **Media Preview**: Can be toggled for performance

### 7.3 Settings Impact

- **Content Moderation**: Policy affects moderation workflow
- **Auto-flagging**: Rules may auto-flag certain content
- **Media Storage**: Settings affect media deletion behavior

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canManageContent` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Action Restrictions**: Delete may be restricted to founders only
- **Content Privacy**: Respects user privacy settings when viewing

### 8.3 Security Features

- **Audit Logging**: All moderation actions logged with admin ID, timestamp, reason
- **IP Tracking**: Actions tracked by IP address
- **Rate Limiting**: API requests rate-limited
- **Input Validation**: All inputs sanitized and validated

### 8.4 Privacy Considerations

- **User Privacy**: Respects user privacy settings
- **Content Visibility**: Moderators see all content regardless of privacy
- **Data Retention**: Deleted content removed per policy

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Content List View**: `content_list_view` event
- **Content Search**: `content_search` event with query
- **Moderation Action**: `content_moderation_action` event with action type and post ID
- **Bulk Action**: `content_bulk_action` event with action and count

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total posts count
- Total shorts count
- Active posts count
- Flagged posts count
- Deleted posts count

**Calculated KPIs**:
- Content moderation rate
- Average time to moderate
- Flag accuracy rate
- Content quality score

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Page Size**: Maximum 100 posts per page
- **Search**: Minimum 2 characters
- **Bulk Actions**: Maximum 100 posts per bulk action
- **Flag Reason**: Minimum 10 characters

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **Partial Bulk Failures**: Show detailed failure list
- **Invalid Post IDs**: Skip invalid IDs, continue with valid ones
- **Media Deletion Failure**: Log error, continue with post deletion

### 10.3 Known Constraints

- **Large Content Base**: Pagination required for >1000 posts
- **Search Performance**: Full-text search may be slow on large datasets
- **Bulk Operations**: May take time for large batches
- **Media Storage**: Media deletion depends on storage service availability

### 10.4 Performance Considerations

- **Indexing**: Type, isActive, createdAt indexed
- **Caching**: Content list not cached (real-time data)
- **Lazy Loading**: Media previews loaded on demand
- **Debouncing**: Search debounced to 500ms

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Content Preview**: Full-screen media preview in modal
- **Comment Moderation**: View and moderate comments
- **User Context**: Quick access to user profile from post
- **Bulk Export**: Export selected posts as CSV/JSON

### 11.2 Next (Medium Priority)

- **Auto-moderation**: AI-powered content flagging
- **Content Analytics**: Engagement metrics per post
- **Moderation Queue**: Prioritized queue for flagged content
- **Content Templates**: Pre-defined moderation reasons

### 11.3 Later (Low Priority)

- **Content Scheduling**: Schedule posts for future publication
- **Content Promotion**: Feature posts in discovery
- **Content Analytics Dashboard**: Detailed analytics per post
- **Moderation Workflow**: Multi-step moderation process

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- React Router for navigation
- React Hot Toast for notifications
- Framer Motion for animations

**Key Dependencies**:
- `react-router-dom`: Navigation
- `react-hot-toast`: Toast notifications
- `framer-motion`: Animations
- Image/Video preview libraries

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- Storage service (S3, etc.) for media

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `jsonwebtoken`: JWT handling
- Storage SDK (AWS S3, etc.)

### 12.3 Data Flow

1. User navigates to Travel Content page
2. Frontend calls `fetchPosts()` with default params
3. Backend queries MongoDB with filters
4. Response includes posts and pagination
5. Frontend renders table with media previews
6. User interacts (search, filter, moderate)
7. Frontend updates params and refetches
8. Table updates with new data

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/travel-content` | Get paginated post list | Yes |
| PATCH | `/api/superadmin/posts/:id` | Update post | Yes |
| PATCH | `/api/superadmin/posts/:id/flag` | Flag post | Yes |
| DELETE | `/api/superadmin/posts/:id` | Delete post | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for content overview
- **Reports**: See `reports-spec.md` for user-reported content
- **Users**: See `users-spec.md` for user management
- **Logs**: See `logs-spec.md` for moderation action logs


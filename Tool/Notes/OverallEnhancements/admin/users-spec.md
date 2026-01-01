# Users Management - Product Specification

## 1. Overview

The Users menu provides comprehensive user management capabilities for SuperAdmin users, including user listing, search, filtering, individual user actions, and bulk operations. It enables administrators to view user details, manage user status, and perform administrative actions.

### User Personas & Goals

- **Founders**: Full user management, view all users, perform any action
- **Admins**: Manage users within their permissions, view user analytics
- **Moderators**: Limited user management (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Users.jsx`): User listing UI, search, filters, bulk actions, user detail modals
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves user data, handles user actions, bulk operations
- **Real-time Context** (`superAdmin/src/context/RealTimeContext.jsx`): Manages user data fetching, real-time updates

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Users.jsx`

**Purpose**: Display and manage all platform users with search, filtering, and action capabilities

**Entry Points**:
- Navigation from sidebar (Users menu item)
- Direct URL: `/users`
- Navigation from Dashboard (click on user in recent activity)

**Exit Points**:
- Click user row → Opens user detail modal
- Click "View Profile" → Navigate to user profile (if implemented)
- Click sidebar menu → Navigate to other pages

**Components Used**:
- `Table` (`superAdmin/src/components/Tables/index.jsx`): Data table with sorting
- `Modal` (`superAdmin/src/components/Modals/index.jsx`): User detail and action modals
- `Card` (`superAdmin/src/components/Cards/index.jsx`): Stat cards for user counts
- `SafeComponent` (`superAdmin/src/components/SafeComponent.jsx`): Error boundary wrapper

**Modals**:
- User Detail Modal: Shows full user information, edit form
- Bulk Action Modal: Confirmation for bulk operations
- Export Modal: CSV/JSON export options

---

## 3. Detailed Features & User Flows

### 3.1 User Listing & Search

**Feature Name**: User List Display

**Business Description**: Display paginated list of all users with search and filter capabilities.

**Preconditions**:
- User must be authenticated
- User must have `canManageUsers` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/users`
2. Frontend calls `fetchUsers()` from `RealTimeContext` with default params
3. Backend endpoint `GET /api/superadmin/users?page=1&limit=20` is called
4. Backend queries `User` collection with pagination
5. Response includes users array and pagination metadata
6. Frontend displays users in table format
7. User can:
   - Search by name/email (debounced 500ms)
   - Filter by status (all/active/inactive/pending/banned)
   - Sort by any column (createdAt, email, fullName, etc.)
   - Change items per page (10, 20, 50, 100)
   - Navigate pages

**Validations**:
- Page number: Must be >= 1
- Limit: Must be between 1 and 100
- Search: Minimum 2 characters (optional)
- Status filter: Must be valid enum value

**Error States**:
- Network error: Show error toast, keep previous data
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No users found" message

**Success States**:
- Users load successfully: Display in table
- Search results: Update table with filtered results
- Pagination: Show current page, total pages, total count

### 3.2 User Detail View

**Feature Name**: View User Details

**Business Description**: View comprehensive user information including profile, activity, posts, and account status.

**Preconditions**:
- User must be selected from list
- User must have view permissions

**Step-by-Step Flow**:
1. User clicks on user row or "View" button
2. Modal opens with user detail view
3. Frontend fetches full user data (if not already loaded)
4. Display user information:
   - Basic info: Name, email, username, avatar
   - Account status: Verified, active, banned, deleted
   - Dates: Created, last login, email verified
   - Statistics: Post count, follower count, following count
   - TripScore: Total score, continents, countries
   - Permissions: Privacy settings, notification preferences
5. User can edit user information (if permission granted)
6. User can perform actions: Activate, Deactivate, Ban, Delete

**Validations**:
- User ID must be valid ObjectId
- User must exist in database

**Error States**:
- User not found: Show "User not found" error
- Load failure: Show error message, allow retry

**Success States**:
- User data loads: Display all information
- Edit success: Show success toast, refresh list

### 3.3 Individual User Actions

**Feature Name**: User Status Management

**Business Description**: Perform actions on individual users (activate, deactivate, ban, delete).

**Preconditions**:
- User must be selected
- Admin must have appropriate permissions

**Step-by-Step Flow**:
1. User clicks action button (Activate/Deactivate/Ban/Delete) on user row
2. Confirmation dialog appears (for destructive actions)
3. User confirms action
4. Frontend calls `handleUserActionClick(userId, action)`
5. Backend endpoint called:
   - Activate: `PATCH /api/superadmin/users/:id` with `{ isVerified: true }`
   - Deactivate: `PATCH /api/superadmin/users/:id` with `{ isVerified: false }`
   - Ban: `PATCH /api/superadmin/users/:id` with `{ deletedAt: Date }`
   - Delete: `DELETE /api/superadmin/users/:id`
6. Backend validates action and updates user
7. Backend logs action in security logs
8. Response returns updated user data
9. Frontend refreshes user list
10. Show success toast

**Validations**:
- User ID must be valid
- User must exist
- Action must be valid enum
- Cannot delete own account (if applicable)

**Error States**:
- Invalid action: Show "Invalid action" error
- User not found: Show "User not found" error
- Permission denied: Show "Insufficient permissions" error

**Success States**:
- Action successful: Show success toast, update UI
- Status change: User row updates immediately

### 3.4 Bulk User Actions

**Feature Name**: Bulk Operations

**Business Description**: Perform actions on multiple users simultaneously (activate, deactivate, ban, delete).

**Preconditions**:
- At least one user must be selected
- Admin must have bulk action permissions

**Step-by-Step Flow**:
1. User selects multiple users using checkboxes
2. Bulk action toolbar appears
3. User selects action (Activate/Deactivate/Ban/Delete)
4. Confirmation modal appears with:
   - Number of users affected
   - Action description
   - Reason input field (required for audit)
5. User enters reason and confirms
6. Frontend calls `handleBulkAction(action, selectedUserIds, reason)`
7. Backend endpoint `POST /api/superadmin/users/bulk-action` is called with:
   ```javascript
   {
     action: string,
     userIds: [string],
     reason: string
   }
   ```
8. Backend validates all user IDs
9. Backend performs action on each user (transaction if possible)
10. Backend logs bulk action in security logs
11. Response returns success count and failures
12. Frontend refreshes user list
13. Show success toast with count

**Validations**:
- At least one user must be selected
- Reason must be provided (min 10 characters)
- All user IDs must be valid
- Action must be valid enum

**Error States**:
- No users selected: Show "Please select users first"
- Invalid user IDs: Show "Some users are invalid"
- Partial failure: Show "X of Y users updated" with details
- Complete failure: Show error message

**Success States**:
- All successful: Show "Successfully [action]d X users"
- Selection cleared: Checkboxes reset
- List refreshed: Updated statuses visible

### 3.5 User Editing

**Feature Name**: Edit User Information

**Business Description**: Update user profile information, account status, and settings.

**Preconditions**:
- User must be selected
- Admin must have edit permissions

**Step-by-Step Flow**:
1. User clicks "Edit" button on user detail modal
2. Edit form appears with current user data
3. User modifies fields:
   - Full name
   - Email (with validation)
   - Username
   - Avatar URL
   - Account status (verified, active)
   - Privacy settings
4. User clicks "Save"
5. Frontend validates form data
6. Backend endpoint `PATCH /api/superadmin/users/:id` is called
7. Backend validates updates
8. Backend updates user document
9. Backend logs edit action
10. Response returns updated user
11. Frontend updates modal and list
12. Show success toast

**Validations**:
- Email: Must be valid format, unique (if changed)
- Username: Must be unique (if changed), 3-20 characters
- Full name: Required, max 100 characters

**Error States**:
- Validation errors: Show field-specific errors
- Duplicate email/username: Show "Already exists" error
- Save failure: Show error message, allow retry

**Success States**:
- Save successful: Show success toast, update UI
- Changes visible: Modal and list reflect updates

---

## 4. Data Model & API Design

### 4.1 Get Users Endpoint

**Endpoint**: `GET /api/superadmin/users`

**Authentication**: Required (JWT token)

**Permissions**: `canManageUsers` or founder

**Query Parameters**:
- `page` (optional): Number, default: 1, min: 1
- `limit` (optional): Number, default: 20, min: 1, max: 100
- `search` (optional): String, min: 2 characters
- `status` (optional): 'all' | 'active' | 'inactive' | 'pending' | 'banned'
- `sortBy` (optional): Field name, default: 'createdAt'
- `sortOrder` (optional): 'asc' | 'desc', default: 'desc'

**Response**:
```javascript
{
  success: true,
  users: [{
    _id: string,
    fullName: string,
    email: string,
    username: string,
    avatar: string,
    isVerified: boolean,
    isActive: boolean,
    deletedAt: Date | null,
    createdAt: Date,
    lastLogin: Date,
    postCount: number,
    followerCount: number,
    followingCount: number,
    tripScore: {
      totalScore: number,
      continents: number,
      countries: number
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

### 4.2 Update User Endpoint

**Endpoint**: `PATCH /api/superadmin/users/:id`

**Authentication**: Required

**Permissions**: `canManageUsers` or founder

**Request Body**:
```javascript
{
  fullName?: string,
  email?: string,
  username?: string,
  avatar?: string,
  isVerified?: boolean,
  isActive?: boolean,
  // ... other fields
}
```

**Response**:
```javascript
{
  success: true,
  message: "User updated successfully",
  user: {
    // Updated user object
  }
}
```

### 4.3 Delete User Endpoint

**Endpoint**: `DELETE /api/superadmin/users/:id`

**Authentication**: Required

**Permissions**: `canManageUsers` or founder

**Response**:
```javascript
{
  success: true,
  message: "User deleted successfully"
}
```

### 4.4 Bulk Action Endpoint

**Endpoint**: `POST /api/superadmin/users/bulk-action`

**Authentication**: Required

**Permissions**: `canManageUsers` or founder

**Request Body**:
```javascript
{
  action: "activate" | "deactivate" | "ban" | "delete",
  userIds: [string],
  reason: string  // Required, min 10 characters
}
```

**Response**:
```javascript
{
  success: true,
  message: "Bulk action completed",
  results: {
    successCount: number,
    failureCount: number,
    failures: [{
      userId: string,
      error: string
    }]
  }
}
```

### 4.5 Data Models

**User Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  fullName: string,
  email: string,              // Unique, lowercase
  username: string,           // Unique, 3-20 chars
  password: string,           // Hashed
  avatar: string,
  isVerified: boolean,
  isActive: boolean,
  deletedAt: Date | null,     // Soft delete
  createdAt: Date,
  lastLogin: Date,
  emailVerified: boolean,
  profile: {
    bio: string,
    website: string,
    location: string
  },
  privacy: {
    profileVisibility: string,
    showEmail: boolean
  },
  settings: {
    notifications: object
  }
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Real-Time Context

**File**: `superAdmin/src/context/RealTimeContext.jsx`

**User Data Management**:
- `users`: Array of user objects
- `fetchUsers(params, signal)`: Fetches users with pagination/filters
- Auto-refresh: Optional (not enabled by default for users)

### 5.2 Component State

**Users Component** (`superAdmin/src/pages/Users.jsx`):
- `users`: User list data
- `loading`: Loading state
- `searchTerm`: Search input value
- `filterStatus`: Current status filter
- `currentPage`: Current page number
- `itemsPerPage`: Items per page (20 default)
- `sortBy`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedUsers`: Array of selected user IDs
- `showBulkActions`: Boolean for bulk action toolbar
- `selectedUser`: Currently viewed user (for modal)
- `showModal`: Modal visibility
- `editFormData`: Form data for editing

**Side Effects**:
- `useEffect` on mount: Fetch initial user list
- `useEffect` on filter change: Reset to page 1, fetch filtered data
- `useEffect` on search: Debounced search (500ms)
- `useEffect` on pagination: Fetch page data

---

## 6. Backend Logic & Rules

### 6.1 Get Users Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/users`

**Business Logic**:
1. Verify authentication and permission (`canManageUsers`)
2. Parse query parameters (page, limit, search, status, sortBy, sortOrder)
3. Build MongoDB query:
   - Search: Match name or email (case-insensitive)
   - Status filter: Apply appropriate filters
   - Sort: Apply sortBy and sortOrder
4. Execute paginated query:
   - Count total matching documents
   - Fetch page of documents
   - Populate related fields if needed
5. Calculate pagination metadata
6. Return users array and pagination info

**Performance Optimizations**:
- Index on email, username, createdAt
- Limit maximum page size to 100
- Use lean queries for list views

### 6.2 Update User Controller

**Route**: `PATCH /api/superadmin/users/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate user ID (ObjectId format)
3. Find user by ID
4. Validate update data:
   - Email uniqueness (if changed)
   - Username uniqueness (if changed)
   - Field format validation
5. Update user document
6. Log action in security logs
7. Return updated user

**Validation Rules**:
- Email: Valid format, unique
- Username: 3-20 characters, alphanumeric + underscore, unique
- Full name: Required, max 100 characters

### 6.3 Delete User Controller

**Route**: `DELETE /api/superadmin/users/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate user ID
3. Find user by ID
4. Check if user can be deleted (not own account, etc.)
5. Soft delete: Set `deletedAt: Date.now()`
6. Optionally: Delete related data (posts, comments, etc.)
7. Log deletion in security logs
8. Return success

**Soft Delete Strategy**:
- Set `deletedAt` timestamp instead of removing document
- Filter deleted users from queries
- Allow restoration if needed

### 6.4 Bulk Action Controller

**Route**: `POST /api/superadmin/users/bulk-action`

**Business Logic**:
1. Verify authentication and permission
2. Validate request body (action, userIds, reason)
3. Validate all user IDs
4. For each user:
   - Find user by ID
   - Perform action (activate/deactivate/ban/delete)
   - Log individual action
5. Collect success/failure results
6. Return summary with counts and failures

**Transaction Handling**:
- Use MongoDB transactions if available
- Rollback on critical errors
- Continue with remaining users on non-critical errors

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Users**: `canManageUsers` permission required
- **Edit Users**: `canManageUsers` permission required
- **Delete Users**: `canManageUsers` permission required
- **Bulk Actions**: `canManageUsers` permission required

### 7.2 Feature Toggles

- **User Export**: Can be enabled/disabled
- **Bulk Actions**: Can be restricted to specific roles
- **User Editing**: Can be limited to specific fields

### 7.3 Settings Impact

- **User Registration**: If disabled, new users cannot register
- **Email Verification**: Affects `isVerified` status
- **Account Deletion**: Policy affects deletion behavior

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canManageUsers` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Action Restrictions**: Some actions may be restricted to founders only
- **Own Account**: Cannot delete/ban own account

### 8.3 Security Features

- **Audit Logging**: All user actions logged with admin ID, timestamp, reason
- **IP Tracking**: User actions tracked by IP address
- **Rate Limiting**: API requests rate-limited
- **Input Validation**: All inputs sanitized and validated

### 8.4 Privacy Considerations

- **PII Handling**: Email addresses and personal data handled securely
- **Data Retention**: Deleted user data retained per policy
- **GDPR Compliance**: User data export/deletion available

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **User List View**: `users_list_view` event
- **User Search**: `users_search` event with query
- **User Action**: `user_action` event with action type and user ID
- **Bulk Action**: `users_bulk_action` event with action and count

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total users count
- Active users count
- Verified users count
- Banned users count
- User growth rate

**Calculated KPIs**:
- User activation rate
- User retention rate
- Average posts per user
- Average TripScore per user

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Page Size**: Maximum 100 users per page
- **Search**: Minimum 2 characters
- **Bulk Actions**: Maximum 100 users per bulk action
- **Reason Length**: Minimum 10 characters for bulk actions

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times
- **Partial Bulk Failures**: Show detailed failure list
- **Invalid User IDs**: Skip invalid IDs, continue with valid ones
- **Concurrent Edits**: Last write wins (no conflict resolution)

### 10.3 Known Constraints

- **Large User Base**: Pagination required for >1000 users
- **Search Performance**: Full-text search may be slow on large datasets
- **Bulk Operations**: May take time for large batches
- **Soft Delete**: Deleted users still count in some aggregations

### 10.4 Performance Considerations

- **Indexing**: Email, username, createdAt indexed
- **Caching**: User list not cached (real-time data)
- **Lazy Loading**: User details loaded on demand
- **Debouncing**: Search debounced to 500ms

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **User Export**: Export user list as CSV/JSON
- **Advanced Filters**: Filter by registration date, activity, TripScore
- **User Activity Log**: View user's action history
- **Bulk Import**: Import users from CSV

### 11.2 Next (Medium Priority)

- **User Groups**: Create and manage user groups
- **Custom Fields**: Add custom user fields
- **User Notes**: Add admin notes to users
- **User Tags**: Tag users for organization

### 11.3 Later (Low Priority)

- **User Merge**: Merge duplicate user accounts
- **User Impersonation**: Login as user (for support)
- **User Analytics**: Detailed user behavior analytics
- **Automated Actions**: Rules-based automated user actions

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
- `date-fns`: Date formatting

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

1. User navigates to Users page
2. Frontend calls `fetchUsers()` with default params
3. Backend queries MongoDB with filters
4. Response includes users and pagination
5. Frontend renders table
6. User interacts (search, filter, sort)
7. Frontend updates params and refetches
8. Table updates with new data

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/users` | Get paginated user list | Yes |
| PATCH | `/api/superadmin/users/:id` | Update user | Yes |
| DELETE | `/api/superadmin/users/:id` | Delete user (soft) | Yes |
| POST | `/api/superadmin/users/bulk-action` | Bulk user actions | Yes |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for user overview
- **Moderators**: See `moderators-spec.md` for moderator management
- **Logs**: See `logs-spec.md` for user action logs
- **Settings**: See `settings-spec.md` for user-related settings


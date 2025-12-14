# Moderators Management - Product Specification

## 1. Overview

The Moderators menu provides comprehensive management of SuperAdmin moderator accounts, including creation, editing, permission assignment, activity tracking, and role-based access control. It enables founders and admins to manage the moderator team and their capabilities.

### User Personas & Goals

- **Founders**: Full moderator management, create/edit/delete moderators, assign all permissions
- **Admins**: Manage moderators within their scope, assign limited permissions
- **Moderators**: View own profile (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Moderators.jsx`): Moderator listing UI, create/edit modals, permission management
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves moderator data, handles CRUD operations, permission management
- **SuperAdmin Model** (`backend/src/models/SuperAdmin.js`): Stores moderator accounts and permissions

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Moderators.jsx`

**Purpose**: Display and manage all moderator accounts with permission assignment

**Entry Points**:
- Navigation from sidebar (Moderators menu item)
- Direct URL: `/moderators`
- Navigation from Settings (if moderator management link available)

**Exit Points**:
- Click moderator row → Opens moderator detail/edit modal
- Click sidebar menu → Navigate to other pages
- Create moderator → Stay on page, show success

**Components Used**:
- `Table`: Moderator listing table
- `Modal`: Create, edit, delete confirmation modals
- `Card`: Stat cards for moderator counts
- Permission checkboxes: For permission assignment

**Modals**:
- Create Moderator Modal: Form with email, password, permissions
- Edit Moderator Modal: Edit email, permissions, status
- Delete Modal: Confirmation for deletion

---

## 3. Detailed Features & User Flows

### 3.1 Moderator Listing

**Feature Name**: Moderator List Display

**Business Description**: Display list of all moderators with their roles, permissions, and activity status.

**Preconditions**:
- User must be authenticated
- User must have `canManageModerators` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/moderators`
2. Frontend calls `getModerators()`
3. Backend endpoint `GET /api/superadmin/moderators` is called
4. Backend queries `SuperAdmin` collection:
   - Filter by role: 'moderator' (and optionally 'admin')
   - Exclude founders
   - Sort by createdAt (descending)
5. Response includes moderators array
6. Frontend displays moderators in table with:
   - Email
   - Role (admin/moderator)
   - Permissions (summary)
   - Status (active/inactive)
   - Last login
   - Created date
   - Actions (edit, delete, toggle status)
7. User can:
   - Search by email (optional)
   - Filter by role (all/admin/moderator)
   - Filter by status (all/active/inactive)
   - Sort by any column

**Validations**:
- Search: Minimum 2 characters (optional)
- Role filter: Must be valid enum
- Status filter: Must be valid enum

**Error States**:
- Network error: Show error toast
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No moderators found" message

**Success States**:
- Moderators load: Display in table
- Filters applied: Table updates

### 3.2 Create Moderator

**Feature Name**: Create New Moderator Account

**Business Description**: Create new moderator account with email, password, and permission assignment.

**Preconditions**:
- User must have create permissions
- Valid email and password available

**Step-by-Step Flow**:
1. User clicks "Add Moderator" button
2. Create modal opens
3. User fills form:
   - Email (required, valid format)
   - Password (required, min 8 characters)
   - Confirm Password (required, must match)
   - Role: Admin or Moderator (dropdown)
   - Permissions (checkboxes):
     - canManageUsers
     - canManageContent
     - canManageReports
     - canManageModerators (admin only)
     - canViewLogs
     - canManageSettings (admin only)
4. User clicks "Create Moderator"
5. Frontend validates form:
   - Email format
   - Password strength
   - Password match
6. Frontend calls `createModerator(formData)`
7. Backend endpoint `POST /api/superadmin/moderators` is called
8. Backend:
    - Validates email (unique, valid format)
    - Validates password (min 8 chars)
    - Hashes password with bcrypt
    - Creates SuperAdmin document:
      - Email, hashed password
      - Role: 'admin' or 'moderator'
      - Permissions: From form
      - isActive: true
      - organization: From creator's organization
    - Sends welcome email with 2FA setup (optional)
9. Response returns created moderator
10. Frontend shows success toast
11. Frontend refreshes moderator list
12. Modal closes

**Validations**:
- Email: Required, valid format, unique
- Password: Required, min 8 characters
- Confirm Password: Must match password
- Role: Required, must be 'admin' or 'moderator'
- Permissions: At least one permission required

**Error States**:
- Invalid email: Show "Invalid email format"
- Duplicate email: Show "Email already exists"
- Weak password: Show "Password must be at least 8 characters"
- Password mismatch: Show "Passwords do not match"
- Creation failure: Show error message

**Success States**:
- Creation successful: Show success toast, refresh list
- Moderator available: New moderator appears in list

### 3.3 Edit Moderator

**Feature Name**: Edit Moderator Account

**Business Description**: Update moderator email, permissions, and status.

**Preconditions**:
- Moderator must be selected
- User must have edit permissions
- Cannot edit own account (if restriction exists)

**Step-by-Step Flow**:
1. User clicks "Edit" button on moderator row
2. Edit modal opens with current moderator data
3. User modifies fields:
   - Email (if allowed)
   - Role (if allowed, admin only)
   - Permissions (checkboxes)
   - Status (active/inactive toggle)
4. User clicks "Save"
5. Frontend validates form data
6. Frontend calls `updateModerator(moderatorId, updates)`
7. Backend endpoint `PATCH /api/superadmin/moderators/:id` is called
8. Backend:
    - Validates moderator ID
    - Finds moderator by ID
    - Validates updates:
      - Email unique (if changed)
      - Permissions valid
    - Updates SuperAdmin document
    - Logs edit action
9. Response returns updated moderator
10. Frontend updates table
11. Show success toast

**Validations**:
- Email: Valid format, unique (if changed)
- Permissions: Valid permission keys
- Cannot remove all permissions
- Cannot edit own account (if restriction)

**Error States**:
- Validation errors: Show field-specific errors
- Save failure: Show error message
- Cannot edit self: Show "Cannot edit own account" error

**Success States**:
- Save successful: Show success toast, update UI
- Changes visible: Table reflects updates

### 3.4 Delete Moderator

**Feature Name**: Delete Moderator Account

**Business Description**: Permanently remove moderator account from system.

**Preconditions**:
- Moderator must be selected
- User must have delete permissions
- Cannot delete own account
- Cannot delete last admin (if restriction exists)

**Step-by-Step Flow**:
1. User clicks "Delete" button on moderator row
2. Delete confirmation modal appears
3. Modal shows:
   - Moderator email
   - Warning about permanent deletion
   - Impact: Moderator will lose access immediately
4. User confirms deletion
5. Frontend calls `deleteModerator(moderatorId)`
6. Backend endpoint `DELETE /api/superadmin/moderators/:id` is called
7. Backend:
    - Validates moderator ID
    - Finds moderator by ID
    - Checks restrictions:
      - Cannot delete own account
      - Cannot delete last admin (if restriction)
    - Deletes SuperAdmin document (or soft delete)
    - Logs deletion action
8. Response returns success
9. Frontend refreshes moderator list
10. Show success toast

**Validations**:
- Moderator ID: Must be valid
- Moderator must exist
- Cannot delete self
- Cannot delete last admin (if restriction)

**Error States**:
- Moderator not found: Show "Moderator not found" error
- Cannot delete self: Show "Cannot delete own account" error
- Last admin: Show "Cannot delete last admin" error
- Delete failure: Show error message

**Success States**:
- Deletion successful: Moderator removed from list
- Access revoked: Moderator loses access immediately

### 3.5 Permission Management

**Feature Name**: Assign/Revoke Permissions

**Business Description**: Manage moderator permissions through checkboxes.

**Preconditions**:
- Moderator must be selected
- User must have permission management access

**Step-by-Step Flow**:
1. User opens edit modal for moderator
2. Permission checkboxes displayed:
   - canManageUsers
   - canManageContent
   - canManageReports
   - canManageModerators (admin only)
   - canViewLogs
   - canManageSettings (admin only)
3. User toggles permissions
4. User saves changes
5. Backend updates permissions object
6. Changes take effect immediately
7. Moderator's access updated

**Validations**:
- At least one permission required
- Some permissions may require admin role
- Cannot grant permissions user doesn't have

**Error States**:
- No permissions: Show "At least one permission required"
- Invalid permission: Show "Invalid permission" error

**Success States**:
- Permissions updated: Moderator access updated
- Immediate effect: Changes apply immediately

---

## 4. Data Model & API Design

### 4.1 Get Moderators Endpoint

**Endpoint**: `GET /api/superadmin/moderators`

**Authentication**: Required

**Permissions**: `canManageModerators` or founder

**Query Parameters**:
- `role` (optional): 'all' | 'admin' | 'moderator'
- `status` (optional): 'all' | 'active' | 'inactive'
- `search` (optional): Email search

**Response**:
```javascript
{
  success: true,
  moderators: [{
    _id: string,
    email: string,
    role: 'admin' | 'moderator',
    permissions: {
      canManageUsers: boolean,
      canManageContent: boolean,
      canManageReports: boolean,
      canManageModerators: boolean,
      canViewLogs: boolean,
      canManageSettings: boolean
    },
    isActive: boolean,
    lastLogin: Date,
    createdAt: Date,
    organization: string
  }]
}
```

### 4.2 Create Moderator Endpoint

**Endpoint**: `POST /api/superadmin/moderators`

**Authentication**: Required

**Permissions**: `canManageModerators` or founder

**Request Body**:
```javascript
{
  email: string,              // Required
  password: string,            // Required, min 8 chars
  role: 'admin' | 'moderator', // Required
  permissions: {
    canManageUsers: boolean,
    canManageContent: boolean,
    canManageReports: boolean,
    canManageModerators: boolean,  // Admin only
    canViewLogs: boolean,
    canManageSettings: boolean     // Admin only
  },
  organization: string         // Optional, from creator
}
```

**Response**:
```javascript
{
  success: true,
  message: "Moderator created successfully",
  moderator: {
    // New moderator object (without password)
  }
}
```

### 4.3 Update Moderator Endpoint

**Endpoint**: `PATCH /api/superadmin/moderators/:id`

**Authentication**: Required

**Permissions**: `canManageModerators` or founder

**Request Body**:
```javascript
{
  email?: string,
  role?: 'admin' | 'moderator',
  permissions?: {
    canManageUsers?: boolean,
    canManageContent?: boolean,
    canManageReports?: boolean,
    canManageModerators?: boolean,
    canViewLogs?: boolean,
    canManageSettings?: boolean
  },
  isActive?: boolean
}
```

**Response**:
```javascript
{
  success: true,
  message: "Moderator updated successfully",
  moderator: {
    // Updated moderator object
  }
}
```

### 4.4 Delete Moderator Endpoint

**Endpoint**: `DELETE /api/superadmin/moderators/:id`

**Authentication**: Required

**Permissions**: `canManageModerators` or founder

**Response**:
```javascript
{
  success: true,
  message: "Moderator deleted successfully"
}
```

### 4.5 Data Models

**SuperAdmin Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  email: string,              // Unique, lowercase
  password: string,            // Hashed with bcrypt
  role: 'founder' | 'admin' | 'moderator',
  organization: string,
  isActive: boolean,
  isLocked: boolean,
  lastLogin: Date,
  loginAttempts: number,
  permissions: {
    canManageUsers: boolean,
    canManageContent: boolean,
    canManageReports: boolean,
    canManageModerators: boolean,
    canViewLogs: boolean,
    canManageSettings: boolean
  },
  profile: {
    firstName: string,
    lastName: string,
    avatar: string
  },
  securityLogs: [{
    timestamp: Date,
    action: string,
    details: string,
    ipAddress: string,
    success: boolean
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**Moderators Component** (`superAdmin/src/pages/Moderators.jsx`):
- `moderators`: Moderator list data
- `loading`: Loading state
- `searchTerm`: Search input value
- `roleFilter`: Current role filter
- `statusFilter`: Current status filter
- `showCreateModal`: Create modal visibility
- `showEditModal`: Edit modal visibility
- `showDeleteModal`: Delete confirmation modal visibility
- `moderatorToEdit`: Currently edited moderator
- `moderatorToDelete`: Moderator to be deleted
- `formData`: Create form data
- `editFormData`: Edit form data
- `permissions`: Permission checkboxes state

**Side Effects**:
- `useEffect` on mount: Fetch initial moderator list
- `useEffect` on filter change: Refetch filtered data
- `useEffect` on search: Debounced search (350ms)

---

## 6. Backend Logic & Rules

### 6.1 Get Moderators Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/moderators`

**Business Logic**:
1. Verify authentication and permission (`canManageModerators`)
2. Parse query parameters
3. Build MongoDB query:
   - Role filter: Match role field (exclude 'founder')
   - Status filter: Match isActive field
   - Search: Match email (case-insensitive)
4. Execute query
5. Exclude password field from results
6. Return moderators array

**Performance Optimizations**:
- Index on email, role, isActive
- Exclude password in query projection
- Use lean queries

### 6.2 Create Moderator Controller

**Route**: `POST /api/superadmin/moderators`

**Business Logic**:
1. Verify authentication and permission
2. Validate request body:
   - Email: Required, valid format, unique
   - Password: Required, min 8 characters
   - Role: Required, must be 'admin' or 'moderator'
   - Permissions: At least one required
3. Check permission restrictions:
   - `canManageModerators`: Only admins can grant
   - `canManageSettings`: Only admins can grant
4. Hash password with bcrypt
5. Create SuperAdmin document:
   - Set email, hashed password
   - Set role
   - Set permissions
   - Set isActive: true
   - Set organization: From creator
6. Save to database
7. Send welcome email (optional)
8. Log creation action
9. Return created moderator (without password)

**Validation Rules**:
- Email: Unique, valid format
- Password: Min 8 characters
- Role: Must be 'admin' or 'moderator'
- Permissions: At least one required

### 6.3 Update Moderator Controller

**Route**: `PATCH /api/superadmin/moderators/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate moderator ID
3. Find moderator by ID
4. Check restrictions:
   - Cannot edit own account (if restriction)
   - Cannot change role to founder
5. Validate updates:
   - Email unique (if changed)
   - Permissions valid
6. Update SuperAdmin document
7. Log edit action
8. Return updated moderator

**Restrictions**:
- Cannot edit own account (optional)
- Cannot grant permissions user doesn't have
- Cannot change role to founder

### 6.4 Delete Moderator Controller

**Route**: `DELETE /api/superadmin/moderators/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate moderator ID
3. Find moderator by ID
4. Check restrictions:
   - Cannot delete own account
   - Cannot delete last admin (if restriction)
5. Delete SuperAdmin document (or soft delete)
6. Log deletion action
7. Return success

**Restrictions**:
- Cannot delete own account
- Cannot delete last admin (optional)

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Moderators**: `canManageModerators` permission required
- **Create Moderators**: `canManageModerators` permission required
- **Edit Moderators**: `canManageModerators` permission required
- **Delete Moderators**: `canManageModerators` permission required

### 7.2 Feature Toggles

- **Moderator Management**: Can be enabled/disabled
- **Permission Management**: Can be restricted to founders only

### 7.3 Settings Impact

- **Password Requirements**: Settings.security.passwordMinLength affects validation
- **Organization**: Moderators inherit creator's organization

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canManageModerators` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Only founders and admins with `canManageModerators` can manage moderators
- **Self-restrictions**: Cannot edit/delete own account
- **Permission Inheritance**: Cannot grant permissions user doesn't have

### 8.3 Security Features

- **Audit Logging**: All moderator actions logged with admin ID, timestamp
- **Password Hashing**: Passwords hashed with bcrypt
- **Input Validation**: All inputs sanitized and validated
- **Email Uniqueness**: Enforced at database level

### 8.4 Privacy Considerations

- **Password Security**: Passwords never returned in responses
- **Activity Tracking**: Last login tracked for security
- **Security Logs**: All actions logged in securityLogs array

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Moderator List View**: `moderators_list_view` event
- **Moderator Create**: `moderator_create` event with moderator ID
- **Moderator Edit**: `moderator_edit` event with moderator ID
- **Moderator Delete**: `moderator_delete` event with moderator ID

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total moderators count
- Active moderators count
- Inactive moderators count
- Moderators by role
- Moderators by permission

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Password Length**: Minimum 8 characters
- **Email Length**: Maximum 255 characters
- **Permissions**: Maximum 6 permissions per moderator

### 10.2 Error Handling

- **Duplicate Email**: Show "Email already exists" error
- **Weak Password**: Show "Password must be at least 8 characters"
- **Cannot Edit Self**: Show "Cannot edit own account" error
- **Last Admin**: Show "Cannot delete last admin" error

### 10.3 Known Constraints

- **Self-management**: Cannot edit/delete own account
- **Role Changes**: Cannot change role to founder
- **Permission Inheritance**: Cannot grant permissions user doesn't have
- **Last Admin**: May not be able to delete last admin

### 10.4 Performance Considerations

- **Indexing**: Email, role, isActive indexed
- **Password Exclusion**: Passwords excluded from queries
- **Lean Queries**: Use lean queries for list views

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Password Reset**: Allow moderators to reset their own passwords
- **Activity Dashboard**: View moderator activity and actions
- **Permission Templates**: Pre-defined permission sets
- **Bulk Operations**: Create/edit multiple moderators

### 11.2 Next (Medium Priority)

- **Moderator Onboarding**: Guided onboarding flow
- **Permission Groups**: Group permissions for easier management
- **Moderator Analytics**: Track moderator performance
- **Two-Factor Auth**: Require 2FA for moderators

### 11.3 Later (Low Priority)

- **Moderator Roles**: Custom role definitions
- **Moderator Hierarchy**: Hierarchical permission system
- **Moderator Reviews**: Review moderator performance
- **API Access**: External API for moderator management

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
- bcrypt for password hashing
- JWT for authentication

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `bcryptjs`: Password hashing
- `jsonwebtoken`: JWT handling

### 12.3 Data Flow

1. User navigates to Moderators page
2. Frontend fetches moderator list
3. Moderators displayed in table
4. User creates/edits/deletes moderator
5. Frontend calls appropriate endpoint
6. Backend processes request
7. Backend updates database
8. Response returns updated data
9. Frontend refreshes list

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/moderators` | Get moderator list | Yes |
| POST | `/api/superadmin/moderators` | Create moderator | Yes |
| PATCH | `/api/superadmin/moderators/:id` | Update moderator | Yes |
| DELETE | `/api/superadmin/moderators/:id` | Delete moderator | Yes |

---

## 14. Related Documentation

- **Authentication**: See `auth-spec.md` for login flow
- **Settings**: See `settings-spec.md` for security settings
- **Logs**: See `logs-spec.md` for moderator action logs
- **Users**: See `users-spec.md` for user management permissions


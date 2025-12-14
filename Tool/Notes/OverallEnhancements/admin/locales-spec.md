# Locales Management - Product Specification

## 1. Overview

The Locales menu provides comprehensive management of location/place data used throughout the platform. It enables SuperAdmin users to create, edit, delete, and manage locales (places) with metadata including name, country, state/province, description, coordinates, spot types, and display order.

### User Personas & Goals

- **Founders**: Full locale management, create featured locations, manage display order
- **Admins**: Manage locales within permissions, review submissions
- **Moderators**: Limited locale management (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Locales.jsx`): Locale listing UI, upload modal, edit modal, preview, search, filters
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves locale data, handles CRUD operations
- **Services** (`superAdmin/src/services/localeService.js`): API service functions for locale endpoints

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Locales.jsx`

**Purpose**: Display and manage all locales (places) with CRUD operations and filtering

**Entry Points**:
- Navigation from sidebar (Locales menu item)
- Direct URL: `/locales`
- Navigation from Locale discovery (if admin link available)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Click locale row → Opens locale detail/preview modal
- Upload locale → Stay on page, show success

**Components Used**:
- `Table`: Locale listing table with sorting
- `Modal`: Upload, edit, preview, delete confirmation modals
- `Card`: Stat cards for locale counts

**Modals**:
- Upload Modal: Form with image upload and metadata inputs
- Edit Modal: Edit locale metadata
- Preview Modal: Locale detail view
- Delete Modal: Confirmation for deletion

---

## 3. Detailed Features & User Flows

### 3.1 Locale Listing & Search

**Feature Name**: Locale List Display

**Business Description**: Display paginated list of all locales with search, country filter, and sorting capabilities.

**Preconditions**:
- User must be authenticated
- User must have `canManageContent` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/locales`
2. Frontend calls `getLocales(searchQuery, selectedCountryCode, currentPage, 20)`
3. Backend endpoint `GET /api/v1/locales?page=1&limit=20&search=...&countryCode=...` is called
4. Backend queries `Locale` collection with filters:
   - Search: Match name or description (case-insensitive)
   - Country filter: Match countryCode field
   - Spot type filter: Match spotTypes array
   - Status filter: Active/inactive
   - Sort: By field and order
5. Response includes locales array and pagination metadata
6. Frontend displays locales in table format with:
   - Image thumbnail
   - Name
   - Country
   - State/Province
   - Spot types
   - Status (active/inactive)
   - Display order
   - Created date
   - Actions (edit, delete, preview, toggle status)
7. User can:
   - Search by name/description (debounced 350ms)
   - Filter by country (all countries dropdown)
   - Filter by spot type (optional)
   - Sort by any column (name, country, createdAt, displayOrder)
   - Change items per page
   - Navigate pages

**Validations**:
- Page number: Must be >= 1
- Limit: Must be between 1 and 100
- Search: Minimum 2 characters (optional)
- Country code: Must be valid ISO code (if provided)

**Error States**:
- Network error: Show error toast, keep previous data
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No locales found" message

**Success States**:
- Locales load successfully: Display in table
- Search results: Update table with filtered results
- Pagination: Show current page, total pages, total count

### 3.2 Locale Upload/Creation

**Feature Name**: Create New Locale

**Business Description**: Create new locale with image, metadata, and coordinates.

**Preconditions**:
- User must have upload permissions
- Valid locale data available

**Step-by-Step Flow**:
1. User clicks "Upload Locale" or "Add Locale" button
2. Upload modal opens
3. User fills form:
   - Name (required)
   - Country (required, dropdown)
   - Country Code (auto-filled from country)
   - State/Province (optional)
   - State Code (optional)
   - Description (optional, textarea)
   - Display Order (number, default: 0)
   - Image file (optional, JPG/PNG)
   - Coordinates (latitude, longitude) - optional, can be geocoded
   - Spot Types (multi-select or tags)
4. User clicks "Create Locale"
5. Frontend validates form data
6. Frontend creates FormData with image and metadata
7. Frontend calls `uploadLocale(formData)`
8. Backend endpoint `POST /api/v1/locales` is called
9. Backend:
    - Validates locale data
    - Uploads image to storage (if provided)
    - Geocodes coordinates if not provided (optional)
    - Creates Locale document in database
    - Returns locale object
10. Frontend shows success toast
11. Frontend refreshes locale list
12. Modal closes

**Validations**:
- Name: Required, max 200 characters
- Country: Required, must be valid country
- Country Code: Required, must be valid ISO code
- Image: Optional, max 10MB, JPG/PNG
- Coordinates: Optional, valid lat/lng if provided
- Display Order: Number, default: 0

**Error States**:
- Validation errors: Show field-specific errors
- Image upload failure: Show "Image upload failed" error
- Geocoding failure: Show warning, allow manual coordinates
- Creation failure: Show "Failed to create locale" error

**Success States**:
- Creation successful: Show success toast, refresh list
- Locale available: New locale appears in list

### 3.3 Locale Editing

**Feature Name**: Edit Locale Metadata

**Business Description**: Update locale information including name, description, coordinates, spot types, and display order.

**Preconditions**:
- Locale must be selected
- User must have edit permissions

**Step-by-Step Flow**:
1. User clicks "Edit" button on locale row
2. Edit modal opens with current locale data
3. User modifies fields:
   - Name
   - Country/Country Code
   - State/Province/State Code
   - Description
   - Display Order
   - Spot Types
   - Coordinates (if editable)
   - Image (replace existing)
4. User clicks "Save"
5. Frontend validates form data
6. Frontend calls `updateLocale(localeId, metadata)`
7. Backend endpoint `PATCH /api/v1/locales/:id` is called
8. Backend validates updates
9. Backend updates Locale document
10. Backend updates image if new image provided
11. Backend logs edit action
12. Response returns updated locale
13. Frontend updates table and modal
14. Show success toast

**Validations**:
- Name: Required, max 200 characters
- Country: Required, must be valid
- Coordinates: Valid lat/lng if provided

**Error States**:
- Validation errors: Show field-specific errors
- Save failure: Show error message, allow retry

**Success States**:
- Save successful: Show success toast, update UI
- Changes visible: Table reflects updates

### 3.4 Locale Preview

**Feature Name**: View Locale Details

**Business Description**: Preview locale information including image, description, coordinates, and metadata.

**Preconditions**:
- Locale must be selected

**Step-by-Step Flow**:
1. User clicks "Preview" or locale row
2. Preview modal opens
3. Display locale information:
   - Image (if available)
   - Name, country, state
   - Description
   - Coordinates (with map link if available)
   - Spot types
   - Display order
   - Created/updated dates
4. User can close modal or edit locale

**Validations**:
- Locale ID: Must be valid
- Locale must exist

**Error States**:
- Locale not found: Show "Locale not found" error
- Load failure: Show error message

**Success States**:
- Locale data loads: Display all information
- Preview works: Modal displays correctly

### 3.5 Locale Status Management

**Feature Name**: Toggle Locale Active/Inactive

**Business Description**: Activate or deactivate locales to control visibility in discovery.

**Preconditions**:
- Locale must be selected
- User must have status management permissions

**Step-by-Step Flow**:
1. User clicks status toggle or "Activate/Deactivate" button
2. Confirmation may appear (for deactivation)
3. User confirms action
4. Frontend calls `toggleLocaleStatus(localeId)`
5. Backend endpoint `PATCH /api/v1/locales/:id/status` is called
6. Backend toggles `isActive` field
7. Backend logs status change
8. Response returns updated locale
9. Frontend updates locale row
10. Show success toast

**Validations**:
- Locale ID: Must be valid
- Locale must exist

**Error States**:
- Locale not found: Show "Locale not found" error
- Toggle failure: Show error message

**Success States**:
- Status toggled: Locale row updates immediately
- Visibility: Locale visible/hidden in discovery

### 3.6 Locale Deletion

**Feature Name**: Delete Locale

**Business Description**: Permanently remove locale from database and storage.

**Preconditions**:
- Locale must be selected
- User must have delete permissions

**Step-by-Step Flow**:
1. User clicks "Delete" button on locale row
2. Delete confirmation modal appears
3. Modal shows:
   - Locale name and country
   - Warning about permanent deletion
   - Impact: May affect posts/shorts referencing this locale
4. User confirms deletion
5. Frontend calls `deleteLocale(localeId)`
6. Backend endpoint `DELETE /api/v1/locales/:id` is called
7. Backend:
    - Validates locale ID
    - Checks if locale is in use (optional warning)
    - Deletes image from storage (if exists)
    - Deletes Locale document from database
    - Logs deletion action
8. Response returns success
9. Frontend refreshes locale list
10. Show success toast

**Validations**:
- Locale ID: Must be valid
- Locale must exist

**Error States**:
- Locale not found: Show "Locale not found" error
- File deletion failure: Show warning, document deleted
- Delete failure: Show error message

**Success States**:
- Deletion successful: Locale removed from list
- Storage cleaned: Image file deleted

---

## 4. Data Model & API Design

### 4.1 Get Locales Endpoint

**Endpoint**: `GET /api/v1/locales`

**Authentication**: Required (for SuperAdmin)

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 20, max: 100
- `search` (optional): String, min: 2 characters
- `countryCode` (optional): Country code filter
- `spotType` (optional): Spot type filter
- `sortBy` (optional): Field name, default: 'displayOrder'
- `sortOrder` (optional): 'asc' | 'desc', default: 'asc'

**Response**:
```javascript
{
  success: true,
  locales: [{
    _id: string,
    name: string,
    country: string,
    countryCode: string,
    stateProvince: string,
    stateCode: string,
    description: string,
    imageUrl: string,
    latitude: number,
    longitude: number,
    spotTypes: [string],
    displayOrder: number,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date
  }],
  pagination: {
    currentPage: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.2 Create Locale Endpoint

**Endpoint**: `POST /api/v1/locales`

**Authentication**: Required

**Request**: `multipart/form-data`
```javascript
{
  image: File,              // Optional, image file
  name: string,             // Required
  country: string,           // Required
  countryCode: string,       // Required
  stateProvince: string,     // Optional
  stateCode: string,         // Optional
  description: string,       // Optional
  latitude: number,          // Optional
  longitude: number,         // Optional
  spotTypes: string,         // Comma-separated or JSON array
  displayOrder: number       // Optional, default: 0
}
```

**Response**:
```javascript
{
  success: true,
  message: "Locale created successfully",
  locale: {
    // New locale object
  }
}
```

### 4.3 Update Locale Endpoint

**Endpoint**: `PATCH /api/v1/locales/:id`

**Authentication**: Required

**Request**: `multipart/form-data` or JSON
```javascript
{
  name?: string,
  country?: string,
  countryCode?: string,
  stateProvince?: string,
  stateCode?: string,
  description?: string,
  latitude?: number,
  longitude?: number,
  spotTypes?: [string],
  displayOrder?: number,
  image?: File              // Optional, new image
}
```

**Response**:
```javascript
{
  success: true,
  message: "Locale updated successfully",
  locale: {
    // Updated locale object
  }
}
```

### 4.4 Toggle Status Endpoint

**Endpoint**: `PATCH /api/v1/locales/:id/status`

**Authentication**: Required

**Request Body**:
```javascript
{
  isActive: boolean
}
```

**Response**:
```javascript
{
  success: true,
  message: "Locale status updated",
  locale: {
    // Updated locale object
  }
}
```

### 4.5 Delete Locale Endpoint

**Endpoint**: `DELETE /api/v1/locales/:id`

**Authentication**: Required

**Response**:
```javascript
{
  success: true,
  message: "Locale deleted successfully"
}
```

### 4.6 Data Models

**Locale Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  name: string,              // Required, max 200 chars
  country: string,           // Required
  countryCode: string,        // Required, ISO code
  stateProvince: string,      // Optional
  stateCode: string,          // Optional
  description: string,        // Optional
  imageUrl: string,          // Optional, storage URL
  latitude: number,           // Optional
  longitude: number,          // Optional
  spotTypes: [string],        // Array of spot types
  displayOrder: number,       // Default: 0, for sorting
  isActive: boolean,          // Default: true
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId        // Ref: SuperAdmin (optional)
}
```

**Spot Types** (inferred enum):
- 'Natural'
- 'Historical'
- 'Cultural'
- 'Adventure'
- 'Beach'
- 'Mountain'
- 'City'
- 'Rural'
- 'Other'

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**Locales Component** (`superAdmin/src/pages/Locales.jsx`):
- `locales`: Locale list data
- `loading`: Loading state
- `uploading`: Upload in progress state
- `searchQuery`: Search input value
- `selectedCountryCode`: Current country filter
- `currentPage`: Current page number
- `totalPages`: Total pages
- `totalLocales`: Total locale count
- `showUploadModal`: Upload modal visibility
- `showEditModal`: Edit modal visibility
- `showPreviewModal`: Preview modal visibility
- `showDeleteModal`: Delete confirmation modal visibility
- `localeToEdit`: Currently edited locale
- `localeToDelete`: Locale to be deleted
- `previewLocale`: Locale being previewed
- `sortField`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedLocales`: Array of selected locale IDs
- `formData`: Upload form data
- `editFormData`: Edit form data

**Side Effects**:
- `useEffect` on mount: Fetch initial locale list
- `useEffect` on filter change: Reset to page 1, fetch filtered data
- `useEffect` on search: Debounced search (350ms)
- `useEffect` on pagination: Fetch page data

---

## 6. Backend Logic & Rules

### 6.1 Get Locales Controller

**File**: `backend/src/controllers/localeController.js`

**Route**: `GET /api/v1/locales`

**Business Logic**:
1. Verify authentication (if SuperAdmin endpoint)
2. Parse query parameters
3. Build MongoDB query:
   - Search: Match name or description (case-insensitive, sanitized)
   - Country filter: Match countryCode field
   - Spot type filter: Match spotTypes array
   - Status filter: Match isActive field (if not includeInactive)
   - Sort: Apply sortBy and sortOrder (default: displayOrder asc)
4. Execute paginated query
5. Calculate pagination metadata
6. Return locales array and pagination info

**Performance Optimizations**:
- Index on name, countryCode, displayOrder, createdAt
- Limit maximum page size to 100
- Sanitize search query (trim, truncate to 100 chars)
- Use lean queries for list views

### 6.2 Create Locale Controller

**Route**: `POST /api/v1/locales`

**Business Logic**:
1. Verify authentication and permission
2. Validate locale data:
   - Name required, max 200 characters
   - Country and countryCode required
   - Coordinates valid if provided
3. Validate image file (if provided):
   - File type: JPG, PNG
   - File size: Max 10MB
4. Upload image to storage (if provided)
5. Geocode coordinates if not provided but address available (optional)
6. Create Locale document:
   - Set all metadata
   - Set imageUrl (if uploaded)
   - Set coordinates
   - Set isActive: true
   - Set createdBy: req.superAdmin._id (if SuperAdmin)
7. Save to database
8. Log creation action
9. Return created locale

**Validation Rules**:
- Name: Required, max 200 characters, sanitized
- Country: Required, must be valid country name
- Country Code: Required, must be valid ISO code
- Coordinates: Optional, valid lat (-90 to 90), lng (-180 to 180)
- Image: Optional, max 10MB, JPG/PNG

### 6.3 Update Locale Controller

**Route**: `PATCH /api/v1/locales/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate locale ID
3. Find locale by ID
4. Validate update data
5. Update image if new image provided:
   - Delete old image from storage
   - Upload new image
   - Update imageUrl
6. Update locale document
7. Log edit action
8. Return updated locale

**Validation Rules**:
- Same as create, but all fields optional
- Image replacement: Delete old image first

### 6.4 Delete Locale Controller

**Route**: `DELETE /api/v1/locales/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate locale ID
3. Find locale by ID
4. Delete image from storage (if exists)
5. Delete Locale document from database
6. Log deletion action
7. Return success

**Cascade Considerations**:
- Posts/shorts may reference locale
- Consider soft delete or preserve references
- Or update posts to remove locale reference

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Locales**: `canManageContent` permission required
- **Create Locales**: `canManageContent` permission required
- **Edit Locales**: `canManageContent` permission required
- **Delete Locales**: `canManageContent` permission required

### 7.2 Feature Toggles

- **Locale Management**: Can be enabled/disabled
- **Locale Upload**: Can be restricted to specific roles
- **Geocoding**: Can be toggled (auto-geocode addresses)

### 7.3 Settings Impact

- **Max File Size**: Settings.storage.maxFileSize affects image upload limit
- **Allowed File Types**: Settings.storage.allowedFileTypes affects accepted formats

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canManageContent` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Action Restrictions**: Delete may be restricted to founders only

### 8.3 Security Features

- **Audit Logging**: All locale actions logged with admin ID, timestamp
- **File Validation**: Strict file type and size validation
- **Input Sanitization**: All inputs sanitized and validated
- **Storage Security**: Images stored securely

### 8.4 Privacy Considerations

- **Public Data**: Locales are public data (no privacy concerns)
- **Coordinate Privacy**: Coordinates are public (used for discovery)
- **Image Storage**: Images stored securely but publicly accessible

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Locale List View**: `locales_list_view` event
- **Locale Create**: `locale_create` event with locale ID
- **Locale Edit**: `locale_edit` event with locale ID
- **Locale Delete**: `locale_delete` event with locale ID
- **Locale Preview**: `locale_preview` event with locale ID

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total locales count
- Active locales count
- Inactive locales count
- Locales by country
- Locales by spot type

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Name Length**: Maximum 200 characters
- **Description Length**: Maximum 2000 characters (if enforced)
- **Image Size**: Maximum 10MB per image
- **Spot Types**: Maximum 10 per locale
- **Page Size**: Maximum 100 locales per page

### 10.2 Error Handling

- **File Upload Failures**: Show detailed error, allow retry
- **Geocoding Failures**: Show warning, allow manual coordinates
- **Validation Errors**: Show field-specific errors
- **Concurrent Edits**: Last write wins

### 10.3 Known Constraints

- **Geocoding Service**: Depends on external service availability
- **Image Format Support**: Limited to JPG/PNG
- **Large Library**: Pagination required for >1000 locales
- **Coordinate Accuracy**: Depends on geocoding service quality

### 10.4 Performance Considerations

- **Indexing**: Name, countryCode, displayOrder, createdAt indexed
- **File Upload**: Progress tracking for large images
- **Lazy Loading**: Images loaded on demand
- **Debouncing**: Search debounced to 350ms

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Bulk Upload**: Upload multiple locales via CSV
- **Map Integration**: Visual map for coordinate selection
- **Locale Categories**: Organize locales into categories
- **Locale Templates**: Pre-defined locale templates

### 11.2 Next (Medium Priority)

- **Locale Duplicates**: Detect and merge duplicate locales
- **Locale Verification**: Verify locale data accuracy
- **Locale Analytics**: Track locale usage in posts
- **Locale Recommendations**: AI-powered locale suggestions

### 11.3 Later (Low Priority)

- **Locale Reviews**: User reviews for locales
- **Locale Photos**: Multiple photos per locale
- **Locale Events**: Events happening at locales
- **API Access**: External API for locale data

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- File upload with progress tracking
- Framer Motion for animations

**Key Dependencies**:
- `react-router-dom`: Navigation
- `react-hot-toast`: Toast notifications
- File upload library
- Geocoding library (optional)

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- File storage (S3, Cloudinary, etc.)
- Geocoding service (optional)

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `multer`: File upload handling
- Storage SDK (AWS S3, etc.)
- Geocoding library (Google Maps, etc.)

### 12.3 Data Flow

1. User navigates to Locales page
2. Frontend fetches locale list
3. Locales displayed in table
4. User creates/edits/deletes locale
5. Frontend calls appropriate endpoint
6. Backend processes request
7. Backend updates database and storage
8. Response returns updated data
9. Frontend refreshes list

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/locales` | Get paginated locale list | Yes (SuperAdmin) |
| POST | `/api/v1/locales` | Create new locale | Yes |
| PATCH | `/api/v1/locales/:id` | Update locale | Yes |
| PATCH | `/api/v1/locales/:id/status` | Toggle locale status | Yes |
| DELETE | `/api/v1/locales/:id` | Delete locale | Yes |

---

## 14. Related Documentation

- **Locale Discovery**: See `locale-spec.md` for frontend locale discovery
- **TripScore Analytics**: See `tripscore-analytics-spec.md` for locale-based analytics
- **Settings**: See `settings-spec.md` for storage settings
- **Travel Content**: See `travel-content-spec.md` for content-locale relationships


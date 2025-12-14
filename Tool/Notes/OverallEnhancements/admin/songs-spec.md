# Songs Management - Product Specification

## 1. Overview

The Songs menu provides comprehensive management of the music library used for posts and shorts. It enables SuperAdmin users to upload songs, manage song metadata (title, artist, genre, duration), toggle song status (active/inactive), and perform bulk operations.

### User Personas & Goals

- **Founders**: Full music library management, upload songs, manage genres
- **Admins**: Manage songs within permissions, review uploads
- **Moderators**: Limited song management (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Songs.jsx`): Song listing UI, upload modal, edit modal, preview, search, filters
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves song data, handles uploads, manages song status
- **Services** (`superAdmin/src/services/songService.js`): API service functions for song endpoints

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Songs.jsx`

**Purpose**: Display and manage music library with upload, edit, and status management capabilities

**Entry Points**:
- Navigation from sidebar (Songs menu item)
- Direct URL: `/songs`
- Navigation from Post/Shorts creation (if song selection opens admin)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Upload song → Stay on page, show success

**Components Used**:
- `Table`: Song listing table with sorting
- `Modal`: Upload, edit, preview, delete confirmation modals
- `Card`: Stat cards for song counts
- Audio player: Preview audio playback

**Modals**:
- Upload Modal: File upload form with metadata inputs
- Edit Modal: Edit song metadata
- Preview Modal: Audio preview with playback controls
- Delete Modal: Confirmation for deletion

---

## 3. Detailed Features & User Flows

### 3.1 Song Listing & Search

**Feature Name**: Song List Display

**Business Description**: Display paginated list of all songs with search, genre filter, and sorting capabilities.

**Preconditions**:
- User must be authenticated
- User must have `canManageContent` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to `/songs`
2. Frontend calls `getSongs(searchQuery, selectedGenre, currentPage, 20)`
3. Backend endpoint `GET /api/superadmin/songs?page=1&limit=20&search=...&genre=...` is called
4. Backend queries `Song` collection with filters:
   - Search: Match title or artist (case-insensitive)
   - Genre filter: Match genre field
   - Status filter: Active/inactive
   - Sort: By field and order
5. Response includes songs array and pagination metadata
6. Frontend displays songs in table format with:
   - Thumbnail/icon
   - Title
   - Artist
   - Genre
   - Duration
   - Status (active/inactive)
   - Created date
   - Actions (edit, delete, preview, toggle status)
7. User can:
   - Search by title/artist (debounced 350ms)
   - Filter by genre (all genres dropdown)
   - Sort by any column (title, artist, genre, duration, createdAt)
   - Change items per page
   - Navigate pages

**Validations**:
- Page number: Must be >= 1
- Limit: Must be between 1 and 100
- Search: Minimum 2 characters (optional)
- Genre: Must be valid enum (if provided)

**Error States**:
- Network error: Show error toast, keep previous data
- 401 Unauthorized: Redirect to login
- 403 Forbidden: Show "Insufficient permissions" error
- Empty results: Show "No songs found" message

**Success States**:
- Songs load successfully: Display in table
- Search results: Update table with filtered results
- Pagination: Show current page, total pages, total count

### 3.2 Song Upload

**Feature Name**: Upload New Song

**Business Description**: Upload audio files to the music library with metadata (title, artist, genre, duration).

**Preconditions**:
- User must have upload permissions
- Valid audio file available

**Step-by-Step Flow**:
1. User clicks "Upload Song" button
2. Upload modal opens
3. User selects audio file (MP3, WAV, M4A, etc.)
4. Frontend validates file:
   - File type: Must be audio format
   - File size: Must be within limit (e.g., 10MB)
   - Duration: Must be <= 60 seconds (if enforced)
5. User fills metadata form:
   - Title (required)
   - Artist (required)
   - Genre (dropdown, required)
   - Duration (auto-detected or manual input)
6. User clicks "Upload"
7. Frontend creates FormData with file and metadata
8. Frontend calls `uploadSong(formData)` with progress tracking
9. Backend endpoint `POST /api/superadmin/songs` is called
10. Backend:
    - Validates file and metadata
    - Uploads file to storage (S3, etc.)
    - Extracts duration if not provided
    - Creates Song document in database
    - Returns song object with URL
11. Frontend shows success toast
12. Frontend refreshes song list
13. Modal closes

**Validations**:
- File: Required, valid audio format, max size 10MB
- Title: Required, max 100 characters
- Artist: Required, max 100 characters
- Genre: Required, must be valid enum
- Duration: Optional, must be <= 60 seconds (if enforced)

**Error States**:
- Invalid file: Show "Invalid file format" error
- File too large: Show "File size exceeds limit" error
- Upload failure: Show "Upload failed" error with details
- Metadata validation: Show field-specific errors

**Success States**:
- Upload successful: Show success toast, refresh list
- Song available: New song appears in list

### 3.3 Song Editing

**Feature Name**: Edit Song Metadata

**Business Description**: Update song metadata (title, artist, genre) without re-uploading file.

**Preconditions**:
- Song must be selected
- User must have edit permissions

**Step-by-Step Flow**:
1. User clicks "Edit" button on song row
2. Edit modal opens with current song data
3. User modifies fields:
   - Title
   - Artist
   - Genre
   - Duration (if editable)
4. User clicks "Save"
5. Frontend validates form data
6. Frontend calls `updateSong(songId, metadata)`
7. Backend endpoint `PATCH /api/superadmin/songs/:id` is called
8. Backend validates updates
9. Backend updates Song document
10. Backend logs edit action
11. Response returns updated song
12. Frontend updates table and modal
13. Show success toast

**Validations**:
- Title: Required, max 100 characters
- Artist: Required, max 100 characters
- Genre: Required, must be valid enum
- Duration: Cannot be changed (read-only)

**Error States**:
- Validation errors: Show field-specific errors
- Save failure: Show error message, allow retry

**Success States**:
- Save successful: Show success toast, update UI
- Changes visible: Table reflects updates

### 3.4 Song Preview

**Feature Name**: Audio Preview

**Business Description**: Preview song audio before using in posts/shorts.

**Preconditions**:
- Song must be selected
- Song must have valid audio URL

**Step-by-Step Flow**:
1. User clicks "Preview" button on song row
2. Preview modal opens
3. Display song information:
   - Title, artist, genre
   - Duration
   - Thumbnail/icon
4. Audio player loads song URL
5. User can:
   - Play/pause audio
   - Seek through audio
   - Adjust volume
   - See current time and total duration
6. User can close modal or use song in post

**Validations**:
- Song URL: Must be valid and accessible
- Audio format: Must be playable by browser

**Error States**:
- Load failure: Show "Failed to load audio" error
- Playback error: Show "Playback failed" error

**Success States**:
- Audio loads: Player ready
- Playback works: Audio plays correctly

### 3.5 Song Status Management

**Feature Name**: Toggle Song Active/Inactive

**Business Description**: Activate or deactivate songs to control availability in post/short creation.

**Preconditions**:
- Song must be selected
- User must have status management permissions

**Step-by-Step Flow**:
1. User clicks status toggle or "Activate/Deactivate" button
2. Confirmation may appear (for deactivation)
3. User confirms action
4. Frontend calls `toggleSongStatus(songId)`
5. Backend endpoint `PATCH /api/superadmin/songs/:id/status` is called
6. Backend toggles `isActive` field
7. Backend logs status change
8. Response returns updated song
9. Frontend updates song row
10. Show success toast

**Validations**:
- Song ID: Must be valid
- Song must exist

**Error States**:
- Song not found: Show "Song not found" error
- Toggle failure: Show error message

**Success States**:
- Status toggled: Song row updates immediately
- Availability: Song available/unavailable in post creation

### 3.6 Song Deletion

**Feature Name**: Delete Song

**Business Description**: Permanently remove song from library and storage.

**Preconditions**:
- Song must be selected
- User must have delete permissions

**Step-by-Step Flow**:
1. User clicks "Delete" button on song row
2. Delete confirmation modal appears
3. Modal shows:
   - Song title and artist
   - Warning about permanent deletion
   - Impact: Songs in use may be affected
4. User confirms deletion
5. Frontend calls `deleteSong(songId)`
6. Backend endpoint `DELETE /api/superadmin/songs/:id` is called
7. Backend:
    - Validates song ID
    - Checks if song is in use (optional)
    - Deletes audio file from storage
    - Deletes Song document from database
    - Logs deletion action
8. Response returns success
9. Frontend refreshes song list
10. Show success toast

**Validations**:
- Song ID: Must be valid
- Song must exist
- May check if song is in use (warn but allow deletion)

**Error States**:
- Song not found: Show "Song not found" error
- File deletion failure: Show warning, document deleted
- Delete failure: Show error message

**Success States**:
- Deletion successful: Song removed from list
- Storage cleaned: Audio file deleted

---

## 4. Data Model & API Design

### 4.1 Get Songs Endpoint

**Endpoint**: `GET /api/superadmin/songs`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Query Parameters**:
- `page` (optional): Number, default: 1
- `limit` (optional): Number, default: 20, max: 100
- `search` (optional): String, min: 2 characters
- `genre` (optional): Genre filter
- `status` (optional): 'active' | 'inactive' | 'all'
- `sortBy` (optional): Field name, default: 'createdAt'
- `sortOrder` (optional): 'asc' | 'desc', default: 'desc'

**Response**:
```javascript
{
  success: true,
  songs: [{
    _id: string,
    title: string,
    artist: string,
    genre: string,
    duration: number,        // Seconds
    audioUrl: string,
    thumbnailUrl: string,     // Optional
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
    playCount: number,        // Optional
    usageCount: number        // Times used in posts/shorts
  }],
  pagination: {
    currentPage: number,
    totalPages: number,
    total: number,
    limit: number
  }
}
```

### 4.2 Upload Song Endpoint

**Endpoint**: `POST /api/superadmin/songs`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Request**: `multipart/form-data`
```javascript
{
  file: File,              // Audio file
  title: string,           // Required
  artist: string,          // Required
  genre: string,           // Required
  duration: number         // Optional, seconds
}
```

**Response**:
```javascript
{
  success: true,
  message: "Song uploaded successfully",
  song: {
    // New song object
  }
}
```

### 4.3 Update Song Endpoint

**Endpoint**: `PATCH /api/superadmin/songs/:id`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Request Body**:
```javascript
{
  title?: string,
  artist?: string,
  genre?: string
}
```

**Response**:
```javascript
{
  success: true,
  message: "Song updated successfully",
  song: {
    // Updated song object
  }
}
```

### 4.4 Toggle Status Endpoint

**Endpoint**: `PATCH /api/superadmin/songs/:id/status`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

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
  message: "Song status updated",
  song: {
    // Updated song object
  }
}
```

### 4.5 Delete Song Endpoint

**Endpoint**: `DELETE /api/superadmin/songs/:id`

**Authentication**: Required

**Permissions**: `canManageContent` or founder

**Response**:
```javascript
{
  success: true,
  message: "Song deleted successfully"
}
```

### 4.6 Data Models

**Song Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  title: string,              // Required, max 100 chars
  artist: string,              // Required, max 100 chars
  genre: string,               // Required, enum
  duration: number,            // Seconds, required
  audioUrl: string,            // Required, storage URL
  thumbnailUrl: string,       // Optional, image URL
  isActive: boolean,           // Default: true
  createdAt: Date,
  updatedAt: Date,
  playCount: number,           // Optional, default: 0
  usageCount: number,          // Optional, default: 0
  uploadedBy: ObjectId        // Ref: SuperAdmin
}
```

**Genre Enum** (inferred):
- 'General'
- 'Pop'
- 'Rock'
- 'Hip-Hop'
- 'Electronic'
- 'Classical'
- 'Jazz'
- 'Country'
- 'R&B'
- 'Other'

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**Songs Component** (`superAdmin/src/pages/Songs.jsx`):
- `songs`: Song list data
- `loading`: Loading state
- `uploading`: Upload in progress state
- `searchQuery`: Search input value
- `selectedGenre`: Current genre filter
- `currentPage`: Current page number
- `totalPages`: Total pages
- `totalSongs`: Total song count
- `showUploadModal`: Upload modal visibility
- `showEditModal`: Edit modal visibility
- `showPreviewModal`: Preview modal visibility
- `showDeleteModal`: Delete confirmation modal visibility
- `songToEdit`: Currently edited song
- `songToDelete`: Song to be deleted
- `previewSong`: Song being previewed
- `playingAudio`: Currently playing audio ID
- `sortField`: Current sort field
- `sortOrder`: 'asc' | 'desc'
- `selectedSongs`: Array of selected song IDs
- `formData`: Upload form data
- `editFormData`: Edit form data

**Side Effects**:
- `useEffect` on mount: Fetch initial song list
- `useEffect` on filter change: Reset to page 1, fetch filtered data
- `useEffect` on search: Debounced search (350ms)
- `useEffect` on pagination: Fetch page data

---

## 6. Backend Logic & Rules

### 6.1 Get Songs Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/songs`

**Business Logic**:
1. Verify authentication and permission (`canManageContent`)
2. Parse query parameters
3. Build MongoDB query:
   - Search: Match title or artist (case-insensitive)
   - Genre filter: Match genre field
   - Status filter: Match isActive field
   - Sort: Apply sortBy and sortOrder
4. Execute paginated query
5. Calculate pagination metadata
6. Return songs array and pagination info

**Performance Optimizations**:
- Index on title, artist, genre, createdAt
- Limit maximum page size to 100
- Use lean queries for list views

### 6.2 Upload Song Controller

**Route**: `POST /api/superadmin/songs`

**Business Logic**:
1. Verify authentication and permission
2. Validate file:
   - File exists and is not empty
   - File type is audio format
   - File size within limit (10MB)
3. Validate metadata:
   - Title, artist, genre required
   - Title and artist max 100 characters
   - Genre must be valid enum
4. Extract duration from audio file (if not provided)
5. Validate duration <= 60 seconds (if enforced)
6. Upload file to storage (S3, etc.)
7. Get audio URL from storage
8. Create Song document:
   - Set metadata
   - Set audioUrl
   - Set isActive: true
   - Set uploadedBy: req.superAdmin._id
9. Save to database
10. Log upload action
11. Return created song

**File Upload**:
- Storage: S3, Cloudinary, or local storage
- File naming: `song-{timestamp}-{random}.{ext}`
- Public URL: Generated and stored

### 6.3 Update Song Controller

**Route**: `PATCH /api/superadmin/songs/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate song ID
3. Find song by ID
4. Validate update data
5. Update song document (title, artist, genre only)
6. Log edit action
7. Return updated song

**Validation Rules**:
- Title: Required, max 100 characters
- Artist: Required, max 100 characters
- Genre: Required, must be valid enum
- Duration: Cannot be changed (read-only)

### 6.4 Delete Song Controller

**Route**: `DELETE /api/superadmin/songs/:id`

**Business Logic**:
1. Verify authentication and permission
2. Validate song ID
3. Find song by ID
4. Delete audio file from storage
5. Delete Song document from database
6. Log deletion action
7. Return success

**File Deletion**:
- Delete from storage service
- Handle deletion failures gracefully
- Document deleted even if file deletion fails (log warning)

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Songs**: `canManageContent` permission required
- **Upload Songs**: `canManageContent` permission required
- **Edit Songs**: `canManageContent` permission required
- **Delete Songs**: `canManageContent` permission required

### 7.2 Feature Toggles

- **Music Library**: Can be enabled/disabled
- **Song Upload**: Can be restricted to specific roles
- **Song Preview**: Can be toggled

### 7.3 Settings Impact

- **Max File Size**: Settings.storage.maxFileSize affects upload limit
- **Allowed File Types**: Settings.storage.allowedFileTypes affects accepted formats
- **Music Duration**: Max 60 seconds enforced (if configured)

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

- **Audit Logging**: All song actions logged with admin ID, timestamp
- **File Validation**: Strict file type and size validation
- **Input Sanitization**: All inputs sanitized and validated
- **Storage Security**: Audio files stored securely

### 8.4 Privacy Considerations

- **Copyright**: Songs must comply with copyright/licensing
- **File Storage**: Audio files stored securely
- **Usage Tracking**: Track song usage in posts/shorts

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Song List View**: `songs_list_view` event
- **Song Upload**: `song_upload` event with song ID
- **Song Edit**: `song_edit` event with song ID
- **Song Delete**: `song_delete` event with song ID
- **Song Preview**: `song_preview` event with song ID

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total songs count
- Active songs count
- Inactive songs count
- Songs by genre
- Total library size (MB)
- Most used songs

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **File Size**: Maximum 10MB per song
- **Duration**: Maximum 60 seconds (enforced in post creation)
- **Title Length**: Maximum 100 characters
- **Artist Length**: Maximum 100 characters
- **Page Size**: Maximum 100 songs per page

### 10.2 Error Handling

- **File Upload Failures**: Show detailed error, allow retry
- **Storage Failures**: Log error, show user-friendly message
- **Metadata Validation**: Show field-specific errors
- **Concurrent Edits**: Last write wins

### 10.3 Known Constraints

- **Audio Format Support**: Depends on browser/player support
- **Storage Limits**: Library size limited by storage capacity
- **Duration Extraction**: May fail for some audio formats
- **Large Library**: Pagination required for >1000 songs

### 10.4 Performance Considerations

- **Indexing**: Title, artist, genre, createdAt indexed
- **File Upload**: Progress tracking for large files
- **Lazy Loading**: Audio previews loaded on demand
- **Debouncing**: Search debounced to 350ms

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Bulk Upload**: Upload multiple songs at once
- **Song Categories**: Organize songs into categories/playlists
- **Usage Analytics**: Track which songs are most used
- **Audio Waveform**: Visual waveform display

### 11.2 Next (Medium Priority)

- **Song Tags**: Add tags for better organization
- **Song Search**: Advanced search with multiple criteria
- **Song Duplicates**: Detect and handle duplicate songs
- **Song Recommendations**: AI-powered song suggestions

### 11.3 Later (Low Priority)

- **Song Licensing**: Track and manage song licenses
- **Royalty Management**: Calculate and track royalties
- **Song Analytics**: Detailed usage analytics per song
- **API Access**: External API for song library

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- File upload with progress tracking
- Audio player for preview
- Framer Motion for animations

**Key Dependencies**:
- `react-router-dom`: Navigation
- `react-hot-toast`: Toast notifications
- Audio player library
- File upload library

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- File storage (S3, Cloudinary, etc.)
- Audio processing library (optional)

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `multer`: File upload handling
- Storage SDK (AWS S3, etc.)
- Audio processing library (for duration extraction)

### 12.3 Data Flow

1. User navigates to Songs page
2. Frontend fetches song list
3. Songs displayed in table
4. User uploads/edits/deletes song
5. Frontend calls appropriate endpoint
6. Backend processes request
7. Backend updates database and storage
8. Response returns updated data
9. Frontend refreshes list

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/songs` | Get paginated song list | Yes |
| POST | `/api/superadmin/songs` | Upload new song | Yes |
| PATCH | `/api/superadmin/songs/:id` | Update song metadata | Yes |
| PATCH | `/api/superadmin/songs/:id/status` | Toggle song status | Yes |
| DELETE | `/api/superadmin/songs/:id` | Delete song | Yes |

---

## 14. Related Documentation

- **Post**: See `post-spec.md` for song usage in posts
- **Shorts**: See `shorts-spec.md` for song usage in shorts
- **Settings**: See `settings-spec.md` for storage settings
- **Travel Content**: See `travel-content-spec.md` for content management


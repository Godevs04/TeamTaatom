# Post Menu - Product Specification

## 1. Overview

The Post menu enables users to create and share photo posts with captions, location data, hashtags, mentions, and optional background music. It serves as the primary content creation interface for the Taatom platform, supporting both single and multiple image uploads with intelligent location extraction, TripScore verification, and media optimization.

### User Personas & Goals

- **Content Creators**: Share travel photos, document trips, build their travel profile
- **Travel Enthusiasts**: Post photos with verified locations to increase TripScore
- **Social Users**: Share moments, engage with community through hashtags and mentions
- **New Users**: Create first post to start their Taatom journey

### Frontend-Backend-superAdmin Collaboration

- **Frontend** (`frontend/app/(tabs)/post.tsx`): Photo/video selection UI, location extraction, form validation, upload with progress tracking, draft saving
- **Backend** (`backend/src/controllers/postController.js`, `backend/src/routes/postRoutes.js`): Handles multipart uploads, image optimization, TripVisit creation, hashtag/mention extraction, notifications
- **superAdmin** (`superAdmin/src/pages/TravelContent.jsx`): Moderates posts (activate/deactivate/flag/delete), views analytics

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `frontend/app/(tabs)/post.tsx`

**Purpose**: Create new photo posts or short videos

**Entry Points**:
- Tab navigation from bottom bar (Add-circle icon)
- Deep link: `/(tabs)/post`
- Navigation from other screens (e.g., "Create Your First Post" CTA from home)

**Exit Points**:
- Successful upload → Navigate to `/(tabs)/home` (feed)
- Cancel/Back → Returns to previous screen
- Tab navigation → Switch to other tabs

**Post Type Selection**:
- **Photo Mode**: Upload single or multiple images (up to 10)
- **Short Mode**: Upload single video (up to 60 minutes, typically shorter)

**Modals & Overlays**:
- Audio Choice Modal: Choose between original audio or background music (for shorts)
- Song Selector Modal: Browse and select background music
- Image/Video Picker: Native device picker
- Camera: In-app camera for taking photos/videos

---

## 3. Detailed Features & User Flows

### 3.1 Select Media (Photo Mode)

**Feature Name**: Photo Selection

**Business Description**: Users can select photos from their gallery or take new photos using the in-app camera. Supports multiple image selection (up to 10 images for carousel posts).

**Preconditions**:
- User must grant media library permissions (for gallery) or camera permissions (for camera)
- User is authenticated

**Step-by-Step Flow - Gallery Selection**:
1. User taps "Choose from Library" button
2. App requests media library permissions (if not granted)
3. Opens native image picker: `ImagePicker.launchImageLibraryAsync()` with options:
   - `mediaTypes: ImagePicker.MediaTypeOptions.Images`
   - `allowsMultipleSelection: true`
   - `allowsEditing: true`
   - `quality: 0.8`
   - `exif: true` (preserves EXIF data including location)
4. User selects one or more images (up to 10)
5. For each selected image:
   - Extract location using `LocationExtractionService.extractFromPhotos()`
   - Check EXIF GPS or `assetInfo.location`
   - If found: Set location, address, `hasExifGps: true`, `rawSource: 'exif'`
   - If not found: Fall back to device's current location
6. Store location metadata: `{ hasExifGps, takenAt, rawSource }`
7. Set `isFromCameraFlow: false`
8. Display selected images in carousel preview
9. Show location info if available

**Step-by-Step Flow - Camera Capture**:
1. User taps "Take Photo" button
2. App requests camera permissions (if not granted)
3. Opens camera: `ImagePicker.launchCameraAsync()` with options:
   - `mediaTypes: ImagePicker.MediaTypeOptions.Images`
   - `allowsEditing: true`
   - `quality: 0.8`
   - `exif: true`
4. User takes photo
5. Wait 500ms for MediaLibrary to update
6. Extract location from captured photo EXIF/assetInfo
7. If location found: Use it; else: Get device's current location
8. Store location metadata
9. Set `isFromCameraFlow: true`
10. Display captured photo in preview

**Validations**:
- Max 10 images per post
- Images must be valid image files
- Location extraction may fail (falls back to device location)

**Error States**:
- Permission denied: Show alert "Please grant photo library/camera permissions"
- No images selected: Show "Please select at least one image"
- Location extraction fails: Fall back to device location (no error shown)

**Success States**:
- Images display in carousel preview
- Location auto-filled if available
- Address shown below location input
- Image counter badge shows number of images

---

### 3.2 Select Media (Short Mode)

**Feature Name**: Video Selection

**Business Description**: Users can select videos from gallery or record new videos. Videos are limited to 60 minutes maximum duration. Supports vertical aspect ratio (9:16) for shorts format.

**Preconditions**:
- User must grant media library or camera permissions
- User is authenticated

**Step-by-Step Flow - Gallery Selection**:
1. User taps "Choose from Library" (when in short mode)
2. Opens video picker: `ImagePicker.launchImageLibraryAsync()` with:
   - `mediaTypes: ImagePicker.MediaTypeOptions.Videos`
   - `allowsEditing: true`
   - `aspect: [9, 16]` (vertical)
   - `quality: 0.8`
   - `exif: true`
3. User selects video
4. Check video duration:
   - If `asset.duration > 100`: Treat as milliseconds, convert to seconds
   - If duration > 60 minutes (3600 seconds): Show error "Video Too Long"
5. If valid: Set `selectedVideo` URI
6. Generate thumbnail: `VideoThumbnails.getThumbnailAsync()` at 1 second
7. Extract location from video metadata (same as photos)
8. Show audio choice modal: "Use original audio" or "Add background music"
9. Display video preview and thumbnail

**Step-by-Step Flow - Camera Capture**:
1. User taps "Take Video" button
2. Opens camera for video: `ImagePicker.launchCameraAsync()` with video options
3. User records video
4. Check duration (same validation as gallery)
5. Generate thumbnail
6. Extract location
7. Set `isFromCameraFlow: true`
8. Show audio choice modal

**Validations**:
- Video duration: Max 60 minutes (3600 seconds)
- Video must be valid video file
- URI must not be empty string

**Error States**:
- Video too long: Alert with formatted duration (e.g., "2:30")
- Invalid video file: Alert "Invalid video file selected"
- Thumbnail generation fails: Show placeholder, continue upload

**Success States**:
- Video preview displays
- Thumbnail generated and shown
- Location auto-filled
- Audio choice modal appears

---

### 3.3 Location Extraction & Verification

**Feature Name**: Automatic Location Detection

**Business Description**: Automatically extracts location from photo/video EXIF data or OS-level metadata. Both EXIF GPS and `assetInfo.location` are treated as verified GPS evidence for TripScore purposes.

**Preconditions**: Media selected (photo or video)

**Step-by-Step Flow**:
1. After media selection, call `LocationExtractionService.extractFromPhotos()`
2. Strategy 1: Check EXIF GPS data (`asset.exif.GPSLatitude`, `asset.exif.GPSLongitude`)
3. Strategy 2: If no EXIF GPS, check `assetInfo.location` (OS-level photo GPS)
4. If either found:
   - Set `hasExifGps: true`
   - Set `rawSource: 'exif'`
   - Extract `takenAt` from EXIF `DateTimeOriginal` or `assetInfo.creationTime`
   - Reverse geocode to get address
5. If neither found: Try filename matching (fallback)
6. If still no location: Fall back to device's current location
7. Store location metadata in state

**Location Source Mapping** (for TripScore):
- `isFromCameraFlow: true` → `source: 'taatom_camera_live'` (HIGH trust)
- `hasExifGps: true` (EXIF or assetInfo.location) → `source: 'gallery_exif'` (MEDIUM trust)
- Location exists but `hasExifGps: false` → `source: 'gallery_no_exif'` (LOW trust)
- No location → `source: 'manual_only'` (UNVERIFIED)

**Validations**:
- Coordinates must be valid (not 0,0)
- Latitude: -90 to 90
- Longitude: -180 to 180

**Error States**:
- Location extraction fails: Silently fall back to device location
- Reverse geocoding fails: Use coordinates only, no address

**Success States**:
- Location auto-filled in form
- Address displayed
- Tip message shown: "Use original camera photos (not WhatsApp/downloaded images) with location enabled so Taatom can verify your trip and count it in TripScore."

---

### 3.4 Add Caption, Hashtags, Mentions

**Feature Name**: Text Input with Smart Suggestions

**Business Description**: Users can add captions with hashtags and mentions. The UI provides autocomplete suggestions as users type.

**Preconditions**: Media selected

**Step-by-Step Flow**:
1. User types in caption field
2. When typing `#`: `HashtagSuggest` component shows hashtag suggestions
3. When typing `@`: `MentionSuggest` component shows user suggestions
4. User selects suggestion or continues typing
5. Caption validated: Required, 1-1000 characters
6. Hashtags extracted on backend (via `extractHashtags` utility)
7. Mentions extracted on backend (via `extractMentions` utility)

**Validations**:
- Caption: Required, 1-1000 characters (trimmed)
- Hashtags: Auto-extracted, no explicit limit (inferred)
- Mentions: Auto-extracted, validated as existing users

**Error States**:
- Caption too short: "Caption is required"
- Caption too long: "Caption cannot exceed 1000 characters"
- Invalid mention: Mentioned user doesn't exist (handled on backend)

**Success States**:
- Caption saved in form state
- Hashtags and mentions highlighted in UI (inferred)
- Suggestions appear as user types

---

### 3.5 Add Location Manually

**Feature Name**: Manual Location Entry

**Business Description**: Users can manually enter a place name or address if automatic location detection fails or they want to override it.

**Preconditions**: Media selected

**Step-by-Step Flow**:
1. User types in "Place Name" field
2. As user types, geocode address: `geocodeAddress(placeName)`
3. Convert place name to coordinates
4. Update location state with geocoded coordinates
5. Reverse geocode to get formatted address
6. Display address below input

**Validations**:
- Place name: Optional, no length limit (inferred)
- Geocoding may fail (invalid place name)

**Error States**:
- Geocoding fails: Location not updated, user can continue without location
- Invalid address: No error shown, location simply not set

**Success States**:
- Address auto-completes as user types
- Location coordinates updated
- Address displayed

---

### 3.6 Add Background Music (Shorts Only)

**Feature Name**: Music Selection

**Business Description**: Users can add background music to their short videos, with control over start time, end time, and volume.

**Preconditions**: 
- Short mode active
- User selected "Add background music" in audio choice modal

**Step-by-Step Flow**:
1. User taps "Add Music" button
2. `SongSelector` modal opens
3. User browses available songs
4. User selects a song
5. User can adjust:
   - Start time (default: 0)
   - End time (default: 60 seconds, or song duration)
   - Volume (default: 0.5, range 0-1)
6. Song preview plays (inferred)
7. User confirms selection
8. Song data stored: `{ songId, startTime, endTime, volume }`

**Validations**:
- Song ID: Must be valid MongoDB ObjectId
- Start time: >= 0, < song duration
- End time: > start time, <= song duration or 60 seconds
- Volume: 0 to 1

**Error States**:
- Song not found: Show error, allow reselection
- Invalid time range: Show validation error

**Success States**:
- Song name and artist displayed
- Music button shows selected song
- Song data included in upload

---

### 3.7 Upload Post

**Feature Name**: Multi-Image Post Upload with Progress

**Business Description**: Uploads one or more images with caption, location, hashtags, mentions, and optional music. Shows real-time upload progress.

**Preconditions**:
- At least one image selected
- Caption provided (required)
- User authenticated

**Step-by-Step Flow**:
1. User taps "Share Post" button
2. Validate form: Caption required, images present
3. Optimize images (if needed):
   - Check each image: `shouldOptimizeImage(uri)`
   - If needs optimization: Resize to max 1200x1200, compress to JPEG
   - Update progress: 0-50% (optimization phase)
4. Determine TripScore source:
   - If `isFromCameraFlow`: `source = 'taatom_camera_live'`
   - Else if `hasExifGps`: `source = 'gallery_exif'`
   - Else if location exists: `source = 'gallery_no_exif'`
   - Else: `source = 'manual_only'`
5. Create FormData with:
   - `images[]`: Array of image files
   - `caption`: Text caption
   - `address`: Place name or address
   - `latitude`, `longitude`: Coordinates (if available)
   - `hasExifGps`: Boolean
   - `takenAt`: ISO date string (if available)
   - `source`: TripScore source type
   - `fromCamera`: Boolean
   - `songId`, `songStartTime`, `songEndTime`, `songVolume`: Music data (if selected)
   - `tags`: Comma-separated hashtags (extracted from caption)
6. Upload via `createPostWithProgress()`:
   - Progress callback updates UI: 50-100% (upload phase)
   - Shows progress percentage and image count
7. On success:
   - Show success alert: "Your post has been shared."
   - Clear form state
   - Navigate to home feed
   - Update `hasExistingPosts: true`
8. On error:
   - Show error alert with message
   - Keep form data (user can retry)

**Validations**:
- Caption: Required, 1-1000 characters
- Images: At least 1, max 10
- Location: Optional, but if provided, coordinates must be valid
- Hashtags: Auto-extracted, no limit
- Mentions: Auto-extracted, validated on backend

**Error States**:
- Network error: "Upload failed. Please try again."
- Validation error: Show specific field error
- Image upload fails: Show error, allow retry
- 429 Rate limit: Show "Too many requests" error

**Success States**:
- Progress reaches 100%
- Success alert shown
- Post appears in feed
- TripVisit created (if location verified)
- Notifications sent to mentioned users
- Hashtags created/updated

---

### 3.8 Upload Short

**Feature Name**: Video Short Upload

**Business Description**: Uploads a video short with caption, location, optional thumbnail, and optional background music.

**Preconditions**:
- Video selected
- Caption provided
- User authenticated

**Step-by-Step Flow**:
1. User taps "Share" button (in short form)
2. Validate: Video present, caption required
3. Determine TripScore source (same logic as posts)
4. Create FormData with:
   - `video`: Video file
   - `image`: Thumbnail image (if generated)
   - `caption`: Text caption
   - `address`, `latitude`, `longitude`: Location data
   - `hasExifGps`, `takenAt`, `source`, `fromCamera`: TripScore metadata
   - `songId`, `songStartTime`, `songEndTime`, `songVolume`: Music data
   - `tags`: Hashtags
5. Upload via `createShort()`:
   - No explicit progress tracking (inferred from code)
6. On success:
   - Show success alert
   - Clear form
   - Navigate to home
7. On error: Show error alert

**Validations**:
- Caption: Required, 1-1000 characters
- Video: Required, max 60 minutes
- Thumbnail: Optional (auto-generated if missing)

**Error States**: Same as post upload

**Success States**: Same as post upload

---

### 3.9 Draft Saving

**Feature Name**: Auto-Save Drafts

**Business Description**: Automatically saves post drafts to AsyncStorage so users don't lose their work if they navigate away.

**Preconditions**: User has selected media

**Step-by-Step Flow**:
1. User selects images/video
2. After 2 seconds of inactivity, auto-save draft:
   - Key: `'postDraft'`
   - Data: `{ selectedImages, selectedVideo, location, address, postType, timestamp }`
3. On next visit to post screen:
   - Check for draft in AsyncStorage
   - If draft exists and < 24 hours old:
     - Show alert: "Draft Found. Would you like to restore your previous draft?"
     - Options: "Discard" or "Restore"
   - If user restores: Load draft data into form
   - If user discards: Delete draft

**Validations**:
- Draft expires after 24 hours
- Only saves if media is selected

**Error States**:
- AsyncStorage error: Silently fail (don't block user)

**Success States**:
- Draft saved automatically
- Draft restored on return
- Draft cleared after successful upload

---

## 4. Data Model & API Design

### 4.1 Data Entities

**Post Entity** (from `backend/src/models/Post.js`):
```typescript
interface Post {
  _id: string;
  user: ObjectId (ref: User);
  caption: string; // Required, max 1000 chars
  imageUrl: string; // Required for photos
  images?: string[]; // Multiple images for carousel
  videoUrl?: string; // For shorts
  storageKey?: string; // Sevalla Object Storage key
  storageKeys?: string[]; // Multiple keys for carousel
  cloudinaryPublicId?: string; // Legacy Cloudinary ID
  cloudinaryPublicIds?: string[]; // Multiple IDs
  tags?: string[]; // Hashtags extracted from caption
  type: 'photo' | 'short'; // Default: 'photo'
  location: {
    address: string; // Default: 'Unknown Location'
    coordinates: {
      latitude: number; // Default: 0
      longitude: number; // Default: 0
    };
  };
  likes: ObjectId[]; // Array of user IDs
  comments: Comment[]; // Embedded comments
  isActive: boolean; // Default: true
  isArchived: boolean; // Default: false
  isHidden: boolean; // Default: false
  commentsDisabled: boolean; // Default: false
  views: number; // Default: 0
  song?: {
    songId: ObjectId (ref: Song);
    startTime: number; // Default: 0
    endTime: number | null; // null = play until end or 60s
    volume: number; // Default: 0.5, min: 0, max: 1
  };
  mentions: ObjectId[]; // Array of mentioned user IDs
  createdAt: Date;
  updatedAt: Date;
}
```

**TripVisit Entity** (inferred from TripScore logic):
- Created automatically when post is uploaded with verified location
- Fields: `user`, `post`, `lat`, `lng`, `address`, `continent`, `country`, `trustLevel`, `source`, `takenAt`, `uploadedAt`
- Trust levels: `'high'`, `'medium'`, `'low'`, `'unverified'`, `'suspicious'`
- Sources: `'taatom_camera_live'`, `'gallery_exif'`, `'gallery_no_exif'`, `'manual_only'`

### 4.2 API Endpoints

#### POST /api/v1/posts

**Purpose**: Create new photo post (single or multiple images)

**Method**: POST

**Auth**: Required (`authMiddleware`)

**Request Body**: `multipart/form-data`
- `images[]`: Array of image files (1-10 files)
- `caption`: String (required, 1-1000 chars)
- `address`: String (optional)
- `latitude`: Number (optional, -90 to 90)
- `longitude`: Number (optional, -180 to 180)
- `hasExifGps`: Boolean (optional, 'true'/'false' as string)
- `takenAt`: ISO date string (optional)
- `source`: String (optional, 'taatom_camera_live' | 'gallery_exif' | 'gallery_no_exif' | 'manual_only')
- `fromCamera`: Boolean (optional, 'true'/'false' as string)
- `songId`: String (optional, MongoDB ObjectId)
- `songStartTime`: Number (optional, >= 0)
- `songEndTime`: Number (optional, >= 0)
- `songVolume`: Number (optional, 0-1)
- `tags`: String (optional, comma-separated hashtags)

**Validations**:
- Caption: Required, 1-1000 characters, trimmed
- Images: At least 1 file, max 10 files
- Latitude/Longitude: Valid ranges if provided
- Song data: Valid ObjectId, time ranges, volume range

**Response Structure**:
```json
{
  "success": true,
  "message": "Post created successfully",
  "post": PostType // Full post object
}
```

**Backend Logic** (from `backend/src/controllers/postController.js`):
1. Validates request (caption, files)
2. Uploads images to Sevalla Object Storage (or Cloudinary fallback):
   - Key format: `posts/{userId}/{timestamp}_{filename}`
   - For multiple images: Creates array of URLs
3. Extracts hashtags from caption: `extractHashtags(caption)`
4. Extracts mentions from caption: `extractMentions(caption)`
5. Creates Post document
6. Creates/updates Hashtag documents
7. Creates notifications for mentioned users
8. Creates TripVisit (if location verified):
   - Determines trust level based on `source`:
     - `taatom_camera_live` → `trustLevel: 'high'`
     - `gallery_exif` → `trustLevel: 'medium'`
     - `gallery_no_exif` → `trustLevel: 'low'`
     - `manual_only` → `trustLevel: 'unverified'`
   - Detects fraud (impossible travel speed)
   - Deduplicates locations (same lat/lng within tolerance)
9. Creates Activity record
10. Sends real-time notifications via WebSocket
11. Invalidates post list cache

---

#### POST /api/v1/shorts

**Purpose**: Create new short video

**Method**: POST

**Auth**: Required

**Request Body**: `multipart/form-data`
- `video`: Video file (required)
- `image`: Thumbnail image (optional)
- `caption`: String (required, 1-1000 chars)
- `address`, `latitude`, `longitude`: Location data (optional)
- `hasExifGps`, `takenAt`, `source`, `fromCamera`: TripScore metadata (optional)
- `songId`, `songStartTime`, `songEndTime`, `songVolume`: Music data (optional)
- `tags`: Comma-separated hashtags (optional)

**Response Structure**: Same as post creation

**Backend Logic**: Similar to post creation, but:
- Uploads video to storage
- Generates thumbnail if not provided
- Sets `type: 'short'`
- Creates TripVisit with same trust logic

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Local State

**Component State** (`frontend/app/(tabs)/post.tsx`):
- `selectedImages`: Array of image objects `{ uri, type, name }`
- `selectedVideo`: String URI or null
- `videoThumbnail`: String URI or null
- `location`: `{ lat, lng }` or null
- `address`: String
- `locationMetadata`: `{ hasExifGps, takenAt, rawSource }` or null
- `isFromCameraFlow`: Boolean
- `isLoading`: Boolean
- `isUploading`: Boolean
- `uploadProgress`: `{ current, total, percentage }`
- `uploadError`: String or null
- `postType`: 'photo' | 'short'
- `user`: UserType or null
- `hasExistingPosts`: Boolean or null
- `hasExistingShorts`: Boolean or null
- `selectedSong`: Song or null
- `songStartTime`: Number
- `songEndTime`: Number
- `showSongSelector`: Boolean
- `audioChoice`: 'background' | 'original' | null
- `showAudioChoiceModal`: Boolean

### 5.2 Global State / Context

**ThemeContext**: Provides theme for styling

**AlertContext**: Provides error/success alerts

### 5.3 Custom Hooks

**useScrollToHideNav**: Hides tab bar on scroll

### 5.4 Caching Strategy

**AsyncStorage Draft**:
- Key: `'postDraft'`
- Structure: `{ selectedImages, selectedVideo, location, address, postType, timestamp }`
- TTL: 24 hours
- Auto-saved: Every 2 seconds after media selection (debounced)

### 5.5 Debouncing & Throttling

**Draft Auto-Save**:
- Debounced: 2 seconds after state changes
- Only saves if media is selected

**Location Geocoding**:
- Debounced: 500ms (inferred) when typing place name

### 5.6 Side Effects

**useEffect Dependencies**:
- Auto-save draft when media/location changes
- Load draft on mount
- Check existing posts/shorts on mount
- Load user on mount

---

## 6. Backend Logic & Rules

### 6.1 Post Creation Rules

**File Upload**:
- Max files: 10 images per post
- File size: Unlimited (no explicit limit)
- Formats: Images (JPEG, PNG, WebP, GIF), Videos (MP4, MOV, etc.)
- Storage: Sevalla Object Storage (primary) or Cloudinary (fallback)
- Optimization: Images resized to max 1200x1200 on client before upload

**Caption Rules**:
- Required: Yes
- Min length: 1 character (after trim)
- Max length: 1000 characters
- Trimmed: Yes

**Location Rules**:
- Optional: Yes
- Default address: 'Unknown Location'
- Default coordinates: (0, 0)
- If provided: Must be valid lat/lng ranges

**Hashtag Extraction**:
- Extracted from caption using `extractHashtags()` utility
- Pattern: `#hashtag` (alphanumeric + emoji)
- Creates/updates Hashtag documents
- No limit on number of hashtags

**Mention Extraction**:
- Extracted from caption using `extractMentions()` utility
- Pattern: `@username`
- Validates mentioned users exist
- Creates notifications for mentioned users

**TripVisit Creation**:
- Created automatically if location provided
- Trust level determined by `source`:
  - `taatom_camera_live` → `'high'` (contributes to TripScore)
  - `gallery_exif` → `'medium'` (contributes to TripScore)
  - `gallery_no_exif` → `'low'` (does NOT contribute)
  - `manual_only` → `'unverified'` (does NOT contribute)
- Fraud detection: Checks for impossible travel speed
- Deduplication: Same location (within tolerance) only counted once per user

### 6.2 Image Optimization

**Client-Side** (before upload):
- Checks if optimization needed: `shouldOptimizeImage(uri)`
- If needed: Resize to max 1200x1200, compress to JPEG
- Quality: Determined by `getOptimalQuality(fileSize)`

**Server-Side** (after upload):
- Stores in Sevalla Object Storage or Cloudinary
- Cloudinary: Auto-optimization enabled (WebP, progressive)
- R2 URLs: Pre-signed, no additional optimization needed

### 6.3 Background Jobs

**Hashtag Processing**:
- Synchronous: Creates/updates Hashtag documents on post creation

**Notification Creation**:
- Synchronous: Creates notifications for mentions and likes
- Real-time: Sends via WebSocket

**Activity Creation**:
- Synchronous: Creates Activity records for likes, comments, posts

---

## 7. superAdmin Dependencies

### 7.1 Content Moderation

**File**: `superAdmin/src/pages/TravelContent.jsx`

**Features**:
- View all posts (photos and shorts) with filters
- Activate/Deactivate posts (`PATCH /api/superadmin/posts/:id` with `isActive`)
- Flag posts for review
- Delete posts permanently
- Search by caption, user, location
- Filter by type (photo/short), status

**Impact on Post Creation**:
- Deactivated posts don't appear in feeds
- Flagged posts may be hidden (inferred)
- Deleted posts removed permanently

---

## 8. Permissions, Privacy & Security

### 8.1 Access Rules

**Authentication**:
- Required for: Creating posts, uploading media
- Optional for: Viewing posts (public feed)

**Device Permissions**:
- Media Library: Required for selecting photos/videos from gallery
- Camera: Required for taking photos/videos
- Location: Optional (for automatic location detection)

### 8.2 Privacy Rules

**Post Visibility**:
- All posts are public by default (visible in feed)
- Users can archive/hide posts (affects visibility)
- Blocked users' posts may be filtered (inferred)

**Location Privacy**:
- Location data stored with post
- Visible to all users (public)
- Used for TripScore calculation

### 8.3 Security Checks

**Auth Middleware**: `authMiddleware` required for POST endpoints

**Input Sanitization**:
- Caption: Trimmed, length validated
- Hashtags: Extracted and validated
- Mentions: Validated as existing users
- Coordinates: Validated as numbers in valid ranges

**File Upload Security**:
- File type validation (images/videos only)
- No explicit file size limit (unlimited uploads)
- Storage keys sanitized

**Rate Limiting**:
- Inferred from error handling (429 errors possible)
- No explicit limits visible in code

---

## 9. Analytics & Events

### 9.1 Tracked Events

**Screen View** (inferred):
- `trackScreenView('post')` - Fired on Post screen mount

**Feature Usage** (inferred):
- Post creation: Tracked when post is successfully created
- Location extraction: Tracked when location is found
- Music selection: Tracked when music is added

**Engagement** (inferred):
- Post upload success/failure
- Draft save/restore

### 9.2 Metrics & KPIs

**User Metrics**:
- Posts created per user
- Average images per post
- Posts with location vs without
- Posts with verified GPS vs manual
- Music usage rate

**Content Metrics**:
- Total posts created
- Posts by type (photo vs short)
- Posts with hashtags/mentions
- Average caption length

**Business Metrics**:
- TripScore contribution by source type
- Verified location rate (hasExifGps true)
- Camera vs gallery usage

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

**Media**:
- Max images per post: 10
- Max video duration: 60 minutes (3600 seconds)
- No file size limit (unlimited uploads)

**Text**:
- Caption: 1-1000 characters
- Comment: 1-500 characters (for comments on posts)

**Location**:
- Latitude: -90 to 90
- Longitude: -180 to 180

### 10.2 Error Handling

**Network Errors**:
- Upload fails: Show error alert, keep form data for retry
- Timeout: Show "Upload failed" message

**Validation Errors**:
- Caption missing: "Caption is required"
- Caption too long: "Caption cannot exceed 1000 characters"
- No media: "Please select at least one image/video"

**Permission Errors**:
- Media library denied: "Please grant photo library permissions"
- Camera denied: "Please grant camera permissions"
- Location denied: Falls back silently (no error)

**File Errors**:
- Invalid file type: "Only image/video files are allowed"
- Video too long: "Video duration exceeds 60 minutes"
- Empty URI: Validated before setting state

### 10.3 Known Constraints

**Location Extraction**:
- EXIF data may be stripped by some apps (WhatsApp, social media)
- `assetInfo.location` may not be available on all devices
- Fallback to device location may be inaccurate

**Image Optimization**:
- Optimization happens on client (may be slow for large images)
- No server-side optimization visible (relies on CDN)

**Draft Saving**:
- Drafts stored locally only (not synced across devices)
- Lost if user clears app data
- 24-hour expiration may be too short for some users

**Multiple Images**:
- All images uploaded sequentially (not parallel)
- Progress tracking may not be perfectly accurate for multiple images

**Video Thumbnail**:
- Generated at 1 second mark (may not be best frame)
- Generation may fail silently

**TODO/FIXME** (inferred):
- No explicit error boundary for upload flow
- Progress tracking for shorts not as detailed as photos
- No retry mechanism for failed uploads (user must manually retry)

---

## 11. Future Enhancements (Optional Backlog)

### Now (High Priority)

1. **Parallel Image Upload**: Upload multiple images in parallel for faster uploads
2. **Better Draft Management**: Cloud sync for drafts, longer expiration, draft list
3. **Improved Location UX**: Map picker for manual location selection
4. **Upload Retry**: Automatic retry mechanism for failed uploads

### Next (Medium Priority)

1. **Video Editing**: Basic video editing (trim, filters) before upload
2. **Image Editing**: Crop, filters, adjustments before upload
3. **Batch Upload**: Upload multiple posts at once
4. **Offline Queue**: Queue uploads when offline, sync when online

### Later (Low Priority)

1. **Scheduled Posts**: Schedule posts for future publication
2. **Post Templates**: Save and reuse post templates
3. **Collaborative Posts**: Multiple users contribute to one post
4. **Post Analytics**: Show views, engagement stats on own posts

---

**Document Version**: 1.0  
**Last Updated**: Based on codebase analysis as of current date  
**Inferred Sections**: Marked with "inferred from code" where behavior is implied but not explicitly documented


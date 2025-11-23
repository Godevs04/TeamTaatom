# MASTER IMPLEMENTATION PLAN: Song Selection Feature for Posts

## OBJECTIVE
Implement song selection feature during post upload (both photos and shorts) without changing any existing logic. Songs will be stored in AWS S3, managed through SuperAdmin panel, and selectable in the main mobile app - similar to Instagram and other social media platforms.

---

## ARCHITECTURE DECISIONS

1. **Storage Solution**: AWS S3 (with optional CloudFront CDN for better performance)
2. **Song Format Support**: MP3, M4A, WAV audio formats
3. **Integration Approach**: Add song reference to Post model as optional field
4. **Backward Compatibility**: All existing posts work perfectly without songs
5. **No Breaking Changes**: All existing endpoints and logic remain completely unchanged

---

## PHASE 1: BACKEND IMPLEMENTATION

### Step 1.1: Install Dependencies
**File:** `backend/package.json`
- Add to dependencies: `"aws-sdk": "^2.1500.0"` and `"uuid": "^9.0.1"`
- Run: `npm install aws-sdk uuid`

### Step 1.2: Create AWS S3 Configuration
**File:** `backend/src/config/s3.js` (NEW FILE)

Create this file with:
- AWS S3 client initialization using environment variables
- `uploadSong(buffer, filename, mimetype)` function - Uploads audio file to S3
- `deleteSong(key)` function - Deletes song from S3
- `getPresignedUrl(key, expiresIn)` function - Generates pre-signed URL for private access
- Use environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_CLOUDFRONT_URL` (optional)

**Key Requirements:**
- Store songs in `songs/` folder in S3
- Use UUID for unique file names
- Set proper Content-Type headers
- Support public-read ACL (or use bucket policy for better security)
- Return CloudFront URL if configured, otherwise S3 URL

### Step 1.3: Create Song Model
**File:** `backend/src/models/Song.js` (NEW FILE)

Schema fields:
- `title` (String, required, trimmed)
- `artist` (String, required, trimmed)
- `duration` (Number, required, in seconds)
- `s3Key` (String, required, unique - S3 object key)
- `s3Url` (String, required - Full URL to song)
- `thumbnailUrl` (String, optional - Album art/thumbnail)
- `genre` (String, default: 'General')
- `isActive` (Boolean, default: true)
- `uploadedBy` (ObjectId, ref: 'SuperAdmin', required)
- `uploadDate` (Date, default: Date.now)
- `usageCount` (Number, default: 0 - tracks how many posts use this song)
- `timestamps: true` (createdAt, updatedAt)

**Indexes:**
- Text index on `title` and `artist` for search
- Index on `isActive` and `createdAt` for filtering
- Index on `genre` for genre filtering

### Step 1.4: Create Song Controller
**File:** `backend/src/controllers/songController.js` (NEW FILE)

**Functions to implement:**

1. `getSongs(req, res)` - Public endpoint
   - Query params: `search`, `genre`, `page`, `limit`
   - Filter: `isActive: true`
   - Support text search on title/artist
   - Return paginated results
   - Select only: `title`, `artist`, `duration`, `s3Url`, `thumbnailUrl`, `genre`, `_id`
   - Sort by `createdAt: -1`
   - Use same error handling pattern as `postController.js`

2. `uploadSong(req, res)` - SuperAdmin only
   - Validate: `req.file` exists
   - Validate file type: `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/m4a`
   - Extract: `title`, `artist`, `genre`, `duration` from `req.body`
   - Upload to S3 using `uploadSong()` from config
   - Create Song document in database
   - Return created song
   - Handle errors (file validation, S3 upload, database errors)

3. `deleteSongById(req, res)` - SuperAdmin only
   - Find song by ID
   - Delete from S3 using `deleteSong()`
   - Delete from database
   - Handle errors

4. `getSongById(req, res)` - Optional helper
   - Get single song by ID
   - Return song details

**Error Handling:**
- Use `sendError()` and `sendSuccess()` from `../utils/errorCodes`
- Use logger from `../utils/logger`
- Follow same patterns as `postController.js`

### Step 1.5: Create Song Routes
**File:** `backend/src/routes/songRoutes.js` (NEW FILE)

**Routes:**
- `GET /api/v1/songs` - Public, get all active songs (uses `getSongs`)
- `POST /api/v1/songs/upload` - Protected + SuperAdmin only, upload song (uses `uploadSong`)
- `DELETE /api/v1/songs/:id` - Protected + SuperAdmin only, delete song (uses `deleteSongById`)
- `GET /api/v1/songs/:id` - Optional, get song by ID

**Middleware:**
- Use `authMiddleware` from `../middleware/authMiddleware` for protected routes
- Use `superAdminOnly` middleware (check if exists, or create similar to other admin routes)
- Use multer for file upload: `upload.single('song')` with audio file filter

**Multer Configuration:**
- Create multer instance in route file (similar to `postRoutes.js`)
- Limits: `fileSize: 10 * 1024 * 1024` (10MB)
- File filter: Accept only audio MIME types

### Step 1.6: Update Post Model
**File:** `backend/src/models/Post.js`

**Add to `postSchema` (after existing fields, before timestamps):**
```javascript
song: {
  songId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
    required: false
  },
  startTime: {
    type: Number, // Start time in seconds (for trimming, default 0)
    default: 0
  },
  volume: {
    type: Number, // Volume level 0-1 (default 0.5)
    default: 0.5,
    min: 0,
    max: 1
  }
}
```

**Important:** Make `song` field optional - existing posts without songs should work fine.

### Step 1.7: Update Post Controller - Create Post
**File:** `backend/src/controllers/postController.js`

**In `createPost` function (around line 446):**

1. Extract song data from `req.body`:
   ```javascript
   const { songId, songStartTime, songVolume } = req.body;
   ```

2. When creating Post object (around line 507), add:
   ```javascript
   song: songId ? {
     songId: songId,
     startTime: parseFloat(songStartTime) || 0,
     volume: parseFloat(songVolume) || 0.5
   } : undefined
   ```

3. After saving post (after line 525), increment song usage count:
   ```javascript
   // Increment song usage count if song is attached
   if (songId) {
     const Song = require('../models/Song');
     await Song.findByIdAndUpdate(songId, { $inc: { usageCount: 1 } }).catch(err => 
       logger.error('Error incrementing song usage count:', err)
     );
   }
   ```

**Important:** 
- Don't change any existing logic
- Song is optional - if not provided, post works as before
- Wrap song operations in try-catch to not break post creation if song fails

### Step 1.8: Update Post Controller - Create Short
**File:** `backend/src/controllers/postController.js`

**In `createShort` function (around line 1604):**

1. Extract song data (same as createPost):
   ```javascript
   const { songId, songStartTime, songVolume } = req.body;
   ```

2. When creating Post object (around line 1685), add song field (same as createPost)

3. After saving short (after line 1702), increment song usage count (same as createPost)

### Step 1.9: Update Post Validation
**File:** `backend/src/routes/postRoutes.js`

**In `createPostValidation` array (around line 78), add optional validation:**
```javascript
body('songId')
  .optional()
  .isMongoId()
  .withMessage('Invalid song ID'),
body('songStartTime')
  .optional()
  .isFloat({ min: 0 })
  .withMessage('Song start time must be a positive number'),
body('songVolume')
  .optional()
  .isFloat({ min: 0, max: 1 })
  .withMessage('Song volume must be between 0 and 1')
```

**For shorts route:** Add same validation to shorts validation (check `shortsRoutes.js`)

### Step 1.10: Register Song Routes
**File:** `backend/src/app.js`

**Add after other route imports (around line 23):**
```javascript
const songRoutes = require('./routes/songRoutes');
```

**Add after other route registrations (around line 200+):**
```javascript
app.use('/api/v1/songs', songRoutes);
```

### Step 1.11: Update Post Response to Include Song
**File:** `backend/src/controllers/postController.js`

**In `getPosts`, `getPostById`, `getUserPosts` functions:**

When populating post data, also populate song details:
```javascript
.populate('song.songId', 'title artist duration s3Url thumbnailUrl')
```

**Important:** Only populate if song exists - use conditional populate or handle in aggregation pipeline.

---

## PHASE 2: FRONTEND IMPLEMENTATION

### Step 2.1: Create Song Service
**File:** `frontend/services/songs.ts` (NEW FILE)

**Interfaces:**
```typescript
export interface Song {
  _id: string;
  title: string;
  artist: string;
  duration: number;
  s3Url: string;
  thumbnailUrl?: string;
  genre: string;
}

export interface SongSelection {
  songId: string;
  startTime?: number;
  volume?: number;
}
```

**Functions:**

1. `getSongs(search?: string, genre?: string, page?: number, limit?: number): Promise<Song[]>`
   - Fetch from `/api/v1/songs`
   - Handle query params
   - Return songs array
   - Use `getApiUrl()` from `./api`
   - Use logger from `../utils/logger`

2. `getSongById(id: string): Promise<Song>`
   - Fetch single song by ID
   - Return song object

**Error Handling:**
- Use try-catch
- Log errors with logger
- Throw errors for caller to handle

### Step 2.2: Create Song Selector Component
**File:** `frontend/components/SongSelector.tsx` (NEW FILE)

**Component Features:**
- Search input for filtering songs
- FlatList displaying songs (title, artist, duration)
- Select/deselect song functionality
- Visual indicator for selected song
- Loading state
- Empty state message
- "Remove Song" button when song is selected

**Props:**
```typescript
interface SongSelectorProps {
  onSelect: (song: Song | null) => void;
  selectedSong: Song | null;
  visible: boolean;
  onClose: () => void;
}
```

**UI Requirements:**
- Modal or bottom sheet style
- Search bar at top
- Song list with title and artist
- Selected song highlighted
- Close button
- Use existing theme/colors from `constants/theme.ts`

**State Management:**
- `songs: Song[]` - List of songs
- `searchQuery: string` - Search input
- `loading: boolean` - Loading state

**Functions:**
- `loadSongs()` - Fetch songs from API
- `handleSearch(query: string)` - Filter songs
- `handleSelect(song: Song)` - Call onSelect callback
- `handleRemove()` - Call onSelect(null)

### Step 2.3: Update Post Upload Screen
**File:** `frontend/app/(tabs)/post.tsx`

**Add State:**
```typescript
const [selectedSong, setSelectedSong] = useState<Song | null>(null);
const [showSongSelector, setShowSongSelector] = useState(false);
```

**Import:**
```typescript
import { SongSelector } from '../../components/SongSelector';
import { Song } from '../../services/songs';
```

**In UI (before submit button):**
- Add "Add Music" button/icon
- Show selected song info if song is selected
- Open SongSelector modal when button clicked

**In `handlePost` function:**
- Add song data to `createPostWithProgress` call:
  ```typescript
  songId: selectedSong?._id,
  songStartTime: 0, // Can be made configurable later
  songVolume: 0.5, // Can be made configurable later
  ```

**In `handleShort` function:**
- Add same song data to `createShort` call

**Modal Implementation:**
```typescript
{showSongSelector && (
  <Modal 
    visible={showSongSelector} 
    onRequestClose={() => setShowSongSelector(false)}
    animationType="slide"
  >
    <SongSelector
      onSelect={(song) => {
        setSelectedSong(song);
        setShowSongSelector(false);
      }}
      selectedSong={selectedSong}
      visible={showSongSelector}
      onClose={() => setShowSongSelector(false)}
    />
  </Modal>
)}
```

**Reset on Success:**
- In success handler, reset: `setSelectedSong(null)`

### Step 2.4: Update Post Type Definition
**File:** `frontend/types/post.ts`

**Add to PostType interface:**
```typescript
song?: {
  songId?: {
    _id: string;
    title: string;
    artist: string;
    duration: number;
    s3Url: string;
    thumbnailUrl?: string;
  };
  startTime?: number;
  volume?: number;
};
```

### Step 2.5: Update Post Service
**File:** `frontend/services/posts.ts`

**In `createPost` function:**
- Add optional parameters: `songId?: string, songStartTime?: number, songVolume?: number`
- Add to FormData if provided:
  ```typescript
  if (songId) {
    formData.append('songId', songId);
    if (songStartTime !== undefined) formData.append('songStartTime', songStartTime.toString());
    if (songVolume !== undefined) formData.append('songVolume', songVolume.toString());
  }
  ```

**In `createShort` function:**
- Add same song parameters and FormData logic

---

## PHASE 3: SUPERADMIN IMPLEMENTATION

### Step 3.1: Create Song Service
**File:** `superAdmin/src/services/songService.js` (NEW FILE)

**Functions:**

1. `getSongs(search, genre, page, limit)`
   - Fetch from `/api/v1/songs`
   - Include auth token from localStorage/session
   - Return songs array

2. `uploadSong(formData)`
   - POST to `/api/v1/songs/upload`
   - Include auth token
   - FormData with: `song` (file), `title`, `artist`, `genre`, `duration`
   - Return response

3. `deleteSong(id)`
   - DELETE to `/api/v1/songs/${id}`
   - Include auth token
   - Return response

**Error Handling:**
- Handle network errors
- Handle API errors
- Return appropriate error messages

### Step 3.2: Create Songs Management Page
**File:** `superAdmin/src/pages/Songs.jsx` (NEW FILE)

**Page Features:**

1. Upload Section:
   - File input (accept audio files)
   - Title input
   - Artist input
   - Genre dropdown/input
   - Duration input (optional, can be extracted from file)
   - Upload button
   - Loading state during upload
   - Success/error messages

2. Songs List Section:
   - Table/grid showing all songs
   - Columns: Title, Artist, Genre, Duration, Usage Count, Upload Date, Actions
   - Search/filter functionality
   - Pagination
   - Delete button for each song
   - Status indicator (Active/Inactive)

**State Management:**
- `songs: []` - List of songs
- `loading: boolean`
- `uploading: boolean`
- `formData: {}` - Upload form state
- `searchQuery: string`
- `selectedGenre: string`

**Functions:**
- `loadSongs()` - Fetch songs
- `handleUpload(e)` - Handle form submission
- `handleDelete(id)` - Delete song with confirmation
- `handleSearch(query)` - Filter songs

**UI Requirements:**
- Use existing SuperAdmin styling/theme
- Responsive design
- Use same component patterns as other admin pages
- Add confirmation dialog for delete

### Step 3.3: Add Songs Route
**File:** `superAdmin/src/App.jsx`

**Import:**
```javascript
import Songs from './pages/Songs';
```

**Add Route:**
```javascript
<Route path="/songs" element={<Songs />} />
```

### Step 3.4: Add Songs to Sidebar
**File:** `superAdmin/src/components/Sidebar.jsx`

**Import icon:**
```javascript
import { Music } from 'lucide-react';
```

**Add to navItems array:**
```javascript
{ name: 'Songs', href: '/songs', icon: Music, permission: 'canManageContent' }
```

---

## PHASE 4: ENVIRONMENT VARIABLES

### Backend `.env` File
Add these variables:
```env
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
AWS_CLOUDFRONT_URL=https://your-cloudfront-url.cloudfront.net
```

**Note:** CloudFront URL is optional but recommended for better performance.

---

## PHASE 5: TESTING CHECKLIST

### Backend Tests:
- [ ] Song upload works (SuperAdmin)
- [ ] Song list endpoint returns active songs
- [ ] Song search works
- [ ] Post creation with song works
- [ ] Post creation without song still works (backward compatibility)
- [ ] Short creation with song works
- [ ] Song usage count increments correctly
- [ ] Song deletion works
- [ ] Post response includes song data when present

### Frontend Tests:
- [ ] Song selector opens/closes
- [ ] Song search works
- [ ] Song selection works
- [ ] Post upload with song works
- [ ] Post upload without song still works
- [ ] Selected song displays correctly
- [ ] Song can be removed before upload

### SuperAdmin Tests:
- [ ] Songs page loads
- [ ] Song upload works
- [ ] Songs list displays correctly
- [ ] Song deletion works
- [ ] Search/filter works

---

## CRITICAL REQUIREMENTS

1. **No Breaking Changes**: All existing functionality must work exactly as before
2. **Backward Compatibility**: Posts without songs must work perfectly
3. **Error Handling**: Song operations should not break post creation
4. **Optional Fields**: Song is always optional in all endpoints
5. **Code Style**: Follow existing code patterns and conventions
6. **Error Messages**: Use existing error code system
7. **Logging**: Use existing logger utility
8. **Validation**: Follow existing validation patterns

---

## FILE STRUCTURE SUMMARY

**New Files:**
- `backend/src/config/s3.js`
- `backend/src/models/Song.js`
- `backend/src/controllers/songController.js`
- `backend/src/routes/songRoutes.js`
- `frontend/services/songs.ts`
- `frontend/components/SongSelector.tsx`
- `superAdmin/src/services/songService.js`
- `superAdmin/src/pages/Songs.jsx`

**Modified Files:**
- `backend/src/models/Post.js` (add song field)
- `backend/src/controllers/postController.js` (add song handling in createPost/createShort)
- `backend/src/routes/postRoutes.js` (add song validation)
- `backend/src/app.js` (register song routes)
- `frontend/app/(tabs)/post.tsx` (add song selector UI)
- `frontend/services/posts.ts` (add song parameters)
- `frontend/types/post.ts` (add song type)
- `superAdmin/src/App.jsx` (add songs route)
- `superAdmin/src/components/Sidebar.jsx` (add songs menu item)

---

## IMPLEMENTATION ORDER

1. **Backend**: S3 config → Song model → Song controller → Song routes → Post model update → Post controller update → Register routes
2. **Frontend**: Song service → Song selector component → Post screen integration → Type updates
3. **SuperAdmin**: Song service → Songs page → Route registration → Sidebar update
4. **Testing**: Test each phase before moving to next

---

## ADDITIONAL NOTES

- This plan ensures zero breaking changes to existing functionality
- All song-related features are optional and additive
- Follow existing code patterns, error handling, and validation approaches
- Use existing utilities (logger, error codes, etc.) throughout
- Maintain consistency with current architecture and conventions


# Locale Menu - Product Specification

## 1. Overview

The Locale menu provides users with a curated directory of featured travel destinations (locales) managed by administrators. Users can browse, search, filter, and bookmark locales to discover new places to visit and plan their trips. The menu serves as both a discovery tool and a reference guide for travel planning.

### User Personas & Goals

- **Travel Planners**: Discover new destinations, research locations, save places for future trips
- **Explorers**: Browse featured locales, learn about different spots, get travel inspiration
- **Active Travelers**: Bookmark favorite locales, track visited places, share locations with others

### Frontend-Backend-superAdmin Collaboration

- **Frontend** (`frontend/app/(tabs)/locale.tsx`): Displays locale cards, handles search/filter UI, manages saved locales in AsyncStorage
- **Backend** (`backend/src/controllers/localeController.js`, `backend/src/routes/localeRoutes.js`): Serves locale data, handles search/filter queries, manages locale CRUD (SuperAdmin only)
- **superAdmin** (`superAdmin/src/pages/Locales.jsx`): Creates, edits, deletes locales, manages display order, activates/deactivates locales

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `frontend/app/(tabs)/locale.tsx`

**Purpose**: Browse and search featured locales with filtering options

**Entry Points**:
- Tab navigation from bottom bar (Location icon)
- Deep link: `/(tabs)/locale`
- Navigation from other screens referencing locales

**Exit Points**:
- Tap on locale card → Navigate to `app/tripscore/countries/[country]/locations/[location].tsx` (locale detail view)
- Tap search icon → Opens search bar (inline)
- Tap filter icon → Opens filter modal

**Tabs**:
- **LOCALE Tab**: Shows admin-managed featured locales
- **SAVED Tab**: Shows user's bookmarked locales (stored in AsyncStorage)

**Modals**:
- Filter Modal: Country, State/Province, Spot Type, Search Radius filters

### Locale Detail Screen

**File**: `frontend/app/tripscore/countries/[country]/locations/[location].tsx`

**Purpose**: Display detailed information about a specific locale

**Entry Points**:
- Tap on locale card from Locale tab
- Deep link with country and location params
- Navigation from TripScore flows

**Exit Points**:
- Back button → Returns to previous screen
- Bookmark button → Toggles saved status (stays on screen)

---

## 3. Detailed Features & User Flows

### 3.1 Browse Featured Locales

**Feature Name**: Locale Discovery Feed

**Business Description**: Users see a scrollable list of featured locales (admin-managed destinations) with images, names, and country codes. Locales are sorted by `displayOrder` (ascending) then by `createdAt` (descending).

**Preconditions**:
- No authentication required (public access)
- Network connectivity (with cached fallback)

**Step-by-Step Flow**:
1. User opens Locale tab
2. App fetches locales: `GET /api/v1/locales?page=1&limit=100&includeInactive=false`
3. Display locales in ScrollView with wide cards (full width, 200px height)
4. Each card shows: image (or gradient placeholder), locale name, country code
5. User scrolls to see more locales
6. Pull-to-refresh reloads locales

**Validations**:
- Only active locales shown (`isActive: true`)
- Sorted by `displayOrder: 1, createdAt: -1`
- Max 100 locales per page (backend limit)

**Error States**:
- Network error: Show error message, allow retry
- Empty state: Show "No Locales Found" with message based on active filters

**Success States**:
- Locales display in cards
- Pull-to-refresh updates list
- Smooth scrolling experience

---

### 3.2 Search Locales

**Feature Name**: Locale Search

**Business Description**: Users can search locales by name, description, or country code using a search bar.

**Preconditions**: User is on Locale tab

**Step-by-Step Flow**:
1. User types in search bar
2. Search query debounced (500ms delay)
3. If query has spaces, send to backend: `GET /api/v1/locales?search={query}`
4. Backend performs regex search on: `name`, `country`, `stateProvince`
5. If query is single word, apply client-side filter on already loaded locales
6. Update filtered locales list
7. Show filtered results

**Validations**:
- Search query: Trimmed, case-insensitive
- Backend search: Regex with `$options: 'i'` (case-insensitive)

**Error States**:
- Search API error: Fall back to client-side filtering
- No results: Show "No Locales Found" with suggestion to adjust filters

**Success States**:
- Filtered locales display immediately
- Search icon remains visible
- Results update as user types (debounced)

---

### 3.3 Filter Locales

**Feature Name**: Advanced Filtering

**Business Description**: Users can filter locales by country, state/province, spot type, and search radius using a modal filter interface.

**Preconditions**: User is on Locale tab

**Step-by-Step Flow**:
1. User taps filter icon (options-outline)
2. Filter modal opens (slide animation)
3. User selects Country from dropdown
4. States/Provinces load for selected country (if available)
5. User selects State/Province (optional)
6. User toggles Spot Types (checkboxes): Historical, Cultural, Natural, Adventure, Religious/spiritual, Wildlife, Beach
7. User enters Search Radius in km (optional)
8. User taps "Search" button
9. Modal closes, locales reload with filters applied
10. Backend query: `GET /api/v1/locales?countryCode={code}&spotType={type}&page=1&limit=100`
11. Client-side filters applied for multiple spot types and radius

**Validations**:
- Country: Required for state selection
- State: Only enabled if country selected
- Spot Type: Multiple selection allowed (client-side filtering)
- Search Radius: Numeric input, optional

**Error States**:
- Country/State load error: Show "No states/provinces available"
- Filter API error: Show error message, allow retry

**Success States**:
- Filtered locales display
- Active filters shown in UI (inferred)
- Reset button clears all filters

---

### 3.4 Bookmark Locales

**Feature Name**: Save Locales

**Business Description**: Users can bookmark favorite locales to access them later in the "Saved" tab.

**Preconditions**: User is on Locale tab or detail screen

**Step-by-Step Flow**:
1. User taps bookmark icon on locale card (or detail screen)
2. Check if locale already saved (check AsyncStorage `savedLocales` array)
3. If not saved: Add locale to `savedLocales` array in AsyncStorage
4. If saved: Remove from array
5. Update local state `isSaved`
6. Emit event: `savedEvents.emitChanged()` (syncs across screens)
7. Show alert: "Saved" or "Removed from saved"

**Validations**:
- Locale must have valid `_id`
- Check for duplicates before saving

**Error States**:
- AsyncStorage error: Show "Failed to save locale"
- Duplicate save attempt: Show "Already Saved" alert

**Success States**:
- Bookmark icon updates (filled/unfilled)
- Alert confirms action
- Saved tab updates automatically

---

### 3.5 View Locale Details

**Feature Name**: Locale Detail View

**Business Description**: Users can view detailed information about a locale including description, coordinates, spot types, and related posts.

**Preconditions**: User taps on locale card

**Step-by-Step Flow**:
1. Navigate to detail screen with params: `country`, `location`, `imageUrl`, `latitude`, `longitude`, `description`, `spotTypes`
2. Load locale data (if from admin locale, fetch from API: `GET /api/v1/locales/:id`)
3. Display locale image, name, description
4. Calculate distance from user's current location (if permissions granted)
5. Show spot types as badges
6. Display related posts (if available, inferred from TripScore integration)
7. Show bookmark button (syncs with saved locales)

**Validations**:
- Coordinates must be valid (not 0,0)
- Distance calculation requires location permissions

**Error States**:
- Locale not found: Show error, navigate back
- Distance calculation error: Hide distance, show other info
- Image load error: Show gradient placeholder

**Success States**:
- Full locale details displayed
- Distance shown if available
- Bookmark status synced

---

## 4. Data Model & API Design

### 4.1 Data Entities

**Locale Entity** (from `frontend/services/locale.ts` and `backend/src/models/Locale.js`):
```typescript
interface Locale {
  _id: string;
  name: string;
  country?: string;
  countryCode: string; // Uppercase, e.g., "GB", "US"
  stateProvince?: string;
  stateCode?: string;
  description?: string;
  imageUrl: string; // cloudinaryUrl or imageUrl (backward compatibility)
  spotTypes?: string[]; // Array of spot type strings
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  displayOrder?: number; // For sorting (lower = higher priority)
  createdAt: string;
  updatedAt: string;
}
```

**Spot Types** (hardcoded in frontend):
- 'Historical spots'
- 'Cultural spots'
- 'Natural spots'
- 'Adventure spots'
- 'Religious/spiritual spots'
- 'Wildlife spots'
- 'Beach spots'

### 4.2 API Endpoints

#### GET /api/v1/locales

**Purpose**: Fetch paginated list of active locales with optional search and filters

**Method**: GET

**Auth**: Public (no authentication required)

**Query Parameters**:
- `search` (string, optional): Search query (searches name, country, stateProvince)
- `countryCode` (string, optional): Filter by country code (e.g., "GB", "US")
- `spotType` (string, optional): Filter by single spot type (API supports one, frontend filters multiple client-side)
- `page` (number, default: 1): Page number
- `limit` (number, default: 50): Items per page (max 100)
- `includeInactive` (boolean, default: false): Include inactive locales (SuperAdmin only)

**Request Body**: None

**Response Structure**:
```json
{
  "success": true,
  "message": "Locales fetched successfully",
  "locales": [Locale[]],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "total": 250,
    "limit": 50
  }
}
```

**Backend Logic** (from `backend/src/controllers/localeController.js`):
- Filters: `isActive: true` (unless `includeInactive=true`)
- Search: Regex on `name`, `country`, `stateProvince` (case-insensitive)
- Country filter: Exact match on `countryCode` (uppercase)
- Spot type filter: Exact match on `spotTypes` array (single type)
- Sorting: `displayOrder: 1, createdAt: -1`
- Image URL: Returns `cloudinaryUrl` or `imageUrl` (backward compatibility)

---

#### GET /api/v1/locales/:id

**Purpose**: Get single locale by ID

**Method**: GET

**Auth**: Public

**Path Parameters**:
- `id` (string): Locale ID (MongoDB ObjectId)

**Response Structure**:
```json
{
  "success": true,
  "message": "Locale fetched successfully",
  "locale": Locale
}
```

**Backend Logic**:
- Finds locale by ID
- Returns all fields (except internal storage keys)
- Returns `imageUrl` (backward compatibility mapping)

---

#### POST /api/v1/locales/upload (SuperAdmin Only)

**Purpose**: Create new locale

**Method**: POST

**Auth**: Required (`verifySuperAdminToken`)

**Request Body**: `multipart/form-data`
- `image` (file, required): Image file (JPEG, PNG, WebP, GIF)
- `name` (string, required, 1-200 chars): Locale name
- `country` (string, required, 1-200 chars): Country name
- `countryCode` (string, required, 1-10 chars): ISO country code
- `stateProvince` (string, optional, max 200 chars): State/province name
- `stateCode` (string, optional, max 50 chars): State/province code
- `description` (string, optional, max 1000 chars): Locale description
- `displayOrder` (number, optional, >= 0): Display order (lower = higher priority)

**Validations**:
- Image: Required, must be image type, no size limit (unlimited uploads)
- Name, country, countryCode: Required
- Display order: Must be unique among active locales (validated on backend)

**Response Structure**:
```json
{
  "success": true,
  "message": "Locale uploaded successfully",
  "locale": Locale
}
```

**Backend Logic**:
- Uploads image to Sevalla Object Storage (or Cloudinary fallback)
- Validates display order uniqueness
- Creates locale with `isActive: true`
- Stores `createdBy` as SuperAdmin ID

---

#### PUT /api/v1/locales/:id (SuperAdmin Only)

**Purpose**: Update locale details (without image)

**Method**: PUT

**Auth**: Required

**Path Parameters**:
- `id` (string): Locale ID

**Request Body**: `application/json`
- All fields optional (same as upload, except no image)

**Response Structure**:
```json
{
  "success": true,
  "message": "Locale updated successfully",
  "locale": Locale
}
```

---

#### PATCH /api/v1/locales/:id/toggle (SuperAdmin Only)

**Purpose**: Toggle locale active/inactive status

**Method**: PATCH

**Auth**: Required

**Request Body**:
```json
{
  "isActive": true
}
```

**Response Structure**:
```json
{
  "success": true,
  "message": "Locale status toggled successfully",
  "locale": Locale
}
```

**Impact**: Inactive locales are excluded from public API responses

---

#### DELETE /api/v1/locales/:id (SuperAdmin Only)

**Purpose**: Delete locale permanently

**Method**: DELETE

**Auth**: Required

**Path Parameters**:
- `id` (string): Locale ID

**Response Structure**:
```json
{
  "success": true,
  "message": "Locale deleted successfully"
}
```

**Backend Logic**:
- Deletes image from storage (Sevalla or Cloudinary)
- Removes locale from database
- Cascade effects: None (locales are independent)

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Local State

**Component State** (`frontend/app/(tabs)/locale.tsx`):
- `savedLocales`: Array of saved Locale objects (from AsyncStorage)
- `adminLocales`: Array of all admin-managed locales
- `filteredLocales`: Array of locales after applying filters
- `loadingLocales`: Boolean for initial load
- `loading`: Boolean for general loading state
- `refreshing`: Boolean for pull-to-refresh
- `activeTab`: 'locale' | 'saved'
- `searchQuery`: String for search input
- `showFilterModal`: Boolean for filter modal visibility
- `showCountryDropdown`: Boolean for country dropdown
- `showStateDropdown`: Boolean for state dropdown
- `countries`: Array of Country objects
- `states`: Array of State objects
- `loadingCountries`: Boolean
- `loadingStates`: Boolean
- `filters`: FilterState object (country, countryCode, stateProvince, stateCode, spotTypes, searchRadius)

**Filter State** (managed by `useReducer`):
```typescript
interface FilterState {
  country: string;
  countryCode: string;
  stateProvince: string;
  stateCode: string;
  spotTypes: string[];
  searchRadius: string;
}
```

### 5.2 Global State / Context

**ThemeContext**: Provides theme for consistent styling

**savedEvents** (`frontend/utils/savedEvents.ts`):
- Event emitter for syncing bookmark status across screens
- Emits when locales are saved/unsaved
- Listened to by detail screen and main screen

### 5.3 Custom Hooks

**useScrollToHideNav**: Hides/shows tab bar on scroll

### 5.4 Caching Strategy

**AsyncStorage Cache**:
- Key: `'savedLocales'`
- Structure: `Locale[]` (array of full locale objects)
- Updated: On save/unsave actions
- Synced: Via `savedEvents` emitter

**In-Memory Cache**:
- Countries: Cached in `frontend/services/location.ts` (`countriesCache`)
- States: Cached per country (`statesCache[countryCode]`)
- No expiration (static data)

### 5.5 Debouncing & Throttling

**Search Input**:
- Debounced: 500ms delay before triggering API call
- Uses `setTimeout` with cleanup

**Filter Application**:
- Applied on "Search" button click (not real-time)
- Client-side filtering for multiple spot types (immediate)

### 5.6 Side Effects

**useEffect Dependencies**:
- `filters` and `searchQuery` changes trigger locale reload
- `activeTab` change reloads saved locales
- `savedEvents` listener updates bookmark status

**Focus Effect**:
- `useFocusEffect` reloads saved locales when screen comes into focus
- Ensures bookmark status is current

---

## 6. Backend Logic & Rules

### 6.1 Locale Retrieval Rules

**Filtering**:
- Default: Only `isActive: true` locales
- SuperAdmin: Can include inactive with `includeInactive=true`
- Search: Case-insensitive regex on name, country, stateProvince
- Country: Exact match on `countryCode` (uppercase)
- Spot Type: Single type filter (API limitation, frontend handles multiple)

**Sorting**:
- Primary: `displayOrder: 1` (ascending, lower = higher priority)
- Secondary: `createdAt: -1` (descending, newest first)
- If `displayOrder` not set, defaults to 0

**Pagination**:
- Default limit: 50
- Max limit: 100 (inferred from code)
- Offset-based: `skip = (page - 1) * limit`

### 6.2 Locale Creation Rules

**Required Fields**:
- `name`: 1-200 characters, trimmed
- `country`: 1-200 characters, trimmed
- `countryCode`: 1-10 characters, uppercase, trimmed
- `image`: Image file (JPEG, PNG, WebP, GIF)

**Optional Fields**:
- `stateProvince`: Max 200 characters
- `stateCode`: Max 50 characters
- `description`: Max 1000 characters
- `displayOrder`: >= 0, must be unique among active locales

**Image Upload**:
- Storage: Sevalla Object Storage (primary) or Cloudinary (fallback)
- Key format: `locale/{filename}.{extension}`
- No file size limit (unlimited uploads)
- Returns URL stored in `cloudinaryUrl` field

**Display Order Validation**:
- If `displayOrder > 0`, checks for conflicts with other active locales
- Returns error if order already assigned: "Display order X is already assigned to another locale"

### 6.3 Locale Update Rules

**Fields**:
- All fields optional (partial update)
- Same validations as creation
- Image not updated via PUT (separate endpoint if needed, inferred)

**Display Order**:
- Can be updated to any value >= 0
- Must be unique among active locales

### 6.4 Locale Deletion Rules

**Cascade Effects**:
- Deletes image from storage (Sevalla or Cloudinary)
- No cascade to posts or TripVisits (locales are reference data)
- Permanent deletion (no soft delete)

### 6.5 Background Jobs

**None**: Locale operations are synchronous

---

## 7. superAdmin Dependencies

### 7.1 Locale Management

**File**: `superAdmin/src/pages/Locales.jsx`

**Features**:
- **View All Locales**: Table view with pagination, search, sorting
- **Create Locale**: Upload form with image, name, country, description, display order
- **Edit Locale**: Update locale details (name, country, description, display order)
- **Delete Locale**: Permanent deletion with confirmation
- **Toggle Status**: Activate/deactivate locales (affects visibility in app)
- **Preview Locale**: View locale as it appears in app
- **Bulk Operations**: Select multiple locales for batch actions (inferred)

**Sorting Options**:
- By name, country, display order, created date
- Ascending/descending toggle

**Filtering**:
- By country code
- By active/inactive status
- Search by name

**Impact on Frontend**:
- Active locales (`isActive: true`) appear in app
- Inactive locales hidden from public API
- Display order controls sorting in app
- Deleted locales removed from app

### 7.2 Analytics

**Inferred**: Locale views, bookmark counts, popular locales (not explicitly visible in code)

---

## 8. Permissions, Privacy & Security

### 8.1 Access Rules

**Public Access**:
- Anyone can view locales (no authentication required)
- Anyone can search and filter locales
- Anyone can bookmark locales (stored locally in AsyncStorage)

**SuperAdmin Access**:
- Create, edit, delete locales: `verifySuperAdminToken` middleware
- View inactive locales: `includeInactive=true` query param (only works with SuperAdmin token, inferred)

### 8.2 Privacy Rules

**Locale Data**:
- All locale data is public (no private locales)
- No user-specific locale visibility rules
- Bookmarked locales stored locally (not synced to server)

### 8.3 Security Checks

**Auth Middleware**:
- `verifySuperAdminToken`: Required for CRUD operations
- Validates SuperAdmin JWT token

**Input Sanitization**:
- Text fields trimmed
- Country code uppercased
- Display order validated as integer >= 0
- Image file type validated (JPEG, PNG, WebP, GIF only)

**Rate Limiting**:
- Inferred from error handling (429 errors possible)
- No explicit limits visible in code

**XSS Protection**:
- Input sanitization on text fields
- Output encoding via React (automatic)

---

## 9. Analytics & Events

### 9.1 Tracked Events

**Screen View** (inferred):
- `trackScreenView('locale')` - Fired on Locale screen mount

**Engagement** (inferred):
- Locale view: When user opens locale detail
- Bookmark action: When user saves/unsaves locale
- Search: When user searches locales
- Filter usage: When user applies filters

### 9.2 Metrics & KPIs

**User Metrics**:
- Locales viewed per session
- Search queries (popular searches)
- Filter usage (which filters are most used)
- Bookmark rate (locales saved / locales viewed)

**Content Metrics**:
- Most viewed locales
- Most bookmarked locales
- Locales by country (distribution)
- Locales by spot type (distribution)

**Business Metrics**:
- Total locales count
- Active vs inactive locales
- Locale creation rate (SuperAdmin activity)

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

**Pagination**:
- Default limit: 50 locales per page
- Max limit: 100 locales per page
- No explicit max pages

**Field Lengths**:
- Name: 1-200 characters
- Country: 1-200 characters
- Country Code: 1-10 characters
- State/Province: Max 200 characters
- State Code: Max 50 characters
- Description: Max 1000 characters
- Display Order: >= 0 (integer)

**Image**:
- No file size limit (unlimited uploads)
- Formats: JPEG, PNG, WebP, GIF only

### 10.2 Error Handling

**Network Errors**:
- Show error message, allow retry
- Fall back to cached data if available (saved locales)

**API Errors**:
- 404 Locale not found: Show error, navigate back
- 400 Validation error: Show validation message
- 500 Server error: Show generic error message

**Partial Data**:
- Missing image: Show gradient placeholder
- Missing coordinates: Hide distance calculation
- Missing description: Show default description or empty

### 10.3 Known Constraints

**Spot Type Filtering**:
- Backend API supports single spot type filter only
- Frontend applies multiple spot types client-side (filters already loaded locales)
- If user selects multiple spot types, must load all locales first, then filter

**Search Behavior**:
- Single-word queries: Client-side filtering (faster)
- Multi-word queries: Backend API search (more accurate)
- Search doesn't search description field (only name, country, stateProvince)

**Display Order**:
- Must be manually managed by SuperAdmin
- No automatic ordering based on popularity or views
- Conflicts must be resolved manually

**Saved Locales**:
- Stored locally only (not synced to server)
- Lost if user clears app data
- No cloud backup

**Country/State Data**:
- Uses static data (not from API)
- Limited to predefined countries/states
- No dynamic loading from external API

**TODO/FIXME** (inferred):
- No pagination on saved locales tab (all saved locales loaded at once)
- No search on saved locales tab
- Distance calculation requires location permissions (may fail silently)

---

## 11. Future Enhancements (Optional Backlog)

### Now (High Priority)

1. **Cloud Sync for Saved Locales**: Sync bookmarked locales to server for cross-device access
2. **Improved Search**: Include description field in search, add fuzzy matching
3. **Pagination for Saved Tab**: Implement pagination for users with many saved locales
4. **Location Permissions UX**: Better handling of location permission requests for distance calculation

### Next (Medium Priority)

1. **Dynamic Country/State Data**: Load from external API or backend endpoint
2. **Multiple Spot Type API Support**: Backend support for filtering by multiple spot types
3. **Locale Recommendations**: Suggest locales based on user's travel history or interests
4. **Related Locales**: Show similar locales when viewing a locale detail

### Later (Low Priority)

1. **Locale Reviews**: Allow users to rate and review locales
2. **Locale Photos**: Multiple photos per locale (gallery view)
3. **Locale Events**: Show upcoming events or best times to visit
4. **Locale Map Integration**: Interactive map showing all locales in a region

---

**Document Version**: 1.0  
**Last Updated**: Based on codebase analysis as of current date  
**Inferred Sections**: Marked with "inferred from code" where behavior is implied but not explicitly documented


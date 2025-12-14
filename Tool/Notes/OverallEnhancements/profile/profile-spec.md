# Profile Menu - Product Specification

## 1. Overview

The Profile menu displays user profiles, including their posts, shorts, saved content, TripScore, followers/following, and settings. It serves as the central hub for viewing and managing user identity, content, and account preferences. The menu includes comprehensive settings for privacy, notifications, and account management.

### User Personas & Goals

- **Profile Viewers**: Browse other users' profiles, view their content, follow/unfollow
- **Profile Owners**: Manage their own profile, edit bio, view stats, manage settings
- **Privacy-Conscious Users**: Configure privacy settings, control who sees their content
- **Content Curators**: Save posts/shorts, organize saved content

### Frontend-Backend-superAdmin Collaboration

- **Frontend** (`frontend/app/(tabs)/profile.tsx`): Profile display, tabs (posts/shorts/saved), edit profile modal, settings navigation
- **Backend** (`backend/src/controllers/profileController.js`, `backend/src/controllers/settingsController.js`): Serves profile data, handles follow/unfollow, TripScore calculation, settings CRUD
- **superAdmin**: User management, account moderation (activate/deactivate/delete)

---

## 2. Screen & Navigation Map (Frontend)

### Main Profile Screen

**File**: `frontend/app/(tabs)/profile.tsx`

**Purpose**: Display user profile with posts, shorts, saved content, and TripScore

**Entry Points**:
- Tab navigation from bottom bar (Profile icon)
- Deep link: `/(tabs)/profile` or `/profile/:id`
- Navigation from other screens (tap on user avatar/name)
- Navigation from search results

**Exit Points**:
- Tap on post/short → Navigate to post detail or shorts feed
- Tap Edit Profile → Opens EditProfile modal
- Tap Settings → Navigate to settings screen (inferred)
- Tap Follow/Unfollow → Updates follow status (stays on screen)
- Tab navigation → Switch to other tabs

**Tabs**:
- **POSTS**: User's photo posts (grid view)
- **SHORTS**: User's short videos (grid view)
- **SAVED**: User's saved posts and shorts (grid view)

**Modals**:
- EditProfile: Edit bio, profile picture, cover photo
- Settings: Privacy, notifications, account settings (inferred, separate screen)

---

## 3. Detailed Features & User Flows

### 3.1 View Profile

**Feature Name**: Profile Display

**Business Description**: Displays user profile information including avatar, bio, stats (posts, followers, following), TripScore, and content tabs.

**Preconditions**:
- User ID available (from params or current user)
- Network connectivity

**Step-by-Step Flow**:
1. Load profile data: `GET /api/v1/profile/:id`
2. Backend determines visibility based on privacy settings:
   - Own profile: Full access
   - Public profile: Full access
   - Followers only: Limited if not following
   - Private: Limited if not following
3. Display profile header:
   - Profile picture (circular, 100px)
   - Cover photo (optional, inferred)
   - Full name
   - Bio (if available)
   - Stats: Posts count, Followers count, Following count
   - TripScore card (if available)
   - Follow/Unfollow button (if not own profile)
   - Edit Profile button (if own profile)
4. Load user's posts: `GET /api/v1/posts/user/:id`
5. Load user's shorts: `GET /api/v1/shorts/user/:id`
6. Load saved content (if own profile): From AsyncStorage
7. Display content in tabs

**Privacy Rules** (from `backend/src/controllers/profileController.js`):
- **Public**: Anyone can view profile, posts, locations
- **Followers Only**: Only followers can see posts and locations
- **Private**: Only approved followers can see posts and locations
- **Own Profile**: Always full access

**Validations**:
- User ID must be valid MongoDB ObjectId
- Profile must exist

**Error States**:
- User not found: Show "User does not exist" error
- Network error: Show error message, allow retry
- Privacy restriction: Show limited profile view (name, avatar only)

**Success States**:
- Full profile displayed
- Content tabs populated
- TripScore shown (if available)
- Follow status shown

---

### 3.2 Edit Profile

**Feature Name**: Profile Editing

**Business Description**: Users can edit their profile picture, bio, and other profile information.

**Preconditions**:
- User is viewing their own profile
- User is authenticated

**Step-by-Step Flow**:
1. User taps "Edit Profile" button
2. `EditProfile` modal opens
3. User can:
   - Change profile picture: Tap avatar → Image picker → Select/capture photo
   - Change cover photo (if supported, inferred)
   - Edit bio: Text input, max length (inferred: 150-200 chars)
   - Edit full name: Text input, max 50 chars
4. User taps "Save"
5. Upload profile picture to storage (if changed)
6. Update profile: `PUT /api/v1/profile/:id`
7. On success: Close modal, refresh profile data
8. On error: Show error message

**Validations**:
- Full name: 2-50 characters
- Bio: Max length (inferred: 200 chars)
- Profile picture: Image file, no size limit (unlimited uploads)

**Error States**:
- Validation error: Show field-specific error
- Upload error: Show "Failed to upload image"
- Network error: Show "Failed to update profile"

**Success States**:
- Profile updated
- Modal closes
- Profile refreshes with new data
- Success toast shown

---

### 3.3 Follow/Unfollow

**Feature Name**: Follow Management

**Business Description**: Users can follow or unfollow other users. Follow requests may be required for private profiles.

**Preconditions**:
- User is viewing another user's profile
- User is authenticated

**Step-by-Step Flow - Public Profile**:
1. User taps "Follow" button
2. Call API: `POST /api/v1/profile/:id/follow`
3. Backend adds current user to target user's followers
4. Backend adds target user to current user's following
5. Update button to "Following"
6. Create notification for followed user
7. Increment followers/following counts

**Step-by-Step Flow - Private Profile**:
1. User taps "Follow" button
2. If `requireFollowApproval: true`:
   - Create follow request (status: 'pending')
   - Show "Request Sent" button
   - Send notification to profile owner
3. If `requireFollowApproval: false`:
   - Follow immediately (same as public)

**Step-by-Step Flow - Unfollow**:
1. User taps "Following" button
2. Call API: `POST /api/v1/profile/:id/follow` (toggle)
3. Backend removes current user from followers
4. Backend removes target user from following
5. Update button to "Follow"
6. Decrement counts

**Validations**:
- Cannot follow self
- Cannot follow if already following (handled by toggle)
- Follow request must be pending before approval

**Error States**:
- Already following: Button shows "Following" (no error)
- Network error: Show error, allow retry
- User not found: Show error

**Success States**:
- Button updates immediately (optimistic update)
- Counts update
- Notification sent (if applicable)

---

### 3.4 View TripScore

**Feature Name**: TripScore Display

**Business Description**: Displays user's TripScore (unique places visited) with breakdown by continent and country.

**Preconditions**:
- Profile has TripScore data (from TripVisits with trusted trust levels)
- User can view profile (privacy rules apply)

**Step-by-Step Flow**:
1. Load profile data (includes TripScore)
2. Display TripScore card:
   - Total Score: Number of unique places visited
   - Continents: Breakdown by continent (e.g., "Asia: 15")
   - Countries: Breakdown by country (e.g., "India: 8")
   - Areas: List of visited locations with dates
3. If `totalScore === 0`: Show hint message: "Start sharing your travels to build your TripScore!"
4. User can tap on continent/country to see details (inferred, navigates to TripScore detail screen)

**TripScore Calculation** (from `backend/src/controllers/profileController.js`):
- Only counts TripVisits with `trustLevel` in `['high', 'medium']`
- Deduplicates by location (same lat/lng within tolerance = 1 unique place)
- Counts unique places, not raw post count

**Validations**:
- TripScore always returned (even if 0)
- Data from TripVisit collection (not Post collection)

**Error States**:
- TripScore calculation error: Show 0 score, no breakdown
- No TripVisits: Show 0 score with hint message

**Success States**:
- TripScore card displays
- Breakdown shows accurate counts
- Areas list shows visited locations

---

### 3.5 View Content Tabs

**Feature Name**: Posts, Shorts, Saved Tabs

**Business Description**: Users can switch between viewing posts, shorts, and saved content in a tabbed interface.

**Preconditions**: Profile loaded

**Step-by-Step Flow - Posts Tab**:
1. User taps "POSTS" tab
2. Display user's photo posts in grid (3 columns)
3. Posts loaded from: `GET /api/v1/posts/user/:id`
4. Tap on post → Navigate to post detail or home feed

**Step-by-Step Flow - Shorts Tab**:
1. User taps "SHORTS" tab
2. Display user's shorts in grid (3 columns)
3. Shorts loaded from: `GET /api/v1/shorts/user/:id`
4. Tap on short → Navigate to shorts feed at that short

**Step-by-Step Flow - Saved Tab**:
1. User taps "SAVED" tab (only visible on own profile)
2. Load saved posts: From AsyncStorage `'savedPosts'`
3. Load saved shorts: From AsyncStorage `'savedShorts'`
4. Combine and display in grid
5. Tap on item → Navigate to post/short detail

**Validations**:
- Posts/Shorts: Only active, non-archived, non-hidden
- Saved: Only items that exist in AsyncStorage

**Error States**:
- No posts: Show empty state "No posts yet"
- No shorts: Show empty state "No shorts yet"
- No saved: Show empty state "No saved items"

**Success States**:
- Grid displays content
- Tab indicator shows active tab
- Smooth tab switching

---

### 3.6 Settings Management

**Feature Name**: Account Settings

**Business Description**: Users can configure privacy, notifications, and account preferences.

**Preconditions**: User is authenticated

**Step-by-Step Flow**:
1. User navigates to Settings (from profile menu, inferred)
2. Display settings categories:
   - **Privacy**: Profile visibility, show email, show location, allow messages, follow approval
   - **Notifications**: Push, email, likes, comments, follows, messages
   - **Account**: Language, theme, data usage
3. User toggles settings
4. Save: `PUT /api/v1/settings/:category` or `PUT /api/v1/settings`
5. On success: Show success message
6. On error: Show error message

**Privacy Settings** (from `backend/src/controllers/settingsController.js`):
- `profileVisibility`: 'public' | 'followers' | 'private'
- `showEmail`: Boolean
- `showLocation`: Boolean
- `allowMessages`: 'everyone' | 'followers' | 'none'
- `requireFollowApproval`: Boolean
- `allowFollowRequests`: Boolean

**Notification Settings**:
- `pushNotifications`: Boolean
- `emailNotifications`: Boolean
- `likesNotifications`: Boolean
- `commentsNotifications`: Boolean
- `followsNotifications`: Boolean
- `messagesNotifications`: Boolean

**Account Settings**:
- `language`: String (default: 'en')
- `theme`: 'light' | 'dark' | 'auto'
- `dataUsage`: 'low' | 'medium' | 'high'

**Validations**:
- All settings validated on backend
- Invalid values rejected with error

**Error States**:
- Validation error: Show specific field error
- Network error: Show "Failed to update settings"

**Success States**:
- Settings saved
- Success message shown
- Changes take effect immediately

---

### 3.7 Logout & Account Actions

**Feature Name**: Account Management

**Business Description**: Users can log out, delete account, or perform other account actions.

**Preconditions**: User is authenticated

**Step-by-Step Flow - Logout**:
1. User taps "Logout" (from settings or profile menu)
2. Show confirmation: "Are you sure you want to log out?"
3. If confirmed:
   - Clear AsyncStorage (auth token, user data)
   - Call `signOut()` service
   - Navigate to login screen
4. If cancelled: Stay on current screen

**Step-by-Step Flow - Delete Account** (inferred):
1. User taps "Delete Account" (from settings)
2. Show confirmation with warning
3. If confirmed:
   - Call delete account API
   - Clear all data
   - Navigate to login screen

**Validations**:
- Logout: No validation needed
- Delete Account: May require password confirmation (inferred)

**Error States**:
- Logout fails: Show error, stay logged in
- Delete fails: Show error, account not deleted

**Success States**:
- Logout: Redirected to login
- Delete: Account removed, redirected to login

---

## 4. Data Model & API Design

### 4.1 Data Entities

**User/Profile Entity** (from `backend/src/models/User.js`):
```typescript
interface User {
  _id: string;
  fullName: string; // 2-50 chars
  email: string; // Unique, required
  username: string; // Unique, max 20 chars
  profilePic: string; // URL
  coverPhoto?: string; // URL (inferred)
  bio?: string; // Max 200 chars (inferred)
  followers: ObjectId[]; // Array of user IDs
  following: ObjectId[]; // Array of user IDs
  followRequests?: FollowRequest[]; // Pending requests
  sentFollowRequests?: FollowRequest[]; // Sent requests
  totalLikes: number; // Default: 0
  isVerified: boolean; // Default: false
  settings: {
    privacy: {
      profileVisibility: 'public' | 'followers' | 'private';
      showEmail: boolean;
      showLocation: boolean;
      allowMessages: 'everyone' | 'followers' | 'none';
      requireFollowApproval: boolean;
      allowFollowRequests: boolean;
      shareActivity?: boolean; // Default: true
    };
    notifications: {
      pushNotifications: boolean;
      emailNotifications: boolean;
      likesNotifications: boolean;
      commentsNotifications: boolean;
      followsNotifications: boolean;
      messagesNotifications: boolean;
    };
    account: {
      language: string; // Default: 'en'
      theme: 'light' | 'dark' | 'auto'; // Default: 'auto'
      dataUsage: 'low' | 'medium' | 'high'; // Default: 'medium'
    };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**TripScore Entity** (computed from TripVisits):
```typescript
interface TripScore {
  totalScore: number; // Unique places visited
  continents: { [key: string]: number }; // e.g., { "Asia": 15, "Europe": 8 }
  countries: { [key: string]: number }; // e.g., { "India": 8, "UK": 5 }
  areas: Array<{
    address: string;
    continent: string;
    likes: number; // Post likes (not visit-specific)
    date: string; // Visit date
  }>;
}
```

### 4.2 API Endpoints

#### GET /api/v1/profile/:id

**Purpose**: Get user profile with posts count, followers, following, TripScore

**Method**: GET

**Auth**: Optional (public access, but authenticated users get follow status)

**Path Parameters**:
- `id`: User ID (MongoDB ObjectId)

**Response Structure**:
```json
{
  "success": true,
  "profile": {
    "_id": "...",
    "fullName": "...",
    "username": "...",
    "profilePic": "...",
    "bio": "...",
    "followers": [...],
    "following": [...],
    "postsCount": 42,
    "followersCount": 150,
    "followingCount": 80,
    "locations": [...], // Post locations for map
    "tripScore": {
      "totalScore": 25,
      "continents": { "Asia": 15, "Europe": 10 },
      "countries": { "India": 8, "UK": 5 },
      "areas": [...]
    },
    "isFollowing": false, // If authenticated
    "isOwnProfile": false,
    "canViewProfile": true,
    "canViewPosts": true,
    "canViewLocations": true,
    "followRequestSent": false
  }
}
```

**Backend Logic**:
- Checks privacy settings to determine visibility
- Calculates TripScore from TripVisits (trusted trust levels only)
- Deduplicates locations for TripScore
- Returns follow status if authenticated

---

#### PUT /api/v1/profile/:id

**Purpose**: Update profile (full name, bio, profile picture)

**Method**: PUT

**Auth**: Required (must be own profile)

**Request Body**: `multipart/form-data`
- `fullName`: String (optional, 2-50 chars)
- `bio`: String (optional, max 200 chars inferred)
- `profilePic`: File (optional, image)
- `coverPhoto`: File (optional, image, inferred)

**Response Structure**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "profile": User
}
```

**Backend Logic**:
- Validates user owns profile
- Uploads images to storage
- Updates user document
- Invalidates profile cache

---

#### POST /api/v1/profile/:id/follow

**Purpose**: Follow or unfollow a user

**Method**: POST

**Auth**: Required

**Path Parameters**:
- `id`: User ID to follow/unfollow

**Response Structure**:
```json
{
  "success": true,
  "message": "Followed successfully" or "Unfollowed successfully",
  "isFollowing": true,
  "followersCount": 151
}
```

**Backend Logic**:
- Toggles follow status
- Handles follow requests for private profiles
- Creates notifications
- Updates follower/following counts

---

#### GET /api/v1/settings

**Purpose**: Get user settings

**Method**: GET

**Auth**: Required

**Response Structure**:
```json
{
  "success": true,
  "settings": {
    "privacy": {...},
    "notifications": {...},
    "account": {...}
  }
}
```

---

#### PUT /api/v1/settings

**Purpose**: Update all settings

**Method**: PUT

**Auth**: Required

**Request Body**:
```json
{
  "settings": {
    "privacy": {...},
    "notifications": {...},
    "account": {...}
  }
}
```

---

#### PUT /api/v1/settings/:category

**Purpose**: Update specific settings category

**Method**: PUT

**Auth**: Required

**Path Parameters**:
- `category`: 'privacy' | 'notifications' | 'account'

**Request Body**: Settings object for that category

**Response Structure**:
```json
{
  "success": true,
  "message": "privacy settings updated successfully",
  "settings": {...}
}
```

**Backend Logic**:
- Validates category
- Updates only specified category
- If `shareActivity` updated, updates all user's activities

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Local State

**Component State** (`frontend/app/(tabs)/profile.tsx`):
- `user`: Current user object
- `profileData`: Profile data (posts count, followers, TripScore, etc.)
- `posts`: Array of user's posts
- `userShorts`: Array of user's shorts
- `savedIds`: Array of saved post/short IDs
- `savedItems`: Array of saved post/short objects
- `activeTab`: 'posts' | 'shorts' | 'saved'
- `loading`: Boolean
- `refreshing`: Boolean
- `showEditProfile`: Boolean
- `unreadCount`: Number

### 5.2 Global State / Context

**ThemeContext**: Provides theme for styling

**AlertContext**: Provides error/success alerts

### 5.3 Custom Hooks

**useScrollToHideNav**: Hides tab bar on scroll

### 5.4 Caching Strategy

**AsyncStorage**:
- Saved posts: `'savedPosts'` (array of post IDs)
- Saved shorts: `'savedShorts'` (array of short IDs)
- User data: Cached in auth service

**Backend Cache**:
- Profile cache: `user:${userId}` (TTL: inferred)
- Invalidated on profile update

### 5.5 Side Effects

**useEffect Dependencies**:
- Load profile data on mount
- Load saved items when tab changes
- Track screen view with analytics
- Listen to saved events for bookmark sync

---

## 6. Backend Logic & Rules

### 6.1 Profile Visibility Rules

**Public Profile** (`profileVisibility: 'public'`):
- Anyone can view profile
- Anyone can view posts
- Anyone can view locations
- Anyone can follow (no approval needed)

**Followers Only** (`profileVisibility: 'followers'`):
- Anyone can view profile (name, avatar, bio)
- Only followers can view posts
- Only followers can view locations
- Anyone can follow (no approval needed)

**Private Profile** (`profileVisibility: 'private'`):
- Anyone can view profile (name, avatar, bio)
- Only approved followers can view posts
- Only approved followers can view locations
- Follow requires approval if `requireFollowApproval: true`

**Own Profile**:
- Always full access
- Can see all posts (including archived/hidden)
- Can see all settings

### 6.2 Follow Rules

**Follow Approval**:
- If `requireFollowApproval: true`: Creates follow request (status: 'pending')
- If `requireFollowApproval: false`: Follows immediately
- Profile owner can approve/reject requests

**Follow Limits**:
- No explicit limit on followers/following (inferred)
- Cannot follow self
- Cannot follow if already following (handled by toggle)

### 6.3 TripScore Calculation

**Trust Levels**:
- Only `trustLevel: 'high'` and `'medium'` contribute to TripScore
- `'low'`, `'unverified'`, `'suspicious'` do NOT contribute

**Deduplication**:
- Same location (lat/lng within tolerance) = 1 unique place
- Only counts unique places, not raw post count

**Sources**:
- `taatom_camera_live` → `'high'` trust
- `gallery_exif` → `'medium'` trust
- `gallery_no_exif` → `'low'` trust (doesn't count)
- `manual_only` → `'unverified'` trust (doesn't count)

---

## 7. superAdmin Dependencies

### 7.1 User Management

**File**: `superAdmin/src/pages/Users.jsx` (inferred)

**Features**:
- View all users
- Activate/Deactivate users
- Delete users
- View user analytics

**Impact on Profile**:
- Deactivated users: Profile may be hidden or limited
- Deleted users: Profile removed permanently

---

## 8. Permissions, Privacy & Security

### 8.1 Access Rules

**Public Access**:
- Anyone can view public profiles (limited data)
- Profile visibility controls what data is shown

**Authenticated Access**:
- Required for: Follow/unfollow, edit profile, view settings
- Optional for: Viewing profiles (enhanced with follow status)

### 8.2 Privacy Rules

**Profile Visibility**:
- Controlled by `settings.privacy.profileVisibility`
- Affects what data is visible to non-followers

**Follow Requests**:
- Required for private profiles if `requireFollowApproval: true`
- Profile owner can approve/reject

**Blocked Users**:
- Blocked users cannot view profile (inferred)
- Blocked users cannot follow (inferred)

### 8.3 Security Checks

**Auth Middleware**: Required for profile updates, follow actions, settings

**Input Sanitization**:
- Full name: Trimmed, length validated
- Bio: Trimmed, length validated
- Settings: Validated against allowed values

**File Upload Security**:
- Profile picture: Image files only, no size limit
- Cover photo: Image files only (inferred)

---

## 9. Analytics & Events

### 9.1 Tracked Events

**Screen View**:
- `trackScreenView('profile', { userId, hasPosts, hasShorts, postsCount })`

**Engagement**:
- Profile view: Tracked when profile is viewed
- Follow action: Tracked when user follows/unfollows
- Edit profile: Tracked when profile is edited

### 9.2 Metrics & KPIs

**User Metrics**:
- Profile views
- Follow/unfollow actions
- Profile edit frequency
- Settings changes

**Content Metrics**:
- Posts per user
- Shorts per user
- Saved items per user

**Business Metrics**:
- Average TripScore per user
- Profile completion rate
- Privacy settings distribution

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

**Text Fields**:
- Full name: 2-50 characters
- Bio: Max 200 characters (inferred)
- Username: Max 20 characters

**Content**:
- No explicit limit on posts/shorts per user
- Saved items: Limited by AsyncStorage capacity

### 10.2 Error Handling

**Network Errors**:
- Profile load fails: Show error, allow retry
- Settings update fails: Show error, keep previous values

**Validation Errors**:
- Invalid profile data: Show field-specific error
- Invalid settings: Show validation error

**Privacy Errors**:
- Cannot view content: Show limited profile view
- Follow request pending: Show "Request Sent" button

### 10.3 Known Constraints

**TripScore**:
- Only counts trusted visits (high/medium)
- Deduplication may hide some visits
- No historical TripScore (only current)

**Saved Content**:
- Stored locally only (not synced across devices)
- Lost if user clears app data
- No cloud backup

**Follow Requests**:
- No expiration (requests stay pending until action)
- No limit on pending requests (inferred)

**Settings**:
- Theme changes may require app restart (inferred)
- Language changes may require app restart (inferred)

---

## 11. Future Enhancements (Optional Backlog)

### Now (High Priority)

1. **Cloud Sync for Saved Content**: Sync saved posts/shorts to server
2. **Profile Verification**: Badge for verified users
3. **Profile Analytics**: Show own profile views, engagement stats
4. **Better Privacy Controls**: Granular control over what followers see

### Next (Medium Priority)

1. **Profile Customization**: Custom themes, layouts
2. **Bio Links**: Clickable links in bio
3. **Profile Highlights**: Pin favorite posts/shorts
4. **Follow Suggestions**: Suggest users to follow

### Later (Low Priority)

1. **Profile Templates**: Pre-designed profile layouts
2. **Profile Stories**: Temporary profile stories
3. **Profile Badges**: Achievement badges for milestones
4. **Profile Analytics Dashboard**: Detailed analytics for profile owners

---

**Document Version**: 1.0  
**Last Updated**: Based on codebase analysis as of current date  
**Inferred Sections**: Marked with "inferred from code" where behavior is implied but not explicitly documented


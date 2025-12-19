# Follow/Unfollow Mechanism - Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [State Management](#state-management)
6. [Error Handling](#error-handling)
7. [Flow Diagrams](#flow-diagrams)
8. [Key Concepts](#key-concepts)

---

## Overview

The follow/unfollow mechanism in TeamTaatom allows users to follow other users, with support for:
- **Direct Follow**: When the target user doesn't require approval
- **Follow Request**: When the target user requires approval (private accounts)
- **Unfollow**: Remove an existing follow relationship

This system is implemented across two main frontend pages:
- **Profile Page** (`/profile/[id]`): View and follow/unfollow a specific user
- **Followers/Following Page** (`/followers`): View and manage followers/following lists

---

## Architecture

### System Components

```
┌─────────────────┐
│  Frontend UI    │
│  (React Native) │
└────────┬────────┘
         │
         │ API Calls
         ▼
┌─────────────────┐
│  Service Layer  │
│  (profile.ts)   │
└────────┬────────┘
         │
         │ HTTP POST
         ▼
┌─────────────────┐
│  Backend API    │
│  (Express.js)   │
└────────┬────────┘
         │
         │ Database Operations
         ▼
┌─────────────────┐
│  MongoDB        │
│  (User Model)   │
└─────────────────┘
```

### Data Flow

1. **User Action** → Frontend component triggers follow/unfollow
2. **Optimistic Update** → UI updates immediately for better UX
3. **API Call** → Service function sends request to backend
4. **Backend Processing** → Server validates and updates database
5. **Response** → Backend returns updated state
6. **State Sync** → Frontend updates state from API response (source of truth)
7. **UI Refresh** → Components re-render with correct state

---

## Backend Implementation

### Endpoint

**Route**: `POST /api/v1/profile/:id/follow`  
**Controller**: `toggleFollow` in `backend/src/controllers/profileController.js`  
**Authentication**: Required (Private route)

### Request Flow

```javascript
// 1. Validation
- Validate userId format (MongoDB ObjectId)
- Prevent self-following
- Check if target user exists
- Check if current user exists

// 2. Determine Current State
const isFollowing = currentUser.following.includes(id);

// 3. Process Action
if (isFollowing) {
  // UNFOLLOW FLOW
  - Remove from currentUser.following
  - Remove from targetUser.followers
  - Remove any pending follow requests
  - Save both users
  - Return: { isFollowing: false, followRequestSent: false }
} else {
  // FOLLOW FLOW
  - Check if approval required
  if (requiresApproval) {
    // FOLLOW REQUEST FLOW
    - Check for existing requests
    - Create follow request
    - Send notifications
    - Return: { isFollowing: false, followRequestSent: true }
  } else {
    // DIRECT FOLLOW FLOW
    - Add to currentUser.following
    - Add to targetUser.followers
    - Create activity
    - Send notifications
    - Return: { isFollowing: true, followRequestSent: false }
  }
}
```

### Response Structure

The backend uses `sendSuccess` which spreads data directly:

```javascript
{
  success: true,
  message: "User followed" | "User unfollowed" | "Follow request sent",
  isFollowing: boolean,
  followersCount: number,
  followingCount: number,
  followRequestSent: boolean
}
```

### Key Backend Logic

#### 1. Unfollow Process
```javascript
if (isFollowing) {
  // Remove bidirectional relationship
  currentUser.following.pull(id);
  targetUser.followers.pull(currentUserId);
  
  // Clean up follow requests
  currentUser.sentFollowRequests = currentUser.sentFollowRequests.filter(
    req => req.user.toString() !== id
  );
  targetUser.followRequests = targetUser.followRequests.filter(
    req => req.user.toString() !== currentUserId.toString()
  );
  
  await Promise.all([currentUser.save(), targetUser.save()]);
}
```

#### 2. Follow Request (Requires Approval)
```javascript
if (requiresApproval) {
  // Check for duplicate requests
  const existingSentRequest = currentUser.sentFollowRequests.find(
    req => req.user.toString() === id && req.status === 'pending'
  );
  
  if (existingSentRequest) {
    return sendError(res, 'BIZ_7002', 'Follow request already pending');
  }
  
  // Create follow request on both sides
  currentUser.sentFollowRequests.push({
    user: id,
    status: 'pending',
    requestedAt: new Date()
  });
  
  targetUser.followRequests.push({
    user: currentUserId,
    status: 'pending',
    requestedAt: new Date()
  });
  
  // Send notifications
  await Notification.createNotification({...});
  await sendNotificationToUser({...});
}
```

#### 3. Direct Follow (No Approval Required)
```javascript
else {
  // Direct follow - no approval needed
  currentUser.following.push(id);
  targetUser.followers.push(currentUserId);
  
  await Promise.all([currentUser.save(), targetUser.save()]);
  
  // Create activity and notifications
  await Activity.createActivity({...});
  await Notification.createNotification({...});
}
```

---

## Frontend Implementation

### Service Layer

**File**: `frontend/services/profile.ts`

```typescript
export const toggleFollow = async (userId: string): Promise<{
  message: string;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
  followRequestSent?: boolean;
}> => {
  try {
    const response = await api.post(`/api/v1/profile/${userId}/follow`);
    // Backend sendSuccess spreads data directly
    const data = response.data;
    return {
      message: data?.message || 'Success',
      isFollowing: Boolean(data?.isFollowing ?? false),
      followersCount: data?.followersCount ?? 0,
      followingCount: data?.followingCount ?? 0,
      followRequestSent: Boolean(data?.followRequestSent ?? false)
    };
  } catch (error: any) {
    // Handle 409 (Conflict) - follow request already pending
    if (error.response?.status === 409) {
      const conflictError = new Error(error.response?.data?.message || 'Follow request already pending');
      (conflictError as any).isConflict = true;
      throw conflictError;
    }
    throw new Error(error.response?.data?.message || 'Failed to update follow status');
  }
};
```

**Key Points**:
- Extracts data from `response.data` (backend spreads data directly)
- Converts values to proper types (Boolean, Number)
- Handles 409 conflicts for duplicate follow requests
- Provides meaningful error messages

---

### Profile Page Implementation

**File**: `frontend/app/profile/[id].tsx`

#### State Management

```typescript
const [isFollowing, setIsFollowing] = useState(false);
const [followRequestSent, setFollowRequestSent] = useState(false);
const [followLoading, setFollowLoading] = useState(false);

// Refs for state management
const isFollowActionInProgress = useRef(false);
const lastFollowApiResponse = useRef<{
  isFollowing: boolean;
  followRequestSent: boolean;
} | null>(null);
```

#### Follow Handler Flow

```typescript
const handleFollow = async () => {
  // 1. Guard: Check if profile exists
  if (!profile) return;
  
  // 2. Mark action in progress
  isFollowActionInProgress.current = true;
  
  // 3. Store previous state for rollback
  const previousFollowing = isFollowing;
  const previousRequestSent = followRequestSent;
  
  // 4. OPTIMISTIC UPDATE - Update UI immediately
  setIsFollowing(!isFollowing);
  if (isFollowing) {
    setFollowRequestSent(false);
  }
  
  // 5. Show loading state
  setFollowLoading(true);
  
  try {
    // 6. Call API
    const response = await toggleFollow(profile._id);
    
    // 7. Extract response data (source of truth)
    const apiIsFollowing = Boolean(response.isFollowing);
    const apiFollowRequestSent = Boolean(response.followRequestSent);
    const newFollowersCount = response.followersCount;
    const newFollowingCount = response.followingCount;
    
    // 8. Store API response in ref (prevents cache override)
    lastFollowApiResponse.current = {
      isFollowing: apiIsFollowing,
      followRequestSent: apiFollowRequestSent
    };
    
    // 9. Update state from API response
    setIsFollowing(apiIsFollowing);
    setFollowRequestSent(apiFollowRequestSent);
    
    // 10. Update profile counts
    setProfile(prevProfile => ({
      ...prevProfile,
      followersCount: newFollowersCount,
      followingCount: newFollowingCount
    }));
    
    // 11. Show success message
    if (apiIsFollowing) {
      showSuccess('You are now following this user!');
    } else if (apiFollowRequestSent) {
      showSuccess('Follow request sent!');
    } else {
      showSuccess('You have unfollowed this user.');
    }
    
    // 12. Refresh profile data after delay
    setTimeout(() => {
      fetchProfile();
    }, 500);
    
    // 13. Clear ref after cache expires (5 seconds)
    setTimeout(() => {
      lastFollowApiResponse.current = null;
    }, 5000);
    
  } catch (e: any) {
    // 14. REVERT optimistic update on error
    setIsFollowing(previousFollowing);
    setFollowRequestSent(previousRequestSent);
    lastFollowApiResponse.current = null;
    
    // 15. Handle errors
    if (e.isConflict || e.response?.status === 409) {
      setFollowRequestSent(true);
      showWarning('Follow Request Pending', e.message);
    } else {
      showError(e.message);
    }
  } finally {
    setFollowLoading(false);
    isFollowActionInProgress.current = false;
  }
};
```

#### Cache Protection Mechanism

The profile page uses a ref to store the API response and prevent cached profile fetches from overriding the correct follow state:

```typescript
// When fetching profile
if (lastFollowApiResponse.current) {
  // Use stored response (source of truth)
  setIsFollowing(lastFollowApiResponse.current.isFollowing);
  setFollowRequestSent(lastFollowApiResponse.current.followRequestSent);
} else {
  // Use fresh API response
  setIsFollowing(userProfile.isFollowing);
  setFollowRequestSent(userProfile.followRequestSent);
}
```

**Why?** Cached responses (304) can return stale `isFollowing` state. The ref ensures the correct state persists for 5 seconds after a follow/unfollow action.

---

### Followers Page Implementation

**File**: `frontend/app/followers.tsx`

#### State Management

```typescript
const [users, setUsers] = useState<UserType[]>([]);
const [followLoading, setFollowLoading] = useState<string | null>(null);
```

#### Follow Handler Flow

```typescript
const handleToggleFollow = async (targetId: string) => {
  // 1. Guard: Prevent self-following
  if (targetId === userId) {
    Alert.alert('Error', 'You cannot follow yourself');
    return;
  }
  
  // 2. Store previous state for rollback
  const previousState = users.find(u => u._id === targetId);
  const previousFollowing = previousState?.isFollowing ?? false;
  
  // 3. Set loading state for specific user
  setFollowLoading(targetId);
  
  // 4. OPTIMISTIC UPDATE - Update UI immediately
  setUsers(prev => prev.map(u => 
    u._id === targetId 
      ? { ...u, isFollowing: !u.isFollowing } 
      : u
  ));
  
  try {
    // 5. Call API
    const response = await toggleFollow(targetId);
    
    // 6. Extract values from response
    const isFollowingValue = Boolean(response.isFollowing);
    const followRequestSentValue = Boolean(response.followRequestSent);
    
    // 7. Update state with API response (source of truth)
    setUsers(prev => prev.map(u => {
      if (u._id === targetId) {
        return {
          ...u,
          isFollowing: isFollowingValue,
          // Update followersCount if provided
          ...(response.followersCount !== undefined && { 
            followersCount: response.followersCount 
          })
        };
      }
      return u;
    }));
    
    // 8. Show success message
    if (isFollowingValue) {
      Alert.alert('Success', 'You are now following this user!');
    } else if (followRequestSentValue) {
      Alert.alert('Success', 'Follow request sent!');
    } else {
      Alert.alert('Success', 'You have unfollowed this user.');
    }
    
    // 9. Refresh list to ensure consistency
    if (userId && userId !== targetId) {
      setTimeout(() => {
        fetchList(page, true);
      }, 300);
    }
    
  } catch (err: any) {
    // 10. REVERT optimistic update on error
    setUsers(prev => prev.map(u => 
      u._id === targetId 
        ? { ...u, isFollowing: previousFollowing } 
        : u
    ));
    
    // 11. Handle errors
    if (err.isConflict || err.response?.status === 409) {
      Alert.alert('Follow Request Pending', err.message);
    } else {
      Alert.alert('Error', err.message);
    }
  } finally {
    setFollowLoading(null);
  }
};
```

---

## State Management

### Optimistic Updates Pattern

Both implementations use **optimistic updates** for better UX:

1. **Immediate UI Update**: State changes immediately when user clicks
2. **API Call**: Request sent to backend
3. **State Sync**: Update state from API response (source of truth)
4. **Error Rollback**: Revert to previous state if API call fails

### State Flow Diagram

```
User Clicks Follow
       │
       ▼
┌──────────────────┐
│ Optimistic Update│
│ isFollowing = !  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   API Call       │
│ toggleFollow()   │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────┐
│Success│  │Error │
└───┬───┘  └───┬──┘
    │          │
    ▼          ▼
┌─────────┐ ┌──────────┐
│Update   │ │Revert    │
│from API │ │to Previous│
└─────────┘ └──────────┘
```

### State Sources of Truth

1. **API Response**: The definitive source after an action
2. **Cached Profile Data**: Used when no recent action
3. **Ref Storage**: Prevents cache from overriding recent actions

---

## Error Handling

### Error Types

1. **409 Conflict**: Follow request already pending
   - Handled gracefully with user-friendly message
   - Sets `followRequestSent` to true

2. **400 Validation**: Invalid user ID or self-follow
   - Shows error alert
   - Prevents invalid operations

3. **404 Not Found**: User doesn't exist
   - Shows error alert
   - Reverts optimistic update

4. **Network Errors**: Connection issues
   - Shows error alert
   - Reverts optimistic update
   - Allows retry

### Error Handling Pattern

```typescript
try {
  const response = await toggleFollow(userId);
  // Success handling
} catch (err: any) {
  // Revert optimistic update
  revertState();
  
  // Handle specific error types
  if (err.isConflict || err.response?.status === 409) {
    // Follow request already pending
    handleConflictError(err);
  } else {
    // Generic error
    showError(err.message);
  }
}
```

---

## Flow Diagrams

### Complete Follow Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER CLICKS FOLLOW                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Optimistic Update    │
            │  UI Updates Immediately│
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  API Call: toggleFollow│
            └───────────┬───────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │   SUCCESS     │       │     ERROR     │
    └───────┬───────┘       └───────┬───────┘
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │ Update State  │       │ Revert State  │
    │ from Response │       │ to Previous   │
    └───────┬───────┘       └───────┬───────┘
            │                       │
            ▼                       ▼
    ┌───────────────┐       ┌───────────────┐
    │ Show Success  │       │ Show Error    │
    │ Message       │       │ Message       │
    └───────────────┘       └───────────────┘
```

### Backend Decision Tree

```
                    Is Following?
                   /              \
                 YES              NO
                  │                │
                  ▼                ▼
            ┌──────────┐    ┌──────────────┐
            │ UNFOLLOW │    │ Requires     │
            │          │    │ Approval?    │
            └──────────┘    └───┬──────┬───┘
                                 │      │
                                YES     NO
                                 │      │
                  ┌──────────────┘      ┌──────────────┐
                  │                     │              │
                  ▼                     ▼              ▼
         ┌──────────────┐      ┌──────────────┐  ┌──────────────┐
         │ Follow       │      │ Direct       │  │ Direct       │
         │ Request      │      │ Follow       │  │ Follow       │
         │              │      │              │  │              │
         │ isFollowing:│      │ isFollowing: │  │ isFollowing: │
         │ false       │      │ true         │  │ true         │
         │             │      │              │  │              │
         │ followReq:  │      │ followReq:   │  │ followReq:   │
         │ true        │      │ false        │  │ false        │
         └──────────────┘      └──────────────┘  └──────────────┘
```

---

## Key Concepts

### 1. Optimistic Updates

**Why?** Provides instant feedback to users, improving perceived performance.

**How?** Update UI immediately, then sync with API response.

**Risk?** State might be incorrect if API fails.

**Solution?** Always revert on error, use API response as source of truth.

### 2. Source of Truth

**API Response** is always the source of truth after an action:
- Frontend state can be stale (cached data)
- API response reflects actual database state
- Always update state from API response, not from optimistic update

### 3. Cache Protection

**Problem**: Cached profile fetches (304 responses) can return stale `isFollowing` state.

**Solution**: Store API response in ref for 5 seconds after action:
- Prevents cache from overriding correct state
- Ensures UI shows accurate follow status
- Clears automatically after cache expires

### 4. State Synchronization

**Profile Page**:
- Uses ref to store recent API response
- Checks ref before using cached profile data
- Refreshes profile after action to get updated counts

**Followers Page**:
- Updates individual user in list
- Refreshes entire list after action
- Ensures consistency across all users

### 5. Error Recovery

**Pattern**: Always store previous state before optimistic update

**On Error**:
1. Revert to previous state
2. Show error message
3. Allow user to retry

**On Success**:
1. Update from API response
2. Show success message
3. Refresh data if needed

---

## Best Practices

### 1. Always Use API Response

```typescript
// ❌ BAD: Use optimistic update as final state
setIsFollowing(!isFollowing);

// ✅ GOOD: Use API response as source of truth
const response = await toggleFollow(userId);
setIsFollowing(response.isFollowing);
```

### 2. Implement Optimistic Updates

```typescript
// ✅ GOOD: Update UI immediately, then sync
setIsFollowing(!isFollowing); // Optimistic
const response = await toggleFollow(userId);
setIsFollowing(response.isFollowing); // Sync with API
```

### 3. Always Revert on Error

```typescript
// ✅ GOOD: Store previous state
const previousFollowing = isFollowing;

try {
  // ... optimistic update and API call
} catch (error) {
  setIsFollowing(previousFollowing); // Revert
}
```

### 4. Handle All Response States

```typescript
// ✅ GOOD: Handle all possible states
if (response.isFollowing) {
  // Direct follow
} else if (response.followRequestSent) {
  // Follow request sent
} else {
  // Unfollowed
}
```

### 5. Refresh Data After Action

```typescript
// ✅ GOOD: Refresh to ensure consistency
setTimeout(() => {
  fetchProfile(); // or fetchList()
}, 500);
```

---

## Testing Checklist

### Profile Page
- [ ] Follow button changes to "Following" after follow
- [ ] Unfollow button changes to "Follow" after unfollow
- [ ] Follow request shows "Request Sent" when approval required
- [ ] Follower count updates correctly
- [ ] Error messages display correctly
- [ ] State persists after page refresh
- [ ] Cache doesn't override recent actions

### Followers Page
- [ ] Follow button works for each user in list
- [ ] Unfollow button works for each user in list
- [ ] List refreshes after follow/unfollow
- [ ] Loading state shows during API call
- [ ] Error messages display correctly
- [ ] State updates correctly for all users

### Edge Cases
- [ ] Self-follow prevention works
- [ ] Duplicate follow request handling
- [ ] Network error handling
- [ ] Invalid user ID handling
- [ ] Private account follow request flow
- [ ] Public account direct follow flow

---

## Common Issues and Solutions

### Issue 1: State Not Updating After Follow

**Symptom**: Button doesn't change after clicking follow.

**Cause**: Not using API response as source of truth.

**Solution**: Always update state from API response:
```typescript
const response = await toggleFollow(userId);
setIsFollowing(response.isFollowing); // Use API response
```

### Issue 2: State Reverts After Refresh

**Symptom**: Follow state resets after page refresh.

**Cause**: Cached profile data overriding correct state.

**Solution**: Use ref to store recent API response:
```typescript
lastFollowApiResponse.current = {
  isFollowing: response.isFollowing,
  followRequestSent: response.followRequestSent
};
```

### Issue 3: Duplicate Follow Requests

**Symptom**: Multiple follow requests created.

**Cause**: Not checking for existing requests.

**Solution**: Backend checks for existing requests before creating new one.

### Issue 4: Optimistic Update Not Reverting on Error

**Symptom**: UI shows incorrect state after error.

**Cause**: Not storing previous state before optimistic update.

**Solution**: Always store previous state:
```typescript
const previousFollowing = isFollowing;
// ... optimistic update
try {
  // ... API call
} catch {
  setIsFollowing(previousFollowing); // Revert
}
```

---

## Conclusion

The follow/unfollow mechanism uses:
- **Optimistic Updates** for better UX
- **API Response as Source of Truth** for accuracy
- **Cache Protection** to prevent stale data
- **Error Recovery** for reliability
- **State Synchronization** for consistency

This ensures a smooth, reliable user experience while maintaining data integrity across the application.

---

## Related Files

### Backend
- `backend/src/controllers/profileController.js` - Main controller
- `backend/src/models/User.js` - User model with follow relationships
- `backend/src/utils/errorCodes.js` - Error handling utilities

### Frontend
- `frontend/services/profile.ts` - Service layer
- `frontend/app/profile/[id].tsx` - Profile page implementation
- `frontend/app/followers.tsx` - Followers page implementation

---

**Last Updated**: 2025-01-12  
**Version**: 1.0  
**Author**: TeamTaatom Development Team


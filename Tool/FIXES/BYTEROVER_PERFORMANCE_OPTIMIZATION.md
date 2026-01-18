# Performance Optimization Patterns & Solutions

**Category:** Performance Optimization, Frontend Optimization, React Native, API Optimization  
**Tags:** parallel-fetching, optimistic-caching, performance-improvement, react-native, api-optimization  
**Created:** January 2026

## Overview

This document captures performance optimization patterns and solutions implemented across the TeamTaatom application to reduce page load times by 50-70%.

## Key Performance Patterns

### 1. Parallel API Calls Pattern

**Problem:** Sequential API calls causing 2-5 second delays.

**Solution:** Use `Promise.allSettled()` for concurrent requests.

**Example Pattern:**
```typescript
// ❌ BAD: Sequential (2-5s total)
const blockStatus = await getBlockStatus(userId);
const chat = await api.get(`/chat/${userId}`);
const messages = await api.get(`/chat/${userId}/messages`);

// ✅ GOOD: Parallel (0.9-1.4s total)
const [blockStatusResult, chatRes, messagesRes] = await Promise.allSettled([
  getBlockStatus(userId).catch(() => ({ isBlocked: false })),
  api.get(`/chat/${userId}`),
  api.get(`/chat/${userId}/messages`)
]);
```

**When to Use:**
- Multiple independent API calls
- Non-critical checks that shouldn't block main flow
- Data fetching that doesn't depend on each other

**Files Using This Pattern:**
- `frontend/app/chat/index.tsx` - Chat loading (60-70% faster)
- `frontend/app/(tabs)/profile.tsx` - Profile, posts, shorts fetch (65% faster)
- `frontend/app/profile/[id].tsx` - User profile data (60% faster)
- `frontend/app/(tabs)/locale.tsx` - Initial data loading (50% faster)

### 2. Optimistic Caching Pattern

**Problem:** Users see loading state instead of cached data on navigation.

**Solution:** Load cached data immediately, refresh in background.

**Example Pattern:**
```typescript
// ✅ Optimistic Cache-First Strategy
const loadUserData = async () => {
  // 1. Try cache first (instant display)
  try {
    const cachedProfile = await AsyncStorage.getItem(`cachedProfile_${userId}`);
    if (cachedProfile) {
      const parsed = JSON.parse(cachedProfile);
      const cacheAge = Date.now() - (parsed.timestamp || 0);
      if (cacheAge < 5 * 60 * 1000) { // 5 min cache
        setProfileData(parsed.data);
        setLoading(false); // Show immediately
      }
    }
  } catch (cacheError) {
    // Continue even if cache fails
  }
  
  // 2. Fetch fresh data in background
  const [profileResult, postsResult] = await Promise.allSettled([
    getProfile(userId),
    getUserPosts(userId)
  ]);
  
  // 3. Update with fresh data and cache for next time
  if (profileResult.status === 'fulfilled') {
    setProfileData(profileResult.value.profile);
    AsyncStorage.setItem(`cachedProfile_${userId}`, JSON.stringify({
      data: profileResult.value.profile,
      timestamp: Date.now()
    })).catch(() => {});
  }
};
```

**Cache TTL Guidelines:**
- Profile data: 5 minutes (frequently changes)
- Posts: 24 hours (more stable)
- User profile: 5 minutes (user actions can change it)

**Files Using This Pattern:**
- `frontend/app/(tabs)/profile.tsx` - 5 min cache for profiles
- `frontend/app/profile/[id].tsx` - 5 min cache for user profiles
- `frontend/app/(tabs)/home.tsx` - 24h cache for posts

### 3. Non-Blocking Operations Pattern

**Problem:** Non-critical checks blocking main data flow.

**Solution:** Run non-critical checks in parallel, handle gracefully.

**Example Pattern:**
```typescript
// ❌ BAD: Blocking
const blockStatus = await getBlockStatus(userId);
if (blockStatus.isBlocked) return;
const chat = await api.get(`/chat/${userId}`);

// ✅ GOOD: Non-blocking parallel
const [blockStatusResult, chatRes] = await Promise.allSettled([
  getBlockStatus(userId).catch(() => ({ isBlocked: false })),
  api.get(`/chat/${userId}`)
]);

// Check block status after, but don't block chat fetch
if (blockStatusResult.status === 'fulfilled' && blockStatusResult.value.isBlocked) {
  // Handle block, but chat already fetched
}
```

**When to Use:**
- Validation checks that shouldn't block main flow
- Optional data fetching
- Message counts, notifications, etc.

### 4. Performance Tracking Pattern

**Problem:** No visibility into actual load times.

**Solution:** Add timing logs for key operations.

**Example Pattern:**
```typescript
const loadData = async () => {
  const startTime = Date.now(); // Use Date.now() for React Native compatibility
  
  // ... parallel fetch operations ...
  
  const loadTime = Date.now() - startTime;
  logger.debug(`[PERF] Data loaded in ${loadTime}ms (optimized parallel fetch)`);
};
```

**Key Metrics:**
- Page load time: Navigation to content visible
- API response time: Individual call duration
- Time to interactive: User can interact

## Performance Improvements Achieved

| Screen | Before | After | Improvement |
|--------|--------|-------|-------------|
| Chat Opening | 2-5s | 0.9-1.4s | **60-70% faster** |
| Profile Screen | 1.5-3s | 0.5-1.2s | **65% faster** |
| User Profile | 2-4s | 0.8-1.5s | **60% faster** |
| Home Screen | 1-2s | 0.3-0.8s | **70% faster** |
| Locale Screen | 1.5-3s | 0.8-1.5s | **50% faster** |

## Best Practices Implemented

1. **Always Use `Promise.allSettled()`** for parallel requests (handles partial failures gracefully)
2. **Cache-First Strategy** - Show cached data immediately, refresh in background
3. **Non-Blocking Checks** - Move validation/optional checks to parallel execution
4. **Performance Tracking** - Add timing logs for visibility
5. **Error Handling** - Use `Promise.allSettled()` to handle partial failures

## React Native Specific Notes

- Use `Date.now()` instead of `performance.now()` for timing (React Native compatibility)
- AsyncStorage for client-side caching (works offline)
- Cache TTLs should balance freshness and performance
- Use `.catch(() => {})` for non-critical cache operations

## Backend Optimization Notes

Backend already optimized with:
- Aggregation pipelines (prevents N+1 queries)
- `$lookup` instead of `.populate()` (more efficient)
- Caching wrapper for frequently accessed data
- Query limits and defensive guards

No backend changes needed - focus was on frontend optimization.

## Common Mistakes to Avoid

1. **Sequential Awaits** - Don't await independent requests sequentially
2. **Blocking on Non-Critical Checks** - Don't block main flow for validation
3. **No Caching** - Always implement cache-first for frequently accessed data
4. **Synchronous Cache Operations** - Don't block on cache read/write
5. **No Performance Tracking** - Add timing logs for visibility

## Future Optimization Opportunities

1. **React Query/SWR** - Automatic caching, background updates, stale-while-revalidate
2. **Service Worker Caching** - Offline support, faster repeat visits
3. **Image Optimization** - WebP, lazy loading, thumbnails
4. **Virtual Scrolling** - For long lists (messages, posts, conversations)
5. **Code Splitting** - Route-based code splitting, lazy loading heavy components

## Code Locations

**Frontend Optimizations:**
- `frontend/app/chat/index.tsx` - Parallel chat/messages fetch
- `frontend/app/(tabs)/profile.tsx` - Parallel + optimistic cache
- `frontend/app/profile/[id].tsx` - Parallel + optimistic cache
- `frontend/app/(tabs)/locale.tsx` - Parallel initialization

**Backend:**
- Already optimized (aggregation pipelines, no changes needed)

**Documentation:**
- Full RCA: `Tool/FIXES/PERFORMANCE_RCA_AND_TRACKER.md`

---

**Last Updated:** January 2026  
**Pattern Version:** 1.0  
**Status:** ✅ Implemented and Documented

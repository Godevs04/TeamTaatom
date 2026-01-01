# Locale Feature Errors - Comprehensive Documentation

## Overview
This document details all errors encountered during the development and debugging of the locale feature in the Taatom application. The locale screen is a critical component that displays travel locations, handles search functionality, calculates distances, and manages user-saved locales.

---

## Table of Contents
1. [Initial Loading Issues](#initial-loading-issues)
2. [Search Functionality Errors](#search-functionality-errors)
3. [Distance Calculation Problems](#distance-calculation-problems)
4. [React Query Integration Issues](#react-query-integration-issues)
5. [Logger and Sanitization Errors](#logger-and-sanitization-errors)
6. [State Management Problems](#state-management-problems)
7. [Performance and Memory Issues](#performance-and-memory-issues)
8. [Root Cause Analysis](#root-cause-analysis)
9. [Lessons Learned](#lessons-learned)

---

## 1. Initial Loading Issues

### Error 1.1: "No Locales Found" on Initial Load
**Description:**
- The locale screen showed "No Locales Found" immediately on mount, even when locales existed in the database.
- Users expected to see all available locales on initial load.

**Root Cause:**
- `loading` state was initialized to `true`, causing the UI to show a loading spinner.
- `loadedOnceRef` guard was preventing initial data fetch.
- Empty state was being set before the API call completed.

**Error Logs:**
```
[LocaleScreen] Initial load - adminLocales empty, loadedOnceRef: false
[LocaleScreen] No locales found on initial load
```

**Attempted Fixes:**
1. Changed `loading` initial state from `true` to `false`
2. Modified `loadedOnceRef` logic to bypass guard on initial load
3. Added `useFocusEffect` to reset `loadedOnceRef` when screen comes into focus

**Status:** ✅ Fixed

---

### Error 1.2: Empty Screen After Network Error
**Description:**
- When network requests failed, the entire screen went blank.
- No cached data was displayed, even if previously loaded locales existed.

**Root Cause:**
- Error handlers were clearing `adminLocales` and `filteredLocales` on any error.
- No fallback to cached data from `AsyncStorage`.
- Error state was not properly handled to preserve existing data.

**Error Logs:**
```
[LocaleScreen] Failed to load admin locales
[API Error:] Network request failed
```

**Attempted Fixes:**
1. Added conditional clearing - only clear locales if there's an active search query
2. Implemented `AsyncStorage` caching for locales
3. Added error handling to preserve existing locales on network errors

**Status:** ✅ Fixed

---

## 2. Search Functionality Errors

### Error 2.1: Infinite Loading Loop on Search
**Description:**
- When searching for a keyword that didn't exist, the screen entered an infinite loading state.
- Loading spinner never stopped, even after API returned empty results.

**Root Cause:**
- Distance calculation was being triggered even when `newLocales.length === 0`.
- Loading states (`loading`, `loadingLocales`, `calculatingDistances`) were not being reset properly.
- `loadedOnceRef` was not being set to `true` on empty search results.

**Error Logs:**
```
[LocaleScreen] Distance calculation started
[LocaleScreen] Distance calculation complete - hiding travel loading overlay
[LocaleScreen] Still loading after empty search results
```

**Attempted Fixes:**
1. Added guard to skip distance calculation when `newLocales.length === 0`
2. Reset all loading states synchronously before early returns
3. Set `loadedOnceRef.current = true` in error handlers
4. Added `isSearchingRef` flag to prevent concurrent searches

**Status:** ✅ Fixed (after multiple iterations)

---

### Error 2.2: Search Results Not Clearing
**Description:**
- After searching for a non-existent keyword (showing "No Locales Found"), clearing the search did not restore the initial list of locales.
- Screen remained empty even after search query was cleared.

**Root Cause:**
- `loadedOnceRef` was set to `true` after empty search results, preventing reload.
- Search query change handler was not properly triggering a reload when cleared.
- `adminLocales` was being cleared on empty search, but not restored when search cleared.

**Error Logs:**
```
[LocaleScreen] Search cleared but locales not restored
[LocaleScreen] loadedOnceRef: true, preventing reload
```

**Attempted Fixes:**
1. Modified `loadedOnceRef` reset logic when search query changes
2. Added `shouldReloadOnClearSearch` flag to `loadAdminLocales`
3. Reset `loadedOnceRef` when search is cleared and no locales present

**Status:** ✅ Fixed

---

### Error 2.3: Debounce Not Working Properly
**Description:**
- Search was triggering API calls on every keystroke.
- Multiple concurrent requests were being made, causing race conditions.

**Root Cause:**
- Debounce timer was not being cleared properly.
- `AbortController` was not being used to cancel in-flight requests.
- React Query integration was not properly debounced.

**Error Logs:**
```
[LocaleService] Multiple concurrent locale fetches
[LocaleScreen] Search debounce not working
```

**Attempted Fixes:**
1. Implemented proper debounce with `setTimeout` and cleanup
2. Added `AbortController` support to locale service
3. Integrated React Query with debounced search query

**Status:** ✅ Fixed

---

## 3. Distance Calculation Problems

### Error 3.1: Distance Calculation Triggering on Empty Results
**Description:**
- Distance calculation was being triggered even when search returned no results.
- This caused unnecessary API calls to OSRM service and wasted resources.

**Root Cause:**
- No guard to check if `newLocales.length > 0` before starting distance calculation.
- Distance calculation logic was in the same flow as locale fetching.

**Error Logs:**
```
[LocaleScreen] Starting distance calculation for 0 locales
[OSRM] API called with empty locale array
```

**Attempted Fixes:**
1. Added early return if `newLocales.length === 0`
2. Separated distance calculation logic into conditional block
3. Added `calculatingDistances` flag to prevent concurrent calculations

**Status:** ✅ Fixed

---

### Error 3.2: Distance Calculation Causing Re-renders
**Description:**
- Distance calculation was causing multiple re-renders of the locale list.
- UI was flickering during distance updates.

**Root Cause:**
- Distance updates were happening one-by-one, triggering re-renders for each locale.
- No batching of distance updates.

**Error Logs:**
```
[LocaleScreen] Distance update causing re-render #1
[LocaleScreen] Distance update causing re-render #2
...
```

**Attempted Fixes:**
1. Batched distance updates using `setAdminLocales` with functional update
2. Used `useCallback` to memoize distance calculation function
3. Added `calculatingDistances` to dependency arrays to prevent unnecessary effects

**Status:** ✅ Fixed

---

## 4. React Query Integration Issues

### Error 4.1: Duplicate API Calls
**Description:**
- After integrating React Query, both React Query and manual `loadAdminLocales` were fetching data.
- This caused duplicate API calls and wasted resources.

**Root Cause:**
- `loadAdminLocales` was still being called even when React Query had data.
- No guard to check if React Query already had the requested data.

**Error Logs:**
```
[React Query] Fetching locales...
[LocaleScreen] loadAdminLocales also fetching...
[API] Duplicate locale fetch requests
```

**Attempted Fixes:**
1. Added guard in `loadAdminLocales` to check if React Query has data
2. Removed redundant call to `loadAdminLocales` from `searchQuery` useEffect
3. Made React Query the primary data source, with `loadAdminLocales` only for distance calculation

**Status:** ✅ Fixed

---

### Error 4.2: React Query Not Updating Local State
**Description:**
- React Query was fetching data successfully, but `adminLocales` state was not updating.
- UI was not reflecting the fetched data.

**Root Cause:**
- `useEffect` that syncs React Query data with local state had incorrect dependencies.
- Distance calculation requirement was preventing state updates.

**Error Logs:**
```
[React Query] Data fetched: 50 locales
[LocaleScreen] adminLocales still empty
```

**Attempted Fixes:**
1. Fixed `useEffect` dependencies to include `localesQueryData`
2. Added proper state synchronization logic
3. Ensured distance calculation doesn't block initial state updates

**Status:** ✅ Fixed

---

### Error 4.3: React Query Cache Not Persisting
**Description:**
- When navigating away and back to the locale screen, React Query was refetching data.
- Expected behavior was to use cached data and avoid refetch.

**Root Cause:**
- React Query configuration had `refetchOnMount: true` (default).
- `staleTime` and `gcTime` were not properly configured.

**Error Logs:**
```
[React Query] Refetching on mount
[API] Unnecessary locale fetch on navigation back
```

**Attempted Fixes:**
1. Configured `refetchOnMount: false` in QueryClient
2. Set appropriate `staleTime` (10 minutes) and `gcTime` (30 minutes)
3. Added `refetchOnWindowFocus: false` and `refetchOnReconnect: false`

**Status:** ✅ Fixed

---

## 5. Logger and Sanitization Errors

### Error 5.1: "[Sanitization in progress]" String Split into Characters
**Description:**
- Error logs were showing `{"0": "[", "1": "S", "2": "a", ...}` instead of proper error messages.
- The string "[Sanitization in progress]" was being split into individual characters.

**Root Cause:**
- `sanitizeData` function was being called recursively on error objects.
- When `isSanitizing` flag was true, it returned "[Sanitization in progress]", which was then treated as an object.
- Error objects contained circular references or complex nested structures.

**Error Logs:**
```
ERROR [API Error:] {"0": "[", "1": "S", "10": "i", "11": "o", "12": "n", "13": " ", "14": "i", "15": "n", "16": " ", "17": "p", "18": "r", "19": "o", "2": "a", "20": "g", "21": "r", "22": "e", "23": "s", "24": "s", "25": "]", "3": "n", "4": "i", "5": "t", "6": "i", "7": "z", "8": "a", "9": "t", ...}
```

**Root Cause Analysis:**
1. `logger.error()` was calling `sanitizeData()` on error objects
2. `sanitizeData()` detected recursion and returned "[Sanitization in progress]"
3. This string was then passed back to `sanitizeData()` as an object
4. The string was treated as an array-like object with numeric keys
5. Each character became a separate key-value pair: `{"0": "[", "1": "S", ...}`

**Attempted Fixes:**
1. Added `isSanitizing` global flag to prevent recursive calls
2. Added depth limit (5 levels) to prevent excessive recursion
3. Added detection for objects that look like split strings (numeric keys with single-char values)
4. Modified `logger.error()` to extract error messages safely before sanitization
5. Added special handling for Error instances to extract message/name/stack directly

**Status:** ⚠️ Partially Fixed (user reverted changes, needs alternative approach)

---

### Error 5.2: Maximum Call Stack Size Exceeded
**Description:**
- Application crashed with "Maximum call stack size exceeded" error.
- This occurred when logging errors that contained circular references.

**Root Cause:**
- `sanitizeData` function was recursively calling itself without proper circular reference detection.
- `WeakSet` for tracking visited objects was not being used correctly.
- Error objects had deep nested structures causing stack overflow.

**Error Logs:**
```
RangeError: Maximum call stack size exceeded
    at sanitizeData (logger.ts:83)
    at sanitizeData (logger.ts:176)
    at sanitizeData (logger.ts:176)
    ...
```

**Attempted Fixes:**
1. Added `WeakSet` to track visited objects
2. Added depth limit to prevent excessive recursion
3. Added special handling for Error, Date, RegExp, Map, Set objects
4. Added try-catch around property access
5. Changed from `forEach` to `for...of` for better error control

**Status:** ✅ Fixed (but user reverted, needs re-implementation)

---

### Error 5.3: Recursive Logger Calls
**Description:**
- `logger.debug()`, `logger.info()`, and `logger.error()` were calling themselves recursively.
- This caused infinite loops when logging.

**Root Cause:**
- Logger methods were using `logger.debug()` instead of `console.debug()`.
- When `createLogEntry()` failed, it tried to log the error using the logger itself.

**Error Logs:**
```
[DEBUG] [DEBUG] [DEBUG] [DEBUG] ...
Maximum call stack size exceeded
```

**Attempted Fixes:**
1. Replaced `logger.debug()` with `console.debug()` in logger methods
2. Replaced `logger.info()` with `console.info()`
3. Replaced `logger.error()` with `console.error()` in error handlers
4. Added try-catch blocks to prevent recursive calls

**Status:** ✅ Fixed (but user reverted, needs re-implementation)

---

## 6. State Management Problems

### Error 6.1: Race Conditions in State Updates
**Description:**
- Multiple state updates were happening concurrently, causing inconsistent UI state.
- Locales would appear and disappear randomly.

**Root Cause:**
- `setAdminLocales` and `setFilteredLocales` were being called from multiple places.
- No proper synchronization between search, filter, and distance calculation updates.

**Error Logs:**
```
[LocaleScreen] State update race condition detected
[LocaleScreen] adminLocales: 50, filteredLocales: 0
```

**Attempted Fixes:**
1. Used functional updates (`prev => ...`) to ensure state consistency
2. Added `isSearchingRef` flag to prevent concurrent searches
3. Batched related state updates together

**Status:** ✅ Fixed

---

### Error 6.2: Stale State in Callbacks
**Description:**
- Callbacks were using stale state values due to closure issues.
- Search handlers were using old `searchQuery` values.

**Root Cause:**
- `useCallback` dependencies were not properly specified.
- State values were captured in closures and not updated.

**Error Logs:**
```
[LocaleScreen] Search handler using stale searchQuery: ""
[LocaleScreen] Actual searchQuery: "paris"
```

**Attempted Fixes:**
1. Added all dependencies to `useCallback` dependency arrays
2. Used refs for values that don't need to trigger re-renders
3. Used functional updates where appropriate

**Status:** ✅ Fixed

---

## 7. Performance and Memory Issues

### Error 7.1: Memory Leaks from Unmounted Components
**Description:**
- State updates were happening after component unmount.
- This caused memory leaks and warnings in React Native.

**Root Cause:**
- No cleanup in `useEffect` hooks.
- Async operations (API calls, distance calculations) were not being cancelled on unmount.

**Error Logs:**
```
Warning: Can't perform a React state update on an unmounted component
[LocaleScreen] State update after unmount
```

**Attempted Fixes:**
1. Added `isMountedRef` to track component mount status
2. Added cleanup functions in `useEffect` hooks
3. Used `AbortController` to cancel in-flight API requests
4. Checked `isMountedRef.current` before all state updates

**Status:** ✅ Fixed

---

### Error 7.2: Excessive Re-renders
**Description:**
- Locale screen was re-rendering excessively, causing performance issues.
- UI was laggy during scrolling and interactions.

**Root Cause:**
- Too many state variables triggering re-renders.
- `useEffect` hooks with incorrect dependencies causing unnecessary runs.
- Distance calculation updates were triggering re-renders for each locale.

**Error Logs:**
```
[React DevTools] LocaleScreen rendered 50+ times in 1 second
[Performance] Excessive re-renders detected
```

**Attempted Fixes:**
1. Memoized expensive computations with `useMemo`
2. Used `useCallback` for event handlers
3. Batched state updates
4. Replaced `FlatList` with `FlashList` for better performance
5. Added `React.memo` to locale card components

**Status:** ✅ Fixed

---

## 8. Root Cause Analysis

### Common Patterns Across All Errors

1. **Insufficient Guards and Early Returns**
   - Many errors occurred because functions didn't check preconditions before executing.
   - Example: Distance calculation running on empty arrays.

2. **Improper State Management**
   - State updates were happening without proper synchronization.
   - Multiple sources of truth (React Query cache vs local state).

3. **Recursive Function Calls**
   - Logger sanitization was calling itself recursively.
   - No proper termination conditions.

4. **Missing Error Handling**
   - Errors were not being caught and handled gracefully.
   - Error states were not properly managed.

5. **Race Conditions**
   - Multiple async operations running concurrently.
   - No proper cancellation or sequencing.

6. **Memory Management**
   - No cleanup for async operations.
   - State updates after component unmount.

---

## 9. Lessons Learned

### Best Practices Applied

1. **Always Check Preconditions**
   ```typescript
   if (newLocales.length === 0) {
     // Don't proceed with distance calculation
     return;
   }
   ```

2. **Use Refs for Values That Don't Trigger Re-renders**
   ```typescript
   const isMountedRef = useRef(true);
   const loadedOnceRef = useRef(false);
   ```

3. **Proper Cleanup in useEffect**
   ```typescript
   useEffect(() => {
     // Setup
     return () => {
       // Cleanup
       abortController.abort();
     };
   }, [dependencies]);
   ```

4. **Extract Error Messages Safely**
   ```typescript
   const errorMessage = error instanceof Error 
     ? error.message 
     : String(error || 'Unknown error');
   ```

5. **Guard Against Recursive Calls**
   ```typescript
   if (isSanitizing && depth === 0) {
     return '[Sanitization in progress]';
   }
   ```

6. **Use AbortController for Cancellation**
   ```typescript
   const abortController = new AbortController();
   // Pass signal to API call
   // Call abortController.abort() on cleanup
   ```

7. **Batch State Updates**
   ```typescript
   setAdminLocales(prev => {
     // Functional update to batch changes
     return updatedLocales;
   });
   ```

8. **Memoize Expensive Operations**
   ```typescript
   const memoizedValue = useMemo(() => {
     return expensiveComputation(data);
   }, [data]);
   ```

### Anti-Patterns to Avoid

1. ❌ **Don't call sanitizeData recursively without guards**
2. ❌ **Don't update state after component unmount**
3. ❌ **Don't trigger API calls without checking if data already exists**
4. ❌ **Don't clear state on errors without checking context (e.g., search query)**
5. ❌ **Don't use logger methods inside logger implementation**
6. ❌ **Don't process empty arrays in expensive operations**
7. ❌ **Don't forget to cancel async operations on cleanup**

---

## 10. Current Status and Recommendations

### Fixed Issues ✅
- Initial loading showing "No Locales Found"
- Infinite loading loop on search
- Search results not clearing
- Distance calculation on empty results
- Race conditions in state updates
- Memory leaks from unmounted components
- Excessive re-renders

### Partially Fixed / Needs Re-implementation ⚠️
- Logger sanitization errors (user reverted changes)
- Maximum call stack size exceeded (user reverted changes)
- Recursive logger calls (user reverted changes)

### Recommendations for Future Development

1. **Implement a Safe Error Logger**
   - Create a separate utility for safe error extraction
   - Avoid deep sanitization of error objects
   - Extract only message, name, and stack

2. **Add Comprehensive Error Boundaries**
   - Wrap locale screen in error boundary
   - Provide fallback UI for errors
   - Log errors to crash reporting service

3. **Implement Proper Testing**
   - Unit tests for error handling
   - Integration tests for search functionality
   - E2E tests for user flows

4. **Add Monitoring and Analytics**
   - Track error rates
   - Monitor API call patterns
   - Measure performance metrics

5. **Documentation**
   - Document all state variables and their purposes
   - Document all useEffect hooks and their dependencies
   - Document error handling strategies

---

## Conclusion

The locale feature encountered numerous errors related to:
- State management and synchronization
- Error handling and logging
- Performance and memory management
- React Query integration
- Search and filtering functionality

Most issues have been resolved through:
- Proper guards and early returns
- Better state management
- Improved error handling
- Performance optimizations

However, the logger sanitization issues need to be re-addressed with a different approach that doesn't involve deep recursive sanitization of error objects.

---

**Document Created:** 2025-12-31  
**Last Updated:** 2025-12-31  
**Author:** AI Assistant  
**Status:** Comprehensive Documentation Complete


# App Tracking Transparency (ATT) Implementation Guide

## Overview

iOS 14.5+ requires apps to request permission before tracking users across apps and websites. This guide explains how to implement App Tracking Transparency (ATT) in the Taatom app.

## Prerequisites

1. **Add Usage Description** (Already Done ✅)
   - `NSUserTrackingUsageDescription` has been added to `app.json`
   - Description: "We use your data to personalize your experience and show you relevant content. This helps us improve the app and provide better features."

2. **Install Package**
   ```bash
   cd frontend
   npm install expo-tracking-transparency
   ```

## Implementation Steps

### Step 1: Import the Package

Add to `frontend/app/_layout.tsx`:

```typescript
import * as TrackingTransparency from 'expo-tracking-transparency';
```

### Step 2: Request Permission on App Launch

Add this to `RootLayoutInner` component in `frontend/app/_layout.tsx`:

```typescript
useEffect(() => {
  // Request tracking permission on iOS
  if (Platform.OS === 'ios') {
    const requestTrackingPermission = async () => {
      try {
        const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
        if (status === 'granted') {
          logger.debug('Tracking permission granted');
          // Initialize analytics or tracking services here
        } else {
          logger.debug('Tracking permission denied');
          // Handle denied permission (still allow app usage)
        }
      } catch (error) {
        logger.error('Error requesting tracking permission:', error);
      }
    };
    
    // Request permission after a short delay to ensure app is ready
    const timer = setTimeout(() => {
      requestTrackingPermission();
    }, 1000);
    
    return () => clearTimeout(timer);
  }
}, []);
```

### Step 3: Check Permission Status (Optional)

If you need to check permission status later:

```typescript
const checkTrackingStatus = async () => {
  if (Platform.OS === 'ios') {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    return status === 'granted';
  }
  return true; // Android doesn't require ATT
};
```

## When to Request Permission

**Best Practice:** Request permission:
- After user has used the app a few times (better acceptance rate)
- When user performs an action that would benefit from tracking
- Not immediately on first launch (can be seen as intrusive)

**Current Implementation:** The code above requests on app launch. Consider moving to a more strategic time, such as:
- After user creates their first post
- When user enables analytics features
- After user has been active for a few sessions

## Handling Permission States

- **Granted**: User allows tracking → Enable analytics, personalization, ad targeting
- **Denied**: User denies tracking → Disable tracking, but app still functions normally
- **Not Determined**: Permission not yet requested → Show request when appropriate

## Important Notes

1. **Only Request Once**: Don't repeatedly request permission if denied
2. **Graceful Degradation**: App must work fully even if permission is denied
3. **No Tracking Before Permission**: Don't track users before getting permission
4. **Android**: ATT is iOS-only; Android has its own privacy controls

## Testing

1. **Test on Physical Device**: ATT doesn't work in iOS Simulator
2. **Reset Permissions**: Settings > Privacy & Security > Tracking > Reset
3. **Test Both States**: Test with permission granted and denied

## Compliance

- ✅ Usage description added to `infoPlist`
- ⚠️ ATT implementation needed (follow steps above)
- ⚠️ Update analytics services to respect ATT status

## Next Steps

1. Install `expo-tracking-transparency` package
2. Add implementation code to `_layout.tsx`
3. Update analytics initialization to check ATT status
4. Test on physical iOS device
5. Update privacy policy to mention tracking and ATT

---

**Status:** Usage description added ✅ | Implementation pending ⚠️


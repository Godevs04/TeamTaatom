# Firebase Cloud Messaging (FCM) Setup Guide

This guide explains how to set up native FCM (Firebase Cloud Messaging) for push notifications in the Taatom mobile app.

## Prerequisites

1. Firebase project configured (already done)
2. `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) files in project root
3. Development build (required - Expo Go doesn't support native modules)

## Installation

1. Install Firebase packages:
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

2. For iOS, install pods:
```bash
cd ios && pod install && cd ..
```

## Configuration

### Android

1. Ensure `google-services.json` is in `frontend/` directory
2. The file is already referenced in `app.json`:
```json
"android": {
  "googleServicesFile": "./google-services.json"
}
```

### iOS

1. Ensure `GoogleService-Info.plist` is in `frontend/` directory
2. The file is already referenced in `app.json`:
```json
"ios": {
  "googleServicesFile": "./GoogleService-Info.plist"
}
```

## Usage

FCM is automatically initialized when the app starts and user is authenticated. The service:

1. Requests notification permissions
2. Gets FCM token
3. Registers token with backend
4. Handles foreground/background notifications
5. Handles notification taps

## Important Notes

### Development Build Required

**Expo Go does NOT support native FCM modules.** You must create a development build:

```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

### Token Format

- **Old (Expo)**: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`
- **New (FCM)**: Native FCM token (long alphanumeric string)

The backend automatically detects token type and routes to the correct service.

### Migration

- Old Expo tokens will continue to work (backend supports both)
- New users will get FCM tokens
- Existing users will get FCM tokens on next app update/login

## Troubleshooting

### "Native module not found" error

This means you're running in Expo Go. Create a development build:
```bash
npx expo run:android
# or
npx expo run:ios
```

### Token not registering

1. Check Firebase configuration files are present
2. Verify Firebase project is correctly configured
3. Check app has notification permissions
4. Review logs for FCM initialization errors

### Notifications not received

1. Verify FCM token is registered in backend
2. Check Firebase Console for message delivery status
3. Ensure app has notification permissions
4. Check device is connected to internet

## Files Modified

- `frontend/services/fcm.ts` - FCM service (new)
- `frontend/services/profile.ts` - Updated to use FCM tokens
- `frontend/app/_layout.tsx` - FCM initialization
- `frontend/package.json` - Added Firebase packages, removed expo-notifications
- `frontend/app.json` - Removed expo-notifications plugin

## Backend Compatibility

The backend supports both token types:
- Expo tokens → Uses Expo Push Notification Service
- FCM tokens → Uses Firebase Admin SDK

No backend changes needed - it automatically detects token type!


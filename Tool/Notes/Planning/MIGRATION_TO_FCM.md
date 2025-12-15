# Migration from Expo Push Notifications to Native FCM

## ✅ Changes Completed

### Frontend Changes

1. **Created FCM Service** (`frontend/services/fcm.ts`)
   - Global FCM initialization
   - Token registration and refresh handling
   - Foreground/background notification handlers
   - Graceful fallback if native module not available

2. **Updated App Layout** (`frontend/app/_layout.tsx`)
   - Removed `expo-notifications` imports
   - Replaced Expo token registration with FCM initialization
   - Integrated FCM service on app start

3. **Updated Profile Service** (`frontend/services/profile.ts`)
   - Changed `updateExpoPushToken` to `updateFCMPushToken`
   - Maintains backward compatibility

4. **Updated App Config** (`frontend/app.json`)
   - Removed `expo-notifications` plugin

5. **Updated Package Dependencies** (`frontend/package.json`)
   - Removed: `expo-notifications`
   - Added: `@react-native-firebase/app`, `@react-native-firebase/messaging`

6. **Background Handler** (`frontend/index.js`)
   - Registered FCM background message handler

### Backend Changes

1. **Updated Notification Utility** (`backend/src/utils/sendNotification.js`)
   - Auto-detects token type (Expo vs FCM)
   - Routes Expo tokens → Expo Push Service
   - Routes FCM tokens → Firebase Admin SDK
   - No breaking changes - supports both!

## 📋 Next Steps

### 1. Install Dependencies

```bash
cd frontend
npm install @react-native-firebase/app@^20.0.0 @react-native-firebase/messaging@^20.0.0
npm uninstall expo-notifications
```

### 2. iOS Setup (if building for iOS)

```bash
cd ios
pod install
cd ..
```

### 3. Create Development Build

**⚠️ IMPORTANT: Expo Go does NOT support native FCM modules!**

You MUST create a development build:

```bash
# For Android
npx expo run:android

# For iOS  
npx expo run:ios
```

### 4. Verify Firebase Configuration Files

Ensure these files exist in `frontend/` directory:
- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS)

These are already referenced in `app.json`.

## 🔄 How It Works Now

### Token Flow

1. **App Starts** → FCM service initializes
2. **User Authenticates** → FCM token obtained
3. **Token Sent to Backend** → Stored in user record
4. **Backend Detects Token Type**:
   - Expo token (`ExponentPushToken[...]`) → Uses Expo Push Service
   - FCM token (native) → Uses Firebase Admin SDK

### Notification Flow

1. **Backend Action** (like, comment, follow) → Creates notification
2. **Backend Sends Push** → Detects token type automatically
3. **App Receives** → FCM handles foreground/background
4. **User Taps** → Navigation handled via `setupNotificationOpenedHandler`

## 🎯 Benefits

- ✅ Direct FCM integration (no Expo intermediary)
- ✅ Better performance and reliability
- ✅ Full control over notification handling
- ✅ Backward compatible (old Expo tokens still work)
- ✅ Production-ready Firebase setup

## ⚠️ Important Notes

1. **Development Build Required**: Cannot test in Expo Go
2. **Firebase Files**: Must have `google-services.json` and `GoogleService-Info.plist`
3. **Permissions**: App will request notification permissions on first launch
4. **Migration**: Existing users with Expo tokens will continue working until they update

## 🐛 Troubleshooting

### "Native module not found"
- You're in Expo Go → Create development build

### "FCM token not registering"
- Check Firebase config files exist
- Verify Firebase project settings
- Check notification permissions granted

### "Notifications not received"
- Verify token in backend database
- Check Firebase Console for delivery status
- Ensure app has internet connection

## 📝 Files Modified

**Frontend:**
- `services/fcm.ts` (new)
- `services/profile.ts`
- `app/_layout.tsx`
- `app.json`
- `package.json`
- `index.js`

**Backend:**
- `utils/sendNotification.js` (enhanced to support both)

## 🚀 Ready to Deploy

After installing dependencies and creating a development build, the app will:
1. Initialize FCM on startup
2. Register FCM tokens automatically
3. Handle notifications seamlessly
4. Work with existing backend (no changes needed!)


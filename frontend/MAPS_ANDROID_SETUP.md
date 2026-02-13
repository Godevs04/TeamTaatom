# Android Map Setup Guide

## Expo Go (Quick Development)

**Maps now work in Expo Go on Android** via a WebView fallback. When using Expo Go, the app automatically uses Google Maps JavaScript API in a WebView instead of the native MapView (which isn't included in Expo Go). No additional setup needed for development.

## Development Build / Production

If the map loads on iOS but not on Android in a **development build or production**, verify the following:

## 1. Google Cloud Console

1. **Enable Maps SDK for Android** – In [Google Cloud Console](https://console.cloud.google.com/apis/library) → APIs & Services → Library, enable:
   - **Maps SDK for Android**

2. **Create/Configure API Key** – In Credentials, ensure your Android key has:
   - Application restriction: **Android apps**
   - Package name: `com.taatom.app` (from `app.json` → `android.package`)
   - SHA-1 fingerprint: Use the SHA-1 from your signing key (EAS Build → project → Credentials → Android Keystore)

3. **API key in app.json** – Already set at `expo.android.config.googleMaps.apiKey`

## 2. Rebuild Required

API key changes require a **full native rebuild**. Hot reload does not pick them up.

```bash
# For development builds
eas build --profile development --platform android

# For production
eas build --profile production --platform android
```

## 3. Code Changes Applied

- `react-native-maps` added to `app.json` plugins so the API key is injected into `AndroidManifest.xml`
- `customMapStyle` disabled on Android (can cause blank map on some devices)
- Map container uses `flex: 1` and `minHeight: 200` on Android for reliable rendering

## 4. Emulator

If testing on an emulator, ensure it uses a **Google APIs** system image (not a stock image).

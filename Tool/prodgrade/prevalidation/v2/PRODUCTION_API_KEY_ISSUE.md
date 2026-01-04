# Production Google Maps API Key Issue - Root Cause & Fix

## 🔴 Problem Summary

**Error**: `REQUEST_DENIED` for all Google Maps API calls (Places API, Geocoding API)
**IP Address**: `103.215.237.162` (production server)
**Error Message**: "This IP, site or mobile application is not authorized to use this API key. Request received from IP address 103.215.237.162, with empty referer"

## 🔍 Root Cause

The API key restrictions in Google Cloud Console are blocking the requests. The error shows:
- **IP Address**: `103.215.237.162` - This is your production server IP
- **Empty Referer**: Mobile apps don't send HTTP referer headers
- **Request Denied**: The API key restrictions don't allow this IP or mobile app

## ✅ Solution (Choose Based on Your Setup)

### Scenario A: Mobile App Making Direct API Calls (Most Common)

If your React Native/Expo app makes API calls directly from the device:

1. **Go to Google Cloud Console** → APIs & Services → Credentials
2. **Find your API key** (starts with `AIzaSyAn6CzFRRsMTsWj...`)
3. **Click Edit** on the API key
4. **Application restrictions**:
   - Select **"Android apps"** for Android
   - Add package name: `com.taatom.app` (verify in `app.json`)
   - Add SHA-1 certificate fingerprint
   - OR select **"iOS apps"** for iOS
   - Add bundle ID: `com.taatom.app` (verify in `app.json`)
5. **API restrictions**:
   - Select **"Restrict key"**
   - Enable these APIs:
     - ✅ Places API (Legacy) - **REQUIRED**
     - ✅ Places API (New)
     - ✅ Geocoding API - **REQUIRED**
     - ✅ Distance Matrix API
6. **Save** and wait 5-10 minutes

### Scenario B: API Calls Through Backend/Proxy

If your app makes calls through a backend server (IP: 103.215.237.162):

1. **Create a separate API key** for server use
2. **Application restrictions**: Select **"IP addresses"**
3. **Add IP address**: `103.215.237.162`
4. **API restrictions**: Enable same APIs (Places, Geocoding, Distance Matrix)
5. **Use this key** in your backend environment variables
6. **Keep mobile key** separate with mobile app restrictions

### Scenario C: Mixed Setup (Mobile + Server)

Use **two separate API keys**:

1. **Mobile API Key**:
   - Application restrictions: Android/iOS apps
   - Bundle ID/Package name restrictions
   - Use in frontend: `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` / `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`

2. **Server API Key**:
   - Application restrictions: IP addresses
   - IP: `103.215.237.162`
   - Use in backend environment variables

## 🔧 Quick Diagnostic Steps

1. **Check your `app.json`** for bundle ID/package name:
   ```json
   {
     "expo": {
       "ios": { "bundleIdentifier": "com.taatom.app" },
       "android": { "package": "com.taatom.app" }
     }
   }
   ```

2. **Verify API key being used**:
   - Check logs: `🔑 Using Google Maps API Key: AIzaSyAn6CzFRRsMTsWj...`
   - Verify this key exists in Google Cloud Console

3. **Check API enablement**:
   - Go to APIs & Services → Library
   - Search for "Places API" (legacy) - must be enabled
   - Search for "Geocoding API" - must be enabled

4. **Check current restrictions**:
   - APIs & Services → Credentials → Your API key
   - Review "Application restrictions" and "API restrictions"

## 📋 Required APIs Checklist

Ensure these are enabled in Google Cloud Console:

- [ ] **Places API** (Legacy) - `/place/textsearch/json` endpoint
- [ ] **Places API (New)** - For future migration
- [ ] **Geocoding API** - `/geocode/json` endpoint  
- [ ] **Distance Matrix API** - If using distance calculations

## 🚨 Common Mistakes to Avoid

1. ❌ **Using HTTP referrer restrictions for mobile apps** - Mobile apps don't send referers
2. ❌ **IP restrictions on mobile API key** - Mobile keys should use bundle ID/package name
3. ❌ **Missing Legacy Places API** - Code uses legacy endpoints, need legacy API enabled
4. ❌ **Wrong bundle ID/package name** - Must match exactly (case-sensitive)
5. ❌ **Not waiting for propagation** - Changes take 5-10 minutes

## 🔐 Security Best Practices

1. ✅ **Separate keys** for iOS, Android, and Server
2. ✅ **Application restrictions** (never use "None" in production)
3. ✅ **API restrictions** (only enable needed APIs)
4. ✅ **Monitor usage** in Google Cloud Console
5. ✅ **Set billing alerts** to prevent unexpected charges

## 📝 Verification After Fix

After making changes:

1. Wait **5-10 minutes** for changes to propagate
2. Restart your app
3. Check logs - should see `✅` instead of `❌ REQUEST_DENIED`
4. Test a location search/geocoding call

## 🔗 Reference Files

- `frontend/GOOGLE_MAPS_SETUP.md` - Original setup guide
- `frontend/GOOGLE_MAPS_API_KEY_FIX.md` - Detailed fix guide
- `frontend/app.json` - Bundle ID/package name configuration
- `frontend/utils/maps.ts` - API key retrieval logic

## 💡 Still Not Working?

If issue persists after following these steps:

1. **Double-check bundle ID/package name** matches exactly
2. **Verify API key** is the one being used in logs
3. **Check Google Cloud Console** for quota/error details
4. **Review error message** - it often contains specific guidance
5. **Try creating a new API key** with correct restrictions from scratch


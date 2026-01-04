# Google Maps API Key - Production Fix Guide

## 🔴 Problem Identified

Your production logs show:
```
REQUEST_DENIED: This IP, site or mobile application is not authorized to use this API key. 
Request received from IP address 103.215.237.162, with empty referer
```

## Root Cause Analysis

The error indicates one of these issues:

1. **API Key Restrictions Too Strict**: The API key has IP/referer restrictions that don't allow the production server
2. **Wrong API Key Type**: Using a server-side restricted key for mobile app calls
3. **Missing API Enablement**: Required APIs not enabled for this key
4. **Mobile App Restrictions Missing**: API key not configured for mobile app bundle IDs

## ✅ Solution Steps

### Step 1: Check Current API Key Restrictions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your API key (the one starting with `AIzaSyAn6CzFRRsMTsWj...`)
4. Click on the key to view details

### Step 2: Configure API Key for Mobile Apps (RECOMMENDED)

For React Native/Expo apps, you should use **Application restrictions** set to **Android apps** or **iOS apps**:

#### For Android:
1. Under **Application restrictions**, select **Android apps**
2. Click **Add an item**
3. Enter your package name: `com.taatom.app` (check your `app.json`)
4. Enter SHA-1 certificate fingerprint (get from your keystore)

#### For iOS:
1. Under **Application restrictions**, select **iOS apps**
2. Click **Add an item**
3. Enter your bundle ID: `com.taatom.app` (check your `app.json`)

#### For Web (if applicable):
1. Under **Application restrictions**, select **HTTP referrers (web sites)**
2. Add your production domain: `https://taatom.com/*`
3. Add your staging domain if needed

### Step 3: Configure API Restrictions

Under **API restrictions**, ensure these APIs are enabled:

1. ✅ **Places API** (Legacy) - REQUIRED for `/place/textsearch/json`
2. ✅ **Places API (New)** - For future use
3. ✅ **Geocoding API** - REQUIRED for `/geocode/json`
4. ✅ **Distance Matrix API** - If you use distance calculations

**Important**: You need BOTH "Places API" (legacy) AND "Places API (New)" enabled!

### Step 4: If Calls Are Made from Server (IP: 103.215.237.162)

If your app makes API calls through a backend server, you need to:

#### Option A: Create Separate Server API Key
1. Create a new API key for server use
2. Set **Application restrictions** to **IP addresses**
3. Add your server IP: `103.215.237.162`
4. Enable the same APIs (Places, Geocoding, Distance Matrix)
5. Use this key in your backend environment variables

#### Option B: Remove IP Restrictions (NOT RECOMMENDED)
Only if you're sure the calls should come from anywhere:
1. Set **Application restrictions** to **None** (not recommended for security)
2. Keep **API restrictions** enabled to limit which APIs can be used

### Step 5: Verify API Enablement

1. Go to **APIs & Services** > **Library**
2. Search for each API and verify it's enabled:
   - ✅ Places API (legacy)
   - ✅ Places API (New)
   - ✅ Geocoding API
   - ✅ Distance Matrix API

### Step 6: Wait for Propagation

After making changes:
- Wait **5-10 minutes** for changes to propagate
- Restart your app
- Clear app cache if needed

## 🔍 Diagnostic Checklist

Run through this checklist to identify the exact issue:

- [ ] Is the API key configured for mobile apps (Android/iOS bundle IDs)?
- [ ] Are all required APIs enabled (Places API legacy, Geocoding, Distance Matrix)?
- [ ] Are API restrictions set correctly (not blocking the APIs you need)?
- [ ] If using server-side calls, is the server IP whitelisted?
- [ ] Are you using the correct API key for the environment (dev vs prod)?
- [ ] Have you waited 5-10 minutes after making changes?

## 🚨 Common Mistakes

1. **Using Web API Key for Mobile**: Mobile apps need mobile app restrictions, not HTTP referrer restrictions
2. **Missing Legacy Places API**: Code uses `/place/textsearch/json` which requires legacy Places API
3. **IP Restrictions on Mobile Key**: Mobile app keys shouldn't have IP restrictions
4. **Wrong Bundle ID**: Make sure bundle ID matches exactly (case-sensitive)

## 📝 Quick Fix (If Urgent)

If you need a quick fix for testing:

1. Create a temporary API key
2. Set **Application restrictions** to **None** (temporary only!)
3. Set **API restrictions** to allow only: Places API, Geocoding API, Distance Matrix API
4. Use this key for testing
5. **IMPORTANT**: Replace with properly restricted key before production!

## 🔐 Security Best Practices

For production, always:
1. ✅ Use separate API keys for iOS, Android, and Web
2. ✅ Set application restrictions (bundle IDs/package names)
3. ✅ Set API restrictions (only enable needed APIs)
4. ✅ Monitor API usage in Google Cloud Console
5. ✅ Set up billing alerts
6. ✅ Rotate keys periodically

## 📞 Still Not Working?

If the issue persists:

1. Check Google Cloud Console > APIs & Services > Dashboard for quota/error details
2. Verify the API key is being used correctly in your code
3. Check if there are multiple API keys and you're using the wrong one
4. Review the exact error message - it often contains specific guidance

## 🔗 Useful Links

- [Google Cloud Console](https://console.cloud.google.com/)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Geocoding API Documentation](https://developers.google.com/maps/documentation/geocoding)


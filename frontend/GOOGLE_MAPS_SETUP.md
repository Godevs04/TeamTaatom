# Google Maps API Setup Instructions

## ⚠️ IMPORTANT: You Need BOTH Places APIs!

Your code uses the **legacy Places API**, but you only have **Places API (New)** enabled. You need to enable **BOTH**.

## Required APIs to Enable

For each API key (iOS and Android), you need:

1. ✅ **Places API (New)** - You have this enabled
2. ❌ **Places API (LEGACY)** - **YOU NEED THIS ONE!** ⬅️ This is what your code uses
3. ✅ **Geocoding API** - You have this enabled
4. ✅ **Distance Matrix API** - You have this enabled

## The Problem

Your code calls these legacy endpoints:
- `https://maps.googleapis.com/maps/api/place/textsearch/json`
- `https://maps.googleapis.com/maps/api/place/autocomplete/json`

These require **"Places API"** (legacy), NOT "Places API (New)".

## Steps to Fix

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project ("Taatom")
3. Go to **"APIs & Services"** > **"Library"**
4. Search for **"Places API"** (without "New" - this is the legacy one)
5. Click on **"Places API"** (should show it's currently disabled)
6. Click **"Enable"**
7. For each API key (iOS and Android):
   - Go to "APIs & Services" > "Credentials"
   - Click on your API key
   - Under "API restrictions", click "Edit"
   - Add **"Places API"** (legacy) to the list
   - Save

## After Enabling

- Wait 2-5 minutes for changes to propagate
- Restart your app
- The errors should stop!

## Alternative: Migrate to Places API (New)

If you prefer to use the new API instead, we'd need to update the code. But for now, the easiest solution is to enable the legacy Places API.

## Verify Your Keys

Your `.env` file should have:
- EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=your_ios_key
- EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=your_android_key

Run: `npm run update-config` after updating .env

# Google Maps API Setup for Locale Duplicate Detection

## Overview

The admin panel now includes automatic duplicate detection when adding or editing locales. When you enter location information (name, city, country), the system:

1. **Geocodes** the address using Google Maps Geocoding API
2. **Checks** for existing locales within 500 meters
3. **Shows a confirmation** if a match is found
4. **Allows you** to populate form fields from the existing locale

## Setup Instructions

### 1. Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Geocoding API**:
   - Navigate to **APIs & Services** > **Library**
   - Search for "Geocoding API"
   - Click **Enable**

### 2. Create API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the API key

### 3. Configure API Key Restrictions (Recommended)

For security, restrict your API key:

1. Click on the API key to edit it
2. Under **Application restrictions**:
   - Select **HTTP referrers (web sites)**
   - Add your admin panel domain (e.g., `https://admin.taatom.com/*`)
   - For local development: `http://localhost:5001/*`
3. Under **API restrictions**:
   - Select **Restrict key**
   - Enable only **Geocoding API**
4. Click **Save**

### 4. Add API Key to Environment

Create a `.env` file in the `superAdmin/` directory:

```env
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
VITE_API_URL=http://localhost:3000
```

**Important**: 
- The `.env` file should be in `.gitignore` (never commit API keys)
- Restart the dev server after adding the key: `npm run dev`

## How It Works

### When Adding a New Locale

1. Enter **Name**, **City**, and **Country** fields
2. After 1 second of no typing, the system automatically:
   - Geocodes the address
   - Checks for existing locales within 500m
3. If a match is found:
   - A confirmation modal appears
   - Shows the existing locale details
   - You can choose to:
     - **Use Existing Locale Data**: Populates all form fields
     - **Continue with Current Input**: Creates a new locale

### When Editing a Locale

1. Modify **Name**, **City**, or **Country** fields
2. Same geocoding and matching process occurs
3. The system excludes the current locale being edited from matches

## Features

- ✅ **Automatic geocoding** when form fields change
- ✅ **500-meter radius** for duplicate detection
- ✅ **Debounced requests** (1 second delay) to avoid excessive API calls
- ✅ **Visual indicators** showing when geocoding is in progress
- ✅ **Confirmation modal** with existing locale details
- ✅ **One-click population** of form fields from existing locale

## Troubleshooting

### "Google Maps API key not configured"

- Check that `VITE_GOOGLE_MAPS_API_KEY` is set in `.env`
- Restart the dev server after adding the key
- Verify the key is correct (no extra spaces)

### "REQUEST_DENIED" errors

- Check API key restrictions in Google Cloud Console
- Ensure **Geocoding API** is enabled
- Verify HTTP referrer restrictions match your domain

### No matches found when there should be

- Check that existing locales have valid coordinates
- Verify coordinates are within 500 meters
- Check browser console for geocoding errors

## API Costs

Google Maps Geocoding API pricing:
- **Free tier**: $200 credit/month (covers ~40,000 requests)
- **After free tier**: $5 per 1,000 requests

The system uses debouncing to minimize API calls.


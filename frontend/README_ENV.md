# Environment Variables Configuration

This document explains how to configure environment variables for the TeamTaatom frontend application.

## Overview

All configuration values are now centralized in `frontend/utils/config.ts` and read from environment variables. This makes it easy to change URLs, API endpoints, and other configuration without modifying code.

## Setup

### 1. Create `.env` file (Optional but Recommended)

Create a `.env` file in the `frontend/` directory:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `frontend/.env` with your values:

```env
# API Configuration
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.9:3000
EXPO_PUBLIC_WEB_SHARE_URL=http://192.168.1.9:3000

# Logo Image URL
EXPO_PUBLIC_LOGO_IMAGE=https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png

# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your_google_client_id_ios
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your_google_client_id_android
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=your_google_client_secret
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=your_google_redirect_uri

# Google Maps API Key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 3. Update app.json (Automatic)

Run the update script before building:

```bash
npm run update-config
```

Or it will run automatically before `npm start` (via `prestart` hook).

## Environment Variable Priority

The configuration system uses the following priority order:

1. **`process.env.EXPO_PUBLIC_*`** - Highest priority (set at build time)
2. **`Constants.expoConfig?.extra`** - From app.json (updated by script)
3. **Fallback defaults** - Hardcoded defaults in `config.ts`

## Available Configuration Values

### API Configuration

- `EXPO_PUBLIC_API_BASE_URL` - Backend API base URL (e.g., `http://192.168.1.9:3000`)
- `EXPO_PUBLIC_WEB_SHARE_URL` - Web share URL for external sharing (e.g., `https://taatom.app`)

### Logo & Branding

- `EXPO_PUBLIC_LOGO_IMAGE` - Logo image URL

### Google OAuth

- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` - iOS-specific client ID (optional)
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID` - Android-specific client ID (optional)
- `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` - Google OAuth redirect URI

### Google Maps

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key

## Usage in Code

Import configuration values from `utils/config.ts`:

```typescript
import { API_BASE_URL, LOGO_IMAGE, getPostShareUrl, getApiUrl } from '../utils/config';

// Use API_BASE_URL
const response = await fetch(`${API_BASE_URL}/api/v1/posts`);

// Or use helper function
const response = await fetch(getApiUrl('/api/v1/posts'));

// Get share URL for a post
const shareUrl = getPostShareUrl(postId);

// Use logo image
<Image source={{ uri: LOGO_IMAGE }} />
```

## Updating Configuration

### For Development

1. Update `frontend/.env` file
2. Restart the Expo development server

### For Production Builds

1. Set environment variables before building:
   ```bash
   export EXPO_PUBLIC_API_BASE_URL=https://api.taatom.app
   npm run build
   ```

2. Or update `app.json` manually and commit:
   ```bash
   npm run update-config
   git add app.json
   git commit -m "Update config"
   ```

## Backend Environment Variables

Backend environment variables are configured in `backend/environment.env`:

- `API_BASE_URL` - Backend API base URL
- `FRONTEND_URL` - Frontend URL (for CORS)
- `LOGO_IMAGE` - Logo image URL
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI

**Note**: Backend and frontend should use matching values for consistency.

## Troubleshooting

### Values not updating?

1. Make sure `.env` file exists in `frontend/` directory
2. Restart Expo development server after changing `.env`
3. Run `npm run update-config` to update `app.json`
4. Clear Expo cache: `npx expo start -c`

### Build-time vs Runtime

- `EXPO_PUBLIC_*` variables are embedded at build time
- Changes require rebuild for production
- Development server picks up changes automatically

## Security Notes

- Never commit `.env` files to git
- `.env.example` is safe to commit (contains no secrets)
- Use different values for development and production
- Keep secrets out of `app.json` (use environment variables)


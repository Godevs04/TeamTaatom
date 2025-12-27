# Environment Variables Example
## Taatom Frontend

This file documents all environment variables that should be set in your `.env` file.

**Important**: Copy the variables below to your `.env` file and fill in the appropriate values for your environment.

---

## Required Environment Variables

### API Configuration

```env
# API Base URL
# Production: https://api.taatom.com
# Development: http://YOUR_LOCAL_IP:3000 (e.g., http://192.168.1.15:3000)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.3:3000

# Web Share URL (for sharing posts externally)
# Production: https://taatom.com
# Development: http://YOUR_LOCAL_IP:3000
EXPO_PUBLIC_WEB_SHARE_URL=http://localhost:3000
```

### Google Maps API Key

```env
# Google Maps API Key
# IMPORTANT: Add domain/package restrictions in Google Cloud Console
# - Android: Restrict to package name: com.taatom.app
# - iOS: Restrict to bundle ID: com.taatom.app
# - Web: Add HTTP referrer restrictions
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBV-jFFSI6o--8SiXjzPYon8WH4slor9Co
```

### Google OAuth Configuration

```env
# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_CLIENT_ID=236289534770-vvfj6c8611ci84aja7jsvd67rrj4uprv.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=236289534770-vvfj6c8611ci84aja7jsvd67rrj4uprv.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=236289534770-vvfj6c8611ci84aja7jsvd67rrj4uprv.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://auth.expo.io/@teamgodevs/taatom
```

### Logo and Assets

```env
# Logo Image URL
EXPO_PUBLIC_LOGO_IMAGE=https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png
```

### Sentry Error Tracking

```env
# Sentry DSN (optional but recommended)
# Get your DSN from https://sentry.io
EXPO_PUBLIC_SENTRY_DSN=

# Sentry Session Replay (optional)
EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0
```

### Environment

```env
# Environment
# Options: development, staging, production
EXPO_PUBLIC_ENV=development
```

### App Store Submission URLs (Required for Production)

```env
# Privacy Policy URL (required for App Store submission)
# This should be a publicly accessible URL to your privacy policy
# Example: https://taatom.com/policies/privacy or https://taatom.com/privacy
EXPO_PUBLIC_PRIVACY_POLICY_URL=

# Terms of Service URL (optional, for App Store submission)
EXPO_PUBLIC_TERMS_OF_SERVICE_URL=

# Support URL (for App Store submission)
EXPO_PUBLIC_SUPPORT_URL=
```

---

## How It Works

1. **Development**: The app uses values from `.env` file or falls back to defaults in `app.json`
2. **Build Time**: The `scripts/update-app-json.js` script runs before builds and updates `app.json` with values from `.env`
3. **Runtime**: The app reads from `process.env.EXPO_PUBLIC_*` variables or `Constants.expoConfig.extra` (which was updated by the script)

## Priority Order

1. `process.env.EXPO_PUBLIC_*` (highest priority - from `.env` file)
2. `Constants.expoConfig.extra.*` (from `app.json` - updated by script)
3. Fallback defaults (development only)

## Production Requirements

For production builds, the following must be set in `.env`:

- ✅ `EXPO_PUBLIC_API_BASE_URL` - Must be a production URL (not localhost/local IP)
- ✅ `EXPO_PUBLIC_WEB_SHARE_URL` - Must be a production URL (not localhost/local IP)
- ✅ `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Must have proper restrictions
- ✅ `EXPO_PUBLIC_PRIVACY_POLICY_URL` - Required for App Store submission

The build script will fail if production URLs are not properly configured.

---

## Security Notes

⚠️ **NEVER** commit your `.env` file to version control!

The following should **NEVER** be in `.env` or `app.json`:
- `GOOGLE_CLIENT_SECRET` - Backend only
- `JWT_SECRET` - Backend only
- `MONGODB_URI` - Backend only
- Any API secrets or private keys

Only `EXPO_PUBLIC_*` prefixed variables are safe to expose in the frontend bundle.


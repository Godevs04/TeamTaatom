# Security: Environment Variables

## ⚠️ CRITICAL SECURITY WARNING

**Client secrets should NEVER be exposed in the frontend bundle!**

The frontend JavaScript bundle is publicly accessible to anyone who uses the app. Any secrets included in the bundle can be extracted and used maliciously.

## What Should NOT Be in Frontend

The following should **NEVER** be exposed to the frontend:

- `GOOGLE_CLIENT_SECRET` - OAuth client secret (backend only)
- `JWT_SECRET` - JWT signing secret (backend only)
- `MONGODB_URI` - Database connection string (backend only)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (backend only)
- `CLOUDINARY_API_SECRET` - Cloudinary secret (backend only)
- Any API keys or secrets

## What IS Safe for Frontend

The following are **safe** to expose (they're meant to be public):

- `EXPO_PUBLIC_API_BASE_URL` - Public API endpoint
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` - OAuth client ID (public identifier)
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Maps API key (with domain restrictions)
- `EXPO_PUBLIC_SENTRY_DSN` - Sentry DSN (public, meant for client-side)
- `EXPO_PUBLIC_WEB_SHARE_URL` - Public share URL

## Current Status

⚠️ **ACTION REQUIRED**: `GOOGLE_CLIENT_SECRET` is currently in `app.json`. This should be removed:

1. Remove `GOOGLE_CLIENT_SECRET` from `app.json` → `expo.extra`
2. Ensure the secret is only used on the backend server
3. The environment validator (`frontend/utils/envValidator.ts`) will catch this in production builds

## Validation

The app includes automatic validation on startup (`frontend/utils/envValidator.ts`) that will:
- ✅ Check for forbidden secrets in environment variables
- ✅ Warn about unsafe variables in development
- ✅ **Throw an error in production** if secrets are detected

This prevents accidental secret exposure in production builds.


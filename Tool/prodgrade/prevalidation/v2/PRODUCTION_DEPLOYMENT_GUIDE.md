# Production Deployment Guide
## Taatom Frontend - Complete Deployment Instructions

**Last Updated**: 2025-01-27

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [EAS Build Configuration](#eas-build-configuration)
4. [Building for Production](#building-for-production)
5. [Store Submission](#store-submission)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying to production, ensure you have:

- ✅ Expo CLI installed: `npm install -g @expo/cli`
- ✅ EAS CLI installed: `npm install -g eas-cli`
- ✅ Expo account created and logged in: `eas login`
- ✅ Apple Developer account (for iOS)
- ✅ Google Play Console account (for Android)
- ✅ Production backend API running and accessible
- ✅ All environment variables configured

---

## Environment Setup

### 1. Create Production Environment File

Create a `.env.production` file in the `frontend/` directory:

```env
# Production Environment Variables
EXPO_PUBLIC_ENV=production

# API Configuration
EXPO_PUBLIC_API_BASE_URL=https://api.taatom.com
EXPO_PUBLIC_WEB_SHARE_URL=https://taatom.com

# Google Maps API Key (with restrictions)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_production_maps_key

# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_production_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your_production_ios_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your_production_android_client_id
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=https://auth.expo.io/@your-org/taatom

# Sentry Error Tracking
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0

# Privacy & Legal URLs (Required for App Store)
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://taatom.com/policies/privacy
EXPO_PUBLIC_TERMS_OF_SERVICE_URL=https://taatom.com/policies/terms
EXPO_PUBLIC_SUPPORT_URL=https://taatom.com/support/contact

# Assets
EXPO_PUBLIC_LOGO_IMAGE=https://your-cdn.com/logo.png
```

### 2. Update app.json Configuration

The `scripts/update-app-json.js` script automatically updates `app.json` from environment variables. It runs automatically via the `prestart` hook, but you can also run it manually:

```bash
cd frontend
npm run update-config
```

**Important**: The script validates production builds and will fail if:
- URLs contain `localhost` or local IP addresses
- Required environment variables are missing

### 3. Verify Configuration

Before building, verify your configuration:

```bash
# Check that environment variables are set
cat .env.production

# Run the update script to verify it works
npm run update-config

# Check the updated app.json
cat app.json | grep -A 10 "extra"
```

---

## EAS Build Configuration

### 1. Configure EAS Build Secrets

Set environment variables in EAS Build:

```bash
# Login to EAS
eas login

# Configure build secrets
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://api.taatom.com
eas secret:create --scope project --name EXPO_PUBLIC_WEB_SHARE_URL --value https://taatom.com
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value your_key
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value your_client_id
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value your_sentry_dsn
eas secret:create --scope project --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value https://taatom.com/policies/privacy
# ... add all required environment variables
```

### 2. Update eas.json

The `eas.json` file is already configured with production, preview, and development profiles. Verify the production profile:

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_ENV": "production",
        "EXPO_PUBLIC_SENTRY_ENVIRONMENT": "production"
      }
    }
  }
}
```

### 3. Configure App Store Connect (iOS)

1. Create app in App Store Connect
2. Configure app information:
   - App name, description, keywords
   - Screenshots (all required sizes)
   - Privacy policy URL
   - Support URL
   - Age rating
3. Set up TestFlight for beta testing

### 4. Configure Google Play Console (Android)

1. Create app in Play Console
2. Complete store listing:
   - App description (short and full)
   - Screenshots
   - Feature graphic (1024x500)
   - Privacy policy URL
3. Complete data safety section
4. Complete content rating (IARC)

---

## Building for Production

### 1. Update Version and Build Number

Before building, update version numbers in `app.json`:

```json
{
  "expo": {
    "version": "1.0.0",
    "ios": {
      "buildNumber": "1"
    },
    "android": {
      "versionCode": 1
    }
  }
}
```

**Note**: Increment these for each release.

### 2. Build for iOS

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Or build locally (requires macOS and Xcode)
eas build --platform ios --profile production --local
```

### 3. Build for Android

```bash
# Build for Google Play Store
eas build --platform android --profile production

# Or build locally
eas build --platform android --profile production --local
```

### 4. Build for Both Platforms

```bash
eas build --platform all --profile production
```

### 5. Monitor Build Progress

```bash
# View build status
eas build:list

# View build logs
eas build:view [build-id]
```

---

## Store Submission

### iOS App Store Submission

1. **Download the build**:
   ```bash
   eas build:download --platform ios --latest
   ```

2. **Submit to App Store**:
   ```bash
   eas submit --platform ios --latest
   ```

   Or manually:
   - Open App Store Connect
   - Go to your app → TestFlight
   - Upload the `.ipa` file
   - Complete app information
   - Submit for review

3. **Required Information**:
   - Privacy policy URL (already configured in `app.json`)
   - App description
   - Screenshots
   - Age rating
   - Support URL

### Google Play Store Submission

1. **Download the build**:
   ```bash
   eas build:download --platform android --latest
   ```

2. **Submit to Play Store**:
   ```bash
   eas submit --platform android --latest
   ```

   Or manually:
   - Open Play Console
   - Go to your app → Production
   - Upload the `.aab` file
   - Complete store listing
   - Complete data safety section
   - Submit for review

3. **Required Information**:
   - Privacy policy URL
   - App description
   - Screenshots
   - Data safety section
   - Content rating

---

## Post-Deployment

### 1. Verify Production Build

After deployment, verify:

- [ ] App loads correctly
- [ ] API calls work (check network tab)
- [ ] Authentication works
- [ ] Push notifications work
- [ ] Error tracking (Sentry) is working
- [ ] Analytics are tracking events

### 2. Monitor Error Tracking

Check Sentry dashboard for:
- Crash reports
- Error rates
- Performance issues
- User feedback

### 3. Monitor Analytics

Check analytics dashboard for:
- User engagement
- Feature usage
- Performance metrics
- User retention

### 4. Update Documentation

After successful deployment:
- Update version numbers
- Document any issues encountered
- Update deployment notes

---

## Troubleshooting

### Build Fails with "Production URLs Required"

**Error**: `❌ ERROR: Production builds cannot use localhost or local IP addresses!`

**Solution**:
1. Check `.env.production` file
2. Ensure `EXPO_PUBLIC_API_BASE_URL` is set to production URL
3. Ensure `EXPO_PUBLIC_WEB_SHARE_URL` is set to production URL
4. Run `npm run update-config` to verify

### Build Fails with "Environment Variable Missing"

**Error**: `❌ ERROR: EXPO_PUBLIC_API_BASE_URL is required for production builds!`

**Solution**:
1. Set environment variable in `.env.production`
2. Or set as EAS build secret: `eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value https://api.taatom.com`
3. Verify with `npm run update-config`

### App Crashes on Startup in Production

**Possible Causes**:
1. Missing environment variables
2. Invalid API URLs
3. Missing Sentry DSN (if Sentry is required)

**Solution**:
1. Check Sentry for crash reports
2. Verify all environment variables are set
3. Test with production API URL in development first

### Privacy Policy URL Not Working

**Error**: App Store rejects due to missing privacy policy URL

**Solution**:
1. Ensure `EXPO_PUBLIC_PRIVACY_POLICY_URL` is set
2. Verify the URL is publicly accessible
3. Check `app.json` → `ios.infoPlist.NSPrivacyPolicyURL` is set
4. Run `npm run update-config` to update

### Google Maps Not Working

**Possible Causes**:
1. API key not set
2. API key restrictions too strict
3. API key not enabled for required services

**Solution**:
1. Verify `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set
2. Check Google Cloud Console for API key restrictions
3. Ensure Maps SDK for Android/iOS is enabled
4. Verify package name/bundle ID restrictions

---

## Quick Reference

### Environment Variables Checklist

- [ ] `EXPO_PUBLIC_API_BASE_URL` - Production API URL
- [ ] `EXPO_PUBLIC_WEB_SHARE_URL` - Production web URL
- [ ] `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Maps API key
- [ ] `EXPO_PUBLIC_GOOGLE_CLIENT_ID` - OAuth client ID
- [ ] `EXPO_PUBLIC_SENTRY_DSN` - Sentry DSN
- [ ] `EXPO_PUBLIC_PRIVACY_POLICY_URL` - Privacy policy URL
- [ ] `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` - Terms URL (optional)
- [ ] `EXPO_PUBLIC_SUPPORT_URL` - Support URL

### Build Commands

```bash
# Update app.json from .env
npm run update-config

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios --latest
eas submit --platform android --latest
```

### Verification Commands

```bash
# Check environment variables
cat .env.production

# Verify app.json
cat app.json | grep -A 20 "extra"

# Check build status
eas build:list

# View build logs
eas build:view [build-id]
```

---

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)

---

**Last Updated**: 2025-01-27  
**Maintained By**: Development Team


# EAS Build Guide - Mobile Apps (iOS/Android)

**Date:** December 2024  
**Purpose:** Guide for building mobile apps using EAS Build directly

---

## 🎯 Why Use EAS Build Directly?

- **No Redundancy:** EAS Build handles everything (no need for GitHub Actions)
- **Optimized:** EAS has specialized infrastructure for mobile builds
- **Code Signing:** EAS handles iOS/Android code signing automatically
- **App Store Ready:** Direct integration with App Store/Play Store
- **Source Maps:** Automatic source map uploads (if configured)

---

## 🚀 How to Build Mobile Apps

### Option 1: Manual Build (Local)

```bash
cd frontend

# Build iOS
eas build --platform ios --profile production

# Build Android
eas build --platform android --profile production

# Build both
eas build --platform all --profile production
```

### Option 2: Automated Build (EAS Webhooks)

Set up EAS webhooks to trigger builds automatically on GitHub push:

1. Go to: https://expo.dev/accounts/[your-account]/projects/[your-project]/settings
2. Enable GitHub integration
3. Configure webhooks to trigger on push to `main` branch

### Option 3: EAS Dashboard

1. Go to: https://expo.dev/accounts/[your-account]/projects/[your-project]
2. Click "Build" tab
3. Select platform (iOS/Android)
4. Click "Start Build"

---

## 📋 Build Profiles

Configured in `frontend/eas.json`:

- **development:** Development builds with dev client
- **preview:** Internal distribution (APK/IPA)
- **production:** Store distribution (App Bundle/IPA)

### Usage:

```bash
# Development build
eas build --platform ios --profile development

# Preview build (for testing)
eas build --platform android --profile preview

# Production build (for stores)
eas build --platform ios --profile production
```

---

## 🔐 Environment Variables

EAS Build uses environment variables from:
1. `eas.json` (build profile `env` section)
2. EAS secrets (set via `eas secret:create`)
3. `.env` file (for local builds)

### Set EAS Secrets:

```bash
# Set secrets for production builds
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://api.taatom.app
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value your-sentry-dsn
```

---

## 📦 Source Maps

Source maps are automatically uploaded to Sentry via the `postPublish` hook in `eas.json`:

```json
{
  "hooks": {
    "postPublish": [
      {
        "file": "scripts/upload-sourcemaps.sh",
        "config": {
          "sentryOrg": "@teamgodevs",
          "sentryProject": "taatom"
        }
      }
    ]
  }
}
```

**Required EAS Secrets:**
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

---

## ✅ Benefits of Using EAS Build Directly

1. **No Redundancy:** One build system, not two
2. **Faster:** EAS infrastructure is optimized for mobile
3. **Simpler:** No GitHub Actions configuration needed
4. **Better Integration:** Direct App Store/Play Store support
5. **Cost Effective:** Uses EAS build credits, not GitHub Actions minutes

---

## 🔄 Current Setup

- **Web Builds:** GitHub Actions (required - EAS doesn't support web)
- **Mobile Builds:** EAS Build directly (recommended)

**No redundancy! Each build system does what it's best at.**

---

## 📚 Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS CLI Reference](https://docs.expo.dev/build-reference/eas-json/)
- [EAS Secrets](https://docs.expo.dev/build-reference/variables/)


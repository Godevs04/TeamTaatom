# Sentry CI/CD Setup Guide

**Date:** December 2024  
**Purpose:** Configure Sentry source map uploads in CI/CD instead of .env

---

## 🔐 Why SENTRY_AUTH_TOKEN Should Be in CI/CD (Not .env)

### Security Reasons:

1. **Never Bundle Secrets in App**
   - `.env` files can accidentally be bundled into the app
   - If `SENTRY_AUTH_TOKEN` is in `.env`, it could be exposed in the app bundle
   - This token has write access to your Sentry project (security risk)

2. **Build-Time Only**
   - `SENTRY_AUTH_TOKEN` is ONLY needed during build time
   - It's used to upload source maps to Sentry's servers
   - Source maps help de-obfuscate production error stack traces
   - The token is NOT needed at runtime

3. **Source Maps Purpose**
   - Production builds are minified/obfuscated
   - When errors occur, stack traces are hard to read
   - Source maps map minified code back to original source
   - Sentry uses source maps to show readable error traces

4. **Best Practice**
   - Secrets should be in CI/CD environment variables
   - Never commit secrets to repository
   - Use CI/CD secrets management (GitHub Secrets, etc.)

---

## 📋 What Was Created

### 1. GitHub Actions Workflow (`.github/workflows/frontend-build.yml`)
   - Builds frontend on push/PR
   - Uploads source maps to Sentry automatically
   - Uses GitHub Secrets for `SENTRY_AUTH_TOKEN`

### 2. EAS Build Configuration (`frontend/eas.json`)
   - Configures Expo Application Services builds
   - Sets up production build with Sentry hooks
   - Defines build profiles (development, preview, production)

### 3. Source Maps Upload Scripts
   - `frontend/scripts/upload-sourcemaps.sh` (Bash)
   - `frontend/scripts/upload-sourcemaps.js` (Node.js)
   - Both scripts handle source map uploads automatically

---

## 🚀 Setup Instructions

### Step 1: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:

```
SENTRY_AUTH_TOKEN=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
SENTRY_ORG=@teamgodevs
SENTRY_PROJECT=taatom
EXPO_PUBLIC_API_BASE_URL=https://api.taatom.app
EXPO_PUBLIC_SENTRY_DSN=https://aaf3d69d655b6b000a0457f62e4e4609@o4510503650131968.ingest.us.sentry.io/4510503712194560
EXPO_TOKEN=your-expo-token-here (if using EAS builds)
```

### Step 2: Remove SENTRY_AUTH_TOKEN from frontend/.env

Edit `frontend/.env` and remove this line:
```env
SENTRY_AUTH_TOKEN=sntrys_...
```

### Step 3: Make Upload Scripts Executable

```bash
chmod +x frontend/scripts/upload-sourcemaps.sh
chmod +x frontend/scripts/upload-sourcemaps.js
```

### Step 4: Test the Setup

#### Test GitHub Actions:
1. Push code to `main` or `develop` branch
2. Check Actions tab in GitHub
3. Verify source maps are uploaded

#### Test EAS Build:
```bash
cd frontend
eas build --platform ios --profile production
```

---

## 🔍 How It Works

### During Build:

1. **Build Process:**
   ```
   npm run build:web
   → Generates minified code + source maps
   ```

2. **Source Maps Upload:**
   ```
   sentry-cli sourcemaps upload
   → Authenticates with SENTRY_AUTH_TOKEN
   → Uploads source maps to Sentry
   → Associates with release version
   ```

3. **Error Tracking:**
   ```
   Production error occurs
   → Sentry receives error with minified stack trace
   → Sentry uses uploaded source maps
   → Shows readable stack trace in dashboard
   ```

### CI/CD Flow:

```
GitHub Push
  ↓
GitHub Actions Triggered
  ↓
Install Dependencies
  ↓
Build Production Bundle
  ↓
Upload Source Maps (using SENTRY_AUTH_TOKEN from secrets)
  ↓
Deploy/Store Artifacts
```

---

## 📊 Verification

### Check Source Maps Upload:

1. **In Sentry Dashboard:**
   - Go to: https://sentry.io/organizations/@teamgodevs/releases/
   - Find your release (GitHub SHA or build ID)
   - Check "Source Maps" section
   - Should show uploaded files

2. **In GitHub Actions:**
   - Check build logs
   - Look for: "✅ Source maps uploaded successfully!"

3. **Test Error Reporting:**
   - Trigger a test error in production
   - Check Sentry dashboard
   - Stack trace should be readable (not minified)

---

## 🛠️ Troubleshooting

### Issue: Source maps not uploading

**Check:**
- [ ] `SENTRY_AUTH_TOKEN` is set in GitHub Secrets
- [ ] `SENTRY_ORG` and `SENTRY_PROJECT` are correct
- [ ] Source maps directory exists (`dist`, `.expo/web/dist`, etc.)
- [ ] Sentry CLI is installed (`npm install -g @sentry/cli`)

**Debug:**
```bash
# Test Sentry CLI locally
export SENTRY_AUTH_TOKEN=your-token
sentry-cli releases list --org @teamgodevs --project taatom
```

### Issue: Source maps not working in Sentry

**Check:**
- [ ] Source maps are uploaded for the correct release
- [ ] Release version matches app version
- [ ] Source maps are not corrupted
- [ ] Sentry DSN matches in app and CI/CD

**Verify:**
```bash
# List uploaded source maps
sentry-cli releases files <release> list --org @teamgodevs --project taatom
```

---

## 📝 Environment Variables Summary

### ✅ In CI/CD (GitHub Secrets):
- `SENTRY_AUTH_TOKEN` - For uploading source maps
- `SENTRY_ORG` - Sentry organization
- `SENTRY_PROJECT` - Sentry project name
- `EXPO_TOKEN` - For EAS builds (optional)

### ✅ In frontend/.env (Runtime):
- `EXPO_PUBLIC_SENTRY_DSN` - Public DSN (safe to expose)
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT` - Environment name
- `EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE` - Replay config
- `EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE` - Replay config

### ❌ NOT in frontend/.env:
- `SENTRY_AUTH_TOKEN` - Should be in CI/CD only

---

## 🎯 Benefits

1. **Security:** Token never exposed in app bundle
2. **Automation:** Source maps upload automatically on build
3. **Reliability:** Consistent source map uploads
4. **Debugging:** Readable error stack traces in production
5. **Best Practice:** Follows Sentry's recommended setup

---

## 📚 References

- [Sentry Source Maps Guide](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [Sentry CLI Documentation](https://docs.sentry.io/product/cli/)
- [GitHub Secrets Guide](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

**Status:** ✅ CI/CD configuration complete. Remove `SENTRY_AUTH_TOKEN` from `.env` and add to GitHub Secrets.


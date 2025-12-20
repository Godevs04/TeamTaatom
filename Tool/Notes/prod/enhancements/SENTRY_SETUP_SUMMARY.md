# Sentry CI/CD Setup - Quick Summary

## ✅ What Was Done

1. **Created GitHub Actions Workflow** (`.github/workflows/frontend-build.yml`)
   - Automatically builds frontend on push/PR
   - Uploads source maps to Sentry using CI/CD secrets
   - Supports both web and mobile builds

2. **Created EAS Build Configuration** (`frontend/eas.json`)
   - Configures Expo Application Services builds
   - Sets up production build hooks for source map uploads
   - Defines build profiles (development, preview, production)

3. **Created Source Maps Upload Scripts**
   - `frontend/scripts/upload-sourcemaps.sh` (Bash version)
   - `frontend/scripts/upload-sourcemaps.js` (Node.js version)
   - Both handle automatic source map uploads

4. **Added npm Script**
   - `npm run upload-sourcemaps` - For manual testing

---

## 🔐 Why SENTRY_AUTH_TOKEN Must Be in CI/CD

### The Problem:
- `SENTRY_AUTH_TOKEN` is a **secret token** with write access to Sentry
- If it's in `.env`, it could accidentally be bundled into the app
- This exposes your Sentry project to security risks

### The Solution:
- Put `SENTRY_AUTH_TOKEN` in **CI/CD secrets** (GitHub Secrets)
- Only use it during **build time** to upload source maps
- Never expose it in the app bundle

### What Are Source Maps?
- Production code is **minified/obfuscated** (hard to read)
- Source maps **map minified code back to original source**
- Sentry uses source maps to show **readable error stack traces**
- Without source maps, production errors are hard to debug

### When Are Source Maps Uploaded?
- **During build** (not at runtime)
- After code is minified/bundled
- Before deploying to production
- Using `SENTRY_AUTH_TOKEN` to authenticate with Sentry API

---

## 🚀 Next Steps

### 1. Add GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Add these secrets:
```
SENTRY_AUTH_TOKEN=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
SENTRY_ORG=@teamgodevs
SENTRY_PROJECT=taatom
EXPO_PUBLIC_API_BASE_URL=https://api.taatom.app
EXPO_PUBLIC_SENTRY_DSN=https://aaf3d69d655b6b000a0457f62e4e4609@o4510503650131968.ingest.us.sentry.io/4510503712194560
```

### 2. Remove from frontend/.env

Remove this line from `frontend/.env`:
```env
SENTRY_AUTH_TOKEN=sntrys_...
```

### 3. Test the Setup

**Test GitHub Actions:**
- Push code to `main` or `develop` branch
- Check Actions tab → Should see source maps uploaded

**Test Locally (optional):**
```bash
cd frontend
export SENTRY_AUTH_TOKEN=your-token
export SENTRY_ORG=@teamgodevs
export SENTRY_PROJECT=taatom
npm run build:web
npm run upload-sourcemaps
```

---

## 📊 How It Works

```
1. Developer pushes code
   ↓
2. GitHub Actions triggers build
   ↓
3. Code is minified/bundled
   ↓
4. Source maps are generated
   ↓
5. Script uploads source maps to Sentry (using SENTRY_AUTH_TOKEN from secrets)
   ↓
6. Production error occurs
   ↓
7. Sentry receives error with minified stack trace
   ↓
8. Sentry uses uploaded source maps to show readable stack trace
```

---

## ✅ Benefits

1. **Security:** Token never exposed in app bundle
2. **Automation:** Source maps upload automatically
3. **Debugging:** Readable error traces in production
4. **Best Practice:** Follows Sentry's recommended setup
5. **Reliability:** Consistent source map uploads

---

## 📚 Full Documentation

See `Tool/Notes/prod/enhancements/SENTRY_CI_CD_SETUP.md` for complete details.

---

**Status:** ✅ Ready to use. Add secrets to GitHub and remove from `.env`.


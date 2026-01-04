# Runtime Environment Variable Configuration

## How It Works

The app **already fetches values from `.env` at runtime** with the following priority:

### Priority Order (Runtime)

1. **`process.env.EXPO_PUBLIC_*`** (from `.env` file) - **HIGHEST PRIORITY** ✅
2. **`Constants.expoConfig.extra.*`** (from `app.json` - updated by script) - Fallback
3. **Hardcoded defaults** - Development fallback only

### Configuration Flow

```
┌─────────────────┐
│   .env file     │  ← You set values here
└────────┬────────┘
         │
         │ (Runtime)
         ▼
┌─────────────────────────┐
│  utils/config.ts        │  ← Reads process.env.EXPO_PUBLIC_* FIRST
│  (Runtime Priority)     │
└────────┬────────────────┘
         │
         │ (If .env not found)
         ▼
┌─────────────────────────┐
│  app.json extra          │  ← Fallback (updated by script)
│  (Build-time fallback)   │
└─────────────────────────┘
```

## Current Implementation

All configuration values in `utils/config.ts` **already prioritize `.env` at runtime**:

```typescript
// Example from utils/config.ts
export const API_BASE_URL = getApiBaseUrl(); // Checks process.env.EXPO_PUBLIC_API_BASE_URL first

export const WEB_SHARE_URL =
  process.env.EXPO_PUBLIC_WEB_SHARE_URL ||  // ← .env FIRST
  Constants.expoConfig?.extra?.WEB_SHARE_URL ||  // ← app.json fallback
  API_BASE_URL.replace('http://', 'https://').replace(':3000', ''); // ← Default

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||  // ← .env FIRST
  Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY ||  // ← app.json fallback
  ''; // ← Default
```

## Why app.json Has Hardcoded Values?

The hardcoded values in `app.json` are **development fallbacks only**. They serve two purposes:

1. **Development**: If `.env` is not set, the app can still run in development
2. **Build-time**: The `scripts/update-app-json.js` script updates these values from `.env` during build

## How to Use

### For Development

1. Create `.env` file in `frontend/` directory:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:3000
EXPO_PUBLIC_WEB_SHARE_URL=http://192.168.1.15:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
# ... etc
```

2. **Runtime automatically uses `.env` values** - no build needed!

### For Production

1. Set environment variables in `.env.production` or EAS build secrets
2. The `scripts/update-app-json.js` script will update `app.json` during build
3. **Runtime still uses `.env` values first** if available

## Verification

To verify runtime is using `.env`:

1. Set a value in `.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://test.example.com:3000
```

2. Check the logs - you should see:
```
[Config] ✅ [WEB] Using .env API URL: http://test.example.com:3000
```

3. The app will use the `.env` value **immediately** (no rebuild needed for development)

## Summary

✅ **Runtime already uses `.env` values first**  
✅ **No changes needed** - the system is working as designed  
✅ **`app.json` values are fallbacks only** - they don't override `.env` at runtime  

The hardcoded values in `app.json` are safe to leave as development fallbacks. They will be replaced by the build script during production builds, and runtime always prioritizes `.env` values anyway.


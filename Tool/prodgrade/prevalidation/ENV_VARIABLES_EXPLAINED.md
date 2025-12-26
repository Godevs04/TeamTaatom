# Vite Environment Variables Explained

## 🔍 Understanding `import.meta.env.PROD`

You're right - you **cannot** see `PROD` in your `.env` file because it's **NOT** something you configure. It's a **built-in Vite variable** that's automatically set by Vite.

## 📚 Built-in Vite Variables (Automatic)

These variables are **automatically set by Vite** - you don't configure them:

| Variable | When It's `true` | When It's `false` |
|----------|------------------|-------------------|
| `import.meta.env.PROD` | When running `npm run build` (production) | When running `npm run dev` (development) |
| `import.meta.env.DEV` | When running `npm run dev` (development) | When running `npm run build` (production) |
| `import.meta.env.MODE` | Always set to `"production"` or `"development"` | - |

### How It Works

```javascript
// When you run: npm run dev
import.meta.env.PROD  // = false
import.meta.env.DEV   // = true
import.meta.env.MODE  // = "development"

// When you run: npm run build (or Vercel builds)
import.meta.env.PROD  // = true
import.meta.env.DEV   // = false
import.meta.env.MODE  // = "production"
```

**You don't need to set these anywhere** - Vite handles them automatically!

## 🔧 Custom Environment Variables (You Configure)

These are variables **YOU** set in `.env` file or Vercel dashboard:

| Variable | Where to Set | Example |
|----------|--------------|---------|
| `VITE_API_URL` | `.env` file or Vercel | `https://taatombackend-prod-yf2tz.sevalla.app` |
| `VITE_SENTRY_DSN` | `.env` file or Vercel | `https://...@sentry.io/...` |
| `VITE_APP_NAME` | `.env` file or Vercel | `Taatom SuperAdmin` |

### Important Rules for Custom Variables

1. **Must start with `VITE_`** - Only variables with this prefix are exposed to client code
2. **Set in `.env` file** (for local development)
3. **Set in Vercel dashboard** (for production deployment)
4. **Available at build time** - Vite embeds them during build

## 📝 Example: What Goes in `.env` File

```bash
# ✅ These are custom variables YOU set
VITE_API_URL=https://taatombackend-prod-yf2tz.sevalla.app
VITE_SENTRY_DSN=https://b3c4e3ec4b6e4f559c0fd641a8fe19ee@o4510597105319936.ingest.us.sentry.io/4510597161091072
VITE_APP_NAME=Taatom SuperAdmin

# ❌ These are BUILT-IN - DON'T add them to .env
# PROD=true          ← Vite sets this automatically
# DEV=false          ← Vite sets this automatically
# MODE=production    ← Vite sets this automatically
```

## 🔄 How It Works in Your Code

Looking at `src/services/api.js`:

```javascript
// ✅ Built-in - automatically set by Vite
const isProduction = import.meta.env.PROD;  // true in production, false in dev

// ✅ Custom - you set this in .env or Vercel
const API_BASE_URL = import.meta.env.VITE_API_URL;  // Your API URL

// The code checks if it's production AND if VITE_API_URL is set
if (isProduction && !import.meta.env.VITE_API_URL) {
  // This error happens when:
  // 1. Running in production (PROD = true)
  // 2. BUT VITE_API_URL is not set
  throw new Error('VITE_API_URL is required');
}
```

## 🎯 Summary

| Type | Variables | Where to Set | Example |
|------|-----------|--------------|---------|
| **Built-in** | `PROD`, `DEV`, `MODE` | Nowhere - Vite sets automatically | `import.meta.env.PROD` |
| **Custom** | `VITE_*` | `.env` file or Vercel | `VITE_API_URL=https://...` |

## ✅ What You Need to Do

1. **For local development**: Set `VITE_API_URL` in `.env` file
2. **For Vercel production**: Set `VITE_API_URL` in Vercel dashboard
3. **Don't worry about `PROD`** - Vite handles it automatically!

---

**TL;DR**: `PROD` is built-in by Vite, you only need to set `VITE_API_URL` in your `.env` file or Vercel dashboard.


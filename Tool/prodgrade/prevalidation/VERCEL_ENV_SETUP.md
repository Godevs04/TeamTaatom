# Vercel Environment Variables Configuration Guide

This guide shows you exactly what environment variables to configure in Vercel for production deployment.

## 🔴 REQUIRED Variables (Must Set)

These variables are **required** for the application to work:

| Variable Name | Value | Environment | Description |
|--------------|-------|-------------|------------|
| `VITE_API_URL` | `https://taatombackend-prod-yf2tz.sevalla.app` | **Production** | Backend API URL - **CRITICAL** |

## 🟡 RECOMMENDED Variables (Should Set)

These variables are recommended for production:

| Variable Name | Value | Environment | Description |
|--------------|-------|-------------|------------|
| `VITE_SENTRY_DSN` | `https://b3c4e3ec4b6e4f559c0fd641a8fe19ee@o4510597105319936.ingest.us.sentry.io/4510597161091072` | Production | Sentry error tracking |
| `VITE_SENTRY_ENVIRONMENT` | `production` | Production | Sentry environment tag |
| `VITE_SENTRY_SEND_DEFAULT_PII` | `true` | Production | Sentry PII collection |

## 🟢 OPTIONAL Variables (Nice to Have)

These variables are optional and may be used for feature flags:

| Variable Name | Value | Environment | Description |
|--------------|-------|-------------|------------|
| `VITE_APP_NAME` | `Taatom SuperAdmin` | Production | Application name |
| `VITE_APP_VERSION` | `1.0.0` | Production | Application version |
| `VITE_DEBUG_MODE` | `false` | Production | Debug mode flag |
| `VITE_ENABLE_ANALYTICS` | `true` | Production | Analytics feature flag |
| `VITE_ENABLE_REAL_TIME_LOGS` | `true` | Production | Real-time logs feature flag |
| `VITE_ENABLE_EXPORT_FEATURES` | `true` | Production | Export features flag |

## 📋 Step-by-Step: How to Configure in Vercel

### 1. Go to Vercel Dashboard
- Navigate to [vercel.com](https://vercel.com)
- Select your project: `team-taatom`

### 2. Open Environment Variables Settings
- Click on **Settings** tab
- Click on **Environment Variables** in the left sidebar

### 3. Add Each Variable

For each variable above:

1. Click **Add New**
2. Enter the **Key** (e.g., `VITE_API_URL`)
3. Enter the **Value** (e.g., `https://taatombackend-prod-yf2tz.sevalla.app`)
4. Select **Environment(s)**:
   - ✅ **Production** (required for `VITE_API_URL`)
   - ✅ **Preview** (optional, for preview deployments)
   - ❌ **Development** (not needed, use local `.env` file)
5. Click **Save**

### 4. Critical: Set for Production Environment

**IMPORTANT**: Make sure `VITE_API_URL` is set for **Production** environment. 

When adding the variable, you'll see checkboxes:
```
☑ Production
☐ Preview  
☐ Development
```

**Check the Production checkbox** for `VITE_API_URL`.

### 5. Redeploy After Setting Variables

After adding/updating environment variables:

1. Go to **Deployments** tab
2. Find your latest deployment
3. Click the **three dots (⋯)** menu
4. Click **Redeploy**
5. Wait for the build to complete

## ⚠️ Important Notes

### Why Variables Must Be Set in Vercel

- **Vite embeds environment variables at BUILD TIME**, not runtime
- Local `.env` files are **NOT** used by Vercel
- Variables must be set in Vercel dashboard **BEFORE** building
- If you set variables after deployment, you **MUST redeploy**

### Variable Naming

- All variables **MUST** start with `VITE_` prefix
- Only `VITE_*` variables are exposed to the client-side code
- Variables without `VITE_` prefix won't be accessible in the browser

### Verification

After redeploying, check the browser console. You should see:

```
🔍 Environment Check: {
  PROD: true,
  MODE: "production",
  VITE_API_URL: "✅ Set",
  API_BASE_URL: "https://taatombackend-prod-yf2tz.sevalla.app"
}
```

If you see `❌ Missing` for `VITE_API_URL`, the variable is not set correctly in Vercel.

## 🚨 Troubleshooting

### Error: "VITE_API_URL environment variable is required"

**Solution:**
1. Verify the variable is set in Vercel dashboard
2. Check that it's enabled for **Production** environment
3. **Redeploy** the application (variables are embedded at build time)

### Variable Not Working After Setting

**Solution:**
- Variables are embedded during build, so you **must redeploy** after setting them
- Make sure the variable name is exactly `VITE_API_URL` (case-sensitive)
- Check that you selected the correct environment (Production)

### How to Verify Variables Are Set

1. In Vercel dashboard → Settings → Environment Variables
2. You should see all your variables listed
3. Check the "Environment" column shows "Production" for `VITE_API_URL`

## 📝 Quick Reference: Minimum Required Setup

For the application to work, you **MUST** set at minimum:

```bash
VITE_API_URL=https://taatombackend-prod-yf2tz.sevalla.app
```

Set this in Vercel → Settings → Environment Variables → Production environment.

---

**Last Updated**: Based on `.env.prod` file configuration
**Backend URL**: `https://taatombackend-prod-yf2tz.sevalla.app`


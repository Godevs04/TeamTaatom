# GitHub Secrets & Variables Setup Guide

**Date:** December 2024  
**Purpose:** Step-by-step guide to add all required secrets and variables to GitHub

---

## 📍 Where to Add Secrets

### Option 1: Repository Secrets (Recommended for Most Cases)

**Path:** Repository → Settings → Secrets and variables → Actions → Secrets tab

**Use this for:**
- Secrets that should be available to all workflows
- Secrets that are the same across all environments
- Simple setup

### Option 2: Environment Secrets (Recommended for Production)

**Path:** Repository → Settings → Secrets and variables → Actions → Environments → [Create Environment] → Add Secret

**Use this for:**
- Different secrets for different environments (staging, production)
- More granular control
- Protection rules (required reviewers, etc.)

**For this project, we'll use Repository Secrets (simpler setup).**

---

## 🔐 Secrets to Add (Repository Secrets)

Go to: **Repository → Settings → Secrets and variables → Actions → Secrets tab → New repository secret**

### 1. SENTRY_AUTH_TOKEN
- **Name:** `SENTRY_AUTH_TOKEN`
- **Value:** `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`
- **Purpose:** Authenticates with Sentry API to upload source maps
- **Required:** Yes (for source map uploads)

### 2. SENTRY_ORG
- **Name:** `SENTRY_ORG`
- **Value:** `@teamgodevs`
- **Purpose:** Sentry organization name
- **Required:** Yes (for source map uploads)

### 3. SENTRY_PROJECT
- **Name:** `SENTRY_PROJECT`
- **Value:** `taatom`
- **Purpose:** Sentry project name
- **Required:** Yes (for source map uploads)

### 4. EXPO_PUBLIC_API_BASE_URL
- **Name:** `EXPO_PUBLIC_API_BASE_URL`
- **Value (Development):** `http://192.168.1.15:3000`
- **Value (Production):** `https://api.taatom.app` (or your production API URL)
- **Purpose:** Backend API base URL for frontend builds
- **Required:** Yes (for builds)

### 5. EXPO_PUBLIC_SENTRY_DSN
- **Name:** `EXPO_PUBLIC_SENTRY_DSN`
- **Value:** `https://aaf3d69d655b6b000a0457f62e4e4609@o4510503650131968.ingest.us.sentry.io/4510503712194560`
- **Purpose:** Sentry DSN for error tracking (public, safe to expose)
- **Required:** Yes (for error tracking)

### 6. EXPO_TOKEN (Optional - Only if using EAS builds)
- **Name:** `EXPO_TOKEN`
- **Value:** Your Expo access token (get from: https://expo.dev/accounts/[your-account]/settings/access-tokens)
- **Purpose:** Authenticates with Expo Application Services for mobile builds
- **Required:** Only if you're using EAS builds (iOS/Android)

---

## 📋 Step-by-Step Instructions

### Step 1: Navigate to Secrets Page

1. Go to your GitHub repository: `https://github.com/TeamGodevs/TeamTaatom`
2. Click **Settings** (top navigation bar)
3. In the left sidebar, click **Secrets and variables**
4. Click **Actions**
5. You'll see two tabs: **Secrets** and **Variables**

### Step 2: Add Repository Secrets

Click **New repository secret** button and add each secret:

#### Secret 1: SENTRY_AUTH_TOKEN
```
Name: SENTRY_AUTH_TOKEN
Secret: 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
```

#### Secret 2: SENTRY_ORG
```
Name: SENTRY_ORG
Secret: @teamgodevs
```

#### Secret 3: SENTRY_PROJECT
```
Name: SENTRY_PROJECT
Secret: taatom
```

#### Secret 4: EXPO_PUBLIC_API_BASE_URL
```
Name: EXPO_PUBLIC_API_BASE_URL
Secret: http://192.168.1.15:3000
```
*(Change to production URL when deploying to production)*

#### Secret 5: EXPO_PUBLIC_SENTRY_DSN
```
Name: EXPO_PUBLIC_SENTRY_DSN
Secret: https://aaf3d69d655b6b000a0457f62e4e4609@o4510503650131968.ingest.us.sentry.io/4510503712194560
```

#### Secret 6: EXPO_TOKEN (Optional)
```
Name: EXPO_TOKEN
Secret: [Your Expo access token]
```
*(Only add if you're using EAS builds)*

### Step 3: Verify Secrets

After adding all secrets, you should see them listed:
- ✅ SENTRY_AUTH_TOKEN
- ✅ SENTRY_ORG
- ✅ SENTRY_PROJECT
- ✅ EXPO_PUBLIC_API_BASE_URL
- ✅ EXPO_PUBLIC_SENTRY_DSN
- ✅ EXPO_TOKEN (if added)

---

## 🔄 Alternative: Using Variables (For Non-Sensitive Values)

For values that are **not sensitive** (like public API URLs), you can also use **Variables**:

**Path:** Repository → Settings → Secrets and variables → Actions → Variables tab

### Variables to Add (Optional):

1. **EXPO_PUBLIC_API_BASE_URL** (can be in Variables instead of Secrets)
2. **EXPO_PUBLIC_SENTRY_DSN** (can be in Variables instead of Secrets)

**Note:** The workflow supports both `vars` and `secrets`, so you can use either. Secrets are more secure, but Variables are easier to update.

---

## ✅ Verification Checklist

After adding secrets, verify:

- [ ] All 5 required secrets are added (6 if using EAS)
- [ ] Secret names match exactly (case-sensitive)
- [ ] No extra spaces in secret values
- [ ] SENTRY_AUTH_TOKEN is the full token string
- [ ] EXPO_PUBLIC_API_BASE_URL points to correct backend

---

## 🧪 Test the Setup

1. **Push code to trigger workflow:**
   ```bash
   git push origin develop
   ```

2. **Check GitHub Actions:**
   - Go to **Actions** tab in repository
   - Find the workflow run
   - Check logs for:
     - ✅ "Source maps uploaded successfully!" (if secrets are correct)
     - ⚠️ "Sentry secrets not configured" (if secrets are missing)

3. **Verify in Sentry:**
   - Go to: https://sentry.io/organizations/@teamgodevs/releases/
   - Check if source maps are uploaded for the release

---

## 🔒 Security Best Practices

1. **Never commit secrets to code** ✅ (Already done - secrets are in GitHub Secrets)
2. **Use different secrets for staging/production** (Use Environments for this)
3. **Rotate secrets regularly** (Especially SENTRY_AUTH_TOKEN)
4. **Limit access** (Only give repository access to trusted team members)

---

## 📝 Quick Reference

### Required Secrets (5):
```
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_SENTRY_DSN
```

### Optional Secrets (1):
```
EXPO_TOKEN (only if using EAS builds)
```

### Where to Add:
**Repository → Settings → Secrets and variables → Actions → Secrets → New repository secret**

---

## 🆘 Troubleshooting

### Issue: "Context access might be invalid" warnings
- **Solution:** These warnings will disappear once secrets are added. They're just informational.

### Issue: "Sentry secrets not configured" in workflow logs
- **Solution:** Check that all 3 Sentry secrets are added (SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)

### Issue: Source maps not uploading
- **Solution:** 
  1. Verify SENTRY_AUTH_TOKEN is correct
  2. Check SENTRY_ORG and SENTRY_PROJECT match your Sentry project
  3. Ensure workflow has permission to access secrets

---

**Status:** Ready to add secrets. Follow Step 1-3 above to complete setup.


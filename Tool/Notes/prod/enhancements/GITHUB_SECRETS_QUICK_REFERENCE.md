# GitHub Secrets - Quick Reference

## 🎯 Where to Add

**Path:** `Repository → Settings → Secrets and variables → Actions → Secrets → New repository secret`

## 📋 What to Add (Copy-Paste Ready)

### 1. SENTRY_AUTH_TOKEN
```
Name: SENTRY_AUTH_TOKEN
Value: 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
```

### 2. SENTRY_ORG
```
Name: SENTRY_ORG
Value: @teamgodevs
```

### 3. SENTRY_PROJECT
```
Name: SENTRY_PROJECT
Value: taatom
```

### 4. EXPO_PUBLIC_API_BASE_URL
```
Name: EXPO_PUBLIC_API_BASE_URL
Value: http://192.168.1.15:3000
```
*(Change to production URL when deploying)*

### 5. EXPO_PUBLIC_SENTRY_DSN
```
Name: EXPO_PUBLIC_SENTRY_DSN
Value: https://aaf3d69d655b6b000a0457f62e4e4609@o4510503650131968.ingest.us.sentry.io/4510503712194560
```

### 6. EXPO_TOKEN (Optional - Only if using EAS builds)
```
Name: EXPO_TOKEN
Value: [Get from: https://expo.dev/accounts/[your-account]/settings/access-tokens]
```

---

## ✅ Checklist

- [ ] Navigate to: Repository → Settings → Secrets and variables → Actions
- [ ] Click "New repository secret"
- [ ] Add all 5 required secrets (6 if using EAS)
- [ ] Verify secret names match exactly (case-sensitive)
- [ ] Test by pushing code to trigger workflow

---

**That's it!** Once added, the workflow warnings will disappear and source maps will upload automatically.


# App Review Notes – Taatom (Guideline 1.2 UGC Compliance)

**Include this in the "Notes" field when submitting to App Store Connect.**

---

## Demo Account (Skip OTP)

To test UGC features immediately without email verification:

**Email:** `john@example.com`  
**Password:** `Password1!`

Alternative accounts: `jane@example.com`, `mike@example.com` (same password).

---

## Where to Find UGC Safeguards

### Report Content
1. **On a post:** Tap the **flag icon** (top-right of the post) OR tap the **three-dot menu** → **Report**
2. **On a user profile:** Tap the **flag icon** (top-right next to the menu) OR tap the **three-dot menu** → **Report User**
3. Choose a reason (Spam, Abuse, Inappropriate Content, Harassment, Other) and submit

### Block User
1. Open any user's profile (tap their name on a post, or search for users)
2. Tap the **three-dot menu** (top-right)
3. Tap **Block User** → Confirm

### Community Guidelines
1. Tap **Profile** (bottom tab)
2. Tap **Settings** (gear icon)
3. Tap **Community Guidelines** (near the top, with flag icon)

---

## Testing Checklist

- [ ] Sign in with demo account
- [ ] View feed (should show at least 3 posts from seed users)
- [ ] Open a post → Tap flag icon → Report → Choose reason → Success message
- [ ] Open a user profile → Tap three-dot menu → Block User → Confirm
- [ ] Profile → Settings → Community Guidelines (visible in 2 taps)

---

## Production Seed Data

Before submission, ensure the production database has test content:

```bash
cd backend
MONGO_URL="<your-production-mongo-uri>" node scripts/seed_test_data.js
```

This creates 3 verified users (john@example.com, jane@example.com, mike@example.com) with 2 posts each. The script skips if users already exist.

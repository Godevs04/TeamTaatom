# Apple Guideline 1.2 UGC Compliance – Implementation Summary

## Overview

This document summarizes the User Generated Content (UGC) safeguards implemented for App Store Guideline 1.2 compliance.

---

## PART 1 — Terms & Conditions (MANDATORY)

### Implementation
- **Signup screen** (`frontend/app/(auth)/signup.tsx`): Mandatory checkbox with expanded clause before account creation
- **Clause text**: "No objectionable, abusive, sexual, violent, hateful, or illegal content is allowed. Violations will result in suspension."
- **Link**: "View full Terms →" opens `/terms` (redirects to `/policies/terms`)
- **Settings**: Terms & Conditions screen at `/settings/terms` with full policy and link to full ToS
- **Storage**: `termsAcceptedAt` stored in MongoDB User model (see schema below)

### Files
- `frontend/app/(auth)/signup.tsx` – Updated T&C checkbox and clause
- `frontend/app/settings/terms.tsx` – **Created** – Terms screen in Settings
- `frontend/app/settings/_layout.tsx` – Added terms route
- `frontend/app/settings/index.tsx` – Added Terms & Conditions and Contact Support items
- `backend/src/models/User.js` – `termsAcceptedAt` field (existing)
- `backend/src/controllers/authController.js` – T&C validation on signup (existing)

---

## PART 2 — Report Content System

### Implementation
- **Report button** on user profile (ellipsis menu) and on each content card (OptimizedPhotoCard)
- **Report modal** with reason options:
  - Spam
  - Abuse
  - Inappropriate Content
  - Harassment
  - Other
- **API**: `POST /api/v1/reports` – stores `reporterId`, `reportedUserId`, `contentId` (optional), `reason`, `status: "pending"`

### Files
- `frontend/components/ReportReasonModal.tsx` – **Created** – Reusable report reason modal
- `frontend/app/profile/[id].tsx` – Report User opens modal
- `frontend/components/OptimizedPhotoCard.tsx` – Report Post opens modal
- `frontend/services/report.ts` – Report API client (existing, added `abuse` type)
- `backend/src/controllers/reportController.js` – Create report, auto-flag logic
- `backend/src/models/Report.js` – Added `abuse` to type enum

---

## PART 3 — Block User System

### Implementation
- **Block button** on profile screen (ellipsis menu)
- **Storage**: `blockedUsers` array on User model
- **Feed**: Posts and Shorts from blocked users excluded when user is authenticated
- **Messages**: Chat controller blocks messaging between blocked users (existing)

### Files
- `frontend/app/profile/[id].tsx` – Block/Unblock in profile menu (existing)
- `backend/src/controllers/postController.js` – Exclude blocked users from `getPosts` and `getShorts`
- `backend/src/controllers/chat.controller.js` – Block check (existing)
- `backend/src/models/User.js` – `blockedUsers` field (existing)

---

## PART 4 — Moderation Support

### Implementation
- **Content status**: Post model has `status: "active" | "flagged" | "removed"`
- **Auto-flag**: When a post receives ≥3 reports, status is set to `flagged`
- **Feed filter**: All post and short queries return only `status === "active"` (or legacy posts with no status)

### Files
- `backend/src/models/Post.js` – Added `flagged` to status enum
- `backend/src/controllers/reportController.js` – Auto-flag logic when report count ≥ 3
- `backend/src/controllers/postController.js` – Status filter in getPosts, getUserPosts, getUserShorts, getShorts

---

## PART 5 — Developer Contact

### Implementation
- **Contact Support** in Settings
- Opens email link: `mailto:contact@taatom.com`

### Files
- `frontend/app/settings/contact-support.tsx` – **Created**
- `frontend/app/settings/index.tsx` – Added Contact Support section
- `frontend/app/settings/_layout.tsx` – Added contact-support route

---

## Database Schema Summary

### MongoDB (Primary Storage)

**users**
```
termsAcceptedAt: Date
blockedUsers: [ObjectId]
```

**reports**
```
reporterId (reportedBy): ObjectId
reportedUserId: ObjectId
contentId (reportedContent): ObjectId (optional)
reason: String
status: "pending" | "under_review" | "resolved" | "dismissed" | "removed"
createdAt: Date
```

**posts** (content documents)
```
status: "active" | "flagged" | "removed"
```

### Firestore Equivalent (if migrating)

| Collection | Document | Fields |
|------------|----------|--------|
| users/{userId} | - | acceptedTerms: true, acceptedAt: Timestamp, blockedUsers: [userId] |
| reports/{reportId} | - | reporterId, reportedUserId, contentId?, reason, status: "pending", createdAt |
| posts/{postId} | - | status: "active" \| "flagged" \| "removed" |

---

## Guideline 1.2 Compliance Checklist

| Requirement | Status |
|-------------|--------|
| Mandatory T&C at signup with explicit content policy | ✅ |
| Content Policy accessible from Settings | ✅ |
| Report User on profile | ✅ |
| Report Content on posts | ✅ |
| Report reason selection (Spam, Abuse, Inappropriate, Harassment, Other) | ✅ |
| Block users | ✅ |
| Blocked users cannot message | ✅ |
| Blocked users' content filtered from feed | ✅ |
| Moderation schema (status: active/flagged/removed) | ✅ |
| Auto-flag at report threshold | ✅ |
| Feed shows only active content | ✅ |
| Developer contact (contact@taatom.com) in Settings | ✅ |

---

## Files Created

| Path | Description |
|------|-------------|
| `frontend/components/ReportReasonModal.tsx` | Report reason selection modal |
| `frontend/app/settings/terms.tsx` | Terms & Conditions screen |
| `frontend/app/settings/contact-support.tsx` | Contact Support screen |
| `UGC_COMPLIANCE_SUMMARY.md` | This document |

## Files Modified

| Path | Changes |
|------|---------|
| `frontend/app/(auth)/signup.tsx` | Expanded T&C clause, "View full Terms" link |
| `frontend/app/settings/index.tsx` | Terms, Contact Support items |
| `frontend/app/settings/_layout.tsx` | terms, contact-support routes |
| `frontend/app/profile/[id].tsx` | ReportReasonModal for Report User |
| `frontend/components/OptimizedPhotoCard.tsx` | ReportReasonModal for Report Post |
| `frontend/services/report.ts` | Added `abuse` type |
| `backend/src/models/Report.js` | Added `abuse` enum |
| `backend/src/models/Post.js` | Added `flagged` to status enum |
| `backend/src/controllers/reportController.js` | Auto-flag at 3 reports |
| `backend/src/controllers/postController.js` | Status filter, blocked users filter |

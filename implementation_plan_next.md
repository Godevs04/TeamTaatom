# Implementation Plan: Production Audit Remediation

## 📌 Context & Overview
Following the comprehensive production audit of the 12 core domains and subsequent remediation, this document tracks the completion status of all items.

---

## ✅ Batch 1: Universal Global Confirmation Dialog Migration (Status: COMPLETED)

### Goal
Eliminate all 8 remaining native `window.confirm()` calls and bespoke inline delete modals across the web application, routing every destructive action through the centralized `useConfirm()` dialog.

### Completed Changes
- [x] **`web/components/trip/comments.tsx`**: Replaced bespoke inline overlay with `useConfirm()`.
- [x] **`web/components/connect/content-block-builder.tsx`**: Replaced `window.confirm("Remove this block?")` with `useConfirm()`.
- [x] **`web/app/(dashboard)/settings/route-access-requests/page.tsx`**: Replaced `window.confirm(...)` with `useConfirm()`.
- [x] **`web/app/(dashboard)/navigate/page.tsx`**: Replaced `confirm(...)` on End and Discard journey with `useConfirm()`.
- [x] **`web/app/(dashboard)/connect/edit-content/page.tsx`**: Replaced `window.confirm("You have unsaved changes...")` with `useConfirm()`.
- [x] **`web/app/(dashboard)/connect/page/[id]/page.tsx`**: Replaced cancel subscription, delete page, and archive page `confirm(...)` calls with `useConfirm()`.
- [x] **`web/app/auth/login/login-client.tsx` & `web/app/(public)/landing-login-client.tsx`**: Replaced `window.confirm(...)` for unverified OTP redirect with `useConfirm()`.

---

## 🚀 Backlog Items (P3)

### Batch 2: Profile Edit Username Immutability (Priority: Low/P3)
- **Goal:** Ensure `EditProfileModal` displays `username` with a lock icon and tooltip explaining immutability post-registration.

### Batch 3: Client-Side Comment Sorting (Priority: Low/P3)
- **Goal:** Provide interactive client-side sorting controls ("Top" vs "Newest") in `TripComments`.

---

## 🧪 Verification Summary
- **Native Confirm Search (`window.confirm` / `alert`):** 0 remaining across the codebase.
- **TypeScript Typecheck (`tsc --noEmit`):** 0 errors.
- **ESLint (`next lint`):** 0 errors / 0 warnings.
- **Playwright Confirmation Suite (`scratch/qa_confirmation_system.py`):** 7/7 PASS.
- **Full Production Audit Suite (`scratch/run_full_audit.js`):** 23/23 PASS.

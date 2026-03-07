# Web app — Improvements (prioritized)

This document lists suggested improvements for the `web/` Next.js app, ordered by **priority**: **Most wanted** → **Should have** → **Nice to have**.

---

## Priority legend

| Label | Meaning |
|-------|--------|
| **1. Most wanted** | High impact: security, reliability, or developer experience; do first. |
| **2. Should have** | Important for quality, performance, or maintainability. |
| **3. Nice to have** | Helpful polish, consistency, or future-proofing. |

---

## 1. Most wanted

### 1.1 Add automated tests
- **Current:** No test runner or tests in `web/` (no Jest/Vitest/Playwright in package.json scripts).
- **Suggestion:** Add unit tests (Vitest or Jest) for `lib/` (e.g. `api.ts`, `auth-errors.ts`, `env.ts`, `utils`) and component tests for critical UI. Add E2E (Playwright) for auth and feed flows so CI can block on regressions.
- **Why:** Prevents regressions and gives confidence when refactoring; CI already runs `npm run build` and `typecheck` but no tests.

### 1.2 Require `BACKEND_ORIGIN` in production
- **Current:** `lib/env.ts` and `next.config.mjs` fall back to `localhost:3000` when `BACKEND_ORIGIN` is unset.
- **Suggestion:** In production, treat `BACKEND_ORIGIN` as required (fail build or startup if missing) so the app never points at localhost in prod.
- **Why:** Avoids misconfiguration that could break or insecure production.

### 1.3 Revoke object URLs for preview images
- **Current:** `app/(dashboard)/create/page.tsx` uses `URL.createObjectURL(f)` for file previews; URLs are not revoked when the component unmounts or when files change.
- **Suggestion:** Store created URLs in a ref, call `URL.revokeObjectURL(url)` in a cleanup effect and when replacing/removing files.
- **Why:** Prevents memory leaks when users add/remove many images.

### 1.4 Add route-level loading UI
- **Current:** No `loading.tsx` (or equivalent) in route segments; users may see a blank screen during navigation.
- **Suggestion:** Add `loading.tsx` in `app/`, `app/(dashboard)/`, and key routes (e.g. feed, profile, settings) with skeletons or spinners.
- **Why:** Better perceived performance and clearer feedback during data fetch.

---

## 2. Should have

### 2.1 Harden middleware protected routes
- **Current:** `middleware.ts` protects a fixed list of path prefixes; `/notifications` is in PROTECTED_PREFIXES but not in the matcher (only `/activity`, `/chat`, etc. listed).
- **Suggestion:** Align matcher with PROTECTED_PREFIXES (e.g. add `/notifications` and `/notifications/:path*`) or derive matcher from the same list so new protected routes are not missed.
- **Why:** Ensures all protected routes are actually gated and covered by the matcher.

### 2.2 Centralize API error handling and user messages
- **Current:** Some pages use `lib/auth-errors.ts`; others inline `isAxiosError` and custom messages (e.g. feed page).
- **Suggestion:** Use a single helper (e.g. `getUserFacingErrorMessage(error)`) used by all API call sites and toasts; keep auth-specific logic in `auth-errors.ts` but expose one function for “message for user”.
- **Why:** Consistent error copy and easier changes (e.g. 429, network, auth).

### 2.3 Add `notifications` to middleware matcher
- **Current:** `/notifications` is protected in logic but not in `config.matcher`.
- **Suggestion:** Add `"/notifications"` and `"/notifications/:path*"` to the matcher.
- **Why:** Middleware runs only for matched paths; missing entries can cause inconsistent auth behavior.

### 2.4 Document or enforce required env for production
- **Current:** `lib/env.ts` validates shape but most server vars are optional; only production throws on invalid env.
- **Suggestion:** Add a short `env.example` or README section listing required vars for production (e.g. `BACKEND_ORIGIN`, `NEXT_PUBLIC_WEB_URL`) and optionally fail fast in `instrumentation.ts` when a required var is missing in production.
- **Why:** Reduces deployment mistakes.

### 2.5 Stricter TypeScript for API responses
- **Current:** Many `lib/api.ts` functions cast `res.data as { ... }` with optional fields.
- **Suggestion:** Define response types (or use backend OpenAPI types if available) and use them as generics on axios calls; validate with Zod at boundaries if the backend is not fully trusted.
- **Why:** Fewer runtime surprises and better refactor safety.

### 2.6 Next.js and React upgrades (planned)
- **Current:** Next 14.2.20, React 18.3.1.
- **Suggestion:** Plan an upgrade to a current Next 15 (or latest 14.x) and React 19 when stable; run typecheck and tests after upgrade.
- **Why:** Security and performance fixes; stay within support window.

---

## 3. Nice to have

### 3.1 Global error page styling
- **Current:** `app/error.tsx` uses Card and Button but no shared layout (e.g. no SiteHeader); it’s a minimal full-page error.
- **Suggestion:** Optionally wrap in the same layout as the rest of the app (or a minimal shell with logo + “Go home”) for brand consistency.
- **Why:** Better UX when something goes wrong.

### 3.2 Not-found page metadata
- **Current:** `app/not-found.tsx` has no metadata export.
- **Suggestion:** Add `export const metadata = { title: "Page not found" };` (or use `generateMetadata`) so the tab title and SEO are correct.
- **Why:** Clearer browser tab and crawlers.

### 3.3 ESLint rules for consistency
- **Current:** Only `extends: ["next/core-web-vitals", "next/typescript"]`.
- **Suggestion:** Add rules for consistent patterns (e.g. no inline `console.log` in production, prefer optional chaining, or a11y rules you care about) and run in CI (already have `npm run lint`).
- **Why:** Fewer style/quality issues over time.

### 3.4 Image optimization for CDN
- **Current:** `next.config.mjs` has Cloudinary and Google in `remotePatterns`; `IMAGE_CDN_BASE_URL` / `NEXT_PUBLIC_CDN_IMAGE_BASE` are optional in env.
- **Suggestion:** If you use a custom CDN, add a loader in `next.config.mjs` and use it with `next/image` so all images go through the CDN and Next’s optimization where applicable.
- **Why:** Consistent performance and caching.

### 3.5 Reduce duplicate env keys
- **Current:** Both `BACKEND_ORIGIN` and `NEXT_PUBLIC_API_BASE_URL` (and similar) exist; `next.config.mjs` uses a fallback chain.
- **Suggestion:** Standardize on one name for “backend API base” (e.g. `BACKEND_ORIGIN` server-side only) and document it; avoid using `NEXT_PUBLIC_*` for server-only values.
- **Why:** Clearer config and less risk of leaking server-only URLs to the client.

### 3.6 Path aliases
- **Current:** `tsconfig` has `"@/*": ["./*"]`; imports use relative paths like `../../../hooks/useFeed`.
- **Suggestion:** Use `@/` consistently (e.g. `@/hooks/useFeed`, `@/components/ui/button`) to shorten imports and simplify moves.
- **Why:** Cleaner imports and easier refactors.

---

## Summary table

| # | Item | Priority |
|---|------|----------|
| 1.1 | Add automated tests | Most wanted |
| 1.2 | Require BACKEND_ORIGIN in production | Most wanted |
| 1.3 | Revoke object URLs (create page) | Most wanted |
| 1.4 | Add route-level loading UI | Most wanted |
| 2.1 | Harden middleware protected routes | Should have |
| 2.2 | Centralize API error messages | Should have |
| 2.3 | Add notifications to middleware matcher | Should have |
| 2.4 | Document required production env | Should have |
| 2.5 | Stricter API response types | Should have |
| 2.6 | Plan Next/React upgrade | Should have |
| 3.1 | Global error page styling | Nice to have |
| 3.2 | Not-found metadata | Nice to have |
| 3.3 | Extra ESLint rules | Nice to have |
| 3.4 | Image CDN loader | Nice to have |
| 3.5 | Reduce duplicate env keys | Nice to have |
| 3.6 | Use path aliases consistently | Nice to have |

---

---

## Implemented (from above)

- **1.2** Require `BACKEND_ORIGIN` in production (`lib/env.ts` + `instrumentation.ts`)
- **1.3** Revoke object URLs on create page (preview images)
- **1.4** Route-level loading UI (`app/loading.tsx`, `(dashboard)/loading.tsx`, feed, settings, profile)
- **2.1 / 2.3** Middleware: added `/notifications` to PROTECTED_PREFIXES and matcher
- **2.2** Centralized API error: `getUserFacingErrorMessage` alias in `lib/auth-errors.ts`; feed uses `getFriendlyErrorMessage`
- **2.4** `env.example` + production check in `instrumentation.ts`
- **3.1** Error page: Taatom branding + layout
- **3.2** Not-found: `metadata` export
- **3.3** ESLint: `no-console` warn (allow warn/error)

*Generated from analysis of the `web/` folder. Update this list as items are done or priorities change.*

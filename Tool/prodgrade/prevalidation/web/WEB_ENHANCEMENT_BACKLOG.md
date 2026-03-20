# Web — enhancement backlog & prevalidation notes

Internal backlog derived from product review. Use for sprint planning, QA scope, and prod-grade prevalidation.

**Last updated:** 2026-03-13 (W-01, W-03, W-04, W-05, W-06, W-07, W-08, W-09, W-10, W-11, W-12, W-15, W-16, W-17 implemented)

---

## Status legend


| Status  | Meaning                                     |
| ------- | ------------------------------------------- |
| Done    | Implemented in codebase (verify in release) |
| Backlog | Not implemented; candidate work             |
| Partial | Some pieces exist; finish or extend         |


---

## Already delivered (reference)

These were addressed in recent web/backend work—confirm in each release:


| Item                  | Notes                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| Sign-in show password | Web login + landing login                                                     |
| Register / reset show password | `register-client.tsx`, `reset-password-client.tsx` (forgot flow is email-only) |
| Crop modal keyboard   | `image-crop-modal.tsx`: Esc close, Enter apply (not on buttons/inputs/range) + hint |
| Feed like/unlike      | Query keys `["feed", mode]` + `setQueriesData`; saved posts cache             |
| Follow/unfollow       | Backend `following.includes(id)` → `.some(id)`; `router.refresh()` on profile |
| Create flow + crop    | `react-easy-crop`, modal, drag-drop zone, short thumbnail crop                |
| Create — photo order  | Stable `photoSlots` + grip drag-reorder; `FormData` `images` order matches UI (W-01) |
| Trip share metadata   | `createMetadata` OG `type: article`, 1200×630 image + alt; `/trip/[id]` (W-06) |
| Feed retry / session  | Load-more failure banner + Retry; 401 on initial feed error → Sign in (W-09) |
| CORS / origins        | Normalized origins; apex ↔ www (backend)                                      |


---

## High impact, reasonable effort (backlog)


| ID   | Enhancement                | Description                                                                 | Prevalidation checks                            |
| ---- | -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| W-01 | Create — reorder photos    | **Done** — grip handle + drop target highlight; UUID slot ids                   | —                                             |
| W-02 | Create — per-image caption | If API adds support, optional caption per image in carousel                 | Contract with backend; empty captions OK        |
| W-03 | Crop modal — keyboard      | **Done** — `Escape` / `Enter` + footer hint; no focus trap yet              | —                                               |
| W-04 | Auth — show password       | **Done** — register + reset new password; forgot page has no password field | —                                               |
| W-05 | Feed — comments UX         | **Done** — right-side comments panel from feed card; trip page flow unchanged | —                                            |
| W-06 | Trip share — Open Graph    | **Done** — `openGraphType: article`, 1200×630 + alt (signed URLs may expire)   | —                                             |


---

## Polish & trust (backlog)


| ID   | Enhancement            | Description                                                                | Prevalidation checks      |
| ---- | ---------------------- | -------------------------------------------------------------------------- | ------------------------- |
| W-07 | Settings visual parity | **Done** — all active settings pages now use premium card/back-link style consistency | — |
| W-08 | Empty states           | **Done** — saved/profile/feed/notifications empties polished with icon + CTA where relevant | — |
| W-09 | Feed errors — retry    | **Done** — load-more banner + Retry; 401 on full-screen error → Sign in; refresh clears banner | — |


---

## Power user / growth (backlog)


| ID   | Enhancement             | Description                                                           | Prevalidation checks            |
| ---- | ----------------------- | --------------------------------------------------------------------- | ------------------------------- |
| W-10 | PWA                     | **Done (baseline)** — `app/manifest.ts`, `public/sw.js`, global SW register | Add richer caching later      |
| W-11 | Discover / search route | **Done** — `/discover` route added (redirects to existing `/search`)   | Upgrade to dedicated discover UI later |
| W-12 | Notifications (web)     | **Done** — notifications page with grouped list + mark-all-read         | Realtime optional               |


---

## Heavier / later (backlog)


| ID   | Enhancement      | Description                                       | Prevalidation checks       |
| ---- | ---------------- | ------------------------------------------------- | -------------------------- |
| W-13 | Realtime feed    | Socket updates for likes/comments on feed cards   | Fallback when disconnected |
| W-14 | Virtualized feed | Window long infinite lists for scroll performance | Scroll restore; a11y       |


---

## Optional UX niceties (from broader review)


| ID   | Enhancement                    | Notes                                                   |
| ---- | ------------------------------ | ------------------------------------------------------- |
| W-15 | Register / reset show-password | **Done** — same pattern as sign-in                         |
| W-16 | Create — draft autosave        | **Done (local)** — `localStorage` restore/save for text fields; clears on successful publish | Media files intentionally excluded |
| W-17 | Create — EXIF location hint    | **Done** — reads GPS from first JPEG via `exifr`, offers one-click apply, sets `hasExifGps/source` on submit |


---

## Prevalidation checklist (web release)

Use before tagging production:

- Auth: login, register, forgot password, session refresh
- Feed: all tabs (recents / friends / popular), like, save, infinite scroll
- Create: photo post, reorder (grip), crop, short + thumbnail crop, upload progress
- Profile: follow/unfollow, counts refresh, followers list
- Trip page: view, comments if implemented
- Env: `NEXT_PUBLIC_`*, API proxy, CSRF on mutating requests
- CORS: apex + `www` aligned with backend allowlist

---

## Related docs (repo)

- `Tool/prodgrade/prevalidation/` — deployment & env guides
- `web/Notes/` — module developer notes (post, profile, etc.)


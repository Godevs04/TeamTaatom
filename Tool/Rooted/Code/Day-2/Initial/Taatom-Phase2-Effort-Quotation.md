# Taatom — Phase 2 Enhancement Proposal & Effort Estimate

| | |
|---|---|
| **Document** | Client Approval — Scope, Effort & Commercial Quotation |
| **Prepared for** | Taatom (Client) |
| **Prepared by** | Godevs — Engineering Team |
| **Date** | 05 July 2026 |
| **Version** | 1.0 (Initial) |
| **Validity** | 30 days from date of issue |

---

## 1. Executive Summary

This document covers the scope, technical approach, effort, timeline, and commercials for the next enhancement phase of the Taatom platform (Mobile App — React Native/Expo, Web — Next.js, Backend — Node.js/MongoDB, SuperAdmin panel).

The scope is derived from the requirement notes shared on 03/07/26 and includes **9 work modules**: screen/map equalization, Travel Folder, Trip Score Ranking Table, Subscription-based Content Promotion, Feed Freshness Algorithm, Homepage revamp with Ad integration, Journey isolation fixes, **Locale monetization**, and a **known-issues stabilization pack**.

| | |
|---|---|
| **Total Effort** | **48 person-days (384 hours)** |
| **Team** | 2 developers (parallel) + shared QA |
| **Calendar Duration** | ~5.5 weeks |
| **Proposed Start** | Mon, 07 July 2026 |
| **Estimated Delivery (EDD)** | **Fri, 14 August 2026** |
| **Package Price** | **₹ 1,05,000 (INR One Lakh Five Thousand)** *(itemized value ₹ 1,15,200 — bundled discount applied)* |

---

## 2. Current Codebase Assessment (Basis of Estimate)

A technical audit of the existing repositories was carried out before estimation. Key findings that shape the effort below:

| Area | Current State | Gap Identified |
|---|---|---|
| Trip Score | Full v2 pipeline (verified visits, fraud checks, admin verification queue). Leaderboard exists **only** in SuperAdmin analytics. | No user-facing ranking table in the app; nationality is stored on user profiles but not used in Trip Score. |
| Home Feed | Recent / Friends / Popular sort modes, photos only, Redis cached. | Purely chronological — no personalization, **no "seen post" exclusion** (repeats occur). |
| Shorts Feed | Mature scoring algorithm with viewed-post exclusion, affinity pools, cold-start blending. | Logic not shared with home feed — will be leveraged as reference for Module 5. |
| Locale | Rich browse/filter tab (~4,900 lines), admin CRUD, world map in SuperAdmin. Bookmarks are device-local only. | **Zero monetization hooks** — no featured/sponsored placement, no premium gating. |
| Subscriptions | Cashfree-based creator (Connect) subscriptions with webhooks, payouts, admin approval. | No content **promotion/boost** product; global `isPremium` flag exists but unused in the app. |
| Journey Tracking | ~2,400-line tracking hook, background GPS, shared context, global floating status bar. | Status bar and journey state overlay every screen — interferes with Home and Profile (client-reported). |
| Maps | 6 map screens on mobile; mix of native `react-native-maps` and WebView fallbacks with inconsistent styling/performance. | Inconsistent map look/behavior between screens; heavy screens (1,700–2,100 lines) need performance passes. |
| Journey Photos | Waypoint capture exists (photos/reels during tracking become public posts pinned to the route). | No consolidated **"Travel Folder"** — media taken during a journey is not grouped or browsable as a trip album. |
| Ads | AdMob native ads on Home & Shorts with frequency caps; ATT/UMP consent flows completed in the previous phase. | Homepage ad slots need re-validation after the Homepage revamp (Module 6). |

---

## 3. Scope of Work — Module Details & Effort

**Blended rate: ₹ 2,400 per person-day (8 hours).** Each module includes development, unit testing, and code review. Integration QA is a separate line.

### Module 1 — Screen Equalization (Maps & Performance)

Bring all 6 map screens (journey tracking, journey detail, journey complete, current location, all locations, trip score country map) to a **uniform map experience** — consistent markers, polylines, camera behavior, dark/light theming — and apply performance passes to the two heaviest screens (list virtualization review, memoization, image sizing, render audits).

| Task | Effort |
|---|---|
| Map component consolidation (shared MapView wrapper usage across 6 screens) | 2.0 d |
| Marker/polyline/camera style parity + theming | 1.5 d |
| Performance audit & fixes (`all-locations`, `current-location`) | 1.5 d |
| **Subtotal** | **5.0 d — ₹ 12,000** |

**Deliverable:** all map screens visually and behaviorally consistent; measurable reduction in re-renders/jank on the two heavy screens.

---

### Module 2 — Travel Folder (Journey Media Album)

While a journey is being tracked, every photo/reel captured is auto-grouped into a **Travel Folder** for that trip. Folder view shows the media grid, taken-at locations on the route, and date/time — accessible from journey detail and profile.

| Task | Effort |
|---|---|
| Backend: journey–media association API (extend waypoint model, folder listing endpoint, pagination) | 2.0 d |
| Mobile: Travel Folder screen (grid + route pins + media viewer) | 2.5 d |
| Auto-capture hook into existing tracking camera flow + gallery imports taken during the journey window | 1.5 d |
| **Subtotal** | **6.0 d — ₹ 14,400** |

**Deliverable:** every completed journey exposes a browsable media folder; media captured during tracking lands there automatically.

---

### Module 3 — Ranking Table (Trip Score Leaderboard)

User-facing leaderboard ranked by Trip Score. **UI design to be supplied by SR** (as per notes). Includes region filter driven by user **nationality**, and a search bar that surfaces a user's rank details.

| Task | Effort |
|---|---|
| Backend: ranked leaderboard API (score sort, nationality/region filter, search, pagination, caching) | 2.0 d |
| Mobile: Ranking Table screen per SR design (rank rows, own-rank pinning, filters, search) | 2.5 d |
| Edge cases: ties, unverified users, empty regions | 0.5 d |
| **Subtotal** | **5.0 d — ₹ 12,000** |

**Dependency:** SR's design must be received by **Sprint 2 start (20 July)** — delay shifts this module's ETA day-for-day.

---

### Module 4 — Subscription → Content Promotion (Creator Boost)

New promotion product on top of the existing Cashfree subscription infra: creators can promote content, and promoted content is distributed to **genuinely engaged audiences** (interest/affinity based — reusing the shorts affinity data), not blind blasts. Includes purchase flow, delivery in feed, impression tracking, and admin oversight.

| Task | Effort |
|---|---|
| Backend: promotion model, purchase order flow (Cashfree one-time), eligibility & budget rules | 2.5 d |
| Feed delivery: inject promoted content to engaged-audience segments with frequency caps | 2.0 d |
| Mobile: "Promote" flow on own posts + promotion status card | 1.5 d |
| SuperAdmin: promotion approval / reporting table | 1.0 d |
| **Subtotal** | **7.0 d — ₹ 16,800** |

**Deliverable:** end-to-end paid promotion loop — pay → approve → deliver → report.

---

### Module 5 — Feed Freshness Algorithm (No-Repeat Home Feed)

Rebuild the home feed on the proven shorts-feed pattern: **a viewer never sees the same post twice** (viewed-post exclusion), fresh-first blending, and audience-nature weighting (interest affinity). Includes graceful backfill when a user exhausts fresh content.

| Task | Effort |
|---|---|
| Extend `UserInteraction` viewed-tracking to home feed posts + telemetry wiring | 1.5 d |
| Feed pipeline: seen-exclusion + freshness/affinity blend + backfill strategy | 2.5 d |
| Cache strategy rework (per-user exclusion vs shared Redis cache) | 1.0 d |
| **Subtotal** | **5.0 d — ₹ 12,000** |

**Deliverable:** measurably zero repeats within a user's rolling window; feed remains performant under cache.

---

### Module 6 — Homepage Revamp (Recent / Friends-Videos + Admin + Ads)

Per notes: **Recent tab → recent posts** (as-is, tuned by Module 5), **Friends tab → video content** from followed users. Admin (SuperAdmin) gets control over homepage composition. AdMob placements re-validated for the new layout.

| Task | Effort |
|---|---|
| Backend: friends-video feed mode (shorts/videos by followed users) | 1.5 d |
| Mobile: Friends tab video cards (inline preview, tap → player) | 2.0 d |
| SuperAdmin: homepage composition controls (pin/curate, section toggles) | 1.0 d |
| Ad slot re-integration & cap checks on new layout | 0.5 d |
| **Subtotal** | **5.0 d — ₹ 12,000** |

---

### Module 7 — Travel/Journey Isolation Fixes

Per notes: journey must **integrate with Journey module only** — active tracking must not intrude on the Home page, and Journey state must not interlock with Profile (no shared-state side effects, no overlay conflicts).

| Task | Effort |
|---|---|
| Scope the global journey status bar to navigate/journey routes (opt-in per screen) | 1.0 d |
| Decouple profile ↔ journey state reads; audit `JourneyContext` consumers | 1.0 d |
| Regression pass on tracking lifecycle (start/pause/resume/complete) after isolation | 1.0 d |
| **Subtotal** | **3.0 d — ₹ 7,200** |

---

### Module 8 — Locale Monetization

Introduce revenue hooks in the Locale feature: **sponsored/featured locale placements** (admin-managed, priced), premium locale content gating via the existing global `isPremium` flag, and server-side saved locales (prerequisite for premium sync).

| Task | Effort |
|---|---|
| Backend: sponsored-locale model + placement rules + admin CRUD | 1.5 d |
| Mobile: sponsored badge/carousel slots in Locale tab + premium-gated content UI | 2.0 d |
| Server-side saved locales (migrate from device-local bookmarks) | 1.0 d |
| SuperAdmin: sponsorship management screen | 0.5 d |
| **Subtotal** | **5.0 d — ₹ 12,000** |

**Deliverable:** two monetization levers live — paid featured placement + premium gating — with admin control.

---

### Module 9 — Known Issues Stabilization Pack

Fixes for the client-reported known issues list, including (from current backlog): journey status bar overlap glitches, map WebView fallback inconsistencies, locale distance-sort edge cases, profile pic refresh failures, and up to **10 additional prioritized bugs** triaged jointly at kickoff.

| Task | Effort |
|---|---|
| Joint triage & prioritization workshop | 0.5 d |
| Bug fixes (batched, priority order) | 3.0 d |
| Verification & regression on fixed areas | 0.5 d |
| **Subtotal** | **4.0 d — ₹ 9,600** |

---

### Cross-Cutting — Integration QA & Release

| Task | Effort |
|---|---|
| End-to-end regression (mobile + web + admin) across all modules | 1.5 d |
| Release engineering: EAS builds, Play Store/App Store submission, staged rollout | 1.0 d |
| UAT support & sign-off assistance | 0.5 d |
| **Subtotal** | **3.0 d — ₹ 7,200** |

---

## 4. Effort & Cost Summary

| # | Module | Effort (days) | Cost (₹) |
|---|---|---|---|
| 1 | Screen Equalization (Maps & Performance) | 5.0 | 12,000 |
| 2 | Travel Folder (Journey Media Album) | 6.0 | 14,400 |
| 3 | Ranking Table (Trip Score Leaderboard) | 5.0 | 12,000 |
| 4 | Subscription → Content Promotion | 7.0 | 16,800 |
| 5 | Feed Freshness Algorithm (No-Repeat) | 5.0 | 12,000 |
| 6 | Homepage Revamp + Ad Integration | 5.0 | 12,000 |
| 7 | Travel/Journey Isolation Fixes | 3.0 | 7,200 |
| 8 | Locale Monetization | 5.0 | 12,000 |
| 9 | Known Issues Stabilization Pack | 4.0 | 9,600 |
| — | Integration QA & Release | 3.0 | 7,200 |
| | **Itemized Total** | **48.0 days** | **₹ 1,15,200** |
| | **Bundled Package Price** | | **₹ 1,05,000** |

> Bundled discount of ₹ 10,200 applies only when the full scope is approved as one engagement. Modules approved individually are billed at itemized rates.

---

## 5. Timeline — Sprint Plan, ETA & EDD

Two developers working in parallel; QA shared. Start **Mon 07 Jul 2026**.

| Sprint | Dates | Modules | Milestone / ETA |
|---|---|---|---|
| Sprint 1 | 07 Jul – 18 Jul | M7 Journey Isolation, M1 Screen Equalization, M9 Bug Pack (triage + first batch) | **18 Jul** — isolation fixes + map parity build to client TestFlight/Internal track |
| Sprint 2 | 20 Jul – 31 Jul | M5 Feed Algorithm, M2 Travel Folder, M3 Ranking Table *(needs SR design by 20 Jul)* | **31 Jul** — feed no-repeat live on staging; Travel Folder + Leaderboard demo |
| Sprint 3 | 03 Aug – 14 Aug | M4 Content Promotion, M6 Homepage Revamp, M8 Locale Monetization, Integration QA, store submission | **12 Aug** — UAT build; **14 Aug** — production release (EDD) |

**EDD: Friday, 14 August 2026** (production submission to both stores; store review timelines are outside our control — typically 1–3 days after submission).

---

## 6. Assumptions

1. UI design for the Ranking Table is supplied by **SR** by 20 Jul 2026; all other screens follow the existing Taatom design system.
2. Cashfree merchant account remains active and supports one-time promotion orders (already used for Connect buy-items).
3. Known-issues list is frozen at the kickoff triage; new issues found later go to a change request or the next phase.
4. Client provides Play Console / App Store Connect access for releases (already in place).
5. Content of sponsored locales / promotion pricing tiers is a **business decision by client**; we implement the mechanism with configurable pricing.
6. One consolidated UAT round per sprint; feedback within 2 working days keeps the EDD intact.

## 7. Exclusions

- New third-party ad networks beyond current AdMob setup.
- iOS/Android store rejection remediation caused by policy areas outside this scope.
- Server/infrastructure cost changes (Redis sizing, CDN) — advisory only.
- Marketing assets, store screenshots, and copywriting.

## 8. Commercial Terms

| Term | Detail |
|---|---|
| Package Price | **₹ 1,05,000** (excl. GST if applicable) |
| Payment Schedule | 40% on approval (₹ 42,000) · 30% at Sprint 2 demo (₹ 31,500) · 30% on production release (₹ 31,500) |
| Warranty | 15 days post-release bug-fix warranty on delivered scope |
| Change Requests | Estimated separately at ₹ 2,400/person-day |

---

## 9. Approval

| | Client | Godevs |
|---|---|---|
| Name | ______________________ | ______________________ |
| Designation | ______________________ | ______________________ |
| Signature | ______________________ | ______________________ |
| Date | ______________________ | ______________________ |

*Approval of this document authorizes commencement on 07 July 2026 per the payment schedule above.*

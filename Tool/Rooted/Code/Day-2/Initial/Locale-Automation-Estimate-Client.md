# Taatom — Locale Automation Enhancement Proposal

## Client-Facing Estimate Document

| | |
|---|---|
| **Project** | Taatom Locale Automation |
| **Prepared for** | Client Review & Approval |
| **Prepared by** | Godevs Engineering Team |
| **Date** | 08 July 2026 |
| **Document Version** | 1.0 |

---

## 1. Executive Summary

Taatom currently supports Locale creation through the SuperAdmin panel, but the process is manual: admins upload images, fill location details, add spot type/travel info, and publish locales one by one.

For global scale, this is not operationally practical.

We propose building a **Locale Automation system** that allows the team to import large batches of destinations in a structured, controlled, and reviewable way.

The recommended approach is:

1. **Bulk import locales from CSV/JSON**
2. **Auto-enrich metadata** such as coordinates and address details
3. **Detect likely duplicates**
4. **Import records as drafts**
5. **Review and publish from SuperAdmin**

This will reduce manual admin effort significantly, improve consistency, and make it possible to scale locale coverage country by country rather than place by place.

---

## 2. Current Situation

### Current Admin Workflow

Today, locale creation in SuperAdmin is primarily:

- image upload
- manual name/country/city entry
- optional coordinate detection
- optional map-assisted discovery
- save one locale at a time

### Existing Good Foundation

The current system already includes:

- a strong `Locale` data model
- support for location coordinates
- support for spot types and travel info
- image gallery upload
- admin map discovery using OpenStreetMap / geocoding
- backend endpoints for locale upload and editing

### Current Limitation

The platform does **not** yet have:

- a bulk import pipeline
- draft import/review workflow
- duplicate detection for imported locales
- remote image ingestion for structured datasets
- country-scale operational upload process

---

## 3. Business Objective

Build a scalable and low-friction workflow so the Taatom team can:

- upload many locales at once
- seed countries/cities faster
- reduce repetitive admin effort
- preserve quality through review before publishing
- grow locale coverage in a structured way

---

## 4. Recommended Solution

## Phase 1 Scope — Locale Bulk Automation

We recommend implementing the following:

### 4.1 Bulk Import Tool in SuperAdmin

A new screen inside SuperAdmin where admins can:

- upload `CSV` or `JSON`
- preview rows before import
- see validation errors before saving
- import in batches

### 4.2 Backend Bulk Import API

A backend import endpoint that:

- accepts bulk locale data
- validates records
- normalizes values
- geocodes missing coordinates
- stores rows as drafts

### 4.3 Draft Review Workflow

Imported locales should not go live immediately.

Each imported row will be marked for review so admins can:

- verify location quality
- check image status
- review duplicate warnings
- publish only approved locales

### 4.4 Duplicate Detection

Before a locale is created, the system should check:

- similar name
- same country code
- nearby coordinates

This avoids repeated destination entries.

### 4.5 Image Handling Strategy

Because the current locale flow expects images, the automation flow should support:

- remote image URL ingestion, or
- placeholder image for draft locales, or
- image-missing review flag

This allows large imports without blocking on manual image upload for every row.

---

## 5. Recommended Functional Deliverables

### Deliverable A — Bulk File Import

- CSV upload
- JSON upload
- row parsing
- field validation
- import summary

### Deliverable B — Auto Enrichment

- auto geocode missing coordinates
- reverse address support where needed
- standardize country and state values
- normalize spot types

### Deliverable C — Draft Review Queue

- imported locales marked as drafts/inactive
- admin review table
- filter by batch / country / status
- publish / reject actions

### Deliverable D — Duplicate & Quality Checks

- exact match checks
- nearby-coordinate checks
- likely duplicate warnings
- invalid row reporting

### Deliverable E — Optional Image Intake

- accept remote image URL when available
- or assign placeholder image
- mark image-missing records for later admin review

---

## 6. Suggested User Flow

### Admin Experience

1. Open **Bulk Import Locales**
2. Upload CSV/JSON file
3. Preview parsed rows
4. Fix or remove invalid rows
5. Start import
6. Imported locales appear as **Drafts**
7. Admin reviews flagged records
8. Admin bulk-publishes approved locales

This keeps the workflow simple while maintaining data quality.

---

## 7. Project Approach

### Why this approach is recommended

This is the easiest and safest method because it:

- scales much better than map-click creation
- avoids uncontrolled mass publishing
- works with the current backend architecture
- reduces operational burden
- creates a reusable long-term import process

### Why not automate directly from world map only

Map discovery is already useful for manual or city-level enrichment, but it is not the right tool for large global imports because:

- it remains human-driven
- it is slower for batch operations
- it lacks structured dataset control
- image handling remains manual

---

## 8. Effort Estimate

### Proposed Engineering Scope

| Module | Scope | Effort |
|---|---|---|
| 1 | Bulk import backend API + validation engine | 4 days |
| 2 | CSV/JSON parser + normalization layer | 2 days |
| 3 | SuperAdmin bulk import UI + preview | 3 days |
| 4 | Draft/review workflow in admin | 2 days |
| 5 | Duplicate detection + quality checks | 2 days |
| 6 | Image strategy (remote URL / placeholder / missing-image handling) | 2 days |
| 7 | QA, bug fixing, import testing with sample datasets | 2 days |
| | **Total** | **17 person-days** |

### Effort in Hours

Assuming 8 hours/day:

- **17 days x 8 hours = 136 engineering hours**

---

## 9. Commercial Estimate

Using the same blended rate basis used for the broader Phase 2 planning:

- **Rate:** ₹ 2,400 per person-day

### Cost Summary

| | |
|---|---|
| **Total effort** | 17 person-days |
| **Itemized value** | ₹ 40,800 |
| **Recommended client quote** | **₹ 42,000** |

### Why quote ₹ 42,000 instead of ₹ 40,800

This rounded client-facing number covers:

- engineering coordination
- import edge-case handling
- admin workflow polish
- post-build deployment support

This is still commercially clean and easy to present.

---

## 10. Timeline

### Recommended Delivery Timeline

| Week | Scope |
|---|---|
| Week 1 | Backend import API, parser, normalization, validation |
| Week 2 | SuperAdmin UI, draft review flow, duplicate logic |
| Week 3 | Image handling, QA, pilot import, fixes, deployment |

### ETA / EDD

| | |
|---|---|
| **Estimated duration** | ~3 weeks |
| **ETA for internal demo** | End of Week 2 |
| **EDD for production-ready delivery** | End of Week 3 |

If started immediately, this is a realistic compact delivery.

---

## 11. Assumptions

This estimate assumes:

1. Existing locale schema remains largely unchanged
2. Current SuperAdmin structure is reused
3. Import source will be CSV/JSON, not live third-party sync in Phase 1
4. Remote image sources, if used, are client-approved / licensed
5. Client will provide sample dataset(s) for testing
6. Draft review status can be introduced without major product redesign

---

## 12. Out of Scope

The following are not included in this estimate unless separately approved:

- automated crawling/scraping of global tourism websites
- full real-time sync with Google Places or third-party travel datasets
- AI-generated descriptions for every locale
- copyright/legal sourcing of third-party images
- advanced ranking/scoring of locales by popularity
- multilingual locale auto-translation

These can be added in a later phase if needed.

---

## 13. Risks / Considerations

### Image Source Risk

The current locale create flow is image-oriented, so for real global scaling, image sourcing needs a clear policy:

- remote URL import
- placeholder for drafts
- or manual enrichment later

### Data Quality Risk

Blind bulk import without review will create:

- duplicates
- weak category mapping
- incomplete locations

So draft review is essential.

### Performance Risk

Very large locale imports should be rolled out:

- by batch
- by region/country
- with monitoring on admin and app query performance

---

## 14. Recommendation to Client

We recommend approving **Phase 1: Locale Bulk Automation** with the following outcome:

- import hundreds or thousands of locales much faster
- reduce manual admin effort dramatically
- maintain quality through draft review
- create a repeatable operational workflow for country-wise expansion

This is the most practical and scalable next step for growing the Locale feature globally.

---

## 15. Approval Summary

| | |
|---|---|
| **Project** | Locale Bulk Automation |
| **Total Effort** | 17 person-days |
| **Estimated Duration** | 3 weeks |
| **Commercial Quote** | **₹ 42,000** |

---

## 16. Optional Phase 2 (Future)

Once Phase 1 is stable, we can propose a second automation phase:

- map-driven bulk import from OSM visible POIs
- scheduled imports by region
- smarter taxonomy mapping
- locale popularity scoring
- premium/sponsored locale ingestion controls

That should be treated as a separate enhancement after this foundation is live.

---

## 17. Sign-Off

| | Client | Godevs |
|---|---|---|
| Name | ____________________ | ____________________ |
| Signature | ____________________ | ____________________ |
| Date | ____________________ | ____________________ |


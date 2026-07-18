# Locale Automation Plan

## Purpose
This document explains the easiest and safest way to automate Locale creation in the SuperAdmin panel instead of uploading places one by one.

It is based on the current codebase flow in:

- `backend/src/models/Locale.js`
- `backend/src/controllers/localeController.js`
- `backend/src/routes/localeRoutes.js`
- `SuperAdmin/src/pages/Locales.jsx`
- `SuperAdmin/src/components/LocalesWorldMap.jsx`
- `SuperAdmin/src/utils/geocoding.js`

---

## 1. Current State Analysis

### 1.1 Locale schema today
The current `Locale` model already supports almost everything needed for bulk creation:

- `name`
- `country`
- `countryCode`
- `stateProvince`
- `stateCode`
- `city`
- `description`
- `displayOrder`
- `spotTypes` (array)
- `travelInfo` (enum)
- `latitude`
- `longitude`
- `imageStorageKeys` (gallery support)
- `storageKey` / `cloudinaryKey` / `imageKey` for primary image
- `isActive`
- `createdBy`

Important constraints from the model / controller:

- `name`, `country`, `countryCode`, and `city` are effectively required.
- `latitude` must be between `-90` and `90`.
- `longitude` must be between `-180` and `180`.
- Coordinates are rounded to 3 decimals in the upload flow.
- `travelInfo` must be one of:
  - `Drivable`
  - `Walkable`
  - `Public Transport`
  - `Flight Required`
  - `Not Accessible`
- Images are currently required in the create flow.

### 1.2 SuperAdmin flow today
Current locale creation is manual:

1. Open `Locales` page in SuperAdmin
2. Add images
3. Fill name, country, countryCode, city, etc.
4. Optionally detect place from map / geocoding
5. Submit via `POST /api/v1/locales/upload`

The form sends multipart data with:

- `images`
- `name`
- `country`
- `countryCode`
- `city`
- optional: `stateProvince`, `description`, `displayOrder`, `spotTypes`, `travelInfo`, `latitude`, `longitude`

### 1.3 Existing automation-like capabilities already present
There is already a partial discovery flow inside the admin map:

- `LocalesWorldMap.jsx` can auto-load OSM tourism POIs inside map bounds
- admin can click a navy landmark dot
- system reverse-geocodes and prepares locale form data
- then admin still creates the locale one by one

So the product already has **place discovery**, but not **bulk ingestion**.

---

## 2. Main Problem

The client wants to upload locales "all over the world" easily.

Doing that fully manually is not scalable because:

1. **Huge volume**: thousands of places
2. **Image dependency**: current API requires at least one uploaded image
3. **Data quality risk**: duplicate places, wrong country/city mapping, weak spot typing
4. **Copyright risk**: images for worldwide places cannot just be scraped blindly
5. **Performance risk**: importing everything globally without curation will flood the locale tab

So the right solution is **semi-automated ingestion with review**, not uncontrolled global dumping.

---

## 3. Recommended Easiest Approach

## Recommendation: CSV/JSON Bulk Import + Geocode + Optional Image Strategy

The easiest practical solution is:

1. Prepare a structured source dataset
2. Import it through a backend bulk-import job
3. Auto-fill geo/address metadata
4. Optionally attach images if provided
5. Push imported records into a **review queue**
6. Approve/publish in SuperAdmin

This is much easier and safer than trying to auto-create everything directly from the world map.

---

## 4. Best Automation Options

### Option A — Bulk import from curated CSV/JSON (Recommended)

Admin uploads a file like:

```csv
name,country,countryCode,stateProvince,stateCode,city,description,spotTypes,travelInfo,latitude,longitude,imageUrl
Eiffel Tower,France,FR,Ile-de-France,IDF,Paris,Iconic landmark,"Historical spots|Viewpoints",Walkable,48.8584,2.2945,https://...
```

System flow:

1. Parse CSV/JSON
2. Validate rows
3. Normalize country/city/state values
4. If coordinates missing, geocode them
5. If image URL is present, download + upload to storage
6. Create locale in DB as `inactive` initially
7. Show import results in admin review screen

### Why this is the best option

- easy for operations team
- easy to rerun
- easy to audit
- easy to deduplicate
- no UI bottleneck
- can scale country by country

### Option B — Bulk import from map-visible OSM tourist POIs

This would extend the existing `LocalesWorldMap` discovery mode:

- load all visible OSM POIs in bounds
- allow checkbox multi-select
- click `Bulk Import`
- reverse-geocode each POI
- create draft locales

This is good for city-by-city seeding, but not ideal for "all over the world" in one step.

### Option C — Scheduled ingest from external sources

This is the most scalable long-term option:

- source from OSM / curated tourism dataset / Google Places shortlist
- nightly import job
- duplicate detection
- region-by-region publishing

This is powerful but should be Phase 2 after Option A works.

---

## 5. What Should NOT Be Automated Blindly

### 5.1 Images for every place
This is the biggest blocker in the current flow.

The create API currently requires at least one image file:

- `uploadLocale()` rejects if no files are present
- files must be multipart uploads

So global automation cannot be truly easy unless one of these happens:

#### Better approach
- make image optional for bulk import drafts, or
- support `remoteImageUrl` ingestion in backend, or
- use a default placeholder image for draft locales

### 5.2 Automatic import of all world landmarks
Not recommended without controls because:

- duplicates will explode
- mobile locale UX will become noisy
- many places may not match your product curation standard
- search/filter performance will degrade over time

So import should be:

- by country
- by state
- by category
- by priority score

---

## 6. Recommended Final Solution Design

## Phase 1: Bulk Draft Importer

### Admin feature
Add a new SuperAdmin tool:

- `Bulk Import Locales`
- upload `CSV` or `JSON`
- preview parsed rows
- validate before insert
- import as `inactive drafts`

### Backend feature
Add a new endpoint, for example:

- `POST /api/v1/locales/bulk-import`

Input:

```json
{
  "rows": [
    {
      "name": "Eiffel Tower",
      "country": "France",
      "countryCode": "FR",
      "stateProvince": "Ile-de-France",
      "city": "Paris",
      "description": "Iconic landmark",
      "spotTypes": ["Historical spots", "Viewpoints"],
      "travelInfo": "Walkable",
      "latitude": 48.8584,
      "longitude": 2.2945,
      "imageUrl": "https://example.com/eiffel.jpg"
    }
  ],
  "mode": "draft"
}
```

### Import rules

For each row:

1. Validate required fields
2. Normalize text
3. If lat/lng missing:
   - call geocode helper
4. Detect duplicates using:
   - same normalized `name`
   - same `countryCode`
   - nearby coordinates (for example <= 0.5 km)
5. If image URL exists:
   - download image
   - upload to storage
   - store as primary image
6. If no image exists:
   - either reject the row
   - or create with placeholder and `needsImage=true`
7. Save locale as `isActive: false`

### Output

```json
{
  "created": 820,
  "skippedDuplicates": 118,
  "failed": 42,
  "errors": [
    {
      "row": 14,
      "reason": "Missing city"
    }
  ]
}
```

---

## 7. Strongly Recommended Backend Changes

To make automation easy, these are the most useful improvements:

### 7.1 Add bulk import endpoint
New controller specifically for machine ingestion.

### 7.2 Make image optional for draft imports
Current create flow is human-upload-first.

For bulk automation, one of these should be introduced:

- `allowMissingImageForDraft = true`
- default placeholder image
- `remoteImageUrl` → fetch and store

### 7.3 Add duplicate protection
Current schema has no uniqueness rule for place identity.

Recommended duplicate detection key:

- normalized `name`
- `countryCode`
- coordinate radius match

Optional future field:

- `source`
- `sourceId`
- `importBatchId`

### 7.4 Add review metadata
Recommended fields:

- `importSource`
- `importBatchId`
- `importStatus` (`draft`, `reviewed`, `published`, `rejected`)
- `needsImage`
- `needsLocationReview`
- `duplicateOf`

These are not present today but would make admin operations much easier.

---

## 8. Easiest Operational Workflow

If the team wants the **least painful real-world workflow**, this is the best path:

### Step 1
Collect destination data from one source at a time:

- country tourism board dataset
- curated CSV from ops team
- OSM-exported POIs by country/city

### Step 2
Run a preprocessing script locally:

- clean names
- map country to ISO code
- split spot types
- infer city/state
- remove obvious duplicates

### Step 3
Upload cleaned CSV/JSON into SuperAdmin bulk importer

### Step 4
Import as drafts only

### Step 5
Review in SuperAdmin:

- missing image
- missing coordinates
- duplicate warning
- wrong category

### Step 6
Bulk approve selected locales

This gives automation without losing data quality.

---

## 9. Fastest Short-Term Win Using Existing Code

Without redesigning the whole locale system, the fastest near-term improvement is:

### Build a mini importer on top of current APIs

#### Approach
Create a script that:

1. reads a CSV/JSON file
2. uses existing geocoding helpers or backend map endpoints
3. downloads one image per row if available
4. submits multipart `POST /api/v1/locales/upload`

#### Pros
- minimal backend changes initially
- uses current storage flow
- fastest proof of concept

#### Cons
- slower than native bulk DB processing
- one API call per locale
- still dependent on images
- weaker duplicate controls

### Verdict
Good for importing the first 100–500 locales.
Not the best long-term solution for global scale.

---

## 10. Best Technical Architecture (Recommended)

## Recommended final architecture

### Layer 1 — Ingestion
- CSV / JSON upload
- optional OSM / Google source adapters

### Layer 2 — Normalization
- clean strings
- normalize country codes
- infer state/city
- coordinate rounding

### Layer 3 — Enrichment
- geocode missing coordinates
- reverse-address if needed
- infer spot types from source tags
- optional remote image fetch

### Layer 4 — Validation
- schema validation
- duplicate checks
- image availability checks

### Layer 5 — Review
- import summary
- flagged rows
- draft mode

### Layer 6 — Publish
- bulk activate approved locales

---

## 11. Spot Type Automation Idea

Current `spotTypes` is flexible array input, which is good for automation.

For easier imports, define a mapping table such as:

| Source tag | Taatom spotTypes |
|---|---|
| `museum` | `Historical spots` |
| `viewpoint` | `Viewpoints` |
| `beach` | `Beaches` |
| `temple` | `Religious places` |
| `park` | `Nature` |
| `castle` | `Historical spots` |
| `waterfall` | `Nature` |
| `market` | `Local experience` |

This can be done in preprocessing so imported rows already match product taxonomy.

---

## 12. Image Strategy Recommendation

This needs a business decision.

### Option 1 — Placeholder-first
- import place without real image
- use default placeholder
- admin can enrich later

Best for scale and speed.

### Option 2 — Remote image fetch
- importer accepts `imageUrl`
- backend downloads and uploads it to Sevalla storage

Best if you have licensed image sources.

### Option 3 — Keep image mandatory
- reject rows without image

Best for quality, worst for scale.

### Recommended
Use **Option 1 + Option 2** together:

- if valid remote image exists, ingest it
- else create draft with placeholder and `needsImage`

---

## 13. Data Quality Rules to Add

Before global automation, these checks should exist:

1. Reject exact duplicate `(name + countryCode + city)`
2. Flag likely duplicate if same normalized name within 0.5 km
3. Reject missing `countryCode`
4. Reject missing `city`
5. Reject invalid lat/lng
6. Limit `spotTypes` to approved taxonomy
7. Prevent same import batch from being applied twice

---

## 14. Recommended Implementation Order

### Phase A — Quick operational automation
1. CSV/JSON import format
2. Local preprocessing script
3. Simple importer using current API

### Phase B — Proper product automation
1. backend bulk-import endpoint
2. draft/review status
3. duplicate engine
4. remote image or placeholder strategy
5. bulk approve/publish in SuperAdmin

### Phase C — Advanced scale
1. scheduled country-wise imports
2. source adapters (OSM / tourism data)
3. scoring and curation rules

---

## 15. My Clear Recommendation

If the goal is **\"easiest way\"**, do this:

### Recommended path

1. **Do not try to auto-upload the entire world directly from the map**
2. **Create a CSV/JSON bulk import flow**
3. **Import as inactive drafts**
4. **Allow placeholder or remote image ingestion**
5. **Add duplicate detection and review**

This is the cleanest, safest, and most maintainable solution.

---

## 16. Suggested Deliverables for Engineering

If you want this implemented, the work can be split into:

### Deliverable 1
Bulk locale import spec + template CSV format

### Deliverable 2
Backend bulk import API

### Deliverable 3
SuperAdmin bulk import screen

### Deliverable 4
Duplicate + validation engine

### Deliverable 5
Draft review / publish workflow

---

## 17. Final Conclusion

The codebase is already halfway there:

- schema supports rich locale metadata
- map discovery already exists
- geocoding helpers already exist
- upload pipeline already exists

What is missing is not the data model, but the **batch ingestion workflow**.

So the easiest automation path is:

**bulk file import + enrichment + review**, not one-by-one admin entry.

If needed, the next step can be a second document with:

1. exact technical scope
2. API contract for bulk import
3. effort estimate for implementing this automation
4. CSV template format


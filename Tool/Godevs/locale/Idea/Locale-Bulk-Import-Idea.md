# Taatom Locale Bulk Import — Idea & Operating Plan


| Field         | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Location      | `Tool/Godevs/locale/Idea`                                             |
| Sample source | `Tool/Godevs/locale/ModelData-Locale.csv`                             |
| Template      | `Tool/Godevs/locale/templates/locale-import-template.csv`             |
| Importer      | `backend/scripts/locale-import/import-locales.js`                     |
| Date          | 2 Aug 2026                                                            |
| Goal          | Import **20k+** locales safely (dry-run → apply), with correct images |


---

## 1. What admin saves today (truth)

Admin (`SuperAdmin` → Locales) posts multipart to `POST /api/v1/locales/upload`.

### Required for create


| Admin field  | Mongo field                         | Notes                           |
| ------------ | ----------------------------------- | ------------------------------- |
| Name         | `name`                              | Tourist place name              |
| Country      | `country`                           | Full name                       |
| Country code | `countryCode`                       | ISO uppercase (e.g. `AF`, `AL`) |
| City         | `city`                              | **max 50 chars**                |
| ≥1 image     | `storageKey` + `imageStorageKeys[]` | Sevalla keys under `locales/…`  |




### Optional


| Admin field      | Mongo field             | Notes                                        |
| ---------------- | ----------------------- | -------------------------------------------- |
| State / Province | `stateProvince`         |                                              |
| State code       | `stateCode`             | optional short code                          |
| Description      | `description`           |                                              |
| Spot type        | `spotTypes[]`           | Admin UI is single-select today; DB is array |
| Travel info      | `travelInfo`            | enum below                                   |
| Lat / Lng        | `latitude`, `longitude` | rounded to **3 decimals**                    |
| Display order    | `displayOrder`          | number, default `0`                          |




### Images (gallery)

- Up to **10** images (`MAX_LOCALE_IMAGES = 10`)
- Types: JPEG, PNG, WebP, GIF; ~10MB each (admin UX)
- Order preserved → mobile carousel
- First image = primary (`storageKey` / `cloudinaryKey` mirror)
- Keys via `buildMediaKey({ type: 'locale', … })` → `locales/{ts}-{id}-{filename}`



### Enums / fixed taxonomies

`travelInfo`

`Drivable` | `Walkable` | `Public Transport` | `Flight Required` | `Not Accessible`

`spotTypes` **(admin dropdown)**

- Historical spots  
- Cultural spots  
- Natural spots  
- Adventure spots  
- Religious/spiritual spots  
- Wildlife spots  
- Beach spots



### Always set by server

- `isActive: true` (manual create)
- `createdBy` (SuperAdmin ObjectId)
- `blurhash` (default placeholder if not computed)
- `timestamps`



### Not in DB today (present in your sample CSV)


| Sample column                 | Decision for v1 import                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| Category / Subcategory        | Map → `spotTypes` (+ keep raw in notes column if needed)            |
| Best Season                   | Append into `description` footer *or* leave in `notes` (not stored) |
| UNESCO (Yes / No / Tentative) | Prefix description `[UNESCO]` / `[UNESCO Tentative]` **or** skip    |


Do **not** invent new Mongo fields for 20k import until product asks for filters on UNESCO/season.

---



## 2. Gap vs your sample (`ModelData-Locale.csv`)

Your sample columns:

`Country, State / Province, City / Region, Tourist Place, Category, Subcategory, Best Season, UNESCO, Description`


| Sample                 | Schema mapping                                         |
| ---------------------- | ------------------------------------------------------ |
| Tourist Place          | → `name`                                               |
| Country                | → `country` (+ derive `countryCode`)                   |
| State / Province       | → `stateProvince`                                      |
| City / Region          | → `city` (truncate/validate ≤50)                       |
| Category + Subcategory | → `spotTypes` via mapping table                        |
| Description            | → `description`                                        |
| Best Season / UNESCO   | → text enrichment, not first-class fields              |
| *(missing)*            | `countryCode`, lat/lng, travelInfo, images, `sourceId` |


So the sample is **editorial content**, not an import-ready schema. Redesign below fixes that.

---



## 3. Recommended import file (CSV / Excel)

Use **CSV UTF-8** (Excel: Save As CSV UTF-8). One row = one locale.

### 3.1 Column contract


| Column                 | Required             | Example                        | Maps to                                 |
| ---------------------- | -------------------- | ------------------------------ | --------------------------------------- |
| `source_id`            | Strongly recommended | `AF-BAMYAN-001`                | External stable id (dedupe / re-import) |
| `name`                 | **Yes**              | Bamyan Valley                  | `name`                                  |
| `country`              | **Yes**              | Afghanistan                    | `country`                               |
| `country_code`         | **Yes**              | AF                             | `countryCode`                           |
| `state_province`       | No                   | Bamyan                         | `stateProvince`                         |
| `state_code`           | No                   | BAM                            | `stateCode`                             |
| `city`                 | **Yes**              | Bamyan                         | `city` (≤50)                            |
| `description`          | No                   | …                              | `description`                           |
| `spot_types`           | No                   | Natural spots|Historical spots | `spotTypes` (`|` or `,`)                |
| `category_raw`         | No                   | Valley                         | mapping aid only                        |
| `subcategory_raw`      | No                   | Mountains, Cultural            | mapping aid only                        |
| `travel_info`          | No                   | Drivable                       | `travelInfo`                            |
| `latitude`             | No*                  | 34.821                         | `latitude`                              |
| `longitude`            | No*                  | 67.826                         | `longitude`                             |
| `display_order`        | No                   | 0                              | `displayOrder`                          |
| `unesco`               | No                   | Yes                            | folded into description if flag set     |
| `best_season`          | No                   | Apr–Jun                        | folded into description if flag set     |
| `image_1` … `image_10` | See §4               | URL or relative path           | gallery                                 |
| `image_folder`         | Alt                  | `images/AF-BAMYAN-001`         | local folder mode                       |
| `is_active`            | No                   | false                          | draft = `false` for bulk                |


For map UX, lat/lng should be filled for as many rows as possible. Importer can **geocode** missing pairs in a later phase.

Template file: `Tool/Godevs/locale/templates/locale-import-template.csv`

### 3.2 Spot-type mapping (from your Category)


| Category / keywords                                                                            | Taatom `spotTypes`        |
| ---------------------------------------------------------------------------------------------- | ------------------------- |
| Valley, National Park, Lake, Mountain, Coast, Desert, Oasis, Forest, Waterfall, Natural Wonder | Natural spots             |
| Beach, Island, Sea                                                                             | Beach spots               |
| Monument, Archaeological, Historic Town/Site, Palace, Fort, Castle, Ruins, Amphitheatre        | Historical spots          |
| Garden, Park (city), Cultural, Architecture, Old City                                          | Cultural spots            |
| Religious, Mosque, Basilica, Sanctuary, Temple                                                 | Religious/spiritual spots |
| Ski, Trekking, Adventure, Scenic Drive                                                         | Adventure spots           |
| Wildlife, Birdwatching                                                                         | Wildlife spots            |


Importer ships a default map; override via `spot_types` column when filled.

---



## 4. Images — how to attach 1–10 photos per locale (correctly)

Admin already supports multi-image gallery. Bulk import must preserve **order** and **binding** to the row.

### Option A — Image URLs in CSV (good for remote CDN)

```text
image_1 = https://cdn…/bamyan-1.jpg
image_2 = https://cdn…/bamyan-2.jpg
…
```

Importer downloads → validates → uploads to Sevalla `locales/…` → sets `imageStorageKeys` in order.

**Pros:** Simple spreadsheet workflow  
**Cons:** Link rot; rate limits; need rights to hotlink

### Option B — Local folder pack (recommended for 20k)

Directory layout next to CSV:

```text
locale-batch-2026-08/
  locales.csv
  images/
    AF-BAMYAN-001/
      01.jpg          ← primary / cover
      02.jpg
      03.webp
    AF-BAMYAN-002/
      01.jpg
```

CSV:


| source_id     | image_folder         |
| ------------- | -------------------- |
| AF-BAMYAN-001 | images/AF-BAMYAN-001 |


Importer sorts files by name (`01`, `02`, …), caps at 10.

**Pros:** Offline, controllable quality, clear binding via `source_id`  
**Cons:** Large zip; transfer to machine that runs import

### Option C — Hybrid

`image_1` URL *or* local path; missing slots filled from `image_folder`.

### Image quality rules (enforce in dry-run)


| Rule               | Value                                          | Why                     |
| ------------------ | ---------------------------------------------- | ----------------------- |
| Formats            | JPEG / PNG / WebP (GIF allowed but avoid)      | Match API               |
| Max files / locale | 10                                             | API hard limit          |
| Max size / file    | 10 MB (warn > 5 MB)                            | Upload + mobile         |
| Min resolution     | ≥ 1200px on long edge                          | Clarity on phone        |
| Preferred aspect   | **4:3 or 16:9 landscape**                      | Locale cards / carousel |
| Reject             | Extreme portrait < 0.6 ratio, < 800px, corrupt | Avoid ugly crops        |
| Color / clarity    | Prefer daylight, no heavy watermark            | Product quality         |
| Naming             | `01` = cover                                   | Predictable primary     |


Optional later: generate `blurhash` on upload (today default placeholder).

### Binding guarantee

1. Every row has stable `source_id`
2. Images only ever attached under that id’s folder / columns
3. Dry-run report lists: `source_id → [file paths / urls] → planned Sevalla keys`
4. Apply is transactional **per row**: upload images → insert Mongo → on failure delete uploaded keys for that row

Never “upload all images then match by filename fuzzily” — that causes wrong photos on wrong places.

---



## 5. Operating modes



### Dry-run (default)

1. Parse CSV
2. Normalize (trim, ISO code, spot map, city length)
3. Resolve image sources (exist? size? dimensions?)
4. Dedupe checks vs DB (`source_id` if stored later, or name+countryCode+city)
5. Print / write report JSON:
  - would-create / would-skip / would-fail  
  - exact Mongo document preview per row  
  - image plan

**No Mongo writes, no Sevalla uploads.**

### Apply

Requires `CONFIRM_LOCALE_IMPORT=YES`.

1. Same validation as dry-run
2. For each OK row: upload images → insert Locale
3. Prefer `is_active=false` for bulk (draft), then publish in admin after sampling
4. Write success/fail log with `source_id`



### Batches

For 20k rows:

- Import **by country** or **2k–5k row chunks**  
- Sleep / concurrency limit on image download (e.g. 3–5 parallel)  
- Resume via `source_id` (skip already imported)

---



## 6. Safety / product recommendations

1. **Never publish 20k blind** — import as `isActive: false`, spot-check images & coords, then bulk-activate.
2. **Deduplicate** against existing 2.2k+ locales (name + countryCode + city, optional distance).
3. **Geocode** missing coords in a second pass (Maps API) with `needsLocationReview` flag (from Day-2 design).
4. **Legal**: only use images you have license for.
5. **createdBy**: use a dedicated SuperAdmin id (ops bot) so audit is clear.
6. Align with longer-term `Locale-Automation-Design.md` (draft / importBatchId) when you add SuperAdmin UI; CLI is Phase 0.

---



## 7. How we transform your current sample


| Sample column    | Import column                                   |
| ---------------- | ----------------------------------------------- |
| Tourist Place    | `name`                                          |
| Country          | `country` + lookup `country_code`               |
| State / Province | `state_province`                                |
| City / Region    | `city`                                          |
| Category         | → `spot_types` via map (+ `category_raw`)       |
| Subcategory      | `subcategory_raw` (optional extra spot types)   |
| Description      | `description` (+ optional UNESCO/season suffix) |
| UNESCO           | `unesco`                                        |
| Best Season      | `best_season`                                   |
| —                | Add `source_id`, images, lat/lng, travel_info   |


A converter can be added: `ModelData-Locale.csv` → template CSV (without images/coords first).

---



## 8. CLI usage (importer)

```bash
cd backend

# Dry-run against redesigned CSV
node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-template.csv \
  --images-root ../Tool/Godevs/locale/batches/demo \
  --env .env.prod

# Real import (drafts)
CONFIRM_LOCALE_IMPORT=YES \
CREATED_BY=<superAdminObjectId> \
node scripts/locale-import/import-locales.js \
  --csv path/to/batch.csv \
  --images-root path/to/batch \
  --env .env.prod \
  --apply \
  --draft
```

Flags:


| Flag                | Meaning                                              |
| ------------------- | ---------------------------------------------------- |
| `--apply`           | Write DB + Sevalla                                   |
| `--draft`           | `isActive=false`                                     |
| `--limit=100`       | Cap rows (pilot)                                     |
| `--check-db`        | On dry-run, connect Mongo and flag likely duplicates |
| `--skip-images`     | Metadata only (not for final prod UX)                |
| `--fold-meta`       | Append UNESCO / season into description              |
| `--report=out.json` | Save dry-run report                                  |


---



## 9. Suggested rollout for 20k places

1. Fill **pilot 50–100** rows with images + coords (one country).
2. Dry-run → fix mapping / quality rejects.
3. Apply as **drafts** → review in SuperAdmin.
4. Activate when OK.
5. Scale country-by-country.
6. Later: SuperAdmin “Bulk Import” UI from Day-2 design (same CSV contract).

---



## 10. Open decisions (need your call)

1. Import as **draft** (`isActive=false`) vs live immediately? **Recommend draft.**
2. UNESCO / Best Season: fold into description, or add schema fields later?
3. Image pack: **folder-by-source_id** vs URL columns? **Recommend folders for 20k.**
4. Geocode now or Phase 2?
5. Which SuperAdmin `createdBy` ObjectId for automated imports?

---



## 11. Deliverables in this folder set


| Path                                              | Purpose                           |
| ------------------------------------------------- | --------------------------------- |
| `Idea/Locale-Bulk-Import-Idea.md`                 | This plan                         |
| `templates/locale-import-template.csv`            | Fillable model (schema-aligned)   |
| `backend/scripts/locale-import/import-locales.js` | Dry-run / apply CLI               |
| `backend/scripts/locale-import/spot-type-map.js`  | Category → spotTypes              |
| `ModelData-Locale.csv`                            | Your editorial sample (unchanged) |


Next step after you approve: convert a slice of `ModelData-Locale.csv` into the template + run dry-run on prod (read-only) to show per-row Mongo previews.
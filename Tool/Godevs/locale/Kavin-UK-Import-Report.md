# Kavin-UK locale files — issues + import-ready batches

**Date:** 16 Sep 2026  
**Source folder:** `Tool/Godevs/locale/Kavin-UK/`  
**Import templates:**

| Source | Rows | Import CSV |
|--------|------|------------|
| `france_places_2000_same_format.csv` | 2000 | `templates/locale-import-batch-fr.csv` |
| `japan_public_places_3000.csv` | 3000 | `templates/locale-import-batch-jp.csv` |
| `usa_places_5000_same_format.csv` | 5000 | `templates/locale-import-batch-us.csv` |

**Dry-run:** JP 3000 OK · FR 2000 OK · US 5000 OK (0 FAIL after normalize)

---

## Message for developer (copy/paste)

Hi,

We reviewed the 3 locale CSVs under `Tool/Godevs/locale/Kavin-UK`.  
They are **close to the import template**, but these issues need fixing in the generator / next export:

### 1) Content quality — France & USA look synthetic
- Almost all FR/US names are placeholders like `Museum New York 001`, `Historic Site Paris 001`, `Park Los Angeles 002`.
- Descriptions are generic templates (`"Museum location in New York, New York, United States."`).
- Please regenerate with **real place names + real descriptions** (Japan file is much better — looks like real GeoNames/public places).

### 2) `spot_types` not Taatom-canonical
- Files used free labels: `Museum`, `Historic Site`, `Mountains`, `Rivers`, `Marina`, etc.
- Importer expects:  
  `Historical spots | Cultural spots | Natural spots | Adventure spots | Religious/spiritual spots | Wildlife spots | Beach spots`
- We remapped these on our side for this import; please emit **canonical** values next time (or at least stable `category_raw` we can map).

### 3) Invalid `travel_info`
- Values were free text (`"Located in Paris…"`, long JP access notes) instead of enum:  
  `Drivable | Walkable | Public Transport | Flight Required | Not Accessible`
- Importer falls back to `Drivable`; please send only those 5 values.

### 4) Missing / incomplete fields
- **France & USA:** `altitude` empty for most rows (coords OK). Optional for import, but preferred filled (metres).
- **Japan:** `unesco` blank on all 3000 rows (we defaulted to `No`).
- All three: UTF-8 **BOM** on `source_id` header (`\ufeffsource_id`) — strip BOM when writing CSV.

### 5) What was already OK
- Column shape matches import template (`source_id`, `name`, `country`, `country_code`, …).
- Unique `source_id`s, coords present on all rows.
- Country codes `FR` / `JP` / `US` correct.

Thanks — please fix FR/US naming + descriptions first before we treat them as production-quality locales.

---

## What we fixed locally (for this import)

1. Stripped BOM  
2. Remapped `spot_types` → canonical  
3. Defaulted blank `unesco` → `No` (JP)  
4. Forced invalid `travel_info` → `Drivable`  
5. Filled some FR/US altitudes via Open-Meteo (partial; rest still blank — OK for import)

---

## Commands

### Dry-run
```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend

node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-jp.csv \
  --fold-meta --skip-images

node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-fr.csv \
  --fold-meta --skip-images

node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-us.csv \
  --fold-meta --skip-images
```

### Apply (same pattern as other batches)
```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-jp.csv \
  --env .env --fold-meta --skip-images --apply

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-fr.csv \
  --env .env --fold-meta --skip-images --apply

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-us.csv \
  --env .env --fold-meta --skip-images --apply
```

### Re-normalize from Kavin-UK sources (if needed)
```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend

node scripts/locale-import/normalize-import-csv.js \
  --csv ../Tool/Godevs/locale/Kavin-UK/japan_public_places_3000.csv \
  --out ../Tool/Godevs/locale/templates/locale-import-batch-jp.csv

node scripts/locale-import/normalize-import-csv.js \
  --csv ../Tool/Godevs/locale/Kavin-UK/france_places_2000_same_format.csv \
  --out ../Tool/Godevs/locale/templates/locale-import-batch-fr.csv

node scripts/locale-import/normalize-import-csv.js \
  --csv ../Tool/Godevs/locale/Kavin-UK/usa_places_5000_same_format.csv \
  --out ../Tool/Godevs/locale/templates/locale-import-batch-us.csv
```

**Note:** Prefer importing **Japan** first for production quality. FR/US are importable technically but names/descriptions look auto-generated — confirm with product before applying.

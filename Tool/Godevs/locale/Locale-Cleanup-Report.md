# Locale CSV cleanup report

**Sources:**
- `Tool/Godevs/locale/ModelData-Locale.csv` (batch 1 — A countries)
- `Tool/Godevs/locale/ModelData-Locale_2-c.csv` (batch 2 — Canada, Cameroon, Cambodia)
- `Tool/Godevs/locale/Country_E_Tourist_Destinations.csv` (batch E — Ecuador → Ethiopia)

**Date:** 2 Sep 2026

---

## Batch E — `Country_E_Tourist_Destinations.csv` (enriched 2 Sep 2026)

| Check | Result |
|--------|--------|
| Importable rows | **54** (EC 10 · EG 12 · SV 7 · GQ 3 · ER 4 · EE 6 · SZ 4 · ET 8) |
| Missing lat/lng | **0** (source already had coords) |
| Missing altitude | **0** (normalized from `"2,850 m"` → `2850`) |
| Column aliases | `Tourist Attraction` → `Tourist Place`, `UNESCO Site` → `UNESCO` |
| Import template | `templates/locale-import-batch-e.csv` |
| Dry-run | **54 OK / 0 FAIL** (image warnings only) |

### Re-enrich command

```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend
node scripts/locale-import/enrich-locale-csv-coords.js \
  --csv ../Tool/Godevs/locale/Country_E_Tourist_Destinations.csv
```

### Convert + dry-run

```bash
node scripts/locale-import/convert-modeldata-to-import.js \
  --csv ../Tool/Godevs/locale/Country_E_Tourist_Destinations.csv \
  --out ../Tool/Godevs/locale/templates/locale-import-batch-e.csv

node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-e.csv \
  --fold-meta
```

---

## Batch 2 — `ModelData-Locale_2-c.csv` (enriched 2 Sep 2026)

| Check | Result |
|--------|--------|
| Importable rows | **157** (Canada 57 · Cameroon 52 · Cambodia 48) |
| Missing lat/lng | **0** |
| Missing altitude | **0** |
| Blank separator rows | Removed |
| Leading blank header row | Removed |
| Altitude column | Added |
| Wood Buffalo location | Fixed → Alberta / Fort Smith |

Canada coords kept from source (rounded to 3 decimals) + Open-Meteo elevation.  
Cameroon + Cambodia filled via curated overrides (Nominatim coverage was empty in source).

---

## Batch 1 — `ModelData-Locale.csv`

**Rows:** 205 lines originally (195 tourist places + 10 country separator blanks)

---

## 1. Issues found (batch 1)

| # | Issue | Count | Action |
|---|--------|-------|--------|
| 1 | **Blank separator rows** between countries | 10 | Removed on enrich (not importable) |
| 2 | **Missing coordinates** (latitude / longitude / altitude) | 195 | Geocoded via Nominatim + Open-Meteo elevation |
| 3 | **Incomplete row** — Hohe Tauern National Park (line 182) | 1 | Filled Category, Subcategory, Best Season, UNESCO, Description |
| 4 | **No `country_code` / `source_id`** | 195 | Added in import template; derive codes at import time |
| 5 | **City > 50 chars** (Mongo `city` maxlength) | 0 | All cities within limit after review |
| 6 | **Non-standard state labels** (e.g. `Lake Sevan Region`, `Mount Aragats` as state) | 2 | Kept as editorial; map to `stateProvince` as-is |
| 7 | **UNESCO = Tentative** | 3 | Fold to description prefix at import (`--fold-meta`) |
| 8 | **Category / Subcategory free text** | all | Map to `spotTypes` via `spot-type-map.js` at import |

---

## 2. Row inventory by country

| Country | Places | Separator after |
|---------|--------|-----------------|
| Afghanistan | 10 | yes |
| Albania | 16 | yes |
| Algeria | 16 | yes |
| Andorra | 13 | yes |
| Angola | 15 | yes |
| Antigua and Barbuda | 13 | yes |
| Argentina | 21 | yes |
| Armenia | 20 | yes |
| Australia | 24 | yes |
| Austria | 16 | yes (1 incomplete → fixed) |
| Azerbaijan | 21 | — |

**Total importable locales:** 195

---

## 3. Schema mapping (editorial → Mongo)

| CSV column | Mongo field | Notes |
|------------|-------------|-------|
| Tourist Place | `name` | Required |
| Country | `country` | Required |
| *(derived)* | `countryCode` | ISO-3166 alpha-2 |
| State / Province | `stateProvince` | Optional |
| City / Region | `city` | Required, max 50 chars |
| Description | `description` | Optional |
| Category + Subcategory | `spotTypes[]` | Via keyword map |
| Best Season | — | Append with `--fold-meta` |
| UNESCO | — | Append with `--fold-meta` |
| **Latitude** | `latitude` | 3 decimal places |
| **Longitude** | `longitude` | 3 decimal places |
| **Altitude** | `altitude` | Meters above sea level (optional) |

Existing schema already had `latitude` and `longitude`. **`altitude`** was added for elevation-aware map/display.

---

## 4. Cleanup actions applied

1. Removed 10 blank separator rows in enriched output.
2. Added columns: `Latitude`, `Longitude`, `Altitude`.
3. Repaired Hohe Tauern National Park row (missing description and metadata).
4. Geocoded each place as: `{Tourist Place}, {City / Region}, {Country}` with Nominatim + country filter.
5. Applied curated overrides for 104 places (OSM misses + wrong hits like St. John's → London).
6. Fetched elevation (m) from Open-Meteo for geocoded rows; overrides include reference elevation.
7. Rounded coordinates to **3 decimals** (matches admin + importer).

**Result:** 195 / 195 rows have latitude, longitude, and altitude.

---

## 5. Import path

After enrichment, convert to import template (or use enriched CSV columns directly):

```bash
cd backend
node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/ModelData-Locale.csv \
  --fold-meta
```

Re-enrich coordinates:

```bash
node scripts/locale-import/enrich-locale-csv-coords.js \
  --csv ../Tool/Godevs/locale/ModelData-Locale.csv
```

---

## 6. Manual review recommended

- Spots geocoded to **city center** when the named place was ambiguous — verify a sample per country before `--apply`.
- Very large regions (e.g. “Great Barrier Reef”, “Albanian Riviera”) may center on a representative point, not the full extent.
- Altitude is **terrain elevation** at the coordinate, not venue floor level.

Fix: stay in backend/ and run without the extra cd:

# You should already be here: TeamTaatom/backend
```bash
node scripts/locale-import/enrich-locale-csv-coords.js \
  --csv ../Tool/Godevs/locale/ModelData-Locale.csv
  ```
If you're unsure where you are:

pwd   # should end with .../TeamTaatom/backend
Or from repo root:
```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend
node scripts/locale-import/enrich-locale-csv-coords.js \
  --csv ../Tool/Godevs/locale/ModelData-Locale.csv
  ```
That run completed successfully: 195 rows, 0 missing coordinates.

Your import dry-run on the template (3 sample rows) also worked — the “no images” warnings are expected until you add image folders/URLs. To dry-run the full dataset you’d need an import-ready CSV with source_id, country_code, etc., or extend the importer to read ModelData-Locale.csv column names directly.


```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend
node scripts/locale-import/enrich-locale-csv-coords.js \
  --csv ../Tool/Godevs/locale/ModelData-Locale_2-c.csv
    ```
```bash
cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend
node scripts/locale-import/enrich-locale-csv-coords.js \
  --csv ../Tool/Godevs/locale/Country_E_Tourist_Destinations.csv
      ```

```bash
  cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend
CONFIRM_LOCALE_IMPORT=YES CREATED_BY=<yourSuperAdminObjectId> \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/ModelData-Locale.csv \
  --env .env.prod \
  --fold-meta \
  --skip-images \
  --apply
  ```


  --Main

  cd /Users/kavinkumar/Kavin/Godevs/Kavin/TeamTaatom/backend

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-1.csv \
  --env .env\
  --fold-meta \
  --skip-images \
  --apply

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-2c.csv \
  --env .env \
  --fold-meta \
  --skip-images \
  --apply

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-e.csv \
  --env .env \
  --fold-meta \
  --skip-images \
  --apply


  CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-1.csv \
  --env .env --fold-meta --skip-images --apply

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-2c.csv \
  --env .env --fold-meta --skip-images --apply

CONFIRM_LOCALE_IMPORT=YES CREATED_BY=694ea2e9988cced433a8fe76 \
  node scripts/locale-import/import-locales.js \
  --csv ../Tool/Godevs/locale/templates/locale-import-batch-e.csv \
  --env .env --fold-meta --skip-images --apply
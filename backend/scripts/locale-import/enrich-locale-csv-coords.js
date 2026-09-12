#!/usr/bin/env node
/**
 * Enrich ModelData-Locale.csv with Latitude, Longitude, Altitude (m).
 * Geocoding: Nominatim (OSM). Elevation: Open-Meteo.
 *
 * Usage (from backend/):
 *   node scripts/locale-import/enrich-locale-csv-coords.js \
 *     --csv ../Tool/Godevs/locale/ModelData-Locale.csv
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const NOMINATIM_DELAY_MS = 1100;
const CACHE_FILE = path.join(__dirname, '.geocode-cache.json');
const OVERRIDES_FILE = path.join(__dirname, 'locale-coords-overrides.json');

const COUNTRY_CODES = {
  Afghanistan: 'af',
  Albania: 'al',
  Algeria: 'dz',
  Andorra: 'ad',
  Angola: 'ao',
  'Antigua and Barbuda': 'ag',
  Argentina: 'ar',
  Armenia: 'am',
  Australia: 'au',
  Austria: 'at',
  Azerbaijan: 'az',
  Canada: 'ca',
  Cameroon: 'cm',
  Cambodia: 'kh',
  Ecuador: 'ec',
  Egypt: 'eg',
  'El Salvador': 'sv',
  'Equatorial Guinea': 'gq',
  Eritrea: 'er',
  Estonia: 'ee',
  Eswatini: 'sz',
  Ethiopia: 'et',
  Fiji: 'fj',
  Finland: 'fi',
  France: 'fr',
  'Micronesia (FSM)': 'fm',
  Micronesia: 'fm',
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

const CSV_PATH = arg('csv');
const DRY = process.argv.includes('--dry');

/** Minimal CSV parser (handles quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += ch === '\r' ? 2 : 1;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function escapeCsvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function serializeCsv(headers, dataRows) {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of dataRows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers, timeout: 20000 }, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/** Parse altitude values like "2,850 m", "0 m", "-19 m", "2850". */
function parseAltitude(value) {
  if (value == null || String(value).trim() === '') return null;
  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/\s*m(eters?)?\s*$/i, '')
    .trim();
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < -500 || n > 9000) return null;
  return Math.round(n);
}

/** Normalize editorial column aliases onto the ModelData schema. */
function normalizeEditorialRow(row) {
  if (!row['Tourist Place'] && row['Tourist Attraction']) {
    row['Tourist Place'] = row['Tourist Attraction'];
  }
  if (!row.UNESCO && row['UNESCO Site']) {
    row.UNESCO = row['UNESCO Site'];
  }
  if (row.Altitude) {
    const alt = parseAltitude(row.Altitude);
    row.Altitude = alt != null ? String(alt) : '';
  }
  return row;
}

function cacheKey(query) {
  return query.toLowerCase().trim();
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function overrideKey(country, place) {
  return `${country}|${place}`;
}

async function geocode(query, cache, countryCode) {
  const key = cacheKey(query);
  if (cache[key]) return cache[key];

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });
  if (countryCode) params.set('countrycodes', countryCode);

  const url = `https://nominatim.openstreetmap.org/search?${params}`;

  const results = await httpGet(url, {
    'User-Agent': 'TaatomLocaleImport/1.0 (locale bulk enrich; contact: dev@taatom.com)',
    Accept: 'application/json',
  });

  if (!Array.isArray(results) || !results.length) {
    cache[key] = { lat: null, lng: null, alt: null, error: 'not found' };
    return cache[key];
  }

  const hit = results[0];
  cache[key] = {
    lat: round3(parseFloat(hit.lat)),
    lng: round3(parseFloat(hit.lon)),
    alt: null,
    display: hit.display_name,
  };
  return cache[key];
}

async function geocodeRow(row, cache, overrides) {
  const country = row.Country || '';
  const place = row['Tourist Place'] || row['Tourist Attraction'] || '';
  const city = row['City / Region'] || '';
  const state = row['State / Province'] || '';
  const cc = COUNTRY_CODES[country] || '';

  const oKey = overrideKey(country, place);
  if (overrides[oKey]) {
    const o = overrides[oKey];
    return { lat: round3(o.lat), lng: round3(o.lng), alt: o.alt ?? null, source: 'override' };
  }

  const attempts = [
    [place, city, country].filter(Boolean).join(', '),
    [place, state, country].filter(Boolean).join(', '),
    [place, country].filter(Boolean).join(', '),
    [city, country].filter(Boolean).join(', '),
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  for (const query of attempts) {
    const hit = await geocode(query, cache, cc);
    await sleep(NOMINATIM_DELAY_MS);
    if (hit.lat != null && hit.lng != null) {
      return { ...hit, source: query };
    }
  }

  return { lat: null, lng: null, alt: null, error: 'not found' };
}

async function fetchElevations(points) {
  if (!points.length) return [];
  const latParam = points.map((p) => p.lat).join(',');
  const lngParam = points.map((p) => p.lng).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latParam}&longitude=${lngParam}`;
  const data = await httpGet(url);
  return Array.isArray(data?.elevation) ? data.elevation : [];
}

/** Fix known incomplete / incorrect editorial rows. */
function repairRow(row) {
  const place = (row['Tourist Place'] || '').trim();
  if (place === 'Hohe Tauern National Park') {
    if (!(row.Description || '').trim()) {
      row.Category = row.Category || 'National Park';
      row.Subcategory = row.Subcategory || 'Mountains, Glacier, Wildlife';
      row['Best Season'] = row['Best Season'] || 'May–Oct';
      row.UNESCO = row.UNESCO || 'No';
      row.Description =
        "Hohe Tauern National Park is Austria's largest national park, protecting glaciers, alpine meadows, and high peaks in the Central Eastern Alps.";
    }
  }
  // Wood Buffalo spans Alberta / NWT — not Ontario
  if (place === 'Wood Buffalo National Park') {
    row['State / Province'] = 'Alberta';
    row['City / Region'] = 'Fort Smith';
  }
  return row;
}

function rowToObject(headers, cells) {
  const obj = {};
  headers.forEach((h, idx) => {
    obj[h] = cells[idx] != null ? String(cells[idx]).trim() : '';
  });
  return obj;
}

async function main() {
  if (!CSV_PATH) {
    console.error('--csv <path> is required');
    process.exit(1);
  }

  const csvAbs = path.resolve(CSV_PATH);
  const parsed = parseCsv(fs.readFileSync(csvAbs, 'utf8'));
  if (!parsed.length) {
    console.error('Empty CSV');
    process.exit(1);
  }

  const headerIdx = parsed.findIndex((r) => String(r[0] || '').trim() === 'Country');
  if (headerIdx < 0) {
    console.error('Could not find header row starting with Country');
    process.exit(1);
  }
  const rawHeaders = parsed[headerIdx].map((h) => h.trim());
  const baseHeaders = [
    'Country',
    'State / Province',
    'City / Region',
    'Tourist Place',
    'Category',
    'Subcategory',
    'Best Season',
    'UNESCO',
    'Description',
  ];
  const coordHeaders = ['Latitude', 'Longitude', 'Altitude'];
  const headers = [...baseHeaders, ...coordHeaders];

  const dataRows = parsed
    .slice(headerIdx + 1)
    .map((cells) => rowToObject(rawHeaders, cells))
    .map(normalizeEditorialRow)
    .filter((row) => {
      const hasContent =
        baseHeaders.some((h) => (row[h] || '').trim()) ||
        (row['Tourist Attraction'] || '').trim();
      return hasContent;
    })
    .map(repairRow);

  console.log(`Enriching ${dataRows.length} locale rows from ${csvAbs}`);
  if (DRY) console.log('(dry run — no file write)');

  const cache = loadCache();
  const overrides = loadOverrides();
  const geocoded = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];
    process.stdout.write(`[${i + 1}/${dataRows.length}] ${row['Tourist Place']} … `);

    const oKey = overrideKey(row.Country || '', row['Tourist Place'] || '');
    const hasOverride = !!overrides[oKey];

    if (!hasOverride && row.Latitude && row.Longitude) {
      const lat = parseFloat(row.Latitude);
      const lng = parseFloat(row.Longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const coords = {
          lat: round3(lat),
          lng: round3(lng),
          alt: parseAltitude(row.Altitude),
        };
        console.log('keep existing');
        geocoded.push({ row, coords });
        continue;
      }
    }

    try {
      const hit = await geocodeRow(row, cache, overrides);
      const coords = { lat: hit.lat, lng: hit.lng, alt: hit.alt };
      if (hit.error) console.log(`MISS (${hit.error})`);
      else if (hit.source === 'override') console.log(`override ${hit.lat}, ${hit.lng}`);
      else console.log(`${hit.lat}, ${hit.lng}`);
      geocoded.push({ row, coords });
    } catch (err) {
      console.log(`ERR ${err.message}`);
      geocoded.push({ row, coords: { lat: null, lng: null, alt: null } });
    }
  }

  saveCache(cache);

  // Batch elevation for rows missing altitude
  const needElev = geocoded.filter((g) => g.coords.lat != null && g.coords.lng != null && g.coords.alt == null);
  const BATCH = 80;
  for (let b = 0; b < needElev.length; b += BATCH) {
    const chunk = needElev.slice(b, b + BATCH);
    try {
      const elevs = await fetchElevations(chunk.map((g) => g.coords));
      chunk.forEach((g, idx) => {
        const alt = elevs[idx];
        if (Number.isFinite(alt)) g.coords.alt = Math.round(alt);
      });
    } catch (err) {
      console.warn(`Elevation batch failed: ${err.message}`);
    }
    if (b + BATCH < needElev.length) await sleep(300);
  }

  const outRows = geocoded.map(({ row, coords }) => ({
    Country: row.Country || '',
    'State / Province': row['State / Province'] || '',
    'City / Region': row['City / Region'] || '',
    'Tourist Place': row['Tourist Place'] || '',
    Category: row.Category || '',
    Subcategory: row.Subcategory || '',
    'Best Season': row['Best Season'] || '',
    UNESCO: row.UNESCO || '',
    Description: row.Description || '',
    Latitude: coords.lat != null ? String(coords.lat) : '',
    Longitude: coords.lng != null ? String(coords.lng) : '',
    Altitude: coords.alt != null ? String(coords.alt) : '',
  }));

  const missing = outRows.filter((r) => !r.Latitude || !r.Longitude);
  console.log(`\nDone. ${outRows.length} rows, ${missing.length} missing coordinates.`);

  if (!DRY) {
    fs.writeFileSync(csvAbs, serializeCsv(headers, outRows), 'utf8');
    console.log(`Written: ${csvAbs}`);
  }

  if (missing.length) {
    console.log('Missing coords:');
    missing.forEach((r) => console.log(`  - ${r['Tourist Place']} (${r.Country})`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

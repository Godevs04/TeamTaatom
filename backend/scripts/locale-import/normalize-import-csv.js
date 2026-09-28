#!/usr/bin/env node
/**
 * Normalize Kavin-UK / import-format locale CSVs:
 * - strip UTF-8 BOM
 * - remap spot_types → Taatom canonical via spot-type-map
 * - default blank unesco → No
 * - fill missing altitude via Open-Meteo (batched)
 *
 * Usage (from backend/):
 *   node scripts/locale-import/normalize-import-csv.js \
 *     --csv ../Tool/Godevs/locale/Kavin-UK/france_places_2000_same_format.csv \
 *     --out ../Tool/Godevs/locale/templates/locale-import-batch-fr.csv
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { mapSpotTypes } = require('./spot-type-map');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

const CSV_PATH = arg('csv');
const OUT_PATH = arg('out');
const SKIP_ELEV = process.argv.includes('--skip-elevation');
const BATCH = Math.min(parseInt(arg('batch', '100'), 10) || 100, 100);

const OUT_HEADERS = [
  'source_id',
  'name',
  'country',
  'country_code',
  'state_province',
  'state_code',
  'city',
  'description',
  'spot_types',
  'category_raw',
  'subcategory_raw',
  'travel_info',
  'latitude',
  'longitude',
  'altitude',
  'display_order',
  'unesco',
  'best_season',
  'image_folder',
  'image_1',
  'image_2',
  'image_3',
];

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

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'TaatomLocaleImport/1.0' } }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchElevations(points) {
  if (!points.length) return [];
  const latParam = points.map((p) => p.lat).join(',');
  const lngParam = points.map((p) => p.lng).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latParam}&longitude=${lngParam}`;
  const data = await httpGet(url);
  return Array.isArray(data?.elevation) ? data.elevation : [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!CSV_PATH || !OUT_PATH) {
    console.error('--csv <path> and --out <path> are required');
    process.exit(1);
  }

  const absIn = path.resolve(CSV_PATH);
  const absOut = path.resolve(OUT_PATH);
  const raw = fs.readFileSync(absIn, 'utf8').replace(/^\uFEFF/, '');
  const parsed = parseCsv(raw);
  if (!parsed.length) {
    console.error('Empty CSV');
    process.exit(1);
  }

  const headers = parsed[0].map((h) => String(h || '').trim().replace(/^\uFEFF/, ''));
  const rows = parsed.slice(1).map((cells) => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = cells[i] != null ? String(cells[i]).trim() : '';
    });
    return o;
  });

  const stats = {
    total: rows.length,
    remappedSpot: 0,
    emptySpot: 0,
    filledUnesco: 0,
    needAlt: 0,
    filledAlt: 0,
    placeholderNames: 0,
  };

  const outRows = rows.map((r) => {
    const category = r.category_raw || '';
    const subcategory = r.subcategory_raw || '';
    const mapped = mapSpotTypes({
      spotTypes: r.spot_types,
      categoryRaw: category,
      subcategoryRaw: subcategory,
    });
    if (mapped.length) stats.remappedSpot += 1;
    else stats.emptySpot += 1;

    let unesco = (r.unesco || '').trim();
    if (!unesco) {
      unesco = 'No';
      stats.filledUnesco += 1;
    }

    const name = r.name || '';
    if (/\b\d{3}\b/.test(name) && /^(Museum|Park|Historic Site|Monument|Castle|Cathedral|Church|Garden|Beach|Viewpoint|Market|Art Gallery|Theatre|Zoo|Aquarium|Abbey|Fortress)\b/i.test(name)) {
      stats.placeholderNames += 1;
    }

    const city = (r.city || '').length > 50 ? r.city.slice(0, 50) : r.city || '';
    const lat = r.latitude || '';
    const lng = r.longitude || '';
    let alt = r.altitude || '';
    if (!alt && lat && lng) stats.needAlt += 1;

    return {
      source_id: r.source_id || '',
      name,
      country: r.country || '',
      country_code: r.country_code || '',
      state_province: r.state_province || '',
      state_code: r.state_code || '',
      city,
      description: r.description || '',
      spot_types: mapped.join('|'),
      category_raw: category,
      subcategory_raw: subcategory,
      travel_info: r.travel_info || 'Drivable',
      latitude: lat,
      longitude: lng,
      altitude: alt,
      display_order: r.display_order || '0',
      unesco,
      best_season: r.best_season || '',
      image_folder: r.image_folder || (r.source_id ? `images/${r.source_id}` : ''),
      image_1: r.image_1 || '',
      image_2: r.image_2 || '',
      image_3: r.image_3 || '',
    };
  });

  if (!SKIP_ELEV && stats.needAlt > 0) {
    console.log(`Fetching elevation for ${stats.needAlt} rows (batch=${BATCH})...`);
    const needIdx = [];
    outRows.forEach((r, i) => {
      if (!r.altitude && r.latitude && r.longitude) needIdx.push(i);
    });
    for (let i = 0; i < needIdx.length; i += BATCH) {
      const slice = needIdx.slice(i, i + BATCH);
      const points = slice.map((idx) => ({
        lat: parseFloat(outRows[idx].latitude),
        lng: parseFloat(outRows[idx].longitude),
      }));
      try {
        const elevs = await fetchElevations(points);
        elevs.forEach((e, j) => {
          if (e != null && Number.isFinite(Number(e))) {
            outRows[slice[j]].altitude = String(Math.round(Number(e)));
            stats.filledAlt += 1;
          }
        });
      } catch (err) {
        console.warn(`Elevation batch failed at ${i}: ${err.message}`);
      }
      if (i + BATCH < needIdx.length) await sleep(500);
      if ((i / BATCH) % 10 === 0) {
        console.log(`  elevation ${Math.min(i + BATCH, needIdx.length)}/${needIdx.length}`);
      }
    }
  }

  const lines = [OUT_HEADERS.join(',')];
  for (const row of outRows) {
    lines.push(OUT_HEADERS.map((h) => escapeCsvCell(row[h])).join(','));
  }
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Normalized ${stats.total} rows`);
  console.log(`  in:  ${absIn}`);
  console.log(`  out: ${absOut}`);
  console.log(`  spot_types remapped: ${stats.remappedSpot}, still empty: ${stats.emptySpot}`);
  console.log(`  unesco filled: ${stats.filledUnesco}`);
  console.log(`  altitude filled: ${stats.filledAlt} (needed ${stats.needAlt})`);
  console.log(`  placeholder-like names (content QA): ${stats.placeholderNames}`);
  const stillNoAlt = outRows.filter((r) => !r.altitude).length;
  const stillNoSpot = outRows.filter((r) => !r.spot_types).length;
  console.log(`  remaining missing altitude: ${stillNoAlt}`);
  console.log(`  remaining missing spot_types: ${stillNoSpot}`);
  if (stillNoSpot) {
    outRows
      .filter((r) => !r.spot_types)
      .slice(0, 10)
      .forEach((r) => console.log(`    - ${r.source_id} ${r.name} (${r.category_raw}/${r.subcategory_raw})`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

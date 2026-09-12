#!/usr/bin/env node
/**
 * Convert editorial ModelData-Locale*.csv → import-ready template CSV.
 *
 * Usage (from backend/):
 *   node scripts/locale-import/convert-modeldata-to-import.js \
 *     --csv ../Tool/Godevs/locale/ModelData-Locale_2-c.csv \
 *     --out ../Tool/Godevs/locale/templates/locale-import-batch-2c.csv
 */

const fs = require('fs');
const path = require('path');
const { mapSpotTypes } = require('./spot-type-map');

const COUNTRY_CODES = {
  Afghanistan: 'AF',
  Albania: 'AL',
  Algeria: 'DZ',
  Andorra: 'AD',
  Angola: 'AO',
  'Antigua and Barbuda': 'AG',
  Argentina: 'AR',
  Armenia: 'AM',
  Australia: 'AU',
  Austria: 'AT',
  Azerbaijan: 'AZ',
  Canada: 'CA',
  Cameroon: 'CM',
  Cambodia: 'KH',
  Ecuador: 'EC',
  Egypt: 'EG',
  'El Salvador': 'SV',
  'Equatorial Guinea': 'GQ',
  Eritrea: 'ER',
  Estonia: 'EE',
  Eswatini: 'SZ',
  Ethiopia: 'ET',
  Fiji: 'FJ',
  Finland: 'FI',
  France: 'FR',
  'Micronesia (FSM)': 'FM',
  Micronesia: 'FM',
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

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

function slugPart(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'X';
}

function guessTravelInfo(category, subcategory) {
  const blob = `${category} ${subcategory}`.toLowerCase();
  if (/\b(walk|old town|market|museum|temple|palace|square|street)\b/.test(blob)) return 'Walkable';
  if (/\b(island|flight|remote|wilderness)\b/.test(blob)) return 'Flight Required';
  return 'Drivable';
}

function main() {
  const csvPath = arg('csv');
  const outPath = arg('out');
  if (!csvPath || !outPath) {
    console.error('--csv <path> and --out <path> are required');
    process.exit(1);
  }

  const absIn = path.resolve(csvPath);
  const absOut = path.resolve(outPath);
  const parsed = parseCsv(fs.readFileSync(absIn, 'utf8'));
  const headerIdx = parsed.findIndex((r) => String(r[0] || '').trim() === 'Country');
  if (headerIdx < 0) {
    console.error('Header row with Country not found');
    process.exit(1);
  }

  const headers = parsed[headerIdx].map((h) => h.trim());
  const rows = parsed
    .slice(headerIdx + 1)
    .map((cells) => {
      const o = {};
      headers.forEach((h, i) => {
        o[h] = cells[i] != null ? String(cells[i]).trim() : '';
      });
      // Editorial aliases used by Country_E_* files
      if (!o['Tourist Place'] && o['Tourist Attraction']) o['Tourist Place'] = o['Tourist Attraction'];
      if (!o.UNESCO && o['UNESCO Site']) o.UNESCO = o['UNESCO Site'];
      if (o.Altitude) {
        const cleaned = String(o.Altitude)
          .replace(/,/g, '')
          .replace(/\s*m(eters?)?\s*$/i, '')
          .trim();
        const alt = parseFloat(cleaned);
        o.Altitude = Number.isFinite(alt) ? String(Math.round(alt)) : '';
      }
      return o;
    })
    .filter((r) => r.Country && r['Tourist Place']);

  const counters = {};
  const outHeaders = [
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

  const outRows = [];
  const errors = [];

  for (const r of rows) {
    const country = r.Country;
    const code = COUNTRY_CODES[country];
    if (!code) {
      errors.push(`Unknown country code for: ${country} (${r['Tourist Place']})`);
      continue;
    }

    const cityRaw = r['City / Region'] || '';
    const city = cityRaw.length > 50 ? cityRaw.slice(0, 50) : cityRaw;
    const category = r.Category || '';
    const subcategory = r.Subcategory || '';
    const spotTypes = mapSpotTypes({ categoryRaw: category, subcategoryRaw: subcategory });
    const travel = guessTravelInfo(category, subcategory);

    const regionKey = `${code}-${slugPart(r['State / Province'] || city || 'GEN')}`;
    counters[regionKey] = (counters[regionKey] || 0) + 1;
    const sourceId = `${regionKey}-${String(counters[regionKey]).padStart(3, '0')}`;

    outRows.push({
      source_id: sourceId,
      name: r['Tourist Place'],
      country,
      country_code: code,
      state_province: r['State / Province'] || '',
      state_code: '',
      city,
      description: r.Description || '',
      spot_types: spotTypes.join('|'),
      category_raw: category,
      subcategory_raw: subcategory,
      travel_info: travel,
      latitude: r.Latitude || '',
      longitude: r.Longitude || '',
      altitude: r.Altitude || '',
      display_order: '0',
      unesco: r.UNESCO || '',
      best_season: r['Best Season'] || '',
      image_folder: `images/${sourceId}`,
      image_1: '',
      image_2: '',
      image_3: '',
    });
  }

  const lines = [outHeaders.join(',')];
  for (const row of outRows) {
    lines.push(outHeaders.map((h) => escapeCsvCell(row[h])).join(','));
  }
  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, `${lines.join('\n')}\n`, 'utf8');

  console.log(`Converted ${outRows.length} rows`);
  console.log(`  in:  ${absIn}`);
  console.log(`  out: ${absOut}`);
  if (errors.length) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e}`));
    process.exit(1);
  }

  const byCountry = {};
  outRows.forEach((r) => {
    byCountry[r.country_code] = (byCountry[r.country_code] || 0) + 1;
  });
  console.log('By country_code:', byCountry);
  const noCoords = outRows.filter((r) => !r.latitude || !r.longitude);
  console.log(`Missing coords: ${noCoords.length}`);
  const noSpots = outRows.filter((r) => !r.spot_types);
  console.log(`Missing spot_types: ${noSpots.length}`);
  if (noSpots.length) {
    noSpots.slice(0, 10).forEach((r) => console.log(`  - ${r.source_id} ${r.name} (${r.category_raw})`));
  }
}

main();

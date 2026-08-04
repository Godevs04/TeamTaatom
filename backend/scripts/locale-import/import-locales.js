#!/usr/bin/env node
/**
 * Bulk locale import — dry-run by default; --apply writes Mongo + Sevalla.
 *
 * See: Tool/Godevs/locale/Idea/Locale-Bulk-Import-Idea.md
 *
 * Usage (from backend/):
 *   node scripts/locale-import/import-locales.js \
 *     --csv ../Tool/Godevs/locale/templates/locale-import-template.csv
 *
 *   CONFIRM_LOCALE_IMPORT=YES CREATED_BY=<ObjectId> \
 *     node scripts/locale-import/import-locales.js --csv batch.csv --images-root ./batch --apply --draft
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
const { mapSpotTypes, CANONICAL } = require('./spot-type-map');

const APPLY = process.argv.includes('--apply');
const DRAFT = process.argv.includes('--draft');
const SKIP_IMAGES = process.argv.includes('--skip-images');
const FOLD_META = process.argv.includes('--fold-meta');
const CHECK_DB = process.argv.includes('--check-db');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
}

const CSV_PATH = arg('csv');
const IMAGES_ROOT = arg('images-root', process.cwd());
const ENV_FILE = arg('env');
const REPORT_PATH = arg('report');
const LIMIT = parseInt(arg('limit', '0'), 10) || 0;
const CREATED_BY = process.env.CREATED_BY || arg('created-by');

const VALID_TRAVEL = [
  'Drivable',
  'Walkable',
  'Public Transport',
  'Flight Required',
  'Not Accessible',
];
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_IMAGES = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const WARN_LONG_EDGE = 1200;

function loadEnvFile(file) {
  if (!file) return;
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`Env file not found: ${abs}`);
  const text = fs.readFileSync(abs, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

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
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => String(c || '').trim())).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] != null ? String(r[idx]).trim() : '';
    });
    return obj;
  });
}

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
  }
  return '';
}

function buildDescription(row, base) {
  let d = base || '';
  if (!FOLD_META) return d;
  const bits = [];
  const unesco = pick(row, 'unesco', 'UNESCO');
  const season = pick(row, 'best_season', 'Best Season');
  if (unesco && /^yes$/i.test(unesco)) bits.push('UNESCO World Heritage');
  else if (unesco && /tentative/i.test(unesco)) bits.push('UNESCO Tentative List');
  if (season) bits.push(`Best season: ${season}`);
  if (!bits.length) return d;
  const suffix = bits.join(' · ');
  return d ? `${d}\n\n(${suffix})` : suffix;
}

function resolveImagePlan(row, imagesRoot) {
  const files = [];
  const folderRel = pick(row, 'image_folder');
  if (folderRel) {
    const dir = path.resolve(imagesRoot, folderRel);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      const listed = fs
        .readdirSync(dir)
        .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      for (const f of listed.slice(0, MAX_IMAGES)) {
        files.push({ kind: 'file', path: path.join(dir, f), label: `${folderRel}/${f}` });
      }
    }
  }
  for (let n = 1; n <= MAX_IMAGES && files.length < MAX_IMAGES; n += 1) {
    const v = pick(row, `image_${n}`, `image${n}`, `Image_${n}`);
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) {
      files.push({ kind: 'url', url: v, label: v });
    } else {
      const p = path.resolve(imagesRoot, v);
      files.push({ kind: 'file', path: p, label: v });
    }
  }
  return files.slice(0, MAX_IMAGES);
}

function inspectLocalFile(filePath) {
  const out = { ok: false, bytes: 0, errors: [], warnings: [] };
  if (!fs.existsSync(filePath)) {
    out.errors.push(`missing file: ${filePath}`);
    return out;
  }
  const st = fs.statSync(filePath);
  out.bytes = st.size;
  if (st.size <= 0) out.errors.push('empty file');
  if (st.size > MAX_BYTES) out.errors.push(`file > ${MAX_BYTES} bytes`);
  if (st.size > 5 * 1024 * 1024) out.warnings.push('file > 5MB');
  // Lightweight magic-byte check (no sharp required for dry-run)
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isGif = buf.slice(0, 3).toString() === 'GIF';
  const isWebp = buf.slice(0, 4).toString() === 'RIFF';
  if (!isJpeg && !isPng && !isGif && !isWebp) {
    out.errors.push('unrecognized image magic bytes');
  }
  out.ok = out.errors.length === 0;
  // Dimension check optional — recommend installing `sharp` later for MIN_LONG_EDGE
  out.warnings.push(
    `dimension check skipped (install sharp for ≥${WARN_LONG_EDGE}px enforcement)`,
  );
  return out;
}

function headUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      resolve({
        ok: res.statusCode >= 200 && res.statusCode < 400,
        status: res.statusCode,
        type: res.headers['content-type'] || '',
        length: parseInt(res.headers['content-length'] || '0', 10) || 0,
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.end();
  });
}

function normalizeRow(row, index) {
  const errors = [];
  const warnings = [];

  const sourceId = pick(row, 'source_id', 'sourceId', 'id') || `ROW-${index + 1}`;
  const name = pick(row, 'name', 'Tourist Place');
  const country = pick(row, 'country', 'Country');
  const countryCode = pick(row, 'country_code', 'countryCode').toUpperCase();
  const stateProvince = pick(row, 'state_province', 'stateProvince', 'State / Province');
  const stateCode = pick(row, 'state_code', 'stateCode');
  let city = pick(row, 'city', 'City / Region');
  const categoryRaw = pick(row, 'category_raw', 'Category');
  const subcategoryRaw = pick(row, 'subcategory_raw', 'Subcategory');
  const travelInfoRaw = pick(row, 'travel_info', 'travelInfo') || 'Drivable';
  const travelInfo = VALID_TRAVEL.includes(travelInfoRaw) ? travelInfoRaw : 'Drivable';
  if (travelInfoRaw && !VALID_TRAVEL.includes(travelInfoRaw)) {
    warnings.push(`travel_info "${travelInfoRaw}" invalid → Drivable`);
  }

  let description = buildDescription(row, pick(row, 'description', 'Description'));
  const spotTypes = mapSpotTypes({
    spotTypes: pick(row, 'spot_types', 'spotTypes'),
    categoryRaw,
    subcategoryRaw,
  });

  if (!name) errors.push('name required');
  if (!country) errors.push('country required');
  if (!countryCode) errors.push('country_code required');
  if (!city) errors.push('city required');
  if (city.length > 50) {
    warnings.push(`city truncated from ${city.length} → 50 chars`);
    city = city.slice(0, 50);
  }

  let latitude = null;
  let longitude = null;
  const latS = pick(row, 'latitude', 'lat');
  const lngS = pick(row, 'longitude', 'lng', 'lon');
  if (latS || lngS) {
    const lat = parseFloat(latS);
    const lng = parseFloat(lngS);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      latitude = Math.round(lat * 1000) / 1000;
      longitude = Math.round(lng * 1000) / 1000;
    } else {
      errors.push('invalid latitude/longitude');
    }
  } else {
    warnings.push('missing coordinates (map features limited)');
  }

  const displayOrder = parseInt(pick(row, 'display_order', 'displayOrder') || '0', 10) || 0;
  const isActiveCol = pick(row, 'is_active', 'isActive');
  let isActive = DRAFT ? false : true;
  if (isActiveCol !== '') {
    isActive = /^(1|true|yes)$/i.test(isActiveCol);
  }
  if (DRAFT) isActive = false;

  const mongoDoc = {
    name,
    country,
    countryCode,
    stateProvince,
    stateCode,
    city,
    description,
    spotTypes,
    travelInfo,
    latitude,
    longitude,
    displayOrder,
    isActive,
    // images filled on apply
    storageKey: null,
    imageStorageKeys: [],
    createdBy: CREATED_BY || null,
  };

  return {
    sourceId,
    categoryRaw,
    subcategoryRaw,
    errors,
    warnings,
    mongoDoc,
    imagePlan: [],
  };
}

async function main() {
  if (ENV_FILE) loadEnvFile(ENV_FILE);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Locale bulk import');
  console.log(`  Mode: ${APPLY ? 'APPLY' : 'DRY_RUN'}${DRAFT ? ' (draft/inactive)' : ''}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (!CSV_PATH) {
    console.error('--csv <path> is required');
    process.exit(1);
  }
  if (APPLY && process.env.CONFIRM_LOCALE_IMPORT !== 'YES') {
    console.error('Refusing --apply without CONFIRM_LOCALE_IMPORT=YES');
    process.exit(1);
  }
  if (APPLY && !CREATED_BY) {
    console.error('CREATED_BY (SuperAdmin ObjectId) required for --apply');
    process.exit(1);
  }
  if (APPLY && !mongoose.Types.ObjectId.isValid(CREATED_BY)) {
    console.error('CREATED_BY is not a valid ObjectId');
    process.exit(1);
  }

  const csvAbs = path.resolve(CSV_PATH);
  const rows = parseCsv(fs.readFileSync(csvAbs, 'utf8'));
  const slice = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`CSV: ${csvAbs}  rows=${rows.length}  processing=${slice.length}`);
  console.log(`Images root: ${path.resolve(IMAGES_ROOT)}`);
  console.log(`Canonical spotTypes: ${CANONICAL.join(' | ')}`);

  const report = {
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    csv: csvAbs,
    totals: { ok: 0, fail: 0, warn: 0, imagesOk: 0, imagesFail: 0 },
    rows: [],
  };

  let Locale;
  let uploadObject;
  let buildMediaKey;
  let deleteObject;

  if (APPLY || CHECK_DB) {
    if (!process.env.MONGO_URL) {
      console.error('MONGO_URL required for --apply / --check-db (use --env .env.prod)');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 20000 });
    Locale = require('../../src/models/Locale');
    ({ uploadObject, buildMediaKey, deleteObject } = require('../../src/services/storage'));
    console.log(`Connected DB: ${mongoose.connection.db.databaseName}`);
  } else {
    console.log('DB: skipped (add --check-db to dedupe against Mongo on dry-run)');
  }

  for (let idx = 0; idx < slice.length; idx += 1) {
    const raw = slice[idx];
    const n = normalizeRow(raw, idx);
    const imageRefs = resolveImagePlan(raw, IMAGES_ROOT);
    const imageDetails = [];

    for (const ref of imageRefs) {
      if (ref.kind === 'file') {
        const insp = inspectLocalFile(ref.path);
        imageDetails.push({ ...ref, ...insp });
        if (!insp.ok) n.errors.push(`image ${ref.label}: ${insp.errors.join('; ')}`);
        else {
          n.warnings.push(...insp.warnings.map((w) => `image ${ref.label}: ${w}`));
          report.totals.imagesOk += 1;
        }
      } else {
        const head = await headUrl(ref.url);
        const ok = head.ok;
        if (!ok) {
          n.errors.push(`image URL bad: ${ref.label} (${head.error || head.status})`);
          report.totals.imagesFail += 1;
        } else {
          if (head.length > MAX_BYTES) n.errors.push(`image URL too large: ${ref.label}`);
          report.totals.imagesOk += 1;
        }
        imageDetails.push({ ...ref, ok, ...head });
      }
    }

    if (!SKIP_IMAGES && imageRefs.length === 0) {
      n.warnings.push('no images resolved (admin create normally requires ≥1 image)');
      if (APPLY) n.errors.push('at least one image required for apply (or use --skip-images)');
    }

    // Dedupe soft-check against DB when connected
    if (Locale) {
      const existing = await Locale.findOne({
        name: n.mongoDoc.name,
        countryCode: n.mongoDoc.countryCode,
        city: n.mongoDoc.city,
      })
        .select('_id name isActive')
        .lean();
      if (existing) {
        n.warnings.push(`possible duplicate of ${existing._id} (isActive=${existing.isActive})`);
      }
    }

    const rowReport = {
      sourceId: n.sourceId,
      status: n.errors.length ? 'FAIL' : 'OK',
      errors: n.errors,
      warnings: n.warnings,
      mongoPreview: n.mongoDoc,
      images: imageDetails.map((d) => ({
        label: d.label,
        kind: d.kind,
        ok: d.ok,
        bytes: d.bytes || d.length || 0,
      })),
    };

    if (n.errors.length) {
      report.totals.fail += 1;
    } else {
      report.totals.ok += 1;
      if (n.warnings.length) report.totals.warn += 1;
    }

    // APPLY
    if (APPLY && n.errors.length === 0) {
      const uploadedKeys = [];
      try {
        if (!SKIP_IMAGES) {
          for (const ref of imageRefs) {
            let buffer;
            let mime = 'image/jpeg';
            let filename = 'image.jpg';
            if (ref.kind === 'file') {
              buffer = fs.readFileSync(ref.path);
              filename = path.basename(ref.path);
              const ext = path.extname(filename).toLowerCase();
              mime =
                ext === '.png'
                  ? 'image/png'
                  : ext === '.webp'
                    ? 'image/webp'
                    : ext === '.gif'
                      ? 'image/gif'
                      : 'image/jpeg';
            } else {
              buffer = await downloadBuffer(ref.url);
              filename = path.basename(new URL(ref.url).pathname) || 'remote.jpg';
            }
            const extension = filename.split('.').pop() || 'jpg';
            const storageKey = buildMediaKey({
              type: 'locale',
              filename,
              extension,
            });
            await uploadObject(buffer, storageKey, mime);
            uploadedKeys.push(storageKey);
          }
        }
        const primary = uploadedKeys[0] || null;
        const doc = await Locale.create({
          ...n.mongoDoc,
          createdBy: new mongoose.Types.ObjectId(CREATED_BY),
          storageKey: primary,
          cloudinaryKey: primary,
          imageStorageKeys: uploadedKeys,
        });
        rowReport.createdId = String(doc._id);
        rowReport.uploadedKeys = uploadedKeys;
      } catch (err) {
        rowReport.status = 'FAIL';
        rowReport.errors.push(`apply failed: ${err.message}`);
        report.totals.ok -= 1;
        report.totals.fail += 1;
        for (const k of uploadedKeys) {
          try {
            await deleteObject(k);
          } catch (_) {
            /* ignore */
          }
        }
      }
    }

    report.rows.push(rowReport);

    const flag = rowReport.status === 'OK' ? 'OK ' : 'FAIL';
    console.log(
      `\n[${flag}] ${n.sourceId}  ${n.mongoDoc.name} (${n.mongoDoc.countryCode}/${n.mongoDoc.city})`,
    );
    console.log(`  spotTypes: ${n.mongoDoc.spotTypes.join(', ') || '(none)'}`);
    console.log(
      `  coords: ${n.mongoDoc.latitude ?? '—'}, ${n.mongoDoc.longitude ?? '—'}  travel: ${n.mongoDoc.travelInfo}  active: ${n.mongoDoc.isActive}`,
    );
    console.log(`  images: ${imageDetails.length}`);
    imageDetails.forEach((d) => console.log(`    - ${d.label} (${d.ok ? 'ok' : 'bad'})`));
    n.errors.forEach((e) => console.log(`  ERROR: ${e}`));
    n.warnings.slice(0, 5).forEach((w) => console.log(`  warn: ${w}`));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('═══════════════════════════════════════════════════════════');

  if (REPORT_PATH) {
    const abs = path.resolve(REPORT_PATH);
    fs.writeFileSync(abs, JSON.stringify(report, null, 2));
    console.log(`Report written: ${abs}`);
  }

  if (!APPLY) {
    console.log(`
DRY RUN only. To apply drafts:
  CONFIRM_LOCALE_IMPORT=YES CREATED_BY=<superAdminId> \\
    node scripts/locale-import/import-locales.js --csv ... --images-root ... --env .env.prod --apply --draft
`);
  }

  if (mongoose.connection.readyState) await mongoose.disconnect();
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        let total = 0;
        res.on('data', (c) => {
          total += c.length;
          if (total > MAX_BYTES) {
            res.destroy();
            reject(new Error('download exceeds max size'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

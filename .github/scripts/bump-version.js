#!/usr/bin/env node
/**
 * GitHub internal release only — does NOT modify app.json or any store version.
 * app.json is for App Store / Play Store; this script only computes the next
 * internal version for the GitHub release tag.
 *
 * Reads .github/release.properties (LAST_INTERNAL_VERSION, RELEASE_TYPE, etc.),
 * computes next version, writes NEW_VERSION.txt, RELEASE_LABEL.txt, RELEASE_TAG.txt,
 * and updates LAST_INTERNAL_VERSION in release.properties for the next run.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PROPS_PATH = path.join(ROOT, '.github/release.properties');

function readProperties(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const props = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    props[key] = value;
  }
  return props;
}

/**
 * Parse internal version: 2026.1.1 or 26.1.1 → { year: 2026, month: 1, patch: 1 }
 */
function parseVersion(v) {
  const s = (v || '').trim();
  const match2 = s.match(/^(\d{2})\.(\d{1,2})\.(\d+)$/);
  const match4 = s.match(/^(\d{4})\.(\d{1,2})\.(\d+)$/);
  const match = match4 || match2;
  if (!match) throw new Error(`Invalid internal version (expected YEAR.MONTH.PATCH): ${v}`);
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const year4 = year < 100 ? 2000 + year : year;
  return { year: year4, month, patch };
}

function formatVersion(o, fourDigitYear = true) {
  const y = fourDigitYear ? o.year : (o.year % 100);
  return `${y}.${o.month}.${o.patch}`;
}

/** Compare two version objects; returns 1 if a > b, -1 if a < b, 0 if equal */
function compareVersions(a, b) {
  if (a.year !== b.year) return a.year > b.year ? 1 : -1;
  if (a.month !== b.month) return a.month > b.month ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}

function isTruthy(value) {
  if (value == null || value === '') return false;
  const v = String(value).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes';
}

function getCurrentYear() {
  return new Date().getFullYear();
}
function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function normalizeYear(y) {
  return y != null && y < 100 ? 2000 + y : y;
}

function bump(props, current) {
  const type = (props.RELEASE_TYPE || 'patch').toLowerCase().replace(/-/g, '_');
  const yearProp = props.YEAR != null && props.YEAR !== '' ? normalizeYear(parseInt(props.YEAR, 10)) : null;
  const monthProp = props.MONTH != null && props.MONTH !== '' ? parseInt(props.MONTH, 10) : null;
  const patchVersion = props.PATCH_VERSION != null && props.PATCH_VERSION !== ''
    ? parseInt(props.PATCH_VERSION, 10)
    : null;

  let next;
  let releaseLabel = (props.RELEASE_LABEL || '').trim();

  if (type === 'major') {
    const year = yearProp != null ? yearProp : current.year + 1;
    next = { year, month: 1, patch: 1 };
  } else if (type === 'minor') {
    const year = yearProp != null ? yearProp : current.year;
    const month = monthProp != null ? monthProp : current.month + 1;
    next = { year, month, patch: 1 };
  } else if (type === 'patch') {
    const year = yearProp != null ? yearProp : current.year;
    const month = monthProp != null ? monthProp : current.month;
    const patch = patchVersion != null ? patchVersion : current.patch + 1;
    next = { year, month, patch };
  } else if (type === 'service_pack') {
    const year = yearProp != null ? yearProp : current.year;
    const month = monthProp != null ? monthProp : current.month;
    next = { year, month, patch: current.patch + 1 };
    if (!releaseLabel) releaseLabel = `Service Patch ${year}.${month}`;
  } else {
    next = { year: current.year, month: current.month, patch: current.patch + 1 };
  }

  return { next, releaseLabel };
}

function main() {
  if (!fs.existsSync(PROPS_PATH)) {
    console.error('Missing .github/release.properties');
    process.exit(1);
  }
  const props = readProperties(PROPS_PATH);
  const lastVersion = (props.LAST_INTERNAL_VERSION || '').trim();
  if (!lastVersion) {
    console.error('LAST_INTERNAL_VERSION is required in .github/release.properties');
    process.exit(1);
  }

  const allowRepatch = isTruthy(props.ALLOW_REPATCH);
  const current = parseVersion(lastVersion);

  let newVersion;
  let releaseLabel;
  let updateLastVersion = true;

  if (allowRepatch) {
    newVersion = lastVersion.indexOf('.') === 4 ? lastVersion : formatVersion(current, true);
    releaseLabel = (props.RELEASE_LABEL || '').trim();
    updateLastVersion = false;
  } else {
    const bumped = bump(props, current);
    newVersion = formatVersion(bumped.next, true);
    releaseLabel = bumped.releaseLabel;
    const nextParsed = parseVersion(newVersion);
    const cmp = compareVersions(nextParsed, current);
    if (cmp <= 0) {
      console.error(
        `Validation failed: new version ${newVersion} must be greater than LAST_INTERNAL_VERSION (${lastVersion}). ` +
        'Either set a higher PATCH_VERSION / RELEASE_TYPE or set ALLOW_REPATCH=true to re-release the same version.'
      );
      process.exit(1);
    }
  }

  // Support both legacy TAG_SUFFIX and new TAG_PREFIX for backwards compatibility.
  const tagPrefix = (props.TAG_PREFIX || '').trim();
  const tagSuffix = (props.TAG_SUFFIX || '').trim();
  const releaseTag = tagPrefix
    ? `${tagPrefix}${newVersion}`
    : tagSuffix
    ? `${newVersion}${tagSuffix}`
    : newVersion;

  fs.writeFileSync(path.join(ROOT, 'NEW_VERSION.txt'), newVersion, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'RELEASE_LABEL.txt'), releaseLabel, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'RELEASE_TAG.txt'), releaseTag, 'utf8');

  if (updateLastVersion) {
    const content = fs.readFileSync(PROPS_PATH, 'utf8');
    const updated = content.replace(
      /^LAST_INTERNAL_VERSION=.*/m,
      `LAST_INTERNAL_VERSION=${newVersion}`
    );
    fs.writeFileSync(PROPS_PATH, updated, 'utf8');
  }

  console.log(newVersion);
}

main();

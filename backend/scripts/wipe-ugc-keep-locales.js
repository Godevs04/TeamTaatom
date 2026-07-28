#!/usr/bin/env node
/**
 * Wipe UGC / test / production app data — KEEP curated Locales (+ admin essentials).
 *
 * DEFAULT = DRY RUN (counts + sample keys only). Nothing is deleted unless --apply.
 *
 * KEEP (Mongo):
 *   - locales
 *   - superadmins
 *   - systemsettings
 *   - featureflags
 *   - scheduleddowntimes
 *   - songs                    (SuperAdmin audio library) — toggle with --wipe-songs
 *   - Taatom Official user     (fixed ObjectId) — toggle with --wipe-official-user
 *   - connectpages category=community — toggle with --wipe-community-pages
 *   - roads, importedregions   (map cache) — toggle with --wipe-map-cache
 *
 * DELETE (Mongo): users (except official if kept), posts, journeys, chats, follows,
 *   likes, comments, notifications, reports, collections, hashtags, tripvisits,
 *   connect UGC (non-community pages + follows/views/orders/subscriptions/payouts),
 *   analytics, errorlogs, shorturls, userinteractions, transcodejobs, activities,
 *   forgotsignins, fxratecaches, …
 *
 * Sevalla / R2 hard delete:
 *   - Collect storage keys from documents being wiped
 *   - Prefix-scan bucket and delete objects under posts/, profiles/, chats/, shorts/, misc/
 *   - NEVER delete locales/ prefix
 *   - NEVER delete songs/ unless --wipe-songs
 *
 * Usage (from backend/):
 *   # Dry run against prod (provide URL + Sevalla env)
 *   MONGO_URL='mongodb+srv://...' node scripts/wipe-ugc-keep-locales.js
 *
 *   # Or load .env.prod
 *   node -r dotenv/config scripts/wipe-ugc-keep-locales.js dotenv_config_path=.env.prod
 *
 *   # Real wipe (DESTRUCTIVE)
 *   CONFIRM_WIPE=YES_WIPE_UGC MONGO_URL='...' node scripts/wipe-ugc-keep-locales.js --apply
 *
 * Optional flags:
 *   --apply
 *   --wipe-songs
 *   --wipe-official-user
 *   --wipe-community-pages
 *   --wipe-map-cache
 *   --skip-sevalla          (Mongo only)
 *   --sample=20              (how many example keys to print in dry-run)
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

const {
  deleteObject,
  BUCKET_NAME,
  s3Client,
} = require('../src/services/storage');

const APPLY = process.argv.includes('--apply');
const WIPE_SONGS = process.argv.includes('--wipe-songs');
const WIPE_OFFICIAL = process.argv.includes('--wipe-official-user');
const WIPE_COMMUNITY = process.argv.includes('--wipe-community-pages');
const WIPE_MAP_CACHE = process.argv.includes('--wipe-map-cache');
const SKIP_SEVALLA = process.argv.includes('--skip-sevalla');
const SAMPLE = (() => {
  const a = process.argv.find((x) => x.startsWith('--sample='));
  return a ? Math.max(0, parseInt(a.split('=')[1], 10) || 20) : 20;
})();

const OFFICIAL_USER_ID =
  process.env.TAATOM_OFFICIAL_USER_ID &&
  mongoose.Types.ObjectId.isValid(process.env.TAATOM_OFFICIAL_USER_ID)
    ? process.env.TAATOM_OFFICIAL_USER_ID
    : '000000000000000000000001';

/** Collections wiped entirely (unless filtered below). */
const WIPE_COLLECTIONS = [
  'posts',
  'likes',
  'comments',
  'follows',
  'journeys',
  'tripvisits',
  'notifications',
  'reports',
  'collections',
  'hashtags',
  'chats',
  'activities',
  'userinteractions',
  'analyticevents',
  'errorlogs',
  'shorturls',
  'forgotsignins',
  'fxratecaches',
  'transcodejobs',
  'connectfollows',
  'connectpageviews',
  'orders',
  'subscriptions',
  'payouts',
];

/** Always keep these whole collections. */
const KEEP_COLLECTIONS = [
  'locales',
  'superadmins',
  'systemsettings',
  'featureflags',
  'scheduleddowntimes',
];

const SEVALLA_WIPE_PREFIXES = ['posts/', 'profiles/', 'chats/', 'shorts/', 'misc/'];
if (WIPE_SONGS) SEVALLA_WIPE_PREFIXES.push('songs/');

const summary = {
  mode: APPLY ? 'APPLY' : 'DRY_RUN',
  mongo: {},
  usersDeleted: 0,
  usersKept: 0,
  connectPagesDeleted: 0,
  connectPagesKept: 0,
  songsDeleted: 0,
  mapCacheDeleted: {},
  sevallaKeysFromDb: 0,
  sevallaKeysFromPrefix: 0,
  sevallaDeleted: 0,
  sevallaFailed: 0,
  sampleKeys: [],
  concerns: [],
};

function addSample(key) {
  if (summary.sampleKeys.length < SAMPLE && key) {
    summary.sampleKeys.push(key);
  }
}

function isHttp(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

function pushKey(set, value) {
  if (!value || typeof value !== 'string') return;
  const k = value.trim();
  if (!k || isHttp(k)) return;
  // skip locales/ and songs/ unless wiping songs
  if (k.startsWith('locales/')) return;
  if (k.startsWith('songs/') && !WIPE_SONGS) return;
  set.add(k);
  addSample(k);
}

async function collectKeysFromCursor(cursor, extractFn, keySet) {
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    extractFn(doc, keySet);
  }
}

async function listPrefixKeys(prefix) {
  const keys = [];
  if (!s3Client || !BUCKET_NAME) return keys;
  let token;
  do {
    const out = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of out.Contents || []) {
      if (obj.Key) {
        keys.push(obj.Key);
        addSample(obj.Key);
      }
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function deleteKeys(keys) {
  for (const key of keys) {
    if (!APPLY) continue;
    try {
      await deleteObject(key);
      summary.sevallaDeleted += 1;
    } catch (err) {
      summary.sevallaFailed += 1;
      console.warn(`[sevalla] delete failed: ${key} — ${err.message}`);
    }
  }
}

async function wipeCollection(db, name, filter = {}) {
  const col = db.collection(name);
  const count = await col.countDocuments(filter);
  summary.mongo[name] = { filter, count };
  if (!APPLY || count === 0) return count;
  const res = await col.deleteMany(filter);
  return res.deletedCount || 0;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Taatom UGC wipe — KEEP locales (+ admin essentials)');
  console.log(`  Mode: ${summary.mode}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is required');
    process.exit(1);
  }

  if (APPLY && process.env.CONFIRM_WIPE !== 'YES_WIPE_UGC') {
    console.error('Refusing --apply without CONFIRM_WIPE=YES_WIPE_UGC');
    process.exit(1);
  }

  // Concerns always printed
  summary.concerns.push(
    'KEEP locales (+ Sevalla locales/ objects) — curated SuperAdmin destinations.',
  );
  summary.concerns.push(
    'KEEP superadmins / systemsettings / featureflags / scheduleddowntimes.',
  );
  if (!WIPE_SONGS) {
    summary.concerns.push(
      'KEEP songs (+ songs/ storage) — SuperAdmin shorts audio library. Pass --wipe-songs to remove.',
    );
  }
  if (!WIPE_OFFICIAL) {
    summary.concerns.push(
      `KEEP Taatom Official user ${OFFICIAL_USER_ID}. Pass --wipe-official-user to remove (may break support chat).`,
    );
  }
  if (!WIPE_COMMUNITY) {
    summary.concerns.push(
      'KEEP Connect pages with category=community (admin communities). Pass --wipe-community-pages to remove those too.',
    );
  }
  if (!WIPE_MAP_CACHE) {
    summary.concerns.push(
      'KEEP roads + importedregions (OSM map-snap cache). Pass --wipe-map-cache to clear.',
    );
  }
  summary.concerns.push(
    'Cashfree: wiping subscriptions/orders/payouts does NOT cancel live Cashfree subscriptions — reconcile in Cashfree dashboard if needed.',
  );
  summary.concerns.push(
    'Cloudinary legacy URLs (if any) are not deleted here — only Sevalla/R2 keys.',
  );

  console.log('\n— Concerns / keep policy —');
  summary.concerns.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));

  await mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 15000,
  });
  const db = mongoose.connection.db;
  console.log(`\nConnected DB: ${db.databaseName}`);

  const keySet = new Set();

  // --- Collect media keys from UGC before delete ---
  console.log('\n— Scanning media keys from documents to wipe —');

  // Posts
  {
    const cur = db.collection('posts').find(
      {},
      { projection: { storageKey: 1, storageKeys: 1, cloudinaryPublicId: 1, cloudinaryPublicIds: 1 } },
    );
    await collectKeysFromCursor(
      cur,
      (doc, set) => {
        pushKey(set, doc.storageKey);
        (doc.storageKeys || []).forEach((k) => pushKey(set, k));
        // HLS often under shorts/hls/{postId}/ — prefix scan covers this
      },
      keySet,
    );
  }

  // Users (profile pics) — exclude official if keeping
  {
    const filter = WIPE_OFFICIAL
      ? {}
      : { _id: { $ne: new mongoose.Types.ObjectId(OFFICIAL_USER_ID) } };
    const cur = db.collection('users').find(filter, {
      projection: { profilePicStorageKey: 1 },
    });
    await collectKeysFromCursor(
      cur,
      (doc, set) => pushKey(set, doc.profilePicStorageKey),
      keySet,
    );
  }

  // Chats attachments
  {
    const cur = db.collection('chats').find({}, { projection: { messages: 1, attachments: 1 } });
    await collectKeysFromCursor(
      cur,
      (doc, set) => {
        const msgs = doc.messages || [];
        for (const m of msgs) {
          const atts = m.attachments || [];
          for (const a of atts) {
            pushKey(set, a.url);
            pushKey(set, a.imageUrl);
            pushKey(set, a.storageKey);
          }
        }
      },
      keySet,
    );
  }

  // Connect pages being wiped
  {
    const filter = WIPE_COMMUNITY ? {} : { category: { $ne: 'community' } };
    const cur = db.collection('connectpages').find(filter, {
      projection: {
        profileImage: 1,
        bannerImage: 1,
        websiteContent: 1,
        subscriptionContent: 1,
      },
    });
    await collectKeysFromCursor(
      cur,
      (doc, set) => {
        pushKey(set, doc.profileImage);
        pushKey(set, doc.bannerImage);
        const scrape = (node) => {
          if (!node) return;
          if (typeof node === 'string') pushKey(set, node);
          else if (Array.isArray(node)) node.forEach(scrape);
          else if (typeof node === 'object') Object.values(node).forEach(scrape);
        };
        scrape(doc.websiteContent);
        scrape(doc.subscriptionContent);
      },
      keySet,
    );
  }

  if (WIPE_SONGS) {
    const cur = db.collection('songs').find(
      {},
      { projection: { storageKey: 1, s3Key: 1, imageStorageKey: 1, cloudinaryKey: 1 } },
    );
    await collectKeysFromCursor(
      cur,
      (doc, set) => {
        pushKey(set, doc.storageKey);
        pushKey(set, doc.s3Key);
        pushKey(set, doc.imageStorageKey);
        pushKey(set, doc.cloudinaryKey);
      },
      keySet,
    );
  }

  summary.sevallaKeysFromDb = keySet.size;
  console.log(`  Keys collected from DB fields: ${keySet.size}`);

  // --- Mongo counts / deletes ---
  console.log('\n— MongoDB collections —');

  for (const name of KEEP_COLLECTIONS) {
    const n = await db.collection(name).countDocuments();
    console.log(`  KEEP  ${name.padEnd(22)} count=${n}`);
  }
  if (!WIPE_SONGS) {
    const n = await db.collection('songs').countDocuments();
    console.log(`  KEEP  ${'songs'.padEnd(22)} count=${n}`);
  }

  for (const name of WIPE_COLLECTIONS) {
    const deleted = await wipeCollection(db, name);
    console.log(
      `  ${APPLY ? 'DEL ' : 'WOULD_DEL'} ${name.padEnd(22)} count=${summary.mongo[name]?.count ?? deleted}`,
    );
  }

  // Users
  {
    const filter = WIPE_OFFICIAL
      ? {}
      : { _id: { $ne: new mongoose.Types.ObjectId(OFFICIAL_USER_ID) } };
    const count = await db.collection('users').countDocuments(filter);
    const kept = WIPE_OFFICIAL
      ? 0
      : await db.collection('users').countDocuments({
          _id: new mongoose.Types.ObjectId(OFFICIAL_USER_ID),
        });
    summary.usersDeleted = count;
    summary.usersKept = kept;
    summary.mongo.users = { filter: WIPE_OFFICIAL ? 'ALL' : 'except official', count };
    console.log(
      `  ${APPLY ? 'DEL ' : 'WOULD_DEL'} ${'users'.padEnd(22)} count=${count} (keep official=${kept})`,
    );
    if (APPLY && count) await db.collection('users').deleteMany(filter);
  }

  // Connect pages
  {
    const filter = WIPE_COMMUNITY ? {} : { category: { $ne: 'community' } };
    const count = await db.collection('connectpages').countDocuments(filter);
    const kept = WIPE_COMMUNITY
      ? 0
      : await db.collection('connectpages').countDocuments({ category: 'community' });
    summary.connectPagesDeleted = count;
    summary.connectPagesKept = kept;
    summary.mongo.connectpages = { filter, count };
    console.log(
      `  ${APPLY ? 'DEL ' : 'WOULD_DEL'} ${'connectpages'.padEnd(22)} count=${count} (keep community=${kept})`,
    );
    if (APPLY && count) await db.collection('connectpages').deleteMany(filter);
  }

  if (WIPE_SONGS) {
    const n = await wipeCollection(db, 'songs');
    summary.songsDeleted = summary.mongo.songs?.count ?? n;
    console.log(`  ${APPLY ? 'DEL ' : 'WOULD_DEL'} ${'songs'.padEnd(22)} count=${summary.songsDeleted}`);
  }

  if (WIPE_MAP_CACHE) {
    for (const name of ['roads', 'importedregions']) {
      await wipeCollection(db, name);
      summary.mapCacheDeleted[name] = summary.mongo[name]?.count || 0;
      console.log(
        `  ${APPLY ? 'DEL ' : 'WOULD_DEL'} ${name.padEnd(22)} count=${summary.mapCacheDeleted[name]}`,
      );
    }
  } else {
    for (const name of ['roads', 'importedregions']) {
      const n = await db.collection(name).countDocuments();
      console.log(`  KEEP  ${name.padEnd(22)} count=${n}`);
    }
  }

  // Locale sanity
  {
    const n = await db.collection('locales').countDocuments();
    console.log(`\n  Locales remaining (must stay): ${n}`);
  }

  // --- Sevalla prefix scan + delete ---
  if (SKIP_SEVALLA) {
    console.log('\n— Sevalla: SKIPPED (--skip-sevalla) —');
  } else if (!BUCKET_NAME || !s3Client) {
    console.log('\n— Sevalla: NOT CONFIGURED (set SEVALLA_STORAGE_* env) —');
  } else {
    console.log(`\n— Sevalla bucket: ${BUCKET_NAME} —`);
    console.log(`  Wipe prefixes: ${SEVALLA_WIPE_PREFIXES.join(', ')}`);
    console.log('  Protected prefixes: locales/' + (WIPE_SONGS ? '' : ', songs/'));

    const prefixKeys = new Set(keySet);
    for (const prefix of SEVALLA_WIPE_PREFIXES) {
      const listed = await listPrefixKeys(prefix);
      console.log(`  Prefix ${prefix.padEnd(12)} objects=${listed.length}`);
      listed.forEach((k) => prefixKeys.add(k));
    }
    // Never touch locales/
    for (const k of [...prefixKeys]) {
      if (k.startsWith('locales/')) prefixKeys.delete(k);
      if (!WIPE_SONGS && k.startsWith('songs/')) prefixKeys.delete(k);
    }

    summary.sevallaKeysFromPrefix = prefixKeys.size;
    console.log(`  Total unique keys to ${APPLY ? 'DELETE' : 'would delete'}: ${prefixKeys.size}`);

    if (summary.sampleKeys.length) {
      console.log(`\n  Sample keys (up to ${SAMPLE}):`);
      summary.sampleKeys.forEach((k) => console.log(`    - ${k}`));
    }

    if (APPLY) {
      console.log('\n  Deleting Sevalla objects…');
      await deleteKeys([...prefixKeys]);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  console.log('═══════════════════════════════════════════════════════════');

  if (!APPLY) {
    console.log(`
DRY RUN complete — nothing was deleted.

To apply for real:
  CONFIRM_WIPE=YES_WIPE_UGC MONGO_URL='...' \\
    node scripts/wipe-ugc-keep-locales.js --apply

Ensure SEVALLA_STORAGE_* are set in the environment for hard storage deletes.
`);
  } else {
    console.log('\nAPPLY complete. Verify locales in SuperAdmin and app health.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

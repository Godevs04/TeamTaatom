/**
 * Migration: Transcode legacy short videos to H.264 720p / AAC
 *
 * Background: Some shorts in production were uploaded by iPhones using HEVC (H.265)
 * or other codecs that crash older Android decoders with a heap-OOM bug.
 * Commit bc725c6 ships a fix (`backend/src/services/videoTranscode.js`) that
 * normalizes new uploads at write-time. This one-time backfill reprocesses
 * existing shorts so they stop crashing on Android.
 *
 * Behavior:
 *  - Iterates `posts` documents where `type === 'short'` and a video key is set.
 *  - For each post, downloads the video from R2, runs `transcodeIfNeeded`, and
 *    if the transcoder rewrote the buffer (i.e. the source was non-H.264),
 *    uploads the new buffer under a sibling key with a `-h264` suffix and
 *    repoints the document to the new key.
 *  - Marks the post with `transcodedAt` + `originalStorageKey` so the migration
 *    is idempotent (resumable on re-run) and reversible (`down()` restores
 *    from `originalStorageKey`).
 *  - The original key is preserved in storage during `up()` so `down()` can
 *    roll back without data loss. Cleanup of originals is left as a separate
 *    follow-up once the team is confident in the new encodes.
 *
 * Env knobs (all optional):
 *   DRY_RUN=1       — log what would happen, but do not write to R2 or Mongo.
 *   LIMIT=100       — only process the first N candidate posts (default: no limit).
 *   CONCURRENCY=1   — process N posts in parallel (default 1, max 3).
 *                     ffmpeg + R2 IO is heavy; raise only on a beefy box.
 *
 * See `003_transcode_legacy_shorts.README.md` for runbook details.
 */

const path = require('path');

// Load services from the backend src tree. These paths are resolved relative
// to this migration file.
const SERVICES_ROOT = path.resolve(__dirname, '..', 'src', 'services');

// videoTranscode.js was added in commit bc725c6. If it isn't present at runtime
// the migration will fail loudly at startup, which is the desired behavior —
// we never want to silently no-op this backfill.
const { transcodeIfNeeded } = require(path.join(SERVICES_ROOT, 'videoTranscode'));
const {
  uploadObject,
  getDownloadUrl,
  deleteObject,
  objectExists,
} = require(path.join(SERVICES_ROOT, 'storage'));

const POSTS_COLLECTION = 'posts';
const PROGRESS_LOG_INTERVAL = 10;

// ---------- Helpers ----------

/**
 * The Post schema stores `storageKey` and `storageKeys[0]` as R2 object keys,
 * but historically some older docs may contain pre-signed URLs (since
 * mediaService.generateSignedUrl swaps keys for URLs at read time and some
 * older code paths may have persisted the URL). Strip query string and
 * scheme/host if it looks like a URL so we always operate on a raw key.
 */
function normalizeStorageKey(value) {
  if (!value || typeof value !== 'string') return null;
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value;
  }
  try {
    const url = new URL(value);
    // Drop leading slash from pathname; drop bucket prefix if path-style URL.
    let key = url.pathname.replace(/^\/+/, '');
    // For path-style URLs (forcePathStyle: true in storage.js), the bucket
    // name is the first path segment. Strip it if present.
    const bucket = process.env.SEVALLA_STORAGE_BUCKET;
    if (bucket && key.startsWith(`${bucket}/`)) {
      key = key.slice(bucket.length + 1);
    }
    return key || null;
  } catch (_err) {
    return null;
  }
}

/**
 * Build a sibling key for the H.264 re-encode by inserting `-h264` before
 * the extension. e.g. `posts/123/abc.mov` -> `posts/123/abc-h264.mp4`.
 * We always emit `.mp4` because the transcoder produces MP4/H.264/AAC.
 */
function buildH264Key(originalKey) {
  const lastSlash = originalKey.lastIndexOf('/');
  const dir = lastSlash >= 0 ? originalKey.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? originalKey.slice(lastSlash + 1) : originalKey;
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${dir}${stem}-h264.mp4`;
}

/**
 * Download an object's bytes via a signed GET URL. We avoid pulling the S3
 * client directly so this migration only depends on the public storage API.
 */
async function downloadFromR2(key) {
  // 600s expiry is plenty for a single-post download even on slow links.
  const url = await getDownloadUrl(key, 600);
  // Node 18+ has global fetch. The migrate-mongo runner uses the project's
  // Node, which per CLAUDE.md is 18+.
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`R2 GET failed for key ${key}: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function readEnvInt(name, defaultValue, { min, max } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  let value = parsed;
  if (typeof min === 'number') value = Math.max(min, value);
  if (typeof max === 'number') value = Math.min(max, value);
  return value;
}

function isTruthyEnv(name) {
  const v = process.env[name];
  if (!v) return false;
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(v);
}

// ---------- Per-post processing ----------

/**
 * Process a single Post document. Returns one of:
 *   { status: 'skipped-already-done' }
 *   { status: 'skipped-no-key' }
 *   { status: 'passthrough' }       // already H.264, no rewrite needed
 *   { status: 'transcoded', newKey }
 *   { status: 'error', error }
 */
async function processPost(postsCol, doc, { dryRun }) {
  const _id = doc._id;

  // Idempotency guard: if the marker is set we already finished this post.
  if (doc.transcodedAt) {
    return { status: 'skipped-already-done' };
  }

  // Resolve the source video key. Prefer storageKeys[0] when present
  // (canonical for shorts: index 0 = video, 1+ = thumbnails), fall back to
  // the legacy `storageKey` field. Either may contain a pre-signed URL on
  // older docs — normalize before use.
  const rawKey =
    (Array.isArray(doc.storageKeys) && doc.storageKeys[0]) ||
    doc.storageKey ||
    null;
  const sourceKey = normalizeStorageKey(rawKey);

  if (!sourceKey) {
    return { status: 'skipped-no-key' };
  }

  // Download source bytes.
  const sourceBuffer = await downloadFromR2(sourceKey);

  // Run the transcoder. It is fail-open: on internal errors it returns
  // { transcoded: false, buffer: <original> } so the caller can move on.
  const result = await transcodeIfNeeded(sourceBuffer, 'video/mp4');

  if (!result || result.transcoded === false) {
    // Already H.264 (or transcoder failed open). Nothing to write.
    return { status: 'passthrough' };
  }

  const newKey = buildH264Key(sourceKey);

  if (dryRun) {
    return { status: 'transcoded', newKey, dryRun: true };
  }

  // Upload the re-encoded buffer to a sibling key (do NOT clobber the
  // original — `down()` needs it to restore from).
  await uploadObject(result.buffer, newKey, 'video/mp4');

  // Build a safe update. We touch only the fields we own:
  //  - storageKey: repoint to the new key
  //  - storageKeys[0]: repoint, keep thumbnails (index 1+) intact
  //  - originalStorageKey: remember the source so down() can restore
  //  - transcodedAt: idempotency marker for re-runs
  const update = {
    $set: {
      storageKey: newKey,
      originalStorageKey: sourceKey,
      transcodedAt: new Date(),
    },
  };

  // Update storageKeys[0] in-place if the field exists, else create it.
  if (Array.isArray(doc.storageKeys) && doc.storageKeys.length > 0) {
    update.$set['storageKeys.0'] = newKey;
  } else {
    update.$set.storageKeys = [newKey];
  }

  await postsCol.updateOne({ _id }, update);

  return { status: 'transcoded', newKey };
}

// ---------- Concurrency runner ----------

/**
 * Run an async worker over a stream of items with bounded concurrency.
 * We avoid `Promise.all` over the full list because that explodes memory
 * when there are 10k posts. Instead, keep `concurrency` workers in flight.
 */
async function runWithConcurrency(cursor, concurrency, worker) {
  let inFlight = 0;
  let drained = false;
  const stats = {
    processed: 0,
    transcoded: 0,
    passthrough: 0,
    skippedAlreadyDone: 0,
    skippedNoKey: 0,
    errors: 0,
  };

  return new Promise((resolve, reject) => {
    let rejected = false;

    const settle = () => {
      if (rejected) return;
      if (drained && inFlight === 0) resolve(stats);
    };

    const fail = (err) => {
      if (rejected) return;
      rejected = true;
      reject(err);
    };

    const pump = async () => {
      if (rejected) return;
      while (inFlight < concurrency && !drained) {
        let doc;
        try {
          doc = await cursor.next();
        } catch (err) {
          return fail(err);
        }
        if (!doc) {
          drained = true;
          break;
        }
        inFlight += 1;
        // Fire and forget; track via inFlight.
        worker(doc)
          .then((result) => {
            stats.processed += 1;
            switch (result.status) {
              case 'transcoded':
                stats.transcoded += 1;
                break;
              case 'passthrough':
                stats.passthrough += 1;
                break;
              case 'skipped-already-done':
                stats.skippedAlreadyDone += 1;
                break;
              case 'skipped-no-key':
                stats.skippedNoKey += 1;
                break;
              case 'error':
                stats.errors += 1;
                break;
              default:
                break;
            }
            if (stats.processed % PROGRESS_LOG_INTERVAL === 0) {
              console.log(
                `[backfill] processed ${stats.processed}, transcoded ${stats.transcoded}, ` +
                `passthrough ${stats.passthrough}, skipped ${stats.skippedAlreadyDone + stats.skippedNoKey}, ` +
                `errors ${stats.errors}`
              );
            }
          })
          .catch((err) => {
            // Worker is supposed to swallow errors and return status:'error'.
            // If we land here it's a programmer error; surface but continue.
            stats.processed += 1;
            stats.errors += 1;
            console.error('[backfill] unexpected worker rejection:', err);
          })
          .finally(() => {
            inFlight -= 1;
            if (drained) {
              settle();
            } else {
              pump();
            }
          });
      }
      settle();
    };

    pump();
  });
}

// ---------- Migration entry points ----------

module.exports = {
  async up(db /* , client */) {
    const dryRun = isTruthyEnv('DRY_RUN');
    const limit = readEnvInt('LIMIT', 0, { min: 0 }); // 0 == no limit
    const concurrency = readEnvInt('CONCURRENCY', 1, { min: 1, max: 3 });

    console.log(
      `[backfill] starting transcode_legacy_shorts ` +
      `(dryRun=${dryRun}, limit=${limit || 'none'}, concurrency=${concurrency})`
    );

    const postsCol = db.collection(POSTS_COLLECTION);

    // Build the candidate query. We deliberately do NOT exclude
    // `transcodedAt` here — instead we let processPost() short-circuit on
    // resume so a re-run with a tighter LIMIT still revisits the head of
    // the queue deterministically.
    const filter = {
      type: 'short',
      $or: [
        { storageKey: { $exists: true, $nin: [null, ''] } },
        { storageKeys: { $exists: true, $not: { $size: 0 } } },
      ],
    };

    const totalCandidates = await postsCol.countDocuments(filter);
    console.log(`[backfill] ${totalCandidates} candidate shorts found`);

    let cursor = postsCol
      .find(filter, {
        projection: {
          _id: 1,
          storageKey: 1,
          storageKeys: 1,
          transcodedAt: 1,
        },
      })
      // Stable order so resume after a crash starts from approximately the
      // same place. createdAt asc puts oldest (most likely HEVC) first.
      .sort({ createdAt: 1 });

    if (limit > 0) {
      cursor = cursor.limit(limit);
    }

    const stats = await runWithConcurrency(cursor, concurrency, async (doc) => {
      try {
        const result = await processPost(postsCol, doc, { dryRun });
        if (result.status === 'transcoded') {
          console.log(
            `[backfill] ${dryRun ? '(dry-run) would transcode' : 'transcoded'} ` +
            `post ${doc._id} -> ${result.newKey}`
          );
        } else if (result.status === 'skipped-no-key') {
          console.warn(`[backfill] skipping post ${doc._id} — no usable storage key`);
        }
        return result;
      } catch (err) {
        // Per spec: errors on a single post are logged with _id and we
        // continue. Never abort the whole run.
        console.error(`[backfill] error on post ${doc._id}:`, err && err.message ? err.message : err);
        return { status: 'error', error: err };
      }
    });

    console.log(
      `[backfill] done. processed=${stats.processed} transcoded=${stats.transcoded} ` +
      `passthrough=${stats.passthrough} skippedAlreadyDone=${stats.skippedAlreadyDone} ` +
      `skippedNoKey=${stats.skippedNoKey} errors=${stats.errors}`
    );

    if (dryRun) {
      console.log('[backfill] DRY_RUN=1 — no documents or R2 objects were written.');
    }
  },

  async down(db /* , client */) {
    const dryRun = isTruthyEnv('DRY_RUN');
    console.log(`[backfill] reverting transcode_legacy_shorts (dryRun=${dryRun})`);

    const postsCol = db.collection(POSTS_COLLECTION);

    const filter = {
      type: 'short',
      originalStorageKey: { $exists: true, $nin: [null, ''] },
    };

    const cursor = postsCol.find(filter, {
      projection: {
        _id: 1,
        storageKey: 1,
        storageKeys: 1,
        originalStorageKey: 1,
      },
    });

    let reverted = 0;
    let errors = 0;

    // Series, not parallel — `down()` is rarer and safer to keep deterministic.
    // eslint-disable-next-line no-await-in-loop
    while (await cursor.hasNext()) {
      // eslint-disable-next-line no-await-in-loop
      const doc = await cursor.next();
      try {
        const newKey = doc.storageKey; // the H.264 we wrote in up()
        const original = doc.originalStorageKey;

        if (dryRun) {
          console.log(
            `[backfill] (dry-run) would restore post ${doc._id}: ` +
            `${newKey} -> ${original}`
          );
          reverted += 1;
          continue; // eslint-disable-line no-continue
        }

        // Best-effort: confirm the original still exists before flipping
        // pointers, so we don't leave a post pointing at a deleted key.
        // eslint-disable-next-line no-await-in-loop
        const stillThere = await objectExists(original).catch(() => false);
        if (!stillThere) {
          console.warn(
            `[backfill] WARN: original key ${original} for post ${doc._id} is missing in R2; ` +
            `skipping rollback for this post to avoid breaking it`
          );
          continue; // eslint-disable-line no-continue
        }

        const update = {
          $set: { storageKey: original },
          $unset: { originalStorageKey: '', transcodedAt: '' },
        };
        if (Array.isArray(doc.storageKeys) && doc.storageKeys.length > 0) {
          update.$set['storageKeys.0'] = original;
        } else {
          update.$set.storageKeys = [original];
        }

        // eslint-disable-next-line no-await-in-loop
        await postsCol.updateOne({ _id: doc._id }, update);

        // Delete the H.264 transcoded key from R2. Do this AFTER the doc
        // update so we never have a doc pointing at a key we just deleted.
        if (newKey && newKey !== original) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await deleteObject(newKey);
          } catch (delErr) {
            console.warn(
              `[backfill] WARN: failed to delete H.264 key ${newKey} for post ${doc._id}: ` +
              `${delErr && delErr.message ? delErr.message : delErr}`
            );
          }
        }

        reverted += 1;
      } catch (err) {
        errors += 1;
        console.error(`[backfill] rollback error on post ${doc._id}:`, err && err.message ? err.message : err);
      }
    }

    console.log(`[backfill] rollback complete. reverted=${reverted} errors=${errors}`);
  },
};

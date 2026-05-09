/**
 * Backfill Song.duration for songs that were uploaded with duration: 0.
 *
 * Why this exists:
 *   The SuperAdmin upload form treated the Duration (minutes) field as an
 *   optional manual input. When admins skipped it, songController persisted
 *   duration: 0, and the mobile song list rendered "0:00" for those rows.
 *
 *   The form has been fixed to auto-extract duration from the audio file
 *   in the browser (HTMLAudioElement.duration) before upload. This migration
 *   repairs the historical rows so users immediately see correct mm:ss
 *   without admins having to edit each song manually.
 *
 * What this does:
 *   For every Song where duration is 0, null, or missing:
 *     1. Pick the best available storage key (storageKey, cloudinaryKey, s3Key).
 *     2. Stream the audio object from Sevalla Object Storage (S3-compatible).
 *     3. Run music-metadata's parseStream on it to read the audio duration.
 *     4. $set duration to the rounded second count.
 *   Songs with no storage key, an unreachable file, or unparseable audio are
 *   logged and skipped — they can be fixed manually in the SuperAdmin edit
 *   modal.
 *
 * Safe to re-run: idempotent. Only touches rows whose duration is still <= 0.
 *
 * One-time deps: music-metadata (added to backend/package.json). Loaded via
 * dynamic import because v11+ is ESM-only and the rest of the backend is CJS.
 */

const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, BUCKET_NAME } = require('../src/services/storage');

const pickStorageKey = (song) =>
  song.storageKey || song.cloudinaryKey || song.s3Key || null;

module.exports = {
  async up(db) {
    if (!BUCKET_NAME) {
      console.error('[005_backfill_song_duration] SEVALLA_STORAGE_BUCKET not configured — aborting.');
      return;
    }

    // music-metadata v11+ is ESM-only; pull it in via dynamic import so this
    // CJS file still works under migrate-mongo.
    const { parseStream } = await import('music-metadata');

    const songs = db.collection('songs');
    const cursor = songs.find({
      $or: [
        { duration: 0 },
        { duration: null },
        { duration: { $exists: false } }
      ]
    });

    let scanned = 0;
    let corrected = 0;
    let skippedNoKey = 0;
    let skippedFetch = 0;
    let skippedParse = 0;
    let skippedZero = 0;

    while (await cursor.hasNext()) {
      const song = await cursor.next();
      scanned += 1;

      const key = pickStorageKey(song);
      if (!key) {
        skippedNoKey += 1;
        continue;
      }

      // Fetch the object body as a Node Readable stream.
      let body;
      try {
        const res = await s3Client.send(new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key
        }));
        body = res.Body;
      } catch (err) {
        skippedFetch += 1;
        console.warn(`[005_backfill_song_duration] fetch failed for ${song._id} (key=${key}):`, err?.message || err);
        continue;
      }

      // music-metadata accepts any Readable. v3 SDK returns an SdkStream
      // that's also a Readable. Hint duration: true so it doesn't waste time
      // pulling the full tag set.
      let metadata;
      try {
        metadata = await parseStream(body, undefined, {
          duration: true,
          skipCovers: true,
          skipPostHeaders: true
        });
      } catch (err) {
        skippedParse += 1;
        console.warn(`[005_backfill_song_duration] parse failed for ${song._id} (key=${key}):`, err?.message || err);
        // Be sure to drain/destroy the stream so we don't leak file handles.
        try { if (body && typeof body.destroy === 'function') body.destroy(); } catch {}
        continue;
      }

      const seconds = metadata?.format?.duration;
      if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) {
        skippedZero += 1;
        continue;
      }

      const rounded = Math.round(seconds);
      await songs.updateOne({ _id: song._id }, { $set: { duration: rounded } });
      corrected += 1;
    }

    console.log(
      `[005_backfill_song_duration] scanned=${scanned} corrected=${corrected} ` +
      `skippedNoKey=${skippedNoKey} skippedFetch=${skippedFetch} ` +
      `skippedParse=${skippedParse} skippedZero=${skippedZero}`
    );
  },

  async down(_db) {
    // No-op: we have no record of the previous (zero) durations and they
    // were wrong anyway. Down migration intentionally a no-op.
    console.log('[005_backfill_song_duration] down is a no-op');
  }
};

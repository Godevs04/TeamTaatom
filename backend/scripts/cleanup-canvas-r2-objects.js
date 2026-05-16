/**
 * Delete orphaned R2 / Sevalla storage objects referenced by ConnectPage.canvasContent.
 *
 * Context:
 *   The canvas editor was removed across web, mobile, and SuperAdmin in
 *   May 2026. Migration 009_clear_connect_canvas_content unsets the
 *   canvasContent / canvasBackground fields. The image and video assets
 *   uploaded for canvas elements live under storage keys like
 *   `misc/{userId}/{timestamp}-{uniqueId}.{ext}` and become
 *   orphans the moment the field is cleared.
 *
 *   This script reads those keys directly from the DB BEFORE migration
 *   009 has run, so it can target individual objects precisely. Once 009
 *   has run, the keys are gone and this script will find nothing to do —
 *   a separate prefix-scan would be needed to clean up post-migration.
 *
 * Run order:
 *   1. node scripts/cleanup-canvas-r2-objects.js          # dry run (default)
 *   2. node scripts/cleanup-canvas-r2-objects.js --apply  # actually delete
 *   3. npm run migrate                                    # then run migration 009
 *
 * Safety:
 *   - Dry run is the default. You must pass --apply to delete anything.
 *   - Each delete is best-effort: a single failure logs and continues;
 *     it does not abort the run. Re-running after a partial failure is
 *     safe (already-deleted keys 404, which we treat as success).
 *   - Only touches keys referenced by canvas elements of type 'image'
 *     or 'video' whose content is a storage key (not a stale signed URL).
 *
 * Run from backend/:
 *   node scripts/cleanup-canvas-r2-objects.js [--apply]
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { deleteObject, BUCKET_NAME } = require('../src/services/storage');

const APPLY = process.argv.includes('--apply');

const summary = {
  pagesScanned: 0,
  pagesWithCanvas: 0,
  keysFound: 0,
  keysSkippedNonStorage: 0,
  keysDeleted: 0,
  keysFailed: 0,
  failures: [],
};

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL not set');
    process.exit(1);
  }
  if (!BUCKET_NAME) {
    console.error('SEVALLA_STORAGE_BUCKET not configured — cannot delete R2 objects');
    process.exit(1);
  }

  console.log(`[cleanup-canvas] mode=${APPLY ? 'APPLY (real deletes)' : 'DRY RUN'} bucket=${BUCKET_NAME}`);

  await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 8000 });
  const pages = mongoose.connection.collection('connectpages');

  const cursor = pages.find(
    { canvasContent: { $exists: true, $ne: [] } },
    { projection: { _id: 1, canvasContent: 1 } }
  );

  while (await cursor.hasNext()) {
    const page = await cursor.next();
    summary.pagesScanned += 1;
    const elements = Array.isArray(page.canvasContent) ? page.canvasContent : [];
    if (elements.length === 0) continue;
    summary.pagesWithCanvas += 1;

    for (const el of elements) {
      if (!el || (el.type !== 'image' && el.type !== 'video')) continue;
      const content = typeof el.content === 'string' ? el.content.trim() : '';
      if (!content) continue;

      // A canvas element's `content` is the storage key when persisted by
      // the (now-removed) updateCanvasContent controller; a signed URL only
      // appears in transit. If we still see an http(s) URL it means the
      // server-side sanitizer didn't catch it on save — skip rather than
      // guess at the key from the URL.
      if (content.startsWith('http://') || content.startsWith('https://')) {
        summary.keysSkippedNonStorage += 1;
        continue;
      }

      summary.keysFound += 1;

      if (!APPLY) {
        console.log(`[dry-run] would delete: ${content}`);
        continue;
      }

      try {
        await deleteObject(content);
        summary.keysDeleted += 1;
      } catch (err) {
        // R2 returns success even for missing keys for DeleteObject, so a
        // thrown error here is a real problem (auth, network, etc.). Log
        // and keep going — orphaned R2 objects are recoverable later;
        // a half-aborted run is harder to reason about.
        summary.keysFailed += 1;
        summary.failures.push({ key: content, error: err?.message || String(err) });
        console.warn(`[cleanup-canvas] delete failed key=${content} err=${err?.message || err}`);
      }
    }
  }

  console.log('');
  console.log('[cleanup-canvas] done');
  console.log(`  pagesScanned         = ${summary.pagesScanned}`);
  console.log(`  pagesWithCanvas      = ${summary.pagesWithCanvas}`);
  console.log(`  keysFound            = ${summary.keysFound}`);
  console.log(`  keysSkippedNonStorage = ${summary.keysSkippedNonStorage}`);
  console.log(`  keysDeleted          = ${APPLY ? summary.keysDeleted : '(dry run)'}`);
  console.log(`  keysFailed           = ${summary.keysFailed}`);
  if (summary.failures.length > 0) {
    console.log('');
    console.log('  failures (first 20):');
    for (const f of summary.failures.slice(0, 20)) {
      console.log(`    - ${f.key}: ${f.error}`);
    }
    if (summary.failures.length > 20) {
      console.log(`    ... and ${summary.failures.length - 20} more`);
    }
  }
  if (!APPLY && summary.keysFound > 0) {
    console.log('');
    console.log('  Re-run with --apply to actually delete the objects above.');
  }

  await mongoose.disconnect();
  process.exit(summary.keysFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[cleanup-canvas] FATAL:', err);
  process.exit(1);
});

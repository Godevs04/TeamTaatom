/**
 * Clear ConnectPage.canvasContent and canvasBackground from existing documents.
 *
 * Why this exists:
 *   The free-form canvas editor (added in TAATOM-049:Bugfixes #12, May 2026)
 *   was reverted to the stacked-blocks builder. The viewer, the mobile
 *   editor, the SuperAdmin editor, the GET/PUT /canvas routes, and the
 *   content-video upload endpoints have all been removed. The model fields
 *   were intentionally left in place during the code revert so data wasn't
 *   silently dropped before this migration shipped.
 *
 *   The fields are now dead weight: no client reads them, no editor writes
 *   them, and Mongoose still returns them on every getPageDetail()
 *   response. This migration unsets them across the collection so list
 *   responses get smaller and the schema-vs-storage state matches.
 *
 * What this does:
 *   Updates every ConnectPage doc that has either field set, $unsetting
 *   canvasContent and canvasBackground in a single bulk update.
 *
 * What this does NOT do:
 *   - Does NOT delete the R2 / Sevalla storage objects referenced by image
 *     and video canvas elements. Those keys (under `misc/...`)
 *     are now orphaned in object storage. Run
 *     `node scripts/cleanup-canvas-r2-objects.js` BEFORE this migration to
 *     reclaim that storage — it reads keys directly from canvasContent,
 *     which this migration is about to unset. (Once this migration has
 *     run, the keys are gone and only a prefix-scan of R2 can find them.)
 *
 *   - Does NOT remove the CanvasElementSchema / field definitions from
 *     the Mongoose model. Those can be removed in a follow-up code change
 *     once we're confident no rollback is needed. Keeping the schema
 *     defined now means an accidental query against these fields won't
 *     throw — it'll just match nothing.
 *
 * Safe to re-run: idempotent ($unset on missing fields is a no-op).
 *
 * Down migration: intentionally a no-op. The dropped data was a
 * free-form positional layout that can't be reconstructed from any other
 * source. If a rollback to canvas is ever needed, restore from a DB
 * snapshot taken before this migration ran.
 */

module.exports = {
  async up(db) {
    const pages = db.collection('connectpages');

    const matchFilter = {
      $or: [
        { canvasContent: { $exists: true, $ne: [] } },
        { canvasBackground: { $exists: true } }
      ]
    };

    const affectedBefore = await pages.countDocuments(matchFilter);

    if (affectedBefore === 0) {
      console.log('[009_clear_connect_canvas_content] nothing to clear');
      return;
    }

    const result = await pages.updateMany(
      matchFilter,
      { $unset: { canvasContent: '', canvasBackground: '' } }
    );

    console.log(
      `[009_clear_connect_canvas_content] matched=${result.matchedCount} ` +
      `modified=${result.modifiedCount} (preChecked=${affectedBefore})`
    );
  },

  async down(_db) {
    // No-op: the cleared data (free-form canvas layouts) cannot be
    // reconstructed from any surviving source. Restore from a DB snapshot
    // if rollback is ever required.
    console.log('[009_clear_connect_canvas_content] down is a no-op');
  }
};

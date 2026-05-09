/**
 * Resync ConnectPage.followerCount with the actual count of active follows.
 *
 * Why this exists:
 *   The cached followerCount field on ConnectPage drifted from the truth
 *   over time. Two historical bugs caused this:
 *     1. archivePage / unarchivePage skipped the +1/-1 counter step, so a
 *        user archiving a follow left the cached count over-stated.
 *     2. The follow-restore-archived branch ran $inc(+1) on top of an
 *        already-archived row, so each archive→re-follow cycle inflated
 *        the count by one.
 *   On top of that, `{ $inc: { followerCount: -1 }, $max: { followerCount: 0 } }`
 *   in a single update document is undefined behavior across MongoDB
 *   versions and produced negative followerCount values on some pages.
 *
 *   The controller has been fixed (every follow-state mutation now derives
 *   the count via countDocuments + $set). This migration repairs the
 *   already-corrupted historical data in one shot so list views start
 *   serving correct numbers immediately, instead of waiting for users to
 *   tap into each page and trigger the in-app self-heal.
 *
 * What this does:
 *   For every ConnectPage:
 *     1. Count ConnectFollow records with connectPageId = page._id and
 *        status = 'active'.
 *     2. If the page's stored followerCount differs, $set it to the live
 *        count.
 *
 * Safe to re-run: idempotent. Logs counts on completion.
 */

module.exports = {
  async up(db) {
    const pages = db.collection('connectpages');
    const follows = db.collection('connectfollows');

    const cursor = pages.find({}, { projection: { _id: 1, followerCount: 1 } });

    let scanned = 0;
    let corrected = 0;
    let totalDelta = 0;

    while (await cursor.hasNext()) {
      const page = await cursor.next();
      scanned += 1;

      const liveCount = await follows.countDocuments({
        connectPageId: page._id,
        status: 'active'
      });

      const storedCount = typeof page.followerCount === 'number' ? page.followerCount : 0;
      if (storedCount === liveCount) continue;

      await pages.updateOne(
        { _id: page._id },
        { $set: { followerCount: liveCount } }
      );
      corrected += 1;
      totalDelta += Math.abs(storedCount - liveCount);
    }

    console.log(
      `[004_resync_connect_followercount] scanned=${scanned} ` +
      `corrected=${corrected} totalAbsoluteDelta=${totalDelta}`
    );
  },

  async down(_db) {
    // No-op: we have no record of the previous (drifted) values, and
    // they were wrong anyway. Down migration is intentionally a no-op.
    console.log('[004_resync_connect_followercount] down is a no-op');
  }
};

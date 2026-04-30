/**
 * Cleanup stale signed URLs from User.profilePic.
 *
 * Why this exists:
 *   profileController.js used to persist the freshly-generated signed URL into
 *   User.profilePic on every avatar upload. Signed URLs expire in 10 minutes,
 *   so the DB was poisoned with URLs that broke the moment the cache window closed.
 *
 *   The controller has been fixed (only profilePicStorageKey is persisted now).
 *   This migration cleans up the legacy data so existing users' avatars
 *   immediately start working through resolveProfilePic().
 *
 * What this does:
 *   For every User document where profilePic looks like a signed URL
 *   (contains X-Amz-Signature, Signature=, or Expires=):
 *     1. If profilePicStorageKey is missing, try to extract it from the URL.
 *     2. Clear profilePic (so resolveProfilePic falls through to the storage key).
 *
 *   Permanent CDN URLs (Cloudinary etc.) are left untouched.
 *
 * Safe to re-run: idempotent. Logs counts on completion.
 */

const SIGNED_URL_INDICATORS = ['X-Amz-Signature', 'X-Amz-Credential', 'Signature=', 'Expires='];

const looksSigned = (url) => {
  if (!url || typeof url !== 'string') return false;
  return SIGNED_URL_INDICATORS.some(token => url.includes(token));
};

const extractKeyFromUrl = (signedUrl) => {
  try {
    const url = new URL(signedUrl);
    const path = url.pathname.replace(/^\//, '');
    const parts = path.split('/');
    // Sevalla / R2 paths typically look like: /{bucket}/profiles/{userId}/{file}
    // Strip the bucket segment if it looks like one (contains "taatom" or matches known bucket pattern)
    if (parts.length > 1 && (parts[0].includes('taatom') || parts[0].includes('sevalla') || parts[0].length < 40)) {
      return parts.slice(1).join('/');
    }
    return path;
  } catch (_) {
    return null;
  }
};

module.exports = {
  async up(db) {
    const users = db.collection('users');

    const cursor = users.find({
      profilePic: { $exists: true, $ne: '' },
      $or: SIGNED_URL_INDICATORS.map(token => ({ profilePic: { $regex: token, $options: 'i' } }))
    });

    let scanned = 0;
    let cleared = 0;
    let recoveredKey = 0;

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      scanned += 1;

      if (!looksSigned(user.profilePic)) continue;

      const update = { $set: { profilePic: '' } };

      if (!user.profilePicStorageKey) {
        const key = extractKeyFromUrl(user.profilePic);
        if (key) {
          update.$set.profilePicStorageKey = key;
          recoveredKey += 1;
        }
      }

      await users.updateOne({ _id: user._id }, update);
      cleared += 1;
    }

    console.log(`[002_cleanup_stale_profile_pic_urls] scanned=${scanned} cleared=${cleared} recoveredStorageKey=${recoveredKey}`);
  },

  async down(_db) {
    // No-op: we cannot reconstruct expired signed URLs, and storage keys are
    // the correct source of truth going forward. Down migration is a no-op.
    console.log('[002_cleanup_stale_profile_pic_urls] down is a no-op');
  }
};

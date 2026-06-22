/**
 * Resync cached User.followersCount/followingCount from the Follow collection.
 *
 * The Follow collection is the source of truth. These cached fields can drift
 * after deploys or older migrations, which makes profile headers show 0 while
 * the followers/following lists still contain the real relationships.
 */
module.exports = {
  async up(db) {
    const users = db.collection('users');
    const follows = db.collection('follows');

    let scanned = 0;
    let updated = 0;

    const cursor = users.find({}, { projection: { _id: 1, followersCount: 1, followingCount: 1 } });

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      scanned += 1;

      const [followersCount, followingCount] = await Promise.all([
        follows.countDocuments({ following: user._id, follower: { $ne: user._id } }),
        follows.countDocuments({ follower: user._id, following: { $ne: user._id } }),
      ]);

      const storedFollowers = typeof user.followersCount === 'number' ? user.followersCount : 0;
      const storedFollowing = typeof user.followingCount === 'number' ? user.followingCount : 0;

      if (storedFollowers !== followersCount || storedFollowing !== followingCount) {
        await users.updateOne(
          { _id: user._id },
          { $set: { followersCount, followingCount } }
        );
        updated += 1;
      }
    }

    console.log(
      `[010_resync_user_follow_counts] scanned=${scanned} updated=${updated}`
    );
  },

  async down(_db) {
    console.log('[010_resync_user_follow_counts] down is a no-op');
  },
};

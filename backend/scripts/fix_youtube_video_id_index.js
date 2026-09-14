/**
 * Fix posts.youtubeVideoId unique index so creator uploads (no YouTube id) can insert.
 *
 * Problem: unique sparse index still indexes { youtubeVideoId: null }, so only one
 * non-YouTube post can exist. Switch to a partial unique index on real string ids.
 *
 * Usage: node scripts/fix_youtube_video_id_index.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoUri) {
    console.error('MONGO_URL / MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.db.collection('posts');

  const indexes = await collection.indexes();
  console.log(
    'Current youtube-related indexes:',
    indexes.filter((i) => JSON.stringify(i.key).includes('youtubeVideoId')).map((i) => i.name)
  );

  const unsetResult = await collection.updateMany(
    {
      $or: [
        { youtubeVideoId: null },
        { youtubeVideoId: '' },
        { youtubeUrl: null },
        { youtubeChannelTitle: null },
      ],
    },
    {
      $unset: {
        youtubeVideoId: '',
        youtubeUrl: '',
        youtubeChannelTitle: '',
      },
    }
  );
  console.log(
    `Unset null/empty YouTube fields on ${unsetResult.modifiedCount} posts (matched ${unsetResult.matchedCount})`
  );

  for (const name of ['youtubeVideoId_1', 'youtubeVideoId_unique_partial']) {
    try {
      await collection.dropIndex(name);
      console.log(`Dropped index ${name}`);
    } catch (e) {
      if (e?.codeName === 'IndexNotFound' || e?.code === 27) {
        console.log(`Index ${name} not present (ok)`);
      } else {
        throw e;
      }
    }
  }

  await collection.createIndex(
    { youtubeVideoId: 1 },
    {
      unique: true,
      name: 'youtubeVideoId_unique_partial',
      partialFilterExpression: {
        youtubeVideoId: { $exists: true, $type: 'string', $gt: '' },
      },
    }
  );
  console.log('Created youtubeVideoId_unique_partial');

  const after = await collection.indexes();
  console.log(
    'After:',
    after.filter((i) => JSON.stringify(i.key).includes('youtubeVideoId'))
  );

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});

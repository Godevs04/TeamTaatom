// Recompute Post.views from recorded `post_view` analytics events using the live
// per-viewer window (8h for long videos, 24h otherwise). Repairs counts inflated
// by older tracking logic.
//
// Usage:
//   node scripts/recount_post_views.js                 # dry run, long videos
//   node scripts/recount_post_views.js --type=all      # dry run, every post type
//   node scripts/recount_post_views.js --apply         # write corrected counts
//   node scripts/recount_post_views.js --env=prod.env  # use another env file (e.g. production)

/* eslint-disable no-console */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const envArg = (args.find((a) => a.startsWith('--env=')) || '').split('=')[1];
if (envArg) {
  const envPath = path.resolve(process.cwd(), envArg);
  if (!fs.existsSync(envPath)) {
    console.error(`Env file not found: ${envPath}`);
    process.exit(1);
  }
  require('dotenv').config({ path: envPath, override: true });
} else {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
  require('dotenv').config({ path: path.resolve(__dirname, '..', 'environment.env') });
}

const Post = require('../src/models/Post');
const AnalyticsEvent = require('../src/models/AnalyticsEvent');
const { viewCooldownFor } = require('../src/services/viewWindow');

const apply = args.includes('--apply');
const typeArg = (args.find((a) => a.startsWith('--type=')) || '--type=long_video').split('=')[1];

const countWindowedViews = (events, windowMs) => {
  const lastCounted = new Map();
  let counted = 0;
  for (const e of events) {
    const viewer = e.userId ? `u:${e.userId}` : `s:${e.sessionId || 'anon'}`;
    const t = new Date(e.timestamp).getTime();
    const prev = lastCounted.get(viewer);
    if (prev === undefined || t - prev >= windowMs) {
      counted += 1;
      lastCounted.set(viewer, t);
    }
  }
  return counted;
};

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) throw new Error('MONGO_URL is not set');
  await mongoose.connect(mongoUrl);
  console.log(`Connected to database "${mongoose.connection.db.databaseName}" on ${mongoose.connection.host}`);

  const filter = typeArg === 'all' ? {} : { type: typeArg };
  const posts = await Post.find(filter).select('_id type views caption').lean();
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: checking ${posts.length} post(s) of type "${typeArg}"`);

  const ops = [];
  for (const post of posts) {
    const id = String(post._id);
    const events = await AnalyticsEvent.find({
      event: 'post_view',
      $or: [{ 'properties.post_id': id }, { 'properties.postId': id }],
    })
      .sort({ timestamp: 1 })
      .select('userId sessionId timestamp')
      .lean();

    const correct = countWindowedViews(events, viewCooldownFor(post.type));
    const stored = post.views || 0;
    if (correct !== stored) {
      console.log(`  ${id} [${post.type}] "${(post.caption || '').slice(0, 30)}": ${stored} -> ${correct}`);
      ops.push({ updateOne: { filter: { _id: post._id }, update: { $set: { views: correct } } } });
    }
  }

  if (!ops.length) {
    console.log('All view counts already match.');
  } else if (apply) {
    const result = await Post.bulkWrite(ops, { ordered: false });
    console.log(`Updated ${result.modifiedCount ?? result.nModified ?? ops.length} post(s).`);
  } else {
    console.log(`${ops.length} post(s) would change. Re-run with --apply to write.`);
  }

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

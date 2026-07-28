#!/usr/bin/env node
/**
 * Hard-delete one song from Mongo + Sevalla (audio + cover image).
 *
 * DEFAULT = dry run. Use --apply to delete.
 *
 * Usage (from backend/):
 *   node -r dotenv/config scripts/delete-one-song.js \
 *     --title "Anbe en anbe" --artist "Harris Jayaraj" dotenv_config_path=.env.prod
 *
 *   CONFIRM_DELETE_SONG=YES node -r dotenv/config scripts/delete-one-song.js \
 *     --title "Anbe en anbe" --artist "Harris Jayaraj" --apply dotenv_config_path=.env.prod
 *
 * Or by id:
 *   node scripts/delete-one-song.js --id 6655... --apply
 */

require('dotenv').config();

const mongoose = require('mongoose');
const { deleteObject } = require('../src/services/storage');

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force'); // ignore remaining post refs

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : null;
}

const TITLE = arg('title');
const ARTIST = arg('artist');
const ID = arg('id');

async function main() {
  if (!process.env.MONGO_URL) {
    console.error('MONGO_URL is required');
    process.exit(1);
  }
  if (!ID && !TITLE) {
    console.error('Provide --id <ObjectId> or --title "..." [--artist "..."]');
    process.exit(1);
  }
  if (APPLY && process.env.CONFIRM_DELETE_SONG !== 'YES') {
    console.error('Refusing --apply without CONFIRM_DELETE_SONG=YES');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY_RUN'}  DB: ${db.databaseName}`);

  const filter = ID
    ? { _id: new mongoose.Types.ObjectId(ID) }
    : {
        title: new RegExp(`^${escapeRegex(TITLE)}$`, 'i'),
        ...(ARTIST ? { artist: new RegExp(`^${escapeRegex(ARTIST)}$`, 'i') } : {}),
      };

  const songs = await db.collection('songs').find(filter).toArray();
  if (songs.length === 0) {
    console.error('No song matched.');
    process.exit(1);
  }
  if (songs.length > 1) {
    console.error(`Matched ${songs.length} songs — narrow with --artist or --id:`);
    songs.forEach((s) =>
      console.error(`  ${s._id}  "${s.title}" — ${s.artist}  usage=${s.usageCount}`),
    );
    process.exit(1);
  }

  const song = songs[0];
  const postRefs = await db.collection('posts').countDocuments({
    'song.songId': song._id,
  });

  const keys = [
    song.storageKey,
    song.s3Key,
    song.cloudinaryKey,
    song.imageStorageKey,
  ].filter((k) => typeof k === 'string' && k.trim() && !/^https?:\/\//i.test(k));

  console.log('\nSong:');
  console.log(`  _id:     ${song._id}`);
  console.log(`  title:   ${song.title}`);
  console.log(`  artist:  ${song.artist}`);
  console.log(`  usageCount (denormalized): ${song.usageCount ?? 0}`);
  console.log(`  posts still referencing:   ${postRefs}`);
  console.log(`  Sevalla keys to delete:`);
  keys.forEach((k) => console.log(`    - ${k}`));
  if (!keys.length) console.log('    (none)');

  if (postRefs > 0 && !FORCE) {
    console.error(
      `\nAbort: ${postRefs} post(s) still reference this song. Wipe posts first, or pass --force.`,
    );
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing deleted. Re-run with CONFIRM_DELETE_SONG=YES ... --apply');
    await mongoose.disconnect();
    return;
  }

  for (const key of keys) {
    try {
      await deleteObject(key);
      console.log(`  deleted storage: ${key}`);
    } catch (err) {
      console.warn(`  storage delete failed (${key}): ${err.message}`);
    }
  }

  const res = await db.collection('songs').deleteOne({ _id: song._id });
  console.log(`\nMongo deletedCount: ${res.deletedCount}`);
  await mongoose.disconnect();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Backfill usernames for existing users based on first half of their email (local-part)
// - Uses only lowercase letters, numbers, and underscores
// - Ensures uniqueness by appending numeric suffixes

/* eslint-disable no-console */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'environment.env') });

const User = require('../src/models/User');

function sanitizeUsername(raw) {
  const lower = (raw || '').toLowerCase();
  const sanitized = lower.replace(/[^a-z0-9_]/g, '_');
  // enforce 3-20 char bound; if too short, pad with 'user'
  const base = sanitized.length >= 3 ? sanitized : (sanitized + 'user').slice(0, 20);
  return base.slice(0, 20);
}

async function generateUniqueUsername(base) {
  let candidate = base;
  let suffix = 0;
  const maxLen = 20;
  // Try until unique (bounded by reasonable attempts)
  // We cap to 10k attempts to avoid infinite loops in pathological cases
  while (await User.exists({ username: candidate })) {
    suffix += 1;
    const suffixStr = String(suffix);
    const cutLen = Math.max(1, maxLen - suffixStr.length);
    candidate = (base.slice(0, cutLen) + suffixStr).slice(0, maxLen);
    if (suffix > 10000) throw new Error('Too many username collisions');
  }
  return candidate;
}

function firstHalfLocalPart(email) {
  const local = String(email || '').split('@')[0];
  const n = Math.ceil(local.length / 2);
  return local.slice(0, n);
}

async function backfill() {
  const uri = process.env.MONGO_URL || process.env.DATABASE_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGO_URI (or DATABASE_URI/MONGODB_URI). Set it in environment.env');
    process.exit(1);
  }

  await mongoose.connect(uri, { autoIndex: false });
  console.log('Connected to MongoDB');

  const query = { $or: [{ username: { $exists: false } }, { username: null }, { username: '' }] };
  const users = await User.find(query).select('email username').lean();
  console.log(`Users needing username: ${users.length}`);

  let updated = 0;
  for (const u of users) {
    try {
      const half = firstHalfLocalPart(u.email);
      const base = sanitizeUsername(half);
      const unique = await generateUniqueUsername(base);
      await User.updateOne({ _id: u._id }, { $set: { username: unique } });
      updated += 1;
      if (updated % 100 === 0) console.log(`Updated ${updated} users...`);
    } catch (e) {
      console.error(`Failed to set username for ${u._id} (${u.email}):`, e.message);
    }
  }

  console.log(`Backfill complete. Updated ${updated} users.`);
  await mongoose.disconnect();
}

backfill().catch(async (err) => {
  console.error('Backfill error:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});



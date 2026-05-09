#!/usr/bin/env node
/**
 * Wrapper so `npm run migrate:create` without args prints usage instead of migrate-mongo's stack trace.
 * migrate-mongo requires: migrate-mongo create <description>
 */
const { spawnSync } = require('child_process');
const path = require('path');

const descParts = process.argv.slice(2);
if (descParts.length === 0) {
  console.error('');
  console.error('Missing migration description.');
  console.error('');
  console.error('Usage:');
  console.error('  npm run migrate:create -- <description>');
  console.error('');
  console.error('Examples:');
  console.error('  npm run migrate:create -- add-post-index');
  console.error('  npm run migrate:create -- backfill_user_scores');
  process.exit(1);
}

const description = descParts.join(' ');
const migrateMongoBin = path.join(__dirname, '..', 'node_modules', 'migrate-mongo', 'bin', 'migrate-mongo.js');
const result = spawnSync(process.execPath, [migrateMongoBin, 'create', description], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});
process.exit(result.status === null ? 1 : result.status);

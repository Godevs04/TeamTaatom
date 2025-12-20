#!/usr/bin/env node

/**
 * Sentry Source Maps Upload Script (Node.js version)
 * This script uploads source maps to Sentry after a production build
 * Used by EAS Build hooks and CI/CD pipelines
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Sentry configuration...');

// Check if Sentry auth token is set
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
if (!sentryAuthToken) {
  console.warn('⚠️  SENTRY_AUTH_TOKEN not found. Source maps will not be uploaded.');
  console.warn('   Set SENTRY_AUTH_TOKEN in CI/CD secrets or build environment.');
  process.exit(0);
}

// Get configuration from environment or defaults
const sentryOrg = process.env.SENTRY_ORG || '@teamgodevs';
const sentryProject = process.env.SENTRY_PROJECT || 'taatom';

// Get release version from EAS build, GitHub SHA, or git
let release = process.env.EAS_BUILD_ID || process.env.GITHUB_SHA;
if (!release) {
  try {
    release = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    release = `build-${Date.now()}`;
  }
}

console.log('📦 Uploading source maps to Sentry...');
console.log(`   Organization: ${sentryOrg}`);
console.log(`   Project: ${sentryProject}`);
console.log(`   Release: ${release}`);

// Check if Sentry CLI is installed
let sentryCliAvailable = false;
try {
  execSync('sentry-cli --version', { stdio: 'ignore' });
  sentryCliAvailable = true;
} catch (error) {
  console.log('📥 Installing Sentry CLI...');
  try {
    execSync('npm install -g @sentry/cli', { stdio: 'inherit' });
    sentryCliAvailable = true;
  } catch (installError) {
    console.error('❌ Failed to install Sentry CLI');
    process.exit(1);
  }
}

// Find source maps directory
const possibleDirs = ['dist', '.expo/web/dist', 'build', '.next'];
let sourceMapsDir = null;

for (const dir of possibleDirs) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    sourceMapsDir = dir;
    break;
  }
}

if (!sourceMapsDir) {
  console.warn('⚠️  Source maps directory not found. Skipping upload.');
  console.warn(`   Searched: ${possibleDirs.join(', ')}`);
  process.exit(0);
}

console.log(`📁 Source maps directory: ${sourceMapsDir}`);

// Upload source maps
try {
  execSync(
    `sentry-cli sourcemaps upload --org "${sentryOrg}" --project "${sentryProject}" --release "${release}" "${sourceMapsDir}"`,
    { stdio: 'inherit' }
  );
  console.log('✅ Source maps uploaded successfully!');
  console.log(`   Release: ${release}`);
  console.log(`   View in Sentry: https://sentry.io/organizations/${sentryOrg}/releases/${release}/`);
} catch (error) {
  console.warn('⚠️  Source maps upload failed. Continuing build...');
  console.warn(`   Error: ${error.message}`);
  process.exit(0); // Don't fail the build if source maps upload fails
}


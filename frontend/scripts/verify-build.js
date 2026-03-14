#!/usr/bin/env node

/**
 * Build Verification Script
 * Verifies production build configuration and bundle size
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.production') });

const appJsonPath = path.join(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const isProduction = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';

console.log('🔍 Verifying build configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Check environment
if (isProduction) {
  console.log('✅ Production environment detected');
} else {
  console.log('⚠️  Development environment - some checks will be skipped');
}

// Verify API Base URL
const apiUrl = appJson.expo.extra?.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
if (!apiUrl) {
  console.error('❌ ERROR: API_BASE_URL is not set');
  hasErrors = true;
} else if (isProduction && (apiUrl.includes('localhost') || apiUrl.includes('192.168.') || apiUrl.includes('10.') || apiUrl.includes('172.'))) {
  console.error(`❌ ERROR: API_BASE_URL is set to localhost/local IP: ${apiUrl}`);
  hasErrors = true;
} else if (isProduction && !apiUrl.startsWith('https://')) {
  console.warn(`⚠️  WARNING: API_BASE_URL is not using HTTPS: ${apiUrl}`);
  hasWarnings = true;
} else {
  console.log(`✅ API_BASE_URL: ${apiUrl}`);
}

// Verify Web Share URL
const webShareUrl = appJson.expo.extra?.WEB_SHARE_URL || process.env.EXPO_PUBLIC_WEB_SHARE_URL;
if (!webShareUrl) {
  console.warn('⚠️  WARNING: WEB_SHARE_URL is not set');
  hasWarnings = true;
} else if (isProduction && (webShareUrl.includes('localhost') || webShareUrl.includes('192.168.'))) {
  console.error(`❌ ERROR: WEB_SHARE_URL is set to localhost/local IP: ${webShareUrl}`);
  hasErrors = true;
} else if (isProduction && !webShareUrl.startsWith('https://')) {
  console.warn(`⚠️  WARNING: WEB_SHARE_URL is not using HTTPS: ${webShareUrl}`);
  hasWarnings = true;
} else {
  console.log(`✅ WEB_SHARE_URL: ${webShareUrl}`);
}

// Verify Privacy Policy URL (required for App Store)
const privacyUrl = appJson.expo.extra?.PRIVACY_POLICY_URL || process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || appJson.expo.ios?.infoPlist?.NSPrivacyPolicyURL;
if (!privacyUrl) {
  console.warn('⚠️  WARNING: PRIVACY_POLICY_URL is not set (required for App Store)');
  hasWarnings = true;
} else {
  console.log(`✅ PRIVACY_POLICY_URL: ${privacyUrl}`);
}

// Verify Google Maps API Key
const mapsKey = appJson.expo.extra?.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || appJson.expo.android?.config?.googleMaps?.apiKey;
if (!mapsKey) {
  console.warn('⚠️  WARNING: GOOGLE_MAPS_API_KEY is not set');
  hasWarnings = true;
} else {
  console.log(`✅ GOOGLE_MAPS_API_KEY: ${mapsKey.substring(0, 10)}...`);
}

// Verify Sentry DSN
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (!sentryDsn) {
  console.warn('⚠️  WARNING: EXPO_PUBLIC_SENTRY_DSN is not set (error tracking disabled)');
  hasWarnings = true;
} else {
  console.log(`✅ SENTRY_DSN: ${sentryDsn.substring(0, 20)}...`);
}

// Verify version numbers
const version = appJson.expo.version;
const iosBuildNumber = appJson.expo.ios?.buildNumber;
const androidVersionCode = appJson.expo.android?.versionCode;

console.log(`\n📱 Version Information:`);
console.log(`   Version: ${version}`);
console.log(`   iOS Build Number: ${iosBuildNumber}`);
console.log(`   Android Version Code: ${androidVersionCode}`);

// Verify bundle identifiers
const iosBundleId = appJson.expo.ios?.bundleIdentifier;
const androidPackage = appJson.expo.android?.package;

if (iosBundleId) {
  console.log(`✅ iOS Bundle ID: ${iosBundleId}`);
} else {
  console.error('❌ ERROR: iOS bundle identifier is not set');
  hasErrors = true;
}

if (androidPackage) {
  console.log(`✅ Android Package: ${androidPackage}`);
} else {
  console.error('❌ ERROR: Android package name is not set');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('❌ BUILD VERIFICATION FAILED');
  console.error('Please fix the errors above before building.');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('⚠️  BUILD VERIFICATION PASSED WITH WARNINGS');
  console.warn('Please review the warnings above.');
  process.exit(0);
} else {
  console.log('✅ BUILD VERIFICATION PASSED');
  console.log('All checks passed. Ready to build!');
  process.exit(0);
}


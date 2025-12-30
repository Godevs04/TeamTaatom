#!/usr/bin/env node

/**
 * Setup Google Play Service Account Key
 * 
 * This script decodes the base64 encoded Google Play service account key
 * from the EAS secret and writes it to keys/google-play-key.json
 * 
 * This is called during EAS build via prebuildCommand
 * 
 * Note: EAS may pass platform arguments (--platform ios/android), which we handle gracefully.
 * This script only needs to run for Android builds, but it's safe to run for iOS too.
 */

const fs = require('fs');
const path = require('path');

// Check platform from environment variables only (EAS sets these)
// We ignore all command-line arguments since EAS may wrap the command with "npx expo"
// which can cause argument parsing issues
const platform = process.env.EAS_BUILD_PLATFORM || 
                 process.env.EXPO_PLATFORM ||
                 process.env.PLATFORM ||
                 null;

// Only proceed if this is an Android build, or if platform is not specified (backward compatibility)
// For iOS builds, we can skip this script entirely since Google Play key is not needed
if (platform === 'ios') {
  console.log('ℹ️ Skipping Google Play key setup for iOS build');
  process.exit(0);
}

// Since this script is only called for Android builds (via prebuildCommand in android section),
// we can safely proceed even if platform is not detected

// Get the base64 encoded Google Play service account key from EAS secret
const googlePlayServiceAccountKeyBase64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;

if (!googlePlayServiceAccountKeyBase64) {
  console.warn('⚠️ GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not found in environment variables');
  console.warn('⚠️ This is expected for non-production builds');
  process.exit(0); // Don't fail the build
}

try {
  // Decode base64 to get the JSON content
  const decodedKey = Buffer.from(googlePlayServiceAccountKeyBase64, 'base64').toString('utf-8');
  
  // Validate that it's valid JSON
  try {
    JSON.parse(decodedKey);
  } catch (jsonError) {
    throw new Error(`Decoded key is not valid JSON: ${jsonError.message}`);
  }
  
  // Path to write the decoded key file
  const keyFile = path.join(__dirname, '..', 'keys', 'google-play-key.json');
  
  // Ensure keys directory exists
  const keysDir = path.dirname(keyFile);
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  
  // Write the decoded JSON to the key file
  fs.writeFileSync(keyFile, decodedKey, 'utf-8');
  
  // Set restrictive permissions (read/write for owner only)
  if (process.platform !== 'win32') {
    fs.chmodSync(keyFile, 0o600);
  }
  
  console.log('✅ Google Play service account key written successfully to', keyFile);
} catch (error) {
  console.error('❌ Error writing Google Play service account key:', error.message);
  
  // Only fail the build in production
  if (process.env.EXPO_PUBLIC_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production') {
    process.exit(1);
  }
  
  // For non-production builds, just warn
  console.warn('⚠️ Continuing build without Google Play key (non-production build)');
}


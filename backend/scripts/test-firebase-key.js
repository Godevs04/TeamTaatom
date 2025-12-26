#!/usr/bin/env node

/**
 * Test script to validate Firebase private key base64 encoding
 * 
 * Usage:
 *   node scripts/test-firebase-key.js
 * 
 * This will read FIREBASE_PRIVATE_KEY_BASE64 from .env and validate it
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;

if (!privateKeyBase64) {
  console.error('❌ FIREBASE_PRIVATE_KEY_BASE64 not found in .env file');
  process.exit(1);
}

try {
  // Remove quotes if present
  let cleanedBase64 = privateKeyBase64.trim();
  if ((cleanedBase64.startsWith('"') && cleanedBase64.endsWith('"')) || 
      (cleanedBase64.startsWith("'") && cleanedBase64.endsWith("'"))) {
    cleanedBase64 = cleanedBase64.slice(1, -1);
    console.log('⚠️  Warning: Found quotes around base64 string, removing them...');
  }
  
  // Remove whitespace
  cleanedBase64 = cleanedBase64.replace(/\s/g, '').replace(/\n/g, '').replace(/\r/g, '');
  
  // Decode
  const decoded = Buffer.from(cleanedBase64, 'base64').toString('utf8');
  
  // Validate format
  const hasBegin = decoded.includes('BEGIN PRIVATE KEY') || decoded.includes('BEGIN RSA PRIVATE KEY');
  const hasEnd = decoded.includes('END PRIVATE KEY') || decoded.includes('END RSA PRIVATE KEY');
  
  if (!hasBegin || !hasEnd) {
    console.error('❌ Invalid PEM format detected');
    console.error('The decoded key does not contain BEGIN/END markers');
    console.error('\nFirst 100 characters of decoded key:');
    console.error(decoded.substring(0, 100));
    process.exit(1);
  }
  
  // Check for newlines
  const hasNewlines = decoded.includes('\n');
  if (!hasNewlines) {
    console.log('⚠️  Warning: Decoded key has no newlines (this is okay, will be fixed at runtime)');
  }
  
  console.log('✅ Base64 key is valid!');
  console.log('✅ PEM format detected');
  console.log(`✅ Key length: ${decoded.length} characters`);
  console.log(`✅ Has newlines: ${hasNewlines ? 'Yes' : 'No (will be added automatically)'}`);
  console.log('\n📋 Key preview:');
  console.log(decoded.substring(0, 50) + '...' + decoded.substring(decoded.length - 50));
  
} catch (error) {
  console.error('❌ Error validating base64 key:', error.message);
  console.error('\n💡 Tips:');
  console.error('1. Make sure FIREBASE_PRIVATE_KEY_BASE64 is a valid base64 string');
  console.error('2. Remove any quotes around the value in .env');
  console.error('3. Use the helper script to re-encode: node scripts/encode-firebase-key.js');
  process.exit(1);
}


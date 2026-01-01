#!/usr/bin/env node

/**
 * Helper script to encode Firebase private key to base64
 * 
 * Usage:
 *   1. Copy your Firebase private key (including BEGIN/END lines)
 *   2. Run: node scripts/encode-firebase-key.js
 *   3. Paste your private key when prompted
 *   4. Copy the base64 output to your .env file as FIREBASE_PRIVATE_KEY_BASE64
 * 
 * OR use command line:
 *   echo -n "YOUR_PRIVATE_KEY_HERE" | node scripts/encode-firebase-key.js
 */

const readline = require('readline');

function encodeToBase64(privateKey) {
  // Clean the input: trim whitespace and ensure proper newlines
  let cleaned = privateKey.trim();
  
  // Replace escaped newlines with actual newlines if present
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // Ensure the key has proper PEM format with newlines
  // Firebase private keys should have newlines for proper parsing
  if (!cleaned.includes('\n') && cleaned.includes('BEGIN')) {
    // Try to add newlines if missing
    cleaned = cleaned
      .replace(/-----BEGIN PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '-----BEGIN RSA PRIVATE KEY-----\n')
      .replace(/-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----')
      .replace(/-----END RSA PRIVATE KEY-----/g, '\n-----END RSA PRIVATE KEY-----');
  }
  
  // Validate it's a proper PEM key
  if (!cleaned.includes('BEGIN') || !cleaned.includes('END')) {
    console.error('❌ Error: Input does not appear to be a valid PEM private key');
    console.error('Expected format: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----');
    process.exit(1);
  }
  
  // Encode to base64 (this preserves newlines as \n characters)
  const base64 = Buffer.from(cleaned, 'utf8').toString('base64');
  
  return base64;
}

// Check if input is provided via command line (pipe or argument)
if (process.stdin.isTTY) {
  // Interactive mode - prompt user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('📝 Firebase Private Key Base64 Encoder');
  console.log('=====================================\n');
  console.log('Instructions:');
  console.log('1. Copy your Firebase private key from your service account JSON file');
  console.log('2. Paste it below (including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----)');
  console.log('3. Press Enter, then Ctrl+D (or Ctrl+Z on Windows) to finish\n');
  console.log('Paste your private key:');

  let input = '';
  
  rl.on('line', (line) => {
    input += line + '\n';
  });

  rl.on('close', () => {
    if (!input.trim()) {
      console.error('❌ Error: No input provided');
      process.exit(1);
    }

    const base64 = encodeToBase64(input);
    
    console.log('\n✅ Base64 encoded key:');
    console.log('=====================================');
    console.log(base64);
    console.log('=====================================\n');
    console.log('📋 Add this to your .env file:');
    console.log(`FIREBASE_PRIVATE_KEY_BASE64=${base64}\n`);
  });
} else {
  // Pipe mode - read from stdin
  let input = '';
  
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  
  process.stdin.on('end', () => {
    if (!input.trim()) {
      console.error('❌ Error: No input provided');
      process.exit(1);
    }

    const base64 = encodeToBase64(input);
    console.log(base64);
  });
}


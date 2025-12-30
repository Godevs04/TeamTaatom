const fs = require('fs');
const path = require('path');

// Get the base64 encoded Google Play service account key from EAS secret
// This will be available as an environment variable during EAS build
const googlePlayServiceAccountKeyBase64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;

// Path to write the decoded key file
const keyFile = path.join(__dirname, 'keys', 'google-play-key.json');

// Decode and write the service account key at build time
if (googlePlayServiceAccountKeyBase64) {
  try {
    // Decode base64 to get the JSON content
    const decodedKey = Buffer.from(googlePlayServiceAccountKeyBase64, 'base64').toString('utf-8');
    
    // Validate that it's valid JSON
    JSON.parse(decodedKey);
    
    // Ensure keys directory exists
    const keysDir = path.dirname(keyFile);
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }
    
    // Write the decoded JSON to the key file
    fs.writeFileSync(keyFile, decodedKey, 'utf-8');
    
    console.log('✅ Google Play service account key written successfully to', keyFile);
  } catch (error) {
    console.error('❌ Error writing Google Play service account key:', error.message);
    // Don't fail the build if key is missing (might be development build)
    if (process.env.EXPO_PUBLIC_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production') {
      throw new Error(`Failed to decode Google Play service account key: ${error.message}`);
    }
  }
} else {
  // Only warn in production builds
  if (process.env.EXPO_PUBLIC_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production') {
    console.warn('⚠️ GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not found in environment variables');
  }
}

// Read the base app.json configuration
const appJson = require('./app.json');

// Export the Expo config
module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    // Any additional runtime config can go here
  },
};


const fs = require('fs');
const path = require('path');

// Get the base64 encoded Google Play service account key from EAS secret
// This will be available as an environment variable during EAS build
const googlePlayServiceAccountKeyBase64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;

// Path to write the decoded key file
const keyFile = path.join(__dirname, 'keys', 'google-play-key.json');

// Decode and write the service account key at build time (Android only)
// Skip for iOS builds to avoid unnecessary file operations
const platform = process.env.EAS_BUILD_PLATFORM || process.env.EXPO_PLATFORM || process.env.PLATFORM;

if (platform !== 'ios' && googlePlayServiceAccountKeyBase64) {
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
} else if (platform === 'ios') {
  // Silently skip for iOS - Google Play key is not needed
} else if (!googlePlayServiceAccountKeyBase64) {
  // Only warn in production Android builds
  if ((process.env.EXPO_PUBLIC_ENV === 'production' || process.env.EAS_BUILD_PROFILE === 'production') && platform === 'android') {
    console.warn('⚠️ GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not found in environment variables');
  }
}

// Read the base app.json configuration
// Using explicit require that expo-doctor can detect
const { expo: appJsonExpo } = require('./app.json');

// Export the Expo config - properly merge app.json values
// This pattern is explicitly recognized by expo-doctor
module.exports = () => ({
  expo: {
    ...appJsonExpo,
    // Any additional runtime config can go here
  },
});


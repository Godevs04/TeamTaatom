const fs = require('fs');
const path = require('path');
const DEFAULT_EAS_PROJECT_ID = 'c3b80b3d-23d8-4948-abfa-80963e4192d0';
const APP_JSON_PATH = path.join(__dirname, 'app.json');
// Must match PBXNativeTarget name in project.pbxproj; EAS assigns provisioning profiles by this name.
const IOS_NATIVE_TARGET_NAME = 'taatom';
const APP_DISPLAY_NAME = 'Taatom';

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

const loadAppJsonExpoConfig = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf-8'));
    return parsed?.expo || null;
  } catch (error) {
    console.warn('⚠️ Unable to read app.json, falling back to dynamic config:', error.message);
    return null;
  }
};

/**
 * Return Expo config using app.json as source of truth, then enforce EAS linkage.
 * @see https://docs.expo.dev/workflow/configuration/
 */
module.exports = ({ config }) => {
  const appJsonConfig = loadAppJsonExpoConfig();
  const baseConfig = appJsonConfig || config || {};

  const resolvedProjectId =
    process.env.EXPO_PROJECT_ID ||
    process.env.EAS_PROJECT_ID ||
    baseConfig?.extra?.eas?.projectId ||
    baseConfig?.extra?.EXPO_PROJECT_ID ||
    DEFAULT_EAS_PROJECT_ID;

  const resolvedBundleIdentifier =
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER ||
    baseConfig?.ios?.bundleIdentifier ||
    'com.taatom.app';

  const resolvedAndroidPackage =
    process.env.EXPO_ANDROID_PACKAGE ||
    baseConfig?.android?.package ||
    'com.taatom.app';

  const finalConfig = {
    ...baseConfig,
    name: IOS_NATIVE_TARGET_NAME,
    ios: {
      ...(baseConfig.ios || {}),
      bundleIdentifier: resolvedBundleIdentifier,
      infoPlist: {
        ...(baseConfig.ios?.infoPlist || {}),
        CFBundleDisplayName:
          baseConfig.ios?.infoPlist?.CFBundleDisplayName ?? APP_DISPLAY_NAME,
      },
    },
    android: {
      ...(baseConfig.android || {}),
      package: resolvedAndroidPackage,
      label: baseConfig.android?.label ?? APP_DISPLAY_NAME,
    },
    extra: {
      ...(baseConfig.extra || {}),
      appDisplayName: APP_DISPLAY_NAME,
      eas: {
        ...(baseConfig.extra?.eas || {}),
        projectId: resolvedProjectId,
      },
    },
  };

  // Optional debug: EXPO_DEBUG_CONFIG=1 npx expo config --type public --json
  if (process.env.EXPO_DEBUG_CONFIG === '1') {
    console.log('Resolved Expo config (debug):');
    console.log(JSON.stringify(finalConfig, null, 2));
  }

  return finalConfig;
};

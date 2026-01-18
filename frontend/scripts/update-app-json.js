#!/usr/bin/env node

/**
 * Script to update app.json extra config from environment variables
 * Run this before building: node scripts/update-app-json.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file (with .env.prod fallback for production)
const envPath = path.join(__dirname, '../.env');
const envProdPath = path.join(__dirname, '../.env.prod');

// Load .env first, then .env.prod (prod will override if both exist)
require('dotenv').config({ path: envPath });
require('dotenv').config({ path: envProdPath, override: true });

const appJsonPath = path.join(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Determine environment (production, staging, or development)
const isProduction = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';
const isStaging = process.env.EXPO_PUBLIC_ENV === 'staging';

// For production, require environment variables (no fallbacks to localhost/local IP)
// For development/staging, allow fallbacks
// Support both EXPO_PUBLIC_API_BASE_URL and API_BASE_URL for compatibility
const getApiBaseUrl = () => {
  const envUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL)?.trim();
  if (envUrl && envUrl !== '') {
    // Reject localhost and local IPs in production
    if (isProduction && (envUrl.includes('localhost') || envUrl.includes('192.168.') || envUrl.includes('10.') || envUrl.includes('172.'))) {
      console.error('❌ ERROR: Production builds cannot use localhost or local IP addresses!');
      console.error(`   Found: ${envUrl}`);
      console.error('   Please set EXPO_PUBLIC_API_BASE_URL to your production API URL in .env file');
      process.exit(1);
    }
    return envUrl;
  }
  
  // Fallback only for development/staging
  if (!isProduction) {
    return appJson.expo.extra?.API_BASE_URL || 'http://localhost:3000';
  }
  
  // Production requires explicit URL
  console.error('❌ ERROR: EXPO_PUBLIC_API_BASE_URL is required for production builds!');
  console.error('   Please set EXPO_PUBLIC_API_BASE_URL in your .env or .env.prod file');
  process.exit(1);
};

const getWebShareUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_WEB_SHARE_URL?.trim();
  if (envUrl && envUrl !== '') {
    if (isProduction && (envUrl.includes('localhost') || envUrl.includes('192.168.') || envUrl.includes('10.') || envUrl.includes('172.'))) {
      console.error('❌ ERROR: Production builds cannot use localhost or local IP addresses!');
      process.exit(1);
    }
    return envUrl;
  }
  
  if (!isProduction) {
    return appJson.expo.extra?.WEB_SHARE_URL || appJson.expo.extra?.API_BASE_URL || 'http://localhost:3000';
  }
  
  // Production: derive from API_BASE_URL if not explicitly set
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace('http://', 'https://').replace(':3000', '');
};

// Get privacy policy URL - use env var or construct from web share URL
const getPrivacyPolicyUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
  if (envUrl && envUrl !== '') {
    return envUrl;
  }
  // Fallback: construct from web share URL
  const webShareUrl = getWebShareUrl();
  if (webShareUrl && !webShareUrl.includes('localhost') && !webShareUrl.includes('192.168.')) {
    return `${webShareUrl}/policies/privacy`;
  }
  return appJson.expo.extra?.PRIVACY_POLICY_URL || '';
};

// Get terms of service URL
const getTermsOfServiceUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL?.trim();
  if (envUrl && envUrl !== '') {
    return envUrl;
  }
  const webShareUrl = getWebShareUrl();
  if (webShareUrl && !webShareUrl.includes('localhost') && !webShareUrl.includes('192.168.')) {
    return `${webShareUrl}/policies/terms`;
  }
  return appJson.expo.extra?.TERMS_OF_SERVICE_URL || '';
};

// Get support URL
const getSupportUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_SUPPORT_URL?.trim();
  if (envUrl && envUrl !== '') {
    return envUrl;
  }
  const webShareUrl = getWebShareUrl();
  if (webShareUrl && !webShareUrl.includes('localhost') && !webShareUrl.includes('192.168.')) {
    return `${webShareUrl}/support/contact`;
  }
  return appJson.expo.extra?.SUPPORT_URL || '';
};

// Update extra config from environment variables (ALWAYS from .env/.env.prod, no hardcoded fallbacks)
// All values are now dynamically loaded from .env file
// Support both EXPO_PUBLIC_ prefix and non-prefixed versions for compatibility
appJson.expo.extra = {
  API_BASE_URL: getApiBaseUrl(),
  WEB_SHARE_URL: getWebShareUrl(),
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
  LOGO_IMAGE: process.env.EXPO_PUBLIC_LOGO_IMAGE || process.env.LOGO_IMAGE || '',
  EXPO_PROJECT_ID: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID || '',
  // Google Client ID - check both EXPO_PUBLIC_ prefix and alternative names (GOOGLE_WEB_CLIENT_ID)
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || '',
  GOOGLE_CLIENT_ID_IOS: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || '',
  GOOGLE_CLIENT_ID_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || '',
  // SECURITY: GOOGLE_CLIENT_SECRET is intentionally NOT included here
  // Client secrets should NEVER be exposed in the frontend bundle
  // The secret should only be used on the backend server
  // Google Redirect URI - check both EXPO_PUBLIC_ prefix and alternative names
  GOOGLE_REDIRECT_URI: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || process.env.EXPO_REDIRECT_URI || '',
  // Privacy and legal URLs
  PRIVACY_POLICY_URL: getPrivacyPolicyUrl(),
  TERMS_OF_SERVICE_URL: getTermsOfServiceUrl(),
  SUPPORT_URL: getSupportUrl(),
};

// Update iOS Google Maps API key from environment variable (ALWAYS from .env, no hardcoded fallback)
const iosMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || '';
if (!appJson.expo.ios) {
  appJson.expo.ios = {};
}
if (iosMapsApiKey) {
  appJson.expo.ios.googleMapsApiKey = iosMapsApiKey;
} else {
  // Remove hardcoded value - require from .env
  delete appJson.expo.ios.googleMapsApiKey;
  if (isProduction) {
    console.warn('⚠️  WARNING: EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY not set. Google Maps may not work on iOS in production.');
  }
}

// Update Android Google Maps API key from environment variable (ALWAYS from .env, no hardcoded fallback)
const androidMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || '';
if (!appJson.expo.android) {
  appJson.expo.android = {};
}
if (!appJson.expo.android.config) {
  appJson.expo.android.config = {};
}
if (!appJson.expo.android.config.googleMaps) {
  appJson.expo.android.config.googleMaps = {};
}
if (androidMapsApiKey) {
  appJson.expo.android.config.googleMaps.apiKey = androidMapsApiKey;
} else {
  // Remove hardcoded value - require from .env
  delete appJson.expo.android.config.googleMaps.apiKey;
  if (isProduction) {
    console.warn('⚠️  WARNING: EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY not set. Google Maps may not work on Android in production.');
  }
}

// Update iOS privacy policy URL from environment variable or extra config
if (appJson.expo.ios?.infoPlist) {
  const privacyPolicyUrl = getPrivacyPolicyUrl();
  if (privacyPolicyUrl) {
    appJson.expo.ios.infoPlist.NSPrivacyPolicyURL = privacyPolicyUrl;
  } else if (isProduction) {
    console.warn('⚠️  WARNING: Privacy policy URL not set. App Store submission may be rejected.');
  }
}

// Handle google-services.json from EAS environment variable
const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
if (googleServicesJson) {
  try {
    // Validate JSON
    const parsed = JSON.parse(googleServicesJson);
    const googleServicesPath = path.join(__dirname, '../google-services.json');
    fs.writeFileSync(googleServicesPath, JSON.stringify(parsed, null, 2));
    console.log('✅ Created google-services.json from EAS environment variable');
    
    // Set googleServicesFile in app.json if not already set
    if (appJson.expo.android && !appJson.expo.android.googleServicesFile) {
      appJson.expo.android.googleServicesFile = './google-services.json';
    }
  } catch (error) {
    console.warn('⚠️  Warning: Failed to create google-services.json from GOOGLE_SERVICES_JSON:', error.message);
    console.warn('   Make sure GOOGLE_SERVICES_JSON is valid JSON');
  }
} else {
  // If no env var, check if file exists locally
  const googleServicesPath = path.join(__dirname, '../google-services.json');
  if (fs.existsSync(googleServicesPath)) {
    // File exists locally, ensure it's referenced
    if (appJson.expo.android && !appJson.expo.android.googleServicesFile) {
      appJson.expo.android.googleServicesFile = './google-services.json';
    }
  } else {
    // No file and no env var - remove reference to avoid build errors
    if (appJson.expo.android && appJson.expo.android.googleServicesFile) {
      delete appJson.expo.android.googleServicesFile;
      console.warn('⚠️  Warning: google-services.json not found and GOOGLE_SERVICES_JSON not set.');
      console.warn('   Firebase features may not work. Set GOOGLE_SERVICES_JSON in EAS secrets for builds.');
    }
  }
}

// Write updated app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf8');
console.log('✅ app.json updated with environment variables');


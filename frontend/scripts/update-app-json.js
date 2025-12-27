#!/usr/bin/env node

/**
 * Script to update app.json extra config from environment variables
 * Run this before building: node scripts/update-app-json.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const appJsonPath = path.join(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Determine environment (production, staging, or development)
const isProduction = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';
const isStaging = process.env.EXPO_PUBLIC_ENV === 'staging';

// For production, require environment variables (no fallbacks to localhost/local IP)
// For development/staging, allow fallbacks
const getApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
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
  console.error('   Please set EXPO_PUBLIC_API_BASE_URL in your .env file');
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

// Update extra config from environment variables
appJson.expo.extra = {
  API_BASE_URL: getApiBaseUrl(),
  WEB_SHARE_URL: getWebShareUrl(),
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || appJson.expo.extra?.GOOGLE_MAPS_API_KEY || '',
  LOGO_IMAGE: process.env.EXPO_PUBLIC_LOGO_IMAGE || appJson.expo.extra?.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png',
  EXPO_PROJECT_ID: appJson.expo.extra?.EXPO_PROJECT_ID || '10a6919b-ba8b-4dfb-b379-d36909e67701',
  // Google Client ID - check both EXPO_PUBLIC_ prefix and alternative names
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || appJson.expo.extra?.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_ID_IOS: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || appJson.expo.extra?.GOOGLE_CLIENT_ID_IOS || appJson.expo.extra?.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_ID_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || appJson.expo.extra?.GOOGLE_CLIENT_ID_ANDROID || appJson.expo.extra?.GOOGLE_CLIENT_ID || '',
  // SECURITY: GOOGLE_CLIENT_SECRET is intentionally NOT included here
  // Client secrets should NEVER be exposed in the frontend bundle
  // The secret should only be used on the backend server
  // Google Redirect URI - check both EXPO_PUBLIC_ prefix and alternative names
  GOOGLE_REDIRECT_URI: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || process.env.EXPO_REDIRECT_URI || appJson.expo.extra?.GOOGLE_REDIRECT_URI || '',
  // Privacy and legal URLs
  PRIVACY_POLICY_URL: getPrivacyPolicyUrl(),
  TERMS_OF_SERVICE_URL: getTermsOfServiceUrl(),
  SUPPORT_URL: getSupportUrl(),
};

// Update Android Google Maps API key from environment variable
if (appJson.expo.android?.config?.googleMaps) {
  const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || appJson.expo.extra?.GOOGLE_MAPS_API_KEY || '';
  if (mapsApiKey) {
    appJson.expo.android.config.googleMaps.apiKey = mapsApiKey;
  } else if (isProduction) {
    console.warn('⚠️  WARNING: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY not set. Google Maps may not work in production.');
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

// Write updated app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf8');
console.log('✅ app.json updated with environment variables');


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

// Update extra config from environment variables
appJson.expo.extra = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || appJson.expo.extra?.API_BASE_URL || 'http://localhost:3000',
  WEB_SHARE_URL: process.env.EXPO_PUBLIC_WEB_SHARE_URL || appJson.expo.extra?.WEB_SHARE_URL || appJson.expo.extra?.API_BASE_URL || 'http://localhost:3000',
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || appJson.expo.extra?.GOOGLE_MAPS_API_KEY || '',
  LOGO_IMAGE: process.env.EXPO_PUBLIC_LOGO_IMAGE || appJson.expo.extra?.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png',
  EXPO_PROJECT_ID: appJson.expo.extra?.EXPO_PROJECT_ID || '10a6919b-ba8b-4dfb-b379-d36909e67701',
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || appJson.expo.extra?.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_ID_IOS: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || appJson.expo.extra?.GOOGLE_CLIENT_ID_IOS || appJson.expo.extra?.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_ID_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || appJson.expo.extra?.GOOGLE_CLIENT_ID_ANDROID || appJson.expo.extra?.GOOGLE_CLIENT_ID || '',
  // SECURITY: GOOGLE_CLIENT_SECRET is intentionally NOT included here
  // Client secrets should NEVER be exposed in the frontend bundle
  // The secret should only be used on the backend server
  GOOGLE_REDIRECT_URI: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI || appJson.expo.extra?.GOOGLE_REDIRECT_URI || '',
};

// Write updated app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2), 'utf8');
console.log('✅ app.json updated with environment variables');


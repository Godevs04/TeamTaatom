#!/usr/bin/env node

/**
 * Setup google-services.json from EAS environment variable
 * This script is run during EAS build to create the google-services.json file
 * from the GOOGLE_SERVICES_JSON environment variable
 */

const fs = require('fs');
const path = require('path');

const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;

if (!googleServicesJson) {
  console.warn('⚠️  GOOGLE_SERVICES_JSON environment variable not set. Skipping google-services.json creation.');
  console.warn('   If you need Firebase, set GOOGLE_SERVICES_JSON in EAS secrets.');
  process.exit(0);
}

try {
  // Parse to validate JSON
  const parsed = JSON.parse(googleServicesJson);
  
  // Write to frontend directory
  const outputPath = path.join(__dirname, '..', 'google-services.json');
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
  
  console.log('✅ Created google-services.json from EAS environment variable');
} catch (error) {
  console.error('❌ Error creating google-services.json:', error.message);
  console.error('   Make sure GOOGLE_SERVICES_JSON is valid JSON');
  process.exit(1);
}


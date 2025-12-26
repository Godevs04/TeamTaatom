#!/usr/bin/env node

/**
 * Copy policy files from frontend/policies to backend/policies
 * This ensures policy files are available in production deployments
 * 
 * Run this script before building/deploying:
 *   node scripts/copy-policies.js
 */

const fs = require('fs');
const path = require('path');

const frontendPoliciesDir = path.join(__dirname, '../../frontend/policies');
const backendPoliciesDir = path.join(__dirname, '../policies');

// Create backend/policies directory if it doesn't exist
if (!fs.existsSync(backendPoliciesDir)) {
  fs.mkdirSync(backendPoliciesDir, { recursive: true });
  console.log('✅ Created backend/policies directory');
}

// Copy policy files
const policyFiles = ['privacyPolicy.md', 'terms.md', 'copyrightConsent.md'];

let copiedCount = 0;
policyFiles.forEach(filename => {
  const sourcePath = path.join(frontendPoliciesDir, filename);
  const destPath = path.join(backendPoliciesDir, filename);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Copied ${filename}`);
    copiedCount++;
  } else {
    console.warn(`⚠️  Source file not found: ${sourcePath}`);
  }
});

if (copiedCount === policyFiles.length) {
  console.log(`\n✅ Successfully copied ${copiedCount} policy files to backend/policies/`);
} else {
  console.warn(`\n⚠️  Only copied ${copiedCount} of ${policyFiles.length} policy files`);
  process.exit(1);
}


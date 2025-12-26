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

// Resolve paths relative to project root (where package.json is)
// __dirname is backend/scripts, so we need to go up to project root
// Use path.resolve to ensure absolute paths
const projectRoot = path.resolve(__dirname, '../..');
const frontendPoliciesDir = path.resolve(projectRoot, 'frontend', 'policies');
const backendPoliciesDir = path.resolve(__dirname, '..', 'policies');

// Debug: Log paths (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('📁 Project root:', projectRoot);
  console.log('📁 Frontend policies dir:', frontendPoliciesDir);
  console.log('📁 Backend policies dir:', backendPoliciesDir);
  console.log('📁 Frontend policies exists:', fs.existsSync(frontendPoliciesDir));
}

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
    // Try alternative paths as fallback
    const altPaths = [
      path.resolve(projectRoot, 'frontend', 'policies', filename),
      path.resolve(process.cwd(), 'frontend', 'policies', filename),
      path.resolve(process.cwd(), '..', 'frontend', 'policies', filename),
    ];
    let found = false;
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`   Found at alternative path: ${altPath}`);
        fs.copyFileSync(altPath, destPath);
        console.log(`✅ Copied ${filename} from alternative path`);
        copiedCount++;
        found = true;
        break;
      }
    }
    if (!found && process.env.NODE_ENV !== 'production') {
      console.log(`   Tried alternative paths:`, altPaths);
    }
  }
});

if (copiedCount === policyFiles.length) {
  console.log(`\n✅ Successfully copied ${copiedCount} policy files to backend/policies/`);
} else {
  console.warn(`\n⚠️  Only copied ${copiedCount} of ${policyFiles.length} policy files`);
  // Don't exit with error - policy routes have fallback logic to find files from multiple locations
  // This prevents production crashes when files aren't found
  console.log('ℹ️  Policy routes will attempt to find files from alternative locations');
  process.exit(0);
}


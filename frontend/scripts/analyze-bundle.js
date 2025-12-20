#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * Analyzes bundle size and warns if it exceeds limits
 */

const fs = require('fs');
const path = require('path');

// Bundle size limits (in bytes)
const BUNDLE_SIZE_LIMITS = {
  main: 2 * 1024 * 1024, // 2MB for main bundle
  vendor: 1 * 1024 * 1024, // 1MB for vendor bundle
  total: 5 * 1024 * 1024, // 5MB total
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function analyzeBundle(bundlePath) {
  if (!fs.existsSync(bundlePath)) {
    console.error(`${colors.red}Error: Bundle file not found at ${bundlePath}${colors.reset}`);
    process.exit(1);
  }

  const stats = fs.statSync(bundlePath);
  const size = stats.size;
  
  return {
    path: bundlePath,
    size,
    formatted: formatBytes(size),
  };
}

function checkBundleSize(bundleInfo, limit, name) {
  if (bundleInfo.size > limit) {
    console.warn(
      `${colors.yellow}⚠️  Warning: ${name} bundle size (${bundleInfo.formatted}) exceeds limit (${formatBytes(limit)})${colors.reset}`
    );
    return false;
  }
  return true;
}

function main() {
  console.log(`${colors.blue}📦 Analyzing bundle sizes...${colors.reset}\n`);

  // Common bundle paths (adjust based on your build output)
  const bundlePaths = [
    path.join(__dirname, '../.expo/web-build/static/js/main.js'),
    path.join(__dirname, '../web-build/static/js/main.js'),
    path.join(__dirname, '../dist/main.jsbundle'),
  ];

  let foundBundles = [];
  
  for (const bundlePath of bundlePaths) {
    if (fs.existsSync(bundlePath)) {
      foundBundles.push(analyzeBundle(bundlePath));
    }
  }

  if (foundBundles.length === 0) {
    console.log(`${colors.yellow}No bundle files found. Run a production build first.${colors.reset}`);
    console.log(`Expected locations:`);
    bundlePaths.forEach(p => console.log(`  - ${p}`));
    process.exit(0);
  }

  console.log(`${colors.blue}Found ${foundBundles.length} bundle file(s):${colors.reset}\n`);

  let allWithinLimits = true;
  let totalSize = 0;

  foundBundles.forEach((bundle, index) => {
    console.log(`${colors.blue}Bundle ${index + 1}:${colors.reset}`);
    console.log(`  Path: ${bundle.path}`);
    console.log(`  Size: ${bundle.formatted}\n`);
    
    totalSize += bundle.size;
    
    // Check against limits
    const withinLimit = checkBundleSize(bundle, BUNDLE_SIZE_LIMITS.main, 'Main');
    if (!withinLimit) {
      allWithinLimits = false;
    }
  });

  console.log(`${colors.blue}Total size: ${formatBytes(totalSize)}${colors.reset}\n`);

  if (totalSize > BUNDLE_SIZE_LIMITS.total) {
    console.warn(
      `${colors.yellow}⚠️  Warning: Total bundle size (${formatBytes(totalSize)}) exceeds limit (${formatBytes(BUNDLE_SIZE_LIMITS.total)})${colors.reset}`
    );
    allWithinLimits = false;
  }

  if (allWithinLimits) {
    console.log(`${colors.green}✅ All bundle sizes are within limits${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  Some bundles exceed size limits. Consider code splitting or removing unused dependencies.${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { analyzeBundle, checkBundleSize, formatBytes };


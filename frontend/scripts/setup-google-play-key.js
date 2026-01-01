const fs = require("fs");
const path = require("path");

const keyFile = path.join(__dirname, "..", "google-play-key.json");

// Check if this is an iOS build (iOS doesn't need Google Play key)
// EAS sets EAS_BUILD_PLATFORM or we can check other env vars
const platform = process.env.EAS_BUILD_PLATFORM || process.env.EXPO_PLATFORM || process.env.PLATFORM;

if (platform === "ios") {
  console.log("ℹ️ Skipping Google Play key setup for iOS build");
  process.exit(0);
}

// For Android builds, the key is required
// If platform is not detected and key is missing, assume it's a local test and exit gracefully
if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY) {
  if (!platform || platform === "android") {
    console.log("❌ GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not found");
    process.exit(1);
  } else {
    // For iOS or unknown platform, exit gracefully (key not needed)
    console.log("ℹ️ GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not found, but not required for this build");
    process.exit(0);
  }
}

// Decode base64 to get the JSON content
const decodedKey = Buffer.from(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8");

// Validate it's valid JSON
try {
  JSON.parse(decodedKey);
} catch (error) {
  console.error("❌ Decoded key is not valid JSON:", error.message);
  process.exit(1);
}

// Write the decoded JSON to the file
fs.writeFileSync(keyFile, decodedKey, "utf-8");

// Set restrictive permissions (read/write for owner only)
if (process.platform !== "win32") {
  fs.chmodSync(keyFile, 0o600);
}

console.log("✅ Google Play key written successfully");

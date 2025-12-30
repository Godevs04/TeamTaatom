const fs = require("fs");
const path = require("path");

const keyFile = path.join(__dirname, "..", "google-play-key.json");

if (!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY) {
  console.log("❌ GOOGLE_PLAY_SERVICE_ACCOUNT_KEY not found");
  process.exit(1);
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

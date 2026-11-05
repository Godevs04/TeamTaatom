/**
 * Gradle fix for @wokcito/ffmpeg-kit-react-native (Android).
 *
 * The package hard-codes `compileSdkVersion 33` / `targetSdkVersion 33`, ignoring the
 * app's SDK settings. React Native 0.88 (react-android) and androidx.appcompat 1.7
 * require every module to compile against API 34+, so AGP's checkReleaseAarMetadata
 * fails the release build. Read the root project's values instead (Expo sets
 * compileSdkVersion / targetSdkVersion on rootProject.ext), with safe fallbacks.
 *
 * Idempotent: safe to run on every install (postinstall, EAS).
 */
const fs = require('fs');
const path = require('path');

const GRADLE_FILE = path.join(
  __dirname,
  '..',
  'node_modules',
  '@wokcito',
  'ffmpeg-kit-react-native',
  'android',
  'build.gradle'
);

// Inline rootProject.ext lookups: the package's own safeExtGet() helper is not
// resolvable inside the `android { }` block under Gradle 9 / AGP 9.
const rootExt = (prop, fallback) =>
  `(rootProject.ext.has('${prop}') ? rootProject.ext.get('${prop}') : ${fallback})`;

const REPLACEMENTS = [
  // Original hard-coded values, and the earlier safeExtGet()-based patch.
  [/compileSdkVersion\s+(?:33\b|safeExtGet\('compileSdkVersion',\s*\d+\))/, `compileSdkVersion ${rootExt('compileSdkVersion', 36)}`],
  [/targetSdkVersion\s+(?:33\b|safeExtGet\('targetSdkVersion',\s*\d+\))/, `targetSdkVersion ${rootExt('targetSdkVersion', 36)}`],
];

function patchFfmpegKitAndroid() {
  if (!fs.existsSync(GRADLE_FILE)) {
    console.log('[patch-ffmpeg-kit-android] Package not installed, skipping');
    return false;
  }
  let source = fs.readFileSync(GRADLE_FILE, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of REPLACEMENTS) {
    if (pattern.test(source)) {
      source = source.replace(pattern, replacement);
      changed = true;
    }
  }
  if (!changed) {
    console.log('[patch-ffmpeg-kit-android] Already patched build.gradle');
    return false;
  }
  fs.writeFileSync(GRADLE_FILE, source);
  console.log('[patch-ffmpeg-kit-android] Patched compileSdk/targetSdk to follow the app');
  return true;
}

patchFfmpegKitAndroid();

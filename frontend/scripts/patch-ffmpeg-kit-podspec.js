/**
 * CocoaPods fixes for @wokcito/ffmpeg-kit-react-native:
 * - Valid pod name (CocoaPods rejects scoped npm names)
 * - Default "https" subspec (Podfile vendors ffmpeg-kit-ios-https from a mirror;
 *   "full" would pull retired arthenica ffmpeg-kit-ios-full and 404)
 * - Ensure s.source is present (CocoaPods validation requires the source attribute even for local :path pods)
 * - Explicit ios/ source_files paths
 */
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = path.join(__dirname, '..', 'node_modules', '@wokcito', 'ffmpeg-kit-react-native');
const PODSPEC = path.join(PACKAGE_DIR, 'ffmpeg-kit-react-native.podspec');

const VALID_NAME = 'ffmpeg-kit-react-native';
// Use https subspec — Podfile vendors ffmpeg-kit-ios-https from a mirror.
// "full" pulls retired arthenica CocoaPods ffmpeg-kit-ios-full (404).
const DEFAULT_SUBSPEC = 'https';

const GLOB_SOURCE_FILES =
  /ss\.source_files\s*=\s*'\*\*\/FFmpegKitReactNativeModule\.m',\s*\n\s*'\*\*\/FFmpegKitReactNativeModule\.h'/g;

const IOS_SOURCE_FILES =
  "ss.source_files      = 'ios/FFmpegKitReactNativeModule.m',\n                             'ios/FFmpegKitReactNativeModule.h'";

function patchFfmpegKitPodspec() {
  if (!fs.existsSync(PODSPEC)) {
    return false;
  }

  const original = fs.readFileSync(PODSPEC, 'utf-8');
  let content = original;

  if (/s\.name\s*=\s*package\["name"\]/.test(content)) {
    content = content.replace(/s\.name\s*=\s*package\["name"\]/, `s.name         = '${VALID_NAME}'`);
  }

  if (/s\.default_subspec\s*=/.test(content)) {
    content = content.replace(
      /s\.default_subspec\s*=\s*'[^']*'/,
      `s.default_subspec   = '${DEFAULT_SUBSPEC}'`,
    );
  }

  // Also point the "full" subspec at the mirrored https binary pod so a
  // stale Podfile.lock cannot pull arthenica's retired ffmpeg-kit-ios-full.
  content = content.replace(
    /ss\.dependency\s+'ffmpeg-kit-ios-full',\s*"6\.0"/g,
    `ss.dependency 'ffmpeg-kit-ios-https', "6.0"`,
  );

  // CocoaPods requires s.source to be present for validation even if ignored via :path in Podfile.
  if (!/\s+s\.source\s*=/.test(content)) {
    content = content.replace(
      /s\.name\s*=\s*'ffmpeg-kit-react-native'/,
      "s.name         = 'ffmpeg-kit-react-native'\n  s.source       = { :git => \"https://github.com/arthenica/ffmpeg-kit.git\", :tag => \"react.native.v#{s.version}\" }",
    );
  }

  if (content.includes("'**/FFmpegKitReactNativeModule.m'")) {
    content = content.replace(GLOB_SOURCE_FILES, IOS_SOURCE_FILES);
  }

  if (content === original) {
    return false;
  }

  fs.writeFileSync(PODSPEC, content);
  console.log(
    '[patch-ffmpeg-kit-podspec] Patched pod name, https default subspec, full→https dependency, ios source_files',
  );
  return true;
}

if (require.main === module) {
  const ok = patchFfmpegKitPodspec();
  if (!ok) {
    console.warn('[patch-ffmpeg-kit-podspec] Podspec not found or already patched — skipped');
  }
}

module.exports = { patchFfmpegKitPodspec, PODSPEC, VALID_NAME, DEFAULT_SUBSPEC, PACKAGE_DIR };

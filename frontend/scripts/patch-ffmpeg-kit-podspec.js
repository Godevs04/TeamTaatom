/**
 * CocoaPods fixes for @wokcito/ffmpeg-kit-react-native:
 * - Valid pod name (CocoaPods rejects scoped npm names)
 * - Default "full" subspec (uses self-hosted ffmpeg-kit-ios-full pod)
 * - Ensure s.source is present (CocoaPods validation requires the source attribute even for local :path pods)
 * - Explicit ios/ source_files paths
 */
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = path.join(__dirname, '..', 'node_modules', '@wokcito', 'ffmpeg-kit-react-native');
const PODSPEC = path.join(PACKAGE_DIR, 'ffmpeg-kit-react-native.podspec');

const VALID_NAME = 'ffmpeg-kit-react-native';
const DEFAULT_SUBSPEC = 'full';

const GLOB_SOURCE_FILES =
  /ss\.source_files\s*=\s*'\*\*\/FFmpegKitReactNativeModule\.m',\s*\n\s*'\*\*\/FFmpegKitReactNativeModule\.h'/g;

const IOS_SOURCE_FILES =
  "ss.source_files      = 'ios/FFmpegKitReactNativeModule.m',\n                             'ios/FFmpegKitReactNativeModule.h'";

function patchFfmpegKitPodspec() {
  if (!fs.existsSync(PODSPEC)) {
    return false;
  }

  let content = fs.readFileSync(PODSPEC, 'utf-8');
  let changed = false;

  if (/s\.name\s*=\s*package\["name"\]/.test(content)) {
    content = content.replace(/s\.name\s*=\s*package\["name"\]/, `s.name         = '${VALID_NAME}'`);
    changed = true;
  }

  if (/s\.default_subspec\s*=\s*'https'/.test(content)) {
    content = content.replace(/s\.default_subspec\s*=\s*'https'/, `s.default_subspec   = '${DEFAULT_SUBSPEC}'`);
    changed = true;
  }

  // CocoaPods requires s.source to be present for validation even if ignored via :path in Podfile.
  // If missing, restore/inject a valid git source block.
  if (!/\s+s\.source\s*=/.test(content)) {
    content = content.replace(
      /s\.name\s*=\s*'ffmpeg-kit-react-native'/,
      "s.name         = 'ffmpeg-kit-react-native'\n  s.source       = { :git => \"https://github.com/arthenica/ffmpeg-kit.git\", :tag => \"react.native.v#{s.version}\" }"
    );
    changed = true;
  }

  if (content.includes("'**/FFmpegKitReactNativeModule.m'")) {
    content = content.replace(GLOB_SOURCE_FILES, IOS_SOURCE_FILES);
    changed = true;
  }

  if (!changed) {
    return false;
  }

  fs.writeFileSync(PODSPEC, content);
  console.log(
    '[patch-ffmpeg-kit-podspec] Patched pod name, full subspec, removed s.source (use Podfile :path), ios source_files',
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

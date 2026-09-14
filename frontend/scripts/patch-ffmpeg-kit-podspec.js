/**
 * CocoaPods fixes for @wokcito/ffmpeg-kit-react-native after arthenica retirement:
 * - Valid pod name (CocoaPods rejects scoped npm names)
 * - Default "full" subspec
 * - Remap retired trunk pods (https/full/min/…) → ffmpeg-kit-ios-full
 *   (vendored via plugins/ffmpeg-kit-ios-full.podspec + withFfmpegKitIos)
 * - Ensure s.source is present
 * - Explicit ios/ source_files paths
 */
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = path.join(__dirname, '..', 'node_modules', '@wokcito', 'ffmpeg-kit-react-native');
const PODSPEC = path.join(PACKAGE_DIR, 'ffmpeg-kit-react-native.podspec');

const VALID_NAME = 'ffmpeg-kit-react-native';
const DEFAULT_SUBSPEC = 'full';
const MIRRORED_IOS_POD = 'ffmpeg-kit-ios-full';

/** Trunk binary pods that 404 after FFmpegKit retirement. */
const RETIRED_IOS_PODS = [
  'ffmpeg-kit-ios-min',
  'ffmpeg-kit-ios-min-gpl',
  'ffmpeg-kit-ios-https',
  'ffmpeg-kit-ios-https-gpl',
  'ffmpeg-kit-ios-audio',
  'ffmpeg-kit-ios-video',
  'ffmpeg-kit-ios-full',
  'ffmpeg-kit-ios-full-gpl',
];

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

  // Point every retired iOS binary dependency at the mirrored full pod (version 6.0).
  for (const retired of RETIRED_IOS_PODS) {
    content = content.replace(
      new RegExp(`ss\\.dependency\\s+'${retired}'\\s*,\\s*"[^"]+"`, 'g'),
      `ss.dependency '${MIRRORED_IOS_POD}', "6.0"`,
    );
  }

  // CocoaPods requires s.source even for local :path pods.
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
    `[patch-ffmpeg-kit-podspec] Patched → default '${DEFAULT_SUBSPEC}', deps → ${MIRRORED_IOS_POD}`,
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

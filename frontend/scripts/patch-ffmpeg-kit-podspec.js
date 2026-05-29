/**
 * CocoaPods rejects scoped npm names (e.g. @wokcito/ffmpeg-kit-react-native).
 * arthenica/ffmpeg-kit iOS binaries were removed from CocoaPods trunk (404).
 * Run on postinstall and during Expo prebuild.
 */
const fs = require('fs');
const path = require('path');

const PODSPEC = path.join(
  __dirname,
  '..',
  'node_modules',
  '@wokcito',
  'ffmpeg-kit-react-native',
  'ffmpeg-kit-react-native.podspec',
);

const VALID_NAME = 'ffmpeg-kit-react-native';
const DEFAULT_SUBSPEC = 'full';

function patchFfmpegKitPodspec() {
  if (!fs.existsSync(PODSPEC)) {
    return false;
  }

  let content = fs.readFileSync(PODSPEC, 'utf-8');
  let changed = false;

  const brokenName = /s\.name\s*=\s*package\["name"\]/;
  if (brokenName.test(content)) {
    content = content.replace(brokenName, `s.name         = '${VALID_NAME}'`);
    changed = true;
  }

  const defaultSubspec = /s\.default_subspec\s*=\s*'https'/;
  if (defaultSubspec.test(content)) {
    content = content.replace(defaultSubspec, `s.default_subspec   = '${DEFAULT_SUBSPEC}'`);
    changed = true;
  }

  if (!changed) {
    return false;
  }

  fs.writeFileSync(PODSPEC, content);
  console.log(
    `[patch-ffmpeg-kit-podspec] Patched pod name (${VALID_NAME}) and default subspec (${DEFAULT_SUBSPEC})`,
  );
  return true;
}

if (require.main === module) {
  const ok = patchFfmpegKitPodspec();
  if (!ok) {
    console.warn('[patch-ffmpeg-kit-podspec] Podspec not found or already patched — skipped');
  }
}

module.exports = { patchFfmpegKitPodspec, PODSPEC, VALID_NAME, DEFAULT_SUBSPEC };

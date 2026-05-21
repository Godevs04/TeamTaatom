/**
 * CocoaPods rejects scoped npm names (e.g. @wokcito/ffmpeg-kit-react-native).
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

function patchFfmpegKitPodspec() {
  if (!fs.existsSync(PODSPEC)) {
    return false;
  }

  let content = fs.readFileSync(PODSPEC, 'utf-8');
  const broken = /s\.name\s*=\s*package\["name"\]/;

  if (!broken.test(content)) {
    return false;
  }

  content = content.replace(broken, `s.name         = '${VALID_NAME}'`);
  fs.writeFileSync(PODSPEC, content);
  console.log(`[patch-ffmpeg-kit-podspec] Set pod name to ${VALID_NAME}`);
  return true;
}

if (require.main === module) {
  const ok = patchFfmpegKitPodspec();
  if (!ok) {
    console.warn('[patch-ffmpeg-kit-podspec] Podspec not found or already patched — skipped');
  }
}

module.exports = { patchFfmpegKitPodspec, PODSPEC, VALID_NAME };

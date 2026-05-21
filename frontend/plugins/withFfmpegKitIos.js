/**
 * iOS FFmpeg Kit fixes (arthenica retirement, April 2025):
 * 1. Patch @wokcito/ffmpeg-kit-react-native podspec name (CocoaPods rejects scoped npm names).
 * 2. Inject self-hosted ffmpeg-kit-ios-https@6.0 pod (replaces removed CocoaPods artifact).
 *
 * Android: @wokcito/ffmpeg-kit-react-native uses Maven ffmpeg-kit-main-16kb.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const { patchFfmpegKitPodspec } = require('../scripts/patch-ffmpeg-kit-podspec');

const POD_ENTRY = "pod 'ffmpeg-kit-ios-https', :podspec => './ffmpeg-kit-ios-https.podspec'";

function withFfmpegKitIos(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const { platformProjectRoot, projectRoot } = cfg.modRequest;

      patchFfmpegKitPodspec();

      const sourcePodspec = path.join(__dirname, 'ffmpeg-kit-ios-https.podspec');
      const destPodspec = path.join(platformProjectRoot, 'ffmpeg-kit-ios-https.podspec');

      fs.copyFileSync(sourcePodspec, destPodspec);

      const podfilePath = path.join(platformProjectRoot, 'Podfile');
      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      if (!podfileContent.includes(POD_ENTRY)) {
        const anchor = 'use_expo_modules!';
        if (!podfileContent.includes(anchor)) {
          throw new Error(
            '[withFfmpegKitIos] Could not find use_expo_modules! in Podfile — cannot inject ffmpeg-kit-ios-https pod.',
          );
        }

        podfileContent = mergeContents({
          tag: 'ffmpeg-kit-ios-https-pod',
          src: podfileContent,
          newSrc: POD_ENTRY,
          anchor: new RegExp(`^\\s*${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
          offset: 1,
          comment: '#',
        }).contents;

        fs.writeFileSync(podfilePath, podfileContent);
      }

      return cfg;
    },
  ]);
}

module.exports = withFfmpegKitIos;

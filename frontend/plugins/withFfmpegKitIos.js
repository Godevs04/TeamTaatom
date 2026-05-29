/**
 * iOS FFmpeg Kit fixes (arthenica retirement, April 2025):
 * 1. Patch @wokcito/ffmpeg-kit-react-native podspec (postinstall + prebuild).
 * 2. Inject ffmpeg-kit-ios-full + local-path ffmpeg-kit-react-native before autolinking.
 *
 * Android: @wokcito/ffmpeg-kit-react-native uses Maven ffmpeg-kit-main-16kb.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const { patchFfmpegKitPodspec } = require('../scripts/patch-ffmpeg-kit-podspec');

const RN_POD_PATH = '../node_modules/@wokcito/ffmpeg-kit-react-native';

const POD_ENTRIES = [
  "pod 'ffmpeg-kit-ios-full', :podspec => './ffmpeg-kit-ios-full.podspec'",
  `pod 'ffmpeg-kit-react-native', :path => '${RN_POD_PATH}', :subspecs => ['full']`,
].join('\n');

const LEGACY_RN_POD = /pod 'ffmpeg-kit-react-native'[^\n]*/;

function injectPodfileEntries(podfileContent, targetName) {
  if (podfileContent.includes(`:path => '${RN_POD_PATH}'`)) {
    return podfileContent;
  }

  if (podfileContent.includes("pod 'ffmpeg-kit-react-native'")) {
    return podfileContent.replace(LEGACY_RN_POD, POD_ENTRIES.split('\n')[1]);
  }

  if (podfileContent.includes("pod 'ffmpeg-kit-ios-full', :podspec =>")) {
    return podfileContent;
  }

  const anchors = [
    { pattern: /^\s*use_expo_modules!/m },
    {
      pattern: new RegExp(
        `^\\s*target\\s+'${(targetName || 'taatom').replace(/'/g, "\\'")}'\\s+do`,
        'm',
      ),
    },
  ];

  for (const { pattern } of anchors) {
    if (!pattern.test(podfileContent)) {
      continue;
    }

    return mergeContents({
      tag: 'ffmpeg-kit-ios-pods',
      src: podfileContent,
      newSrc: POD_ENTRIES,
      anchor: pattern,
      offset: 0,
      comment: '#',
    }).contents;
  }

  throw new Error(
    `[withFfmpegKitIos] Could not find a Podfile anchor to inject ffmpeg-kit pods (target '${targetName}').`,
  );
}

function withFfmpegKitIos(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const { platformProjectRoot } = cfg.modRequest;
      const targetName = cfg.modRequest.projectName || config.slug || config.name || 'taatom';

      patchFfmpegKitPodspec();

      const sourcePodspec = path.join(__dirname, 'ffmpeg-kit-ios-full.podspec');
      const destPodspec = path.join(platformProjectRoot, 'ffmpeg-kit-ios-full.podspec');
      fs.copyFileSync(sourcePodspec, destPodspec);

      const podfilePath = path.join(platformProjectRoot, 'Podfile');
      const podfileContent = fs.readFileSync(podfilePath, 'utf-8');
      fs.writeFileSync(podfilePath, injectPodfileEntries(podfileContent, targetName));

      return cfg;
    },
  ]);
}

module.exports = withFfmpegKitIos;

/**
 * iOS FFmpeg Kit fixes (arthenica retirement, April 2025):
 * 1. Patch @wokcito/ffmpeg-kit-react-native podspec (postinstall + prebuild).
 * 2. Vendor a single mirrored ffmpeg-kit-ios-full pod (not CocoaPods trunk / arthenica).
 * 3. Force the RN pod onto the "full" subspec before autolinking can pull "https" (404).
 *
 * Do NOT also inject an https alias with the same xcframeworks — CocoaPods errors with
 * "frameworks with conflicting names: ffmpegkit.xcframework, libavcodec…".
 *
 * Android: @wokcito/ffmpeg-kit-react-native uses Maven ffmpeg-kit-main-16kb.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const { patchFfmpegKitPodspec } = require('../scripts/patch-ffmpeg-kit-podspec');

const RN_POD_PATH = '../node_modules/@wokcito/ffmpeg-kit-react-native';
const LOCAL_FULL_PODSPEC = './ffmpeg-kit-ios-full.podspec';

const POD_ENTRIES = [
  `pod 'ffmpeg-kit-ios-full', :podspec => '${LOCAL_FULL_PODSPEC}'`,
  `pod 'ffmpeg-kit-react-native', :path => '${RN_POD_PATH}', :subspecs => ['full']`,
].join('\n');

function ensurePodfileEntries(podfileContent, targetName) {
  let next = podfileContent;

  // Drop autolinked / stale lines so we own the single source of truth.
  next = next.replace(/^\s*pod 'ffmpeg-kit-react-native'[^\n]*\n?/gm, '');
  next = next.replace(/^\s*pod 'ffmpeg-kit-ios-full'[^\n]*\n?/gm, '');
  next = next.replace(/^\s*pod 'ffmpeg-kit-ios-https'[^\n]*\n?/gm, '');

  // Remove prior tagged injection if regenerating.
  next = next.replace(
    /# @generated begin ffmpeg-kit-ios-pods[\s\S]*?# @generated end ffmpeg-kit-ios-pods\n?/g,
    '',
  );

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
    if (!pattern.test(next)) {
      continue;
    }

    return mergeContents({
      tag: 'ffmpeg-kit-ios-pods',
      src: next,
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
      fs.writeFileSync(podfilePath, ensurePodfileEntries(podfileContent, targetName));

      return cfg;
    },
  ]);
}

module.exports = withFfmpegKitIos;

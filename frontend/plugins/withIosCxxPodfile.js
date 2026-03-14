/**
 * Expo config plugin: fix iOS build errors "'cassert' file not found" and
 * "Could not build Objective-C module 'ExpoGL'" on EAS/prebuild.
 * Sets CLANG_CXX_LANGUAGE_STANDARD and CLANG_CXX_LIBRARY for Pods and app target.
 * Runs after react_native_post_install so our settings are not overwritten.
 * @see https://github.com/expo/expo/issues/22622
 * @see https://github.com/expo/expo/issues/22623
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Run AFTER react_native_post_install so RN doesn't overwrite. Apply to both Pods and app project.
const CXX_SNIPPET = `
    # Fix cassert/ExpoGL: C++ standard and headers (run after react_native_post_install).
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'
        config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
        config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
      end
    end
    # Also set on app project so module import finds C++ headers.
    installer.aggregate_targets.each do |aggregate_target|
      aggregate_target.user_project.native_targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] ||= 'gnu++17'
          config.build_settings['CLANG_CXX_LIBRARY'] ||= 'libc++'
          config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
        end
      end
      aggregate_target.user_project.save
    end
`;

function withIosCxxPodfile(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return config;
      }
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Avoid applying twice (new snippet includes aggregate_targets)
      if (contents.includes("CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'") && contents.includes('aggregate_targets.each')) {
        return config;
      }

      // Insert fix at END of post_install (after react_native_post_install) so our settings win
      const endPattern = /(:ccache_enabled\s*=>\s*ccache_enabled\?\(podfile_properties\),\s*\))(\s+end\s+end\s*)$/m;
      if (endPattern.test(contents)) {
        contents = contents.replace(
          endPattern,
          (_, closingParenBlock, twoEnds) => closingParenBlock + CXX_SNIPPET + '\n  end\nend\n'
        );
        fs.writeFileSync(podfilePath, contents, 'utf8');
      } else {
        // Fallback: insert at start of post_install
        const startMarker = /(post_install\s+do\s+\|installer\|)/;
        if (startMarker.test(contents) && !contents.includes("CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'")) {
          contents = contents.replace(startMarker, (m) => m + CXX_SNIPPET);
          fs.writeFileSync(podfilePath, contents, 'utf8');
        }
      }

      return config;
    },
  ]);
}

module.exports = withIosCxxPodfile;

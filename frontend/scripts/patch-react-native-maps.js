/**
 * Post-install patch script for react-native-maps.
 * Resolves fatal "nil insertion" and "index out of bounds" crashes on iOS.
 * Patches:
 * - AIRMap.m (Apple Maps)
 * - AIRGoogleMap.m (Google Maps)
 */
const fs = require('fs');
const path = require('path');

const AIR_MAP_M = path.join(__dirname, '..', 'node_modules', 'react-native-maps', 'ios', 'AirMaps', 'AIRMap.m');
const AIR_GOOGLE_MAP_M = path.join(__dirname, '..', 'node_modules', 'react-native-maps', 'ios', 'AirGoogleMaps', 'AIRGoogleMap.m');

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-react-native-maps] File not found: ${filePath} — skipped`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const r of replacements) {
    if (content.includes(r.search)) {
      content = content.replace(r.search, r.replace);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[patch-react-native-maps] Successfully patched: ${path.basename(filePath)}`);
    return true;
  } else {
    console.log(`[patch-react-native-maps] Already patched or no target found in: ${path.basename(filePath)}`);
    return false;
  }
}

function runPatch() {
  console.log('[patch-react-native-maps] Running native iOS maps patches...');

  const airMapReplacements = [
    // 1. insertReactSubview nil check
    {
      search: '- (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {\n    // Our desired API',
      replace: '- (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {\n    if (subview == nil) return;\n    // Our desired API'
    },
    // 2. insertReactSubview safe index clamping
    {
      search: '    [_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];\n}',
      replace: '    NSUInteger safeIndex = MIN((NSUInteger)atIndex, _reactSubviews.count);\n    [_reactSubviews insertObject:(UIView *)subview atIndex:safeIndex];\n}'
    },
    // 3. removeReactSubview nil check
    {
      search: '- (void)removeReactSubview:(id<RCTComponent>)subview {\n    // similarly, when the children',
      replace: '- (void)removeReactSubview:(id<RCTComponent>)subview {\n    if (subview == nil) return;\n    // similarly, when the children'
    }
  ];

  const airGoogleMapReplacements = [
    // 1. insertReactSubview nil check
    {
      search: '- (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {\n  // Our desired API',
      replace: '- (void)insertReactSubview:(id<RCTComponent>)subview atIndex:(NSInteger)atIndex {\n  if (subview == nil) return;\n  // Our desired API'
    },
    // 2. insertReactSubview safe index clamping
    {
      search: '  [_reactSubviews insertObject:(UIView *)subview atIndex:(NSUInteger) atIndex];\n}',
      replace: '  NSUInteger safeIndex = MIN((NSUInteger)atIndex, _reactSubviews.count);\n  [_reactSubviews insertObject:(UIView *)subview atIndex:safeIndex];\n}'
    },
    // 3. removeReactSubview nil check
    {
      search: '- (void)removeReactSubview:(id<RCTComponent>)subview {\n  // similarly, when the children',
      replace: '- (void)removeReactSubview:(id<RCTComponent>)subview {\n  if (subview == nil) return;\n  // similarly, when the children'
    }
  ];

  const ok1 = patchFile(AIR_MAP_M, airMapReplacements);
  const ok2 = patchFile(AIR_GOOGLE_MAP_M, airGoogleMapReplacements);

  return ok1 || ok2;
}

if (require.main === module) {
  runPatch();
}

module.exports = { runPatch };

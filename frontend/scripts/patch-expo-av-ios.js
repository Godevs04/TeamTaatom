/**
 * expo-av 16 still compiles against ExpoModulesCore headers removed in SDK 55+.
 * Inline the three missing protocols and rename the old UMPromise typedefs so
 * the existing audio/video native module can build on Expo SDK 57.
 */
const fs = require('fs');
const path = require('path');

const IOS = path.join(__dirname, '..', 'node_modules', 'expo-av', 'ios');

const EVENT_EMITTER = `@protocol EXEventEmitter <NSObject>
- (void)startObserving;
- (void)stopObserving;
- (NSArray<NSString *> *)supportedEvents;
@end`;

const EVENT_EMITTER_SERVICE = `@protocol EXEventEmitterService <NSObject>
- (void)sendEventWithName:(NSString *)name body:(id)body;
@end`;

const LEGACY_VIEW = `@protocol EXLegacyExpoViewProtocol <NSObject>
@end`;

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-expo-av-ios] Missing ${filePath}`);
    return false;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) content = content.split(search).join(replace);
  }
  content = content.replace(/UMPromiseResolveBlock/g, 'EXPromiseResolveBlock');
  content = content.replace(/UMPromiseRejectBlock/g, 'EXPromiseRejectBlock');
  if (content === original) {
    console.log(`[patch-expo-av-ios] Already patched ${path.basename(filePath)}`);
    return false;
  }
  fs.writeFileSync(filePath, content);
  console.log(`[patch-expo-av-ios] Patched ${path.relative(path.join(__dirname, '..'), filePath)}`);
  return true;
}

const SHIM = `#import <Foundation/Foundation.h>

#ifndef EXAV_LEGACY_SHIMS_H
#define EXAV_LEGACY_SHIMS_H

// EXLog* / EXFatal / EXErrorWithMessage were removed from ExpoModulesCore in SDK 55+.
static inline NSError *EXErrorWithMessage(NSString *message) {
  return [NSError errorWithDomain:@"EXAV" code:0 userInfo:@{ NSLocalizedDescriptionKey: message ?: @"" }];
}

static inline void EXLogInfo(NSString *format, ...) {
  va_list args;
  va_start(args, format);
  NSLogv([@"[expo-av] " stringByAppendingString:format ?: @""], args);
  va_end(args);
}

static inline void EXLogWarn(NSString *format, ...) {
  va_list args;
  va_start(args, format);
  NSLogv([@"[expo-av] " stringByAppendingString:format ?: @""], args);
  va_end(args);
}

static inline void EXLogError(NSString *format, ...) {
  va_list args;
  va_start(args, format);
  NSLogv([@"[expo-av] " stringByAppendingString:format ?: @""], args);
  va_end(args);
}

static inline void EXFatal(NSError *error) {
  NSLog(@"[expo-av] %@", error);
}

#endif
`;

function ensureShim() {
  const filePath = path.join(IOS, 'EXAV', 'EXAVLegacyShims.h');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (current !== SHIM) {
    fs.writeFileSync(filePath, SHIM);
    console.log('[patch-expo-av-ios] Wrote EXAVLegacyShims.h');
  }
}

function ensureImport(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('EXAVLegacyShims.h')) return;
  const importLine = '#import "EXAVLegacyShims.h"\n';
  const firstImport = content.indexOf('#import');
  if (firstImport === -1) {
    content = importLine + content;
  } else {
    content = content.slice(0, firstImport) + importLine + content.slice(firstImport);
  }
  fs.writeFileSync(filePath, content);
  console.log(`[patch-expo-av-ios] Imported shim in ${path.basename(filePath)}`);
}

function run() {
  if (!fs.existsSync(IOS)) {
    console.warn('[patch-expo-av-ios] expo-av ios sources not found — skipped');
    return;
  }
  ensureShim();
  for (const file of [
    'EXAV/EXAudioRecordingPermissionRequester.m',
    'EXAV/EXAV.m',
    'EXAV/EXAVTV.m',
    'EXAV/EXAVPlayerData.m',
  ]) {
    ensureImport(path.join(IOS, file));
  }
  patchFile(path.join(IOS, 'EXAV', 'EXAV.h'), [
    ['#import <ExpoModulesCore/EXEventEmitter.h>', EVENT_EMITTER],
  ]);
  patchFile(path.join(IOS, 'EXAV', 'EXAV.m'), [
    ['#import <ExpoModulesCore/EXEventEmitterService.h>', EVENT_EMITTER_SERVICE],
  ]);
  patchFile(path.join(IOS, 'EXAV', 'EXAVTV.m'), [
    ['#import <ExpoModulesCore/EXEventEmitterService.h>', EVENT_EMITTER_SERVICE],
  ]);
  patchFile(path.join(IOS, 'EXAV', 'Video', 'EXVideoView.h'), [
    ['#import <ExpoModulesCore/EXLegacyExpoViewProtocol.h>', LEGACY_VIEW],
  ]);
  patchFile(path.join(IOS, 'EXAV', 'ExpoVideoView.swift'), [
    [
      'guard let legacyModuleRegistry = appContext?.legacyModuleRegistry else {',
      'guard let legacyModuleRegistry = appContext?.value(forKey: "legacyModuleRegistry") as? EXModuleRegistry else {',
    ],
  ]);
  patchFile(path.join(IOS, 'EXAV', 'Video', 'VideoViewModule.swift'), [
    [
      'resolver: promise.resolver, rejecter: promise.legacyRejecter',
      'resolver: promise.legacyResolver, rejecter: promise.legacyRejecter',
    ],
  ]);
}

if (require.main === module) run();

module.exports = { run };

# Pull Request Description

## Title
```text
TAATOM: Fix ffmpeg-kit CocoaPods validation on EAS iOS build & clean unused dependencies
```

## Description

### Overview
This PR resolves the EAS iOS build failure caused by the CocoaPods validation crash of the retired `ffmpeg-kit-ios-full` package. It also cleans up several unused/retired dependencies to improve build stability, reduce package sizes, and ensure long-term maintenance health.

### Key Changes
1. **FFmpegKit iOS Build Fix**:
   - Pointed the config plugin (`withFfmpegKitIos.js`) directly to the remote GitHub `.podspec` hosted by the community fork:
     `https://raw.githubusercontent.com/luthviar/ffmpeg-kit-ios-full/main/ffmpeg-kit-ios-full.podspec`
   - Reformatted the `s.source` attribute in the local `ffmpeg-kit-ios-full.podspec` to a single line to satisfy strict CocoaPods parsers.
   - Enforced the presence of the required `s.source` attribute in `@wokcito/ffmpeg-kit-react-native`'s podspec via `patch-ffmpeg-kit-podspec.js` (CocoaPods requires it to validate, even for local `:path` pods).
2. **Frontend Dependency Cleanup**:
   - Safely uninstalled **`recoil`** (officially archived and unmaintained since Jan 2025).
   - Safely uninstalled **`node-fetch`** (redundant NodeJS-only package in React Native/Expo).
3. **Backend Dependency Cleanup**:
   - Safely uninstalled **`@react-native-firebase/app`** and **`@react-native-firebase/messaging`** (React Native dependencies listed in the backend by mistake).
   - Removed **`csrf`** (deprecated package; the backend uses native `crypto` module in `csrfProtection.js` instead).

---

### Verification & Testing Results
- **Script Run**: Patched the local package `@wokcito/ffmpeg-kit-react-native` successfully via `node scripts/patch-ffmpeg-kit-podspec.js` and confirmed the `s.source` attribute is injected properly.
- **Frontend**: Ran `npm run lint` and confirmed that the TypeScript type-check passed successfully with `"TS OK"` (no imports depend on the uninstalled packages).
- **Backend**: Ran `npm run lint` and confirmed compilation succeeds with `0 errors`.

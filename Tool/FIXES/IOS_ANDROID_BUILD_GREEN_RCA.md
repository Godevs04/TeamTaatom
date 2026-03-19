# iOS & Android build “green” fixes — RCA & playbook

**Purpose:** Document what was changed to fix local IDE errors, Gradle/Xcode/EAS failures, and `expo-doctor` issues so the team can reuse this for future regressions.

**Scope:** `frontend/` Expo SDK ~54, React Native ~0.81, EAS Build, Android Studio / Xcode on Expo build workers.

**Date context:** Fixes applied across sessions (Mar 2026).

---

## 1. Android — Sentry Gradle script path (`/sentry.gradle`)

### Symptom
- IDE / Gradle sync: **Could not read script `/sentry.gradle` as it does not exist**
- Often paired with cascading “Failed to apply plugin `com.facebook.react.rootproject`”

### Root cause
In `frontend/android/app/build.gradle`, Sentry was applied with:

```gradle
... require.resolve('@sentry/react-native/package.json') ... .execute().text.trim(), "sentry.gradle")
```

**`.execute()` was called with no working directory.** Gradle’s Groovy `execute()` defaults the process CWD to something that is **not** `android/app`, so Node’s `require.resolve` fails or resolves incorrectly, the dirname becomes `/`, and Gradle looks for **`/sentry.gradle`**.

### Fix
Match the pattern used elsewhere in the same file (React Native / Expo entry resolution): run Node **from `android/app`**:

```gradle
.execute(null, rootDir).text.trim(), "sentry.gradle")
```

**File:** `frontend/android/app/build.gradle` (Sentry `apply from:` line)

### Prevention
- Any `node` / `require.resolve` in Gradle **must** use `.execute(null, rootDir)` (or another explicit `projectDir` that contains / walks up to `node_modules`).

---

## 2. Android — “Minimum Gradle 8.13, current 8.9” (IDE only)

### Symptom
- VS Code / Cursor **Java/Gradle** diagnostics: AGP requires Gradle **≥ 8.13** but “current” is **8.9**

### Root cause
The **project wrapper** (`gradle-wrapper.properties`) may already use **8.14.x**, but the editor extension sometimes uses a **bundled** Gradle instead of the **wrapper**.

### Fix
- Ensure `frontend/gradle/wrapper/gradle-wrapper.properties` uses a supported distribution (e.g. **8.14.3**).
- Add / keep `frontend/.vscode/settings.json`:

```json
{
  "java.import.gradle.wrapper.enabled": true,
  "java.configuration.updateBuildConfiguration": "automatic"
}
```

Then **reload the window** or **Clean Java Language Server Workspace** so diagnostics refresh.

**Files:** `frontend/gradle/wrapper/gradle-wrapper.properties`, `frontend/.vscode/settings.json`

---

## 3. Android — `SDK location not found` (local `./gradlew`)

### Symptom
- `./gradlew :app:assembleDebug` fails with **SDK location not found** / define `ANDROID_HOME` or `local.properties`

### Root cause
Gradle needs the Android SDK path. On a dev machine, neither **`ANDROID_HOME`** nor **`sdk.dir`** was set.

### Fix (local)
Create **`frontend/android/local.properties`** (gitignored by `android/.gitignore`):

```properties
sdk.dir=/Users/<you>/Library/Android/sdk
```

Or set environment:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

**Note:** EAS cloud builds inject SDK paths; this is mainly for **local** Gradle / Android Studio.

**File:** `frontend/android/local.properties` (local only, do not commit secrets)

---

## 4. Expo Doctor — `app.json` schema & static vs dynamic config

### Symptom A — invalid iOS key
- **Field: ios — should NOT have additional property `googleMapsApiKey`**

**Root cause:** Expo’s schema expects the Google Maps iOS SDK key under **`ios.config.googleMapsApiKey`**, not on `ios` root.

**Fix:** Move the key into `ios.config` next to other `config` fields.

**File:** `frontend/app.json`

### Symptom B — app.json not “used” by `app.config.js`
- **You have app.json but app.config.js is not using values from it**

**Root cause:** Expo marks static config as “unused” when the dynamic config export **does not** return the object built from the static file (special internal marker on `config`).

**Fix:** Export must pass through Expo’s injected config:

```js
module.exports = ({ config }) => config;
```

(Keep any **top-of-file** side effects, e.g. Google Play key decode, as they run at load time.)

**File:** `frontend/app.config.js`

---

## 5. EAS Android — `expo-gl-cpp` / Gradle + “Autolinking” noise

### Symptom (EAS log)
- **`expo-gl-cpp`:** `Could not set unknown property 'classifier' for task ... Jar` (Gradle 8 / AGP vs old script)
- **`expo-gl-cpp`:** does not specify **`compileSdk`**
- Secondary: **Autolinking is not set up in `settings.gradle`** (often a follow-on when native project / modules fail early)

### Root cause (functional)
`expo-gl` pulls in **`expo-gl-cpp`**, whose Android Gradle was **incompatible** with the toolchain on the EAS image (and iOS build broke in the same dependency chain — see §6).

### Fix (product decision)
The app **did not import `expo-gl` / `GLView`** anywhere. **Removed the dependency** to drop `expo-gl-cpp` from native builds.

**Files:** `frontend/package.json`, `frontend/package-lock.json` (run `npm install`)

### If you need GL again later
- Re-add only when a feature requires it.
- Expect to **pin compatible versions** with your Expo SDK / RN, or apply **patch-package** fixes to `expo-gl-cpp` if upstream lags.
- Re-run EAS with **`--clear-cache`** after native dependency changes.

---

## 6. EAS iOS — `ExpoGL` / `'cassert' file not found` (Xcode log)

### Symptom (Xcode / EAS)
- `React-jsi/jsi/jsi.h:10:10: error: 'cassert' file not found`
- `could not build Objective-C module 'ExpoGL'`

### Root cause
Same native stack as §5: **`expo-gl` / ExpoGL / JSI** path on the build image. Removing **`expo-gl`** removed the failing native module from the iOS graph.

### Fix
Same as §5: remove unused **`expo-gl`** dependency.

---

## 7. TypeScript / `npm run lint` (not native build, but “green CI”)

These were fixed so `tsc --noEmit` passes:

| Area | Issue | Fix |
|------|--------|-----|
| `reset-password.tsx` | Formik `errors.*` / `touched.*` wider than `AuthInput` props | `error={typeof errors.x === 'string' ? errors.x : undefined}`, `touched={!!touched.x}` |
| `profile.tsx`, `shorts.tsx`, `locale.tsx` | `StyleSheet` styles on `<Image>` inferred as `ViewStyle \| TextStyle \| ImageStyle` | `import { ImageStyle }` and `style={... as ImageStyle}` |
| `shorts.tsx` | `status.error` on `AVPlaybackStatus` union | Narrow: `'error' in status && status.error` |
| `tsconfig.json` | IDE: cannot resolve `expo/tsconfig.base` | Use `"extends": "expo/tsconfig.base.json"` |

---

## 8. Quick verification checklist

**Local**
```bash
cd frontend && npm run lint
cd frontend/android && ./gradlew :app:assembleDebug   # needs SDK / local.properties
```

**Expo**
```bash
cd frontend && npx expo-doctor
```

**EAS**
- After native dep changes: `eas build -p android --clear-cache` / `eas build -p ios --clear-cache`

---

## 9. File index (what we touched)

| File | Why |
|------|-----|
| `frontend/android/app/build.gradle` | Sentry `execute(null, rootDir)` |
| `frontend/.vscode/settings.json` | Gradle wrapper for IDE |
| `frontend/android/local.properties` | Local `sdk.dir` (developer machine) |
| `frontend/app.json` | `googleMapsApiKey` under `ios.config` |
| `frontend/app.config.js` | `module.exports = ({ config }) => config` |
| `frontend/package.json` / `package-lock.json` | Removed `expo-gl` |
| `frontend/tsconfig.json` | `expo/tsconfig.base.json` extends |
| Various `*.tsx` | TS strictness / RN types (see §7) |

---

## 10. RCA summary (one paragraph)

**Android local/IDE failures** were primarily **wrong Node CWD in Gradle** (Sentry script → `/sentry.gradle`) and **missing SDK path** (`local.properties` / `ANDROID_HOME`), with **IDE Gradle version** sometimes not following the wrapper. **expo-doctor** failed due to **invalid `ios.googleMapsApiKey` placement** and **dynamic config not returning Expo’s merged `config`**. **EAS Android and iOS** both broke on the **`expo-gl` → `expo-gl-cpp` / ExpoGL** native chain on current toolchains; since **`expo-gl` was unused**, removing it was the lowest-risk fix. **TypeScript** issues were standard RN/Formik typing gaps, fixed with narrow casts and guards.

---

*Maintainers: append new build breaks under a dated subsection with Symptom / Root cause / Fix / Files.*
 
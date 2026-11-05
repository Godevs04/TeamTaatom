import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Build number of the installed binary (iOS CFBundleVersion / Android versionCode).
 *
 * eas.json uses `appVersionSource: "remote"`, so EAS assigns build numbers at build
 * time and the app config carries none — read the native value instead. Falls back
 * to the config (dev/Expo Go) and finally '1'.
 */
export function getNativeBuildNumber(): string {
  const native = Application.nativeBuildVersion;
  if (native) return native;
  const fromConfig =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode;
  return fromConfig != null && String(fromConfig) !== '' ? String(fromConfig) : '1';
}

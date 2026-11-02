import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';

/**
 * True only when the AdMob native module is compiled into the running binary.
 *
 * Importing 'react-native-google-mobile-ads' calls TurboModuleRegistry.getEnforcing
 * at load time, which throws when the binary has no RNGoogleMobileAdsModule. That
 * happens in Expo Go and in any development build created before the package was
 * added, so an appOwnership check alone is not enough.
 */
export function isAdsModuleLinked(): boolean {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return false;
  try {
    if (TurboModuleRegistry.get?.('RNGoogleMobileAdsModule')) return true;
  } catch {
    return false;
  }
  return !!NativeModules.RNGoogleMobileAdsModule;
}

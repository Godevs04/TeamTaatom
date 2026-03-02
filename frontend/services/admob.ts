/**
 * AdMob + UMP (User Messaging Platform) initialization.
 * Compliance: GDPR/EEA consent, iOS/Android policies, non-blocking startup.
 *
 * - Runs only on ios/android (skips web, Expo Go).
 * - UMP consent flow before MobileAds init (delay_app_measurement_init: true in app.json).
 * - Test device config in __DEV__ to avoid invalid traffic.
 * - Safe error handling: never crashes app.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from '../utils/logger';

let isInitialized = false;

/**
 * Initialize ads: UMP consent flow + MobileAds.
 * Non-blocking; errors are logged and swallowed.
 */
export async function initializeAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.appOwnership === 'expo') return; // Skip in Expo Go — native module not registered

  try {
    const { default: MobileAds, AdsConsent, AdsConsentDebugGeography } = await import(
      'react-native-google-mobile-ads'
    );

    const options = __DEV__
      ? {
          // EEA debug: test consent form. Use NOT_EEA for "consent not required" testing.
          debugGeography: AdsConsentDebugGeography.EEA,
          testDeviceIdentifiers: ['EMULATOR'] as string[],
          tagForUnderAgeOfConsent: false,
        }
      : { tagForUnderAgeOfConsent: false };

    // 1. Request consent info update (UMP SDK)
    await AdsConsent.requestInfoUpdate(options);

    // 2. Load and show consent form if required (GDPR/EEA)
    await AdsConsent.loadAndShowConsentFormIfRequired();

    // 3. Initialize MobileAds (after consent; delayAppMeasurementInit ensures no measurement before consent)
    const mobileAds = MobileAds();
    if (__DEV__) {
      await mobileAds.setRequestConfiguration({
        testDeviceIdentifiers: ['EMULATOR'],
      });
    }
    await mobileAds.initialize();

    isInitialized = true;
    if (__DEV__) {
      logger.debug('[AdMob] SDK initialized (test mode)');
    } else {
      logger.debug('[AdMob] SDK initialized');
    }
  } catch (error: unknown) {
    // Non-blocking: never crash app
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[AdMob] Init failed (non-blocking):', message);
  }
}

/**
 * Manually re-open consent / privacy options form.
 * Use for "Manage Privacy Settings" in Profile/Settings.
 */
export async function showConsentForm(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const { AdsConsent } = await import('react-native-google-mobile-ads');
    await AdsConsent.showPrivacyOptionsForm();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[AdMob] Show consent form failed:', message);
    throw error; // Caller can show user-friendly message
  }
}

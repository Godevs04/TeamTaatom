/**
 * Native-only AdMob + UMP implementation (iOS / Android).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from '../utils/logger';

let isInitialized = false;

export async function initializeAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.appOwnership === 'expo') return;

  try {
    const { default: MobileAds, AdsConsent, AdsConsentDebugGeography } = await import(
      'react-native-google-mobile-ads'
    );

    const options = __DEV__
      ? {
          debugGeography: AdsConsentDebugGeography.EEA,
          testDeviceIdentifiers: ['EMULATOR'] as string[],
          tagForUnderAgeOfConsent: false,
        }
      : { tagForUnderAgeOfConsent: false };

    await AdsConsent.requestInfoUpdate(options);
    await AdsConsent.loadAndShowConsentFormIfRequired();

    const mobileAds = MobileAds();
    if (__DEV__) {
      await mobileAds.setRequestConfiguration({
        testDeviceIdentifiers: ['EMULATOR'],
      });
    }
    await mobileAds.initialize();

    isInitialized = true;
    logger.debug('[AdMob] SDK initialized', { mode: __DEV__ ? 'test' : 'prod' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[AdMob] Init failed (non-blocking):', message);
  }
}

export async function showConsentForm(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const { AdsConsent } = await import('react-native-google-mobile-ads');
    await AdsConsent.showPrivacyOptionsForm();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('[AdMob] Show consent form failed:', message);
    throw error;
  }
}


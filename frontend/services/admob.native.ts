/**
 * Native-only AdMob + UMP implementation (iOS / Android).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from '../utils/logger';

let isInitialized = false;
let initializeAdsPromise: Promise<void> | null = null;
let consentFlowPromise: Promise<void> | null = null;
let showPrivacyOptionsPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initializeAds(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.appOwnership === 'expo') return;
  if (isInitialized) return;
  if (initializeAdsPromise) {
    await initializeAdsPromise;
    return;
  }

  initializeAdsPromise = (async () => {
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

      consentFlowPromise = (async () => {
        await AdsConsent.requestInfoUpdate(options);
        await AdsConsent.loadAndShowConsentFormIfRequired();
      })();
      await consentFlowPromise;

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
    } finally {
      consentFlowPromise = null;
      initializeAdsPromise = null;
    }
  })();

  await initializeAdsPromise;
}

export async function showConsentForm(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (showPrivacyOptionsPromise) {
    await showPrivacyOptionsPromise;
    return true;
  }

  let opened = false;
  showPrivacyOptionsPromise = (async () => {
    await initializeAds();
    const { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } = await import(
      'react-native-google-mobile-ads'
    );

    if (consentFlowPromise) {
      await consentFlowPromise;
    }

    // Ensure latest consent state is available before trying to open privacy options.
    for (let i = 0; i < 3; i += 1) {
      await AdsConsent.requestInfoUpdate();
      const info = await AdsConsent.getConsentInfo();
      if (info.privacyOptionsRequirementStatus !== AdsConsentPrivacyOptionsRequirementStatus.UNKNOWN) {
        break;
      }
      await sleep(350);
    }

    const retryDelays = [400, 800, 1200];
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      try {
        await AdsConsent.showPrivacyOptionsForm();
        opened = true;
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isLoadingError = message.includes('privacy options form is being loaded');
        const hasRetryRemaining = attempt < retryDelays.length;

        if (isLoadingError && hasRetryRemaining) {
          logger.debug('[AdMob] Privacy form still loading, retrying', {
            attempt: attempt + 1,
          });
          await sleep(retryDelays[attempt]);
          continue;
        }

        if (message.includes('form is unavailable because it is not required')) {
          logger.info('[AdMob] Privacy options not required for this user/session');
          return;
        }

        logger.warn('[AdMob] Show consent form failed:', message);
        throw error;
      }
    }
  })();

  try {
    await showPrivacyOptionsPromise;
    return opened;
  } finally {
    showPrivacyOptionsPromise = null;
  }
}


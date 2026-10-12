/**
 * Native AdMob long-video / Watch ad slots.
 * LLD: rewarded preferred (rewarded interstitial) with interstitial fallback.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import { ADMOB, isAdsEnabled } from '../constants/admob';
import { createLogger } from '../utils/logger';
import type { AdSlot } from '../utils/longVideoAdSchedule';

const logger = createLogger('LongVideoAds');
const AD_LOAD_TIMEOUT_MS = 12000;

function platformUnits() {
  return Platform.OS === 'ios' ? ADMOB.ios : ADMOB.android;
}

function isConfiguredUnit(id?: string): id is string {
  return !!id && !id.includes('XXXXXXXXXX');
}

/**
 * Show one ad slot. Prefers rewarded interstitial → rewarded → interstitial.
 * Resolves when ad closed or skipped (no fill / Expo Go / disabled).
 */
function adsModuleIsLinked(): boolean {
  // Expo Go has no RNGoogleMobileAdsModule. Requiring the package calls
  // TurboModuleRegistry.getEnforcing and crashes the Watch screen before play.
  if (Constants.appOwnership === 'expo' || Platform.OS === 'web') return false;
  try {
    if (TurboModuleRegistry.get?.('RNGoogleMobileAdsModule')) return true;
  } catch {
    return false;
  }
  return !!NativeModules.RNGoogleMobileAdsModule;
}

export async function showLongVideoAdSlot(slot: AdSlot): Promise<'completed' | 'skipped'> {
  if (!isAdsEnabled() || !adsModuleIsLinked()) {
    return 'skipped';
  }

  let ads: any;
  try {
    ads = require('react-native-google-mobile-ads');
  } catch (e) {
    logger.debug('AdMob module unavailable', e);
    return 'skipped';
  }

  const preferRewarded = slot.preferRewarded || slot.type === 'rewarded';

  if (preferRewarded) {
    if (await showRewardedInterstitial(ads)) return 'completed';
    if (await showRewarded(ads)) return 'completed';
  }

  const ok = await showInterstitial(ads);
  return ok ? 'completed' : 'skipped';
}

function onceResolver() {
  let settled = false;
  return {
    finish(resolve: (v: boolean) => void, value: boolean) {
      if (settled) return false;
      settled = true;
      resolve(value);
      return true;
    },
    get settled() {
      return settled;
    },
  };
}

function showUntilClosed(
  ad: { addAdEventListener: Function; load: () => void; show: () => Promise<unknown> },
  events: { loaded: string; closed: string; error: string },
  resolve: (value: boolean) => void,
  extraUnsubs: Array<() => void> = [],
) {
  const gate = onceResolver();
  const unsubs: Array<() => void> = [...extraUnsubs];
  let loadTimer: ReturnType<typeof setTimeout> | null = null;
  let shown = false;
  const cleanup = () => {
    if (loadTimer) clearTimeout(loadTimer);
    unsubs.forEach((unsub) => {
      try { unsub(); } catch { /* ignore */ }
    });
  };
  unsubs.push(ad.addAdEventListener(events.loaded, () => {
    if (gate.settled || shown) return;
    shown = true;
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = null;
    ad.show().catch(() => {
      cleanup();
      gate.finish(resolve, false);
    });
  }));
  unsubs.push(ad.addAdEventListener(events.closed, () => {
    cleanup();
    gate.finish(resolve, true);
  }));
  unsubs.push(ad.addAdEventListener(events.error, () => {
    cleanup();
    gate.finish(resolve, false);
  }));
  ad.load();
  loadTimer = setTimeout(() => {
    if (shown || gate.settled) return;
    cleanup();
    gate.finish(resolve, false);
  }, AD_LOAD_TIMEOUT_MS);
}

function showInterstitial(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const { InterstitialAd, AdEventType } = ads;
      const id = platformUnits().interstitial;
      if (!isConfiguredUnit(id)) {
        resolve(false);
        return;
      }
      const interstitial = InterstitialAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: false,
      });
      showUntilClosed(interstitial, {
        loaded: AdEventType.LOADED,
        closed: AdEventType.CLOSED,
        error: AdEventType.ERROR,
      }, resolve);
    } catch (e) {
      logger.warn('Interstitial failed', e);
      resolve(false);
    }
  });
}

function showRewarded(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
      const id = platformUnits().rewarded;
      if (!isConfiguredUnit(id)) {
        resolve(false);
        return;
      }
      const rewarded = RewardedAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubEarn = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {});
      showUntilClosed(rewarded, {
        loaded: RewardedAdEventType.LOADED,
        closed: AdEventType.CLOSED,
        error: AdEventType.ERROR,
      }, resolve, [unsubEarn]);
    } catch (e) {
      logger.warn('Rewarded failed', e);
      resolve(false);
    }
  });
}

/** Watch / long-video primary format (AdMob Rewarded Interstitial unit). */
function showRewardedInterstitial(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const { RewardedInterstitialAd, RewardedAdEventType, AdEventType } = ads;
      if (!RewardedInterstitialAd) {
        resolve(false);
        return;
      }
      const id = platformUnits().rewardedInterstitial;
      if (!isConfiguredUnit(id)) {
        resolve(false);
        return;
      }
      const ad = RewardedInterstitialAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubEarn = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {});
      showUntilClosed(ad, {
        loaded: RewardedAdEventType.LOADED,
        closed: AdEventType.CLOSED,
        error: AdEventType.ERROR,
      }, resolve, [unsubEarn]);
    } catch (e) {
      logger.warn('Rewarded interstitial failed', e);
      resolve(false);
    }
  });
}

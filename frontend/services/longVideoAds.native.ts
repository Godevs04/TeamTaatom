/**
 * Native AdMob long-video / Watch ad slots.
 * LLD: rewarded preferred (rewarded interstitial) with interstitial fallback.
 */
import { Platform } from 'react-native';
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
export async function showLongVideoAdSlot(slot: AdSlot): Promise<'completed' | 'skipped'> {
  if (!isAdsEnabled() || Platform.OS === 'web') {
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
  return (resolve: (v: boolean) => void, value: boolean) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };
}

function showInterstitial(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = onceResolver();
    try {
      const { InterstitialAd, AdEventType } = ads;
      const id = platformUnits().interstitial;
      if (!isConfiguredUnit(id)) {
        finish(resolve, false);
        return;
      }
      const interstitial = InterstitialAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        interstitial.show().catch(() => finish(resolve, false));
      });
      const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
        finish(resolve, true);
      });
      const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
        finish(resolve, false);
      });
      interstitial.load();
      setTimeout(() => finish(resolve, false), AD_LOAD_TIMEOUT_MS);
    } catch (e) {
      logger.warn('Interstitial failed', e);
      finish(resolve, false);
    }
  });
}

function showRewarded(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = onceResolver();
    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
      const id = platformUnits().rewarded;
      if (!isConfiguredUnit(id)) {
        finish(resolve, false);
        return;
      }
      const rewarded = RewardedAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubEarn = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {});
      const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show().catch(() => finish(resolve, false));
      });
      const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        unsubEarn();
        unsubLoaded();
        unsubClosed();
        unsubError();
        finish(resolve, true);
      });
      const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        unsubEarn();
        unsubLoaded();
        unsubClosed();
        unsubError();
        finish(resolve, false);
      });
      rewarded.load();
      setTimeout(() => finish(resolve, false), AD_LOAD_TIMEOUT_MS);
    } catch (e) {
      logger.warn('Rewarded failed', e);
      finish(resolve, false);
    }
  });
}

/** Watch / long-video primary format (AdMob Rewarded Interstitial unit). */
function showRewardedInterstitial(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = onceResolver();
    try {
      const { RewardedInterstitialAd, RewardedAdEventType, AdEventType } = ads;
      if (!RewardedInterstitialAd) {
        finish(resolve, false);
        return;
      }
      const id = platformUnits().rewardedInterstitial;
      if (!isConfiguredUnit(id)) {
        finish(resolve, false);
        return;
      }
      const ad = RewardedInterstitialAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubEarn = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {});
      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => finish(resolve, false));
      });
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        unsubEarn();
        unsubLoaded();
        unsubClosed();
        unsubError();
        finish(resolve, true);
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (err: unknown) => {
        logger.debug('Rewarded interstitial error', err);
        unsubEarn();
        unsubLoaded();
        unsubClosed();
        unsubError();
        finish(resolve, false);
      });
      ad.load();
      setTimeout(() => finish(resolve, false), AD_LOAD_TIMEOUT_MS);
    } catch (e) {
      logger.warn('Rewarded interstitial failed', e);
      finish(resolve, false);
    }
  });
}

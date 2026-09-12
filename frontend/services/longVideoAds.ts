import { Platform } from 'react-native';
import { ADMOB, isAdsEnabled } from '../constants/admob';
import { createLogger } from '../utils/logger';
import type { AdSlot } from '../utils/longVideoAdSchedule';

const logger = createLogger('LongVideoAds');

function unitId(kind: 'interstitial' | 'rewarded'): string {
  const platform = Platform.OS === 'ios' ? ADMOB.ios : ADMOB.android;
  if (kind === 'rewarded') {
    return (platform as typeof ADMOB.android & { rewarded?: string }).rewarded || '';
  }
  return platform.interstitial;
}

/**
 * Show one ad slot. Prefers rewarded when preferRewarded; falls back to interstitial.
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
    const ok = await showRewarded(ads);
    if (ok) return 'completed';
  }

  const ok = await showInterstitial(ads);
  return ok ? 'completed' : 'skipped';
}

function showInterstitial(ads: any): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const { InterstitialAd, AdEventType } = ads;
      const id = unitId('interstitial');
      if (!id || id.includes('XXXXXXXXXX')) {
        resolve(false);
        return;
      }
      const interstitial = InterstitialAd.createForAdRequest(id, { requestNonPersonalizedAdsOnly: false });
      const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        interstitial.show().catch(() => resolve(false));
      });
      const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
        resolve(true);
      });
      const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
        resolve(false);
      });
      interstitial.load();
      setTimeout(() => resolve(false), 12000);
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
      const id = unitId('rewarded');
      if (!id) {
        resolve(false);
        return;
      }
      const rewarded = RewardedAd.createForAdRequest(id, { requestNonPersonalizedAdsOnly: false });
      let earned = false;
      const unsubEarn = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      const unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        rewarded.show().catch(() => resolve(false));
      });
      const unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        unsubEarn();
        unsubLoaded();
        unsubClosed();
        unsubError();
        resolve(earned || true);
      });
      const unsubError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
        unsubEarn();
        unsubLoaded();
        unsubClosed();
        unsubError();
        resolve(false);
      });
      rewarded.load();
      setTimeout(() => resolve(false), 12000);
    } catch (e) {
      logger.warn('Rewarded failed', e);
      resolve(false);
    }
  });
}

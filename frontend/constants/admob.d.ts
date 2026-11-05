export const ADMOB: {
  publisherId: string;
  forceTestAds: boolean;
  android: {
    banner: string;
    interstitial: string;
    rewarded: string;
    rewardedInterstitial: string;
    native: string;
    feedNative: string;
  };
  ios: {
    banner: string;
    interstitial: string;
    rewarded: string;
    rewardedInterstitial: string;
    native: string;
    feedNative: string;
  };
};

export function isAdsEnabled(): boolean;

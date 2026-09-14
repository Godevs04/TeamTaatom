export const ADMOB: {
  publisherId: string;
  forceTestAds: boolean;
  android: {
    banner: string;
    interstitial: string;
    rewarded: string;
    rewardedInterstitial: string;
    native: string;
  };
  ios: {
    banner: string;
    interstitial: string;
    rewarded: string;
    rewardedInterstitial: string;
    native: string;
  };
};

export function isAdsEnabled(): boolean;

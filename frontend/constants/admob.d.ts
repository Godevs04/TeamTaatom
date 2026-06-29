export const ADMOB: {
  publisherId: string;
  forceTestAds: boolean;
  android: { banner: string; interstitial: string; native: string };
  ios: { banner: string; interstitial: string; native: string };
};

export function isAdsEnabled(): boolean;

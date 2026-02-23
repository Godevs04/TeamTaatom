/**
 * AdMob banner component for Taatom.
 * Renders a banner ad when running on native (iOS/Android). No-op on web.
 *
 * Usage: <AdBanner /> or <AdBanner size="LARGE_BANNER" />
 *
 * 1. Replace placeholder App IDs in app.json (androidAppId / iosAppId) with your AdMob app IDs (ca-app-pub-6362359854606661~XXXXXXXXXX).
 * 2. Replace placeholder ad unit IDs in constants/admob.js with your banner/interstitial unit IDs from AdMob.
 */

import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { ADMOB } from '../constants/admob';

const isWeb = Platform.OS === 'web';

export function AdBanner({ size = 'BANNER' }) {
  const unitId = useMemo(() => {
    if (Platform.OS === 'android') return ADMOB.android.banner;
    if (Platform.OS === 'ios') return ADMOB.ios.banner;
    return null;
  }, []);

  if (isWeb || !unitId || unitId.includes('XXXXXXXXXX')) {
    return null;
  }

  try {
    const { BannerAd, BannerAdSize } = require('react-native-google-mobile-ads');
    const adSize = typeof size === 'string' ? BannerAdSize[size] || BannerAdSize.BANNER : size;

    return (
      <BannerAd
        unitId={unitId}
        size={adSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {}}
        onAdFailedToLoad={(error) => {
          if (__DEV__) {
            console.warn('[AdBanner] Failed to load ad:', error?.message || error);
          }
        }}
      />
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('[AdBanner] react-native-google-mobile-ads not available:', e?.message);
    }
    return null;
  }
}

export default AdBanner;

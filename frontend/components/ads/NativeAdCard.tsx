/**
 * NativeAdCard – Reusable Native Advanced Ad component for in-feed placement.
 *
 * Uses react-native-google-mobile-ads Native Ad API. Renders headline, body, icon,
 * call-to-action, and media (image/video) when available. Complies with AdMob
 * policy: shows "Sponsored" label, no auto-click or incentivized clicks.
 *
 * Development vs Production: In __DEV__ we use test ad unit IDs from ADMOB config
 * (already set to Google's test IDs in constants/admob.js). In production builds
 * use the real Native Ad Unit ID (ca-app-pub-6362359854606661/3257756403).
 * Apple policy: never use production ad unit IDs in development to avoid invalid traffic.
 */

import React, { useEffect, useState, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import { ADMOB } from '../../constants/admob';

const isWeb = Platform.OS === 'web';
const isExpoGo = Constants.appOwnership === 'expo';

// Do NOT require('react-native-google-mobile-ads') at module load. It triggers
// TurboModuleRegistry and crashes in Expo Go / when native module isn't linked.
// We load the module lazily inside the component (useEffect) and guard render.

export type NativeAdCardProps = {
  /** Unique key for list stability; used to avoid re-loading same slot on re-mount */
  adIndex: number;
  /** Fired exactly once when the ad finishes loading and is about to render.
   *  Used by the home-feed cap tracker to count Google ad impressions toward
   *  the 5-per-8h limit. Does NOT fire if the ad fails to load (no impression
   *  to count in that case). */
  onImpression?: () => void;
  /** Fired when this slot cannot render an ad. The parent should remove the slot
   *  from its data array so the slot does not occupy a blank space in the feed. */
  onLoadFailed?: () => void;
};

type AdsModule = {
  NativeAd: typeof import('react-native-google-mobile-ads').NativeAd;
  NativeAdView: React.ComponentType<any>;
  NativeMediaView: React.ComponentType<any>;
  NativeAsset: React.ComponentType<any>;
  NativeAssetType: typeof import('react-native-google-mobile-ads').NativeAssetType;
};

function NativeAdCardComponent({ adIndex, onImpression, onLoadFailed }: NativeAdCardProps) {
  const { theme } = useTheme();
  const [adsModule, setAdsModule] = useState<AdsModule | null>(null);
  const [moduleError, setModuleError] = useState(false);
  const [nativeAd, setNativeAd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const destroyedRef = useRef(false);
  // Fire onImpression at most once per ad load. Cleared when the ad is
  // destroyed (effect cleanup) so a re-load fires it again.
  const impressionFiredRef = useRef(false);

  const unitId = Platform.OS === 'android' ? ADMOB.android.native : ADMOB.ios.native;

  // Refs to fire onLoadFailed at most once per slot, regardless of which
  // failure path triggered it. Without these, the parent could be told to
  // remove the slot multiple times (re-render churn) or get stuck in a loop.
  const failureFiredRef = useRef(false);
  const onLoadFailedRef = useRef(onLoadFailed);
  onLoadFailedRef.current = onLoadFailed;
  const fireLoadFailed = () => {
    if (failureFiredRef.current) return;
    failureFiredRef.current = true;
    try { onLoadFailedRef.current?.(); } catch { /* swallow */ }
  };

  // Lazy-load the native ads module only on mount. Never require() in Expo Go — native module is not registered and require() throws.
  useEffect(() => {
    if (isWeb || isExpoGo) {
      setLoading(false);
      setModuleError(true);
      fireLoadFailed();
      return;
    }
    try {
      const ads = require('react-native-google-mobile-ads');
      setAdsModule({
        NativeAd: ads.NativeAd,
        NativeAdView: ads.NativeAdView,
        NativeMediaView: ads.NativeMediaView,
        NativeAsset: ads.NativeAsset,
        NativeAssetType: ads.NativeAssetType,
      });
    } catch {
      setModuleError(true);
      setLoading(false);
      fireLoadFailed();
    }
  }, []);

  // Load the native ad once the module is available. Optional: preload one ad in a ref and reuse to reduce load cycles.
  useEffect(() => {
    if (!adsModule || !unitId || unitId.includes('XXXXXXXXXX')) {
      if (adsModule === null && !moduleError) return;
      setLoading(false);
      setError(true);
      if (unitId && unitId.includes('XXXXXXXXXX')) fireLoadFailed();
      return;
    }

    destroyedRef.current = false;
    setLoading(true);
    setError(false);

    adsModule.NativeAd.createForAdRequest(unitId)
      .then((ad) => {
        if (destroyedRef.current) {
          ad.destroy();
          return;
        }
        setNativeAd(ad);
        setLoading(false);
        // Fire impression for the cap tracker as soon as the ad is loaded
        // and accepted (not destroyed). Guarded so a render thrash can't
        // double-count the same load.
        if (!impressionFiredRef.current) {
          impressionFiredRef.current = true;
          try { onImpression?.(); } catch { /* swallow */ }
        }
      })
      .catch(() => {
        if (!destroyedRef.current) {
          setError(true);
          setLoading(false);
          fireLoadFailed();
        }
      });

    return () => {
      destroyedRef.current = true;
      impressionFiredRef.current = false;
      setNativeAd((prev: any) => {
        if (prev) {
          prev.destroy();
        }
        return null;
      });
    };
    // onImpression deliberately NOT a dep — including it would re-run the
    // ad load every time the parent re-creates the callback, leaking ad
    // requests and double-counting impressions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adsModule, unitId, adIndex]);

  if (isWeb || moduleError) {
    return null;
  }

  if (!adsModule) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.wrapper, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.placeholder}>
          <LoadingGlobe size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !nativeAd) {
    return null;
  }

  const { NativeAdView: AdView, NativeAsset: Asset, NativeAssetType: AssetType, NativeMediaView: MediaView } = adsModule;
  const hasMedia = !!nativeAd.mediaContent;

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.surface }]}>
      <AdView
        nativeAd={nativeAd}
        style={[styles.nativeAdView, { minHeight: hasMedia ? 280 : 120 }]}
      >
          <View style={[styles.sponsoredRow, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.sponsoredLabel, { color: theme.colors.textSecondary }]}>
              Sponsored
            </Text>
          </View>
          <View style={styles.content}>
            <View style={styles.topRow}>
              {nativeAd.icon && (
                <Asset assetType={AssetType.ICON}>
                  <Image
                    source={{ uri: nativeAd.icon.url }}
                    style={[styles.icon, { backgroundColor: theme.colors.background }]}
                    resizeMode="cover"
                  />
                </Asset>
              )}
              <View style={styles.headlineBody}>
                <Asset assetType={AssetType.HEADLINE}>
                  <Text
                    style={[styles.headline, { color: theme.colors.text }]}
                    numberOfLines={2}
                  >
                    {nativeAd.headline}
                  </Text>
                </Asset>
                {nativeAd.body ? (
                  <Asset assetType={AssetType.BODY}>
                    <Text
                      style={[styles.body, { color: theme.colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {nativeAd.body}
                    </Text>
                  </Asset>
                ) : null}
              </View>
            </View>
            {nativeAd.mediaContent ? (
              <View style={styles.mediaWrapper}>
                <MediaView style={styles.media} />
              </View>
            ) : null}
            <Asset assetType={AssetType.CALL_TO_ACTION}>
              <Text
                style={[styles.cta, { color: theme.colors.primary }]}
                numberOfLines={1}
              >
                {nativeAd.callToAction}
              </Text>
            </Asset>
          </View>
      </AdView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sponsoredRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sponsoredLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  nativeAdView: {
    padding: 12,
  },
  content: {
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  headlineBody: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  mediaWrapper: {
    width: '100%',
    aspectRatio: 1.91,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  cta: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const NativeAdCard = memo(NativeAdCardComponent);
export default NativeAdCard;

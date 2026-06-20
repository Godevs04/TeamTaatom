/**
 * ShortsNativeAd – Full-screen vertical native ad for Shorts (reels) feed.
 *
 * Uses NativeAd.createForAdRequest() with startVideoMuted: true (no auto-play sound).
 * Production: ADMOB native unit ID. Development: Google test native ID.
 * Layout: Media fills screen, dark gradient overlay, "Sponsored" top-left, headline + CTA near bottom.
 * Policy: Clear "Sponsored" label, no auto-click, no misleading UI. Safe-area aware.
 */

import React, { useEffect, useState, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Image,
  useWindowDimensions,
  Animated,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { ADMOB } from '../../constants/admob';
import logger from '../../utils/logger';
import { initializeAds } from '../../services/admob';

const isWeb = Platform.OS === 'web';
const isExpoGo = Constants.appOwnership === 'expo';
const NATIVE_AD_LOAD_TIMEOUT_MS = 12000;

type AdsModule = {
  NativeAd: typeof import('react-native-google-mobile-ads').NativeAd;
  NativeAdView: React.ComponentType<any>;
  NativeMediaView: React.ComponentType<any>;
  NativeAsset: React.ComponentType<any>;
  NativeAssetType: typeof import('react-native-google-mobile-ads').NativeAssetType;
  AdEventType: { IMPRESSION: string };
  NativeMediaAspectRatio: typeof import('react-native-google-mobile-ads').NativeMediaAspectRatio;
  NativeAdChoicesPlacement: typeof import('react-native-google-mobile-ads').NativeAdChoicesPlacement;
};

const maskAdUnitId = (unitId?: string) => {
  if (!unitId) return 'missing';
  const [publisher, unit] = unitId.split('/');
  return unit ? `${publisher}/${unit.slice(0, 3)}...${unit.slice(-3)}` : `${unitId.slice(0, 12)}...`;
};

export type ShortsNativeAdProps = {
  adIndex: number;
  /** Height for the ad cell (e.g. SHORTS_ITEM_HEIGHT). Defaults to window height minus tab bar. */
  height?: number;
  /** When true, ad fills the parent (position absolute, 100% size) to match full Shorts cell. */
  fillParent?: boolean;
  /** Called when the ad fires an impression (observe-only; e.g. analytics). */
  onImpression?: () => void;
  /** Fired when this slot cannot render an ad (Expo Go / web stub, module load
   *  failure, no-fill, ad request rejection, or placeholder unit ID). The
   *  parent should remove the slot from its data array — otherwise the slot
   *  occupies a SHORTS_ITEM_HEIGHT cell with the black `shortItem` background
   *  and the user sees a blank dark screen at that scroll position. */
  onLoadFailed?: () => void;
};

function ShortsNativeAdComponent({ adIndex, height: propHeight, fillParent, onImpression, onLoadFailed }: ShortsNativeAdProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [adsModule, setAdsModule] = useState<AdsModule | null>(null);
  const [moduleError, setModuleError] = useState(false);
  const [nativeAd, setNativeAd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const destroyedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const unitId = Platform.OS === 'android' ? ADMOB.android.native : ADMOB.ios.native;
  const TAB_BAR = Platform.OS === 'web' ? 70 : 88;
  const height = propHeight ?? windowHeight - TAB_BAR;

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

  const onImpressionRef = useRef(onImpression);
  onImpressionRef.current = onImpression;

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
        AdEventType: ads.AdEventType,
        NativeMediaAspectRatio: ads.NativeMediaAspectRatio,
        NativeAdChoicesPlacement: ads.NativeAdChoicesPlacement,
      });
    } catch (err) {
      logger.error('[AdMob] Failed to load react-native-google-mobile-ads module in Shorts', err, {
        platform: Platform.OS,
        isExpoGo,
      });
      setModuleError(true);
      setLoading(false);
      fireLoadFailed();
    }
  }, []);

  useEffect(() => {
    if (!adsModule || !unitId || unitId.includes('XXXXXXXXXX')) {
      if (adsModule === null && !moduleError) return;
      setLoading(false);
      setError(true);
      // Placeholder unit ID is a permanent misconfiguration, not transient —
      // tell the parent so it stops trying to insert ad slots this session.
      if (unitId && unitId.includes('XXXXXXXXXX')) fireLoadFailed();
      return;
    }

    destroyedRef.current = false;
    setLoading(true);
    setError(false);

    logger.debug('[AdMob] Loading shorts native ad', {
      platform: Platform.OS,
      unitId: maskAdUnitId(unitId),
      adIndex,
      dev: __DEV__,
    });

    let requestTimedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const adRequest = initializeAds()
      .then(() =>
        adsModule.NativeAd.createForAdRequest(unitId, {
          startVideoMuted: true,
          aspectRatio: adsModule.NativeMediaAspectRatio.ANY,
          adChoicesPlacement: adsModule.NativeAdChoicesPlacement.TOP_RIGHT,
        })
      )
      .then((ad) => {
        if (requestTimedOut || destroyedRef.current) {
          ad.destroy();
        }
        return ad;
      });
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        requestTimedOut = true;
        reject(new Error(`Native ad request timed out after ${NATIVE_AD_LOAD_TIMEOUT_MS}ms`));
      }, NATIVE_AD_LOAD_TIMEOUT_MS);
    });

    Promise.race([adRequest, timeout])
      .then((ad) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (destroyedRef.current) {
          ad.destroy();
          return;
        }
        logger.info('[AdMob] Shorts native ad loaded', {
          platform: Platform.OS,
          unitId: maskAdUnitId(unitId),
          adIndex,
        });
        // Observe impression only; do not manipulate
        if (adsModule.AdEventType?.IMPRESSION && typeof ad.addAdEventListener === 'function') {
          ad.addAdEventListener(adsModule.AdEventType.IMPRESSION as any, () => {
            onImpressionRef.current?.();
          });
        }
        setNativeAd(ad);
        setLoading(false);
      })
      .catch((loadError) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (!destroyedRef.current) {
          logger.error('[AdMob] Shorts native ad failed to load', loadError, {
            platform: Platform.OS,
            unitId: maskAdUnitId(unitId),
            adIndex,
          });
          setError(true);
          setLoading(false);
          // No-fill / network / SDK error — bubble up so parent can drop the slot.
          fireLoadFailed();
        }
      });

    return () => {
      destroyedRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
      setNativeAd((prev: any) => {
        if (prev) prev.destroy();
        return null;
      });
    };
  }, [adsModule, unitId, adIndex]);

  // Fade in over 200ms when ad is ready (must be before any early return to keep hook order stable)
  useEffect(() => {
    if (nativeAd) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [nativeAd]);

  if (isWeb || moduleError) return null;
  if (!adsModule) return null;

  if (loading) {
    const loadingStyle = fillParent
      ? [styles.container, styles.containerFill, { backgroundColor: '#0a0a0f' }]
      : [styles.container, { height, backgroundColor: '#0a0a0f' }];
    return (
      <View style={loadingStyle}>
        <LoadingGlobe size="large" color="rgba(255,255,255,0.6)" style={styles.loader} />
      </View>
    );
  }

  if (error || !nativeAd) return null;

  const { NativeAdView: AdView, NativeAsset: Asset, NativeAssetType: AssetType, NativeMediaView: MediaView } = adsModule;
  const topInset = insets.top;
  const bottomInset = insets.bottom;

  const containerStyle = fillParent
    ? [styles.container, styles.containerFill, { opacity: fadeAnim }]
    : [styles.container, { height, opacity: fadeAnim }];

  return (
    <Animated.View style={containerStyle}>
      <AdView nativeAd={nativeAd} style={StyleSheet.absoluteFill}>
        {/* Media fills screen (reel-style) */}
        {nativeAd.mediaContent ? (
          <View style={StyleSheet.absoluteFill}>
            <MediaView style={styles.media} />
          </View>
        ) : null}

        {/* Dark gradient overlay for readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.35, 1]}
          style={[StyleSheet.absoluteFill, styles.overlay]}
          pointerEvents="none"
        />

        {/* Sponsored – top-left, inside safe area */}
        <View style={[styles.sponsoredWrap, { top: topInset + 12 }]} pointerEvents="none">
          <Text style={styles.sponsoredLabel}>Sponsored</Text>
        </View>

        {/* Headline Container View - direct child of AdView */}
        <View style={[styles.headlineContainer, { bottom: bottomInset + 80 }]}>
          <Asset assetType={AssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={2}>
              {nativeAd.headline}
            </Text>
          </Asset>
        </View>

        {/* CTA Container View - direct child of AdView */}
        <View style={[styles.ctaContainer, { bottom: bottomInset + 24 }]}>
          <Asset assetType={AssetType.CALL_TO_ACTION}>
            <View style={styles.ctaWrap}>
              <Text style={styles.ctaText} numberOfLines={1}>
                {nativeAd.callToAction}
              </Text>
            </View>
          </Asset>
        </View>
      </AdView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0a0a0f',
  },
  containerFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -20,
  },
  media: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sponsoredWrap: {
    position: 'absolute',
    left: 16,
  },
  sponsoredLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.8)',
  },
  headlineContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  ctaContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  headline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ctaWrap: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0f',
  },
});

export const ShortsNativeAd = memo(ShortsNativeAdComponent);
export default ShortsNativeAd;

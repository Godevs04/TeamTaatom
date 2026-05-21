/**
 * Single native ad slot for Connect website preview screens.
 * Picks Google AdMob vs TAATOM private ad per global cap + per-website revisit rules.
 */

import React, { memo, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { NativeAdCard } from './NativeAdCard';
import { TaatomPrivateAd } from './TaatomPrivateAd';
import {
  markWebsiteShown,
  recordGoogleAdImpression,
  useAdCap,
} from '../../services/adCap';
import { resolveConnectWebsiteAdKind } from '../../utils/connectWebsiteAd';

const isWeb = Platform.OS === 'web';
const isExpoGo = Constants.appOwnership === 'expo';

export type ConnectWebsiteAdProps = {
  /** Connect page _id — unique website key for cap / revisit dedup */
  pageId: string;
  /** Owners previewing their own site should not see monetized ads */
  skipAds?: boolean;
};

function ConnectWebsiteAdComponent({ pageId, skipAds }: ConnectWebsiteAdProps) {
  const adCap = useAdCap();
  const markedGoogleRef = useRef(false);

  const kind = useMemo(
    () => resolveConnectWebsiteAdKind(pageId, { skipAds: skipAds || isWeb || isExpoGo }),
    // Re-evaluate when cap flips so a mount during load can pick up persisted state.
    [pageId, skipAds, adCap.isCapped, adCap.count],
  );

  const onGoogleImpression = useCallback(() => {
    if (markedGoogleRef.current) return;
    markedGoogleRef.current = true;
    void recordGoogleAdImpression();
    void markWebsiteShown(pageId);
  }, [pageId]);

  if (kind === 'none') return null;

  if (kind === 'google') {
    return <NativeAdCard adIndex={0} onImpression={onGoogleImpression} />;
  }

  return <TaatomPrivateAd placementId={pageId} />;
}

export const ConnectWebsiteAd = memo(ConnectWebsiteAdComponent);
export default ConnectWebsiteAd;

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  ensureAttResolvedBeforeAds,
  getAttStatus,
  getCanServePersonalizedAds,
  requestAttPermission,
  type AttStatus,
} from '../services/attPermission';
import { isAdsEnabled } from '../constants/admob';

type UseAppTrackingPermissionResult = {
  status: AttStatus;
  requestPermission: () => Promise<AttStatus>;
  canServePersonalizedAds: boolean;
  isLoading: boolean;
};

/**
 * Exposes iOS ATT state for UI/settings. ATT is requested during app startup
 * (before AdMob init) when ads are enabled — not from this hook directly.
 */
export function useAppTrackingPermission(): UseAppTrackingPermissionResult {
  const [status, setStatus] = useState<AttStatus>('unavailable');
  const [canServePersonalizedAds, setCanServePersonalizedAds] = useState(false);
  const [isLoading, setIsLoading] = useState(Platform.OS === 'ios' && isAdsEnabled());

  const refresh = useCallback(async () => {
    if (!isAdsEnabled()) {
      setStatus('unavailable');
      setCanServePersonalizedAds(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await ensureAttResolvedBeforeAds();
      const nextStatus = await getAttStatus();
      setStatus(nextStatus);
      setCanServePersonalizedAds(getCanServePersonalizedAds());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    const nextStatus = await requestAttPermission();
    setStatus(nextStatus);
    setCanServePersonalizedAds(getCanServePersonalizedAds());
    return nextStatus;
  }, []);

  return {
    status,
    requestPermission,
    canServePersonalizedAds,
    isLoading,
  };
}

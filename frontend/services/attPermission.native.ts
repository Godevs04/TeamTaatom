/**
 * App Tracking Transparency (ATT) — iOS 14.5+ only.
 *
 * Apple requires requesting ATT before accessing IDFA for personalized ads.
 * If the user denies or restricts tracking, AdMob must use non-personalized ads
 * (requestNonPersonalizedAdsOnly: true) so we never track before consent.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
  isAvailable as isTrackingTransparencyAvailable,
} from 'expo-tracking-transparency';
import { PermissionStatus } from 'expo-modules-core';
import { isAdsEnabled } from '../constants/admob';
import logger from '../utils/logger';

export type AttStatus = 'unavailable' | 'undetermined' | 'granted' | 'denied' | 'restricted';

const ATT_FLOW_COMPLETED_KEY = 'taatom_att_flow_completed_v1';

let resolvePromise: Promise<boolean> | null = null;
let canServePersonalizedAds = true;
let lastStatus: AttStatus = 'unavailable';

function parseIosVersion(): { major: number; minor: number } {
  const raw = Platform.Version;
  const version = typeof raw === 'string' ? raw : String(raw);
  const [majorStr, minorStr] = version.split('.');
  return {
    major: Number.parseInt(majorStr ?? '0', 10) || 0,
    minor: Number.parseInt(minorStr ?? '0', 10) || 0,
  };
}

/** ATT prompt is required only on iOS 14.5 and newer. */
export function isIosAttRequired(): boolean {
  if (Platform.OS !== 'ios') return false;
  const { major, minor } = parseIosVersion();
  if (major > 14) return true;
  if (major === 14 && minor >= 5) return true;
  return false;
}

function mapPermissionStatus(status: PermissionStatus): AttStatus {
  switch (status) {
    case PermissionStatus.GRANTED:
      return 'granted';
    case PermissionStatus.DENIED:
      return 'denied';
    case PermissionStatus.UNDETERMINED:
      return 'undetermined';
    default:
      return 'restricted';
  }
}

function statusAllowsPersonalizedAds(status: AttStatus): boolean {
  return status === 'granted' || status === 'unavailable';
}

async function markAttFlowCompleted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ATT_FLOW_COMPLETED_KEY, '1');
  } catch (error) {
    logger.warn('[ATT] Failed to persist flow completion (non-blocking):', error);
  }
}

async function hasAttFlowCompleted(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ATT_FLOW_COMPLETED_KEY);
    return value === '1';
  } catch {
    return false;
  }
}

async function refreshFromSystemPermission(): Promise<AttStatus> {
  if (Platform.OS !== 'ios' || !isTrackingTransparencyAvailable()) {
    lastStatus = 'unavailable';
    canServePersonalizedAds = true;
    return lastStatus;
  }

  try {
    const response = await getTrackingPermissionsAsync();
    lastStatus = mapPermissionStatus(response.status);
  } catch (error) {
    logger.warn('[ATT] getTrackingPermissionsAsync failed; using non-personalized ads:', error);
    lastStatus = 'denied';
  }

  canServePersonalizedAds = statusAllowsPersonalizedAds(lastStatus);
  return lastStatus;
}

/**
 * Request ATT on iOS 14.5+ before AdMob init. Skipped on Android, web, Expo Go,
 * when ads are disabled, or when iOS < 14.5.
 */
export async function ensureAttResolvedBeforeAds(): Promise<boolean> {
  if (!isAdsEnabled()) {
    lastStatus = 'unavailable';
    canServePersonalizedAds = false;
    return false;
  }

  if (Platform.OS !== 'ios') {
    lastStatus = 'unavailable';
    canServePersonalizedAds = true;
    return true;
  }

  if (!isIosAttRequired()) {
    lastStatus = 'unavailable';
    canServePersonalizedAds = true;
    await markAttFlowCompleted();
    return true;
  }

  if (!isTrackingTransparencyAvailable()) {
    lastStatus = 'unavailable';
    canServePersonalizedAds = true;
    await markAttFlowCompleted();
    return true;
  }

  if (resolvePromise) {
    return resolvePromise;
  }

  resolvePromise = (async () => {
    try {
      await refreshFromSystemPermission();

      // Show the system ATT dialog only while status is undetermined.
      // iOS remembers granted/denied; SecureStore records that we completed our flow.
      if (lastStatus === 'undetermined') {
        logger.info('[ATT] Requesting App Tracking Transparency permission');
        try {
          const response = await requestTrackingPermissionsAsync();
          lastStatus = mapPermissionStatus(response.status);
        } catch (error) {
          logger.warn('[ATT] requestTrackingPermissionsAsync failed; using non-personalized ads:', error);
          lastStatus = 'denied';
        }
        await markAttFlowCompleted();
      } else {
        const completed = await hasAttFlowCompleted();
        if (!completed) {
          await markAttFlowCompleted();
        }
      }

      canServePersonalizedAds = statusAllowsPersonalizedAds(lastStatus);
      logger.info('[ATT] Resolved', {
        status: lastStatus,
        canServePersonalizedAds,
      });
      return canServePersonalizedAds;
    } finally {
      resolvePromise = null;
    }
  })();

  return resolvePromise;
}

export function getCanServePersonalizedAds(): boolean {
  return canServePersonalizedAds;
}

export async function getAttStatus(): Promise<AttStatus> {
  if (!isAdsEnabled() || Platform.OS !== 'ios') {
    return 'unavailable';
  }
  if (!isIosAttRequired() || !isTrackingTransparencyAvailable()) {
    return 'unavailable';
  }
  return refreshFromSystemPermission();
}

/** Manual re-check; iOS will not re-show the dialog after the user has decided. */
export async function requestAttPermission(): Promise<AttStatus> {
  if (!isAdsEnabled() || Platform.OS !== 'ios' || !isIosAttRequired()) {
    return 'unavailable';
  }
  if (!isTrackingTransparencyAvailable()) {
    return 'unavailable';
  }

  await refreshFromSystemPermission();
  if (lastStatus === 'undetermined') {
    try {
      const response = await requestTrackingPermissionsAsync();
      lastStatus = mapPermissionStatus(response.status);
    } catch (error) {
      logger.warn('[ATT] requestAttPermission failed:', error);
      lastStatus = 'denied';
    }
    await markAttFlowCompleted();
  }

  canServePersonalizedAds = statusAllowsPersonalizedAds(lastStatus);
  return lastStatus;
}

/**
 * Store binary update prompts (App Store / Play Store).
 * Separate from OTA (expo-updates) — bumps nativeApplicationVersion.
 */

import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import logger from '../utils/logger';

const LAST_STORE_CHECK_KEY = '@taatom:lastStoreVersionCheck';
const STORE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type PlatformVersionConfig = {
  latest: string;
  minimum: string;
  storeUrl: string;
  message?: string;
};

type MobileVersionPayload = {
  ios?: PlatformVersionConfig;
  android?: PlatformVersionConfig;
};

/** Compare semver-ish strings: a < b → -1, a === b → 0, a > b → 1 */
export function compareSemver(a: string, b: string): number {
  const normalize = (v: string) =>
    String(v || '0')
      .split(/[.+-]/)
      .map((p) => parseInt(p.replace(/\D/g, ''), 10) || 0);
  const pa = normalize(a);
  const pb = normalize(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function getCurrentAppVersion(): string {
  return (
    Application.nativeApplicationVersion ||
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '0.0.0'
  );
}

async function fetchMobileVersionConfig(): Promise<PlatformVersionConfig | null> {
  try {
    const response = await api.get('/api/v1/app-config/mobile-version', {
      timeout: 8000,
    });
    const data = (response.data?.data || response.data) as MobileVersionPayload;
    const platform = Platform.OS === 'ios' ? data.ios : data.android;
    if (!platform?.latest || !platform?.storeUrl) return null;
    return {
      latest: String(platform.latest),
      minimum: String(platform.minimum || '0.0.0'),
      storeUrl: String(platform.storeUrl),
      message: platform.message,
    };
  } catch (error: any) {
    logger.debug('Store version config fetch failed:', error?.message || error);
    return null;
  }
}

function openStore(storeUrl: string) {
  Linking.openURL(storeUrl).catch((err) => {
    logger.warn('Failed to open store URL:', err);
  });
}

function showStoreUpdateAlert(
  config: PlatformVersionConfig,
  blocking: boolean,
) {
  const title = blocking ? 'Update Required' : 'Update Available';
  const body =
    config.message ||
    `Version ${config.latest} is available. Please update Taatom from the store.`;

  if (blocking) {
    Alert.alert(title, body, [
      {
        text: 'Update',
        onPress: () => openStore(config.storeUrl),
      },
    ], { cancelable: false });
    return;
  }

  Alert.alert(title, body, [
    { text: 'Later', style: 'cancel' },
    {
      text: 'Update',
      onPress: () => openStore(config.storeUrl),
    },
  ]);
}

/**
 * Check remote store version vs installed binary.
 * Soft alert when current < latest; blocking when current < minimum.
 */
export async function checkStoreUpdate(options?: {
  force?: boolean;
  showAlertIfUpToDate?: boolean;
}): Promise<{
  updateAvailable: boolean;
  forceRequired: boolean;
  current: string;
  latest?: string;
}> {
  const current = getCurrentAppVersion();
  const force = !!options?.force;

  if (!force) {
    try {
      const last = await AsyncStorage.getItem(LAST_STORE_CHECK_KEY);
      if (last && Date.now() - Number(last) < STORE_CHECK_INTERVAL_MS) {
        return { updateAvailable: false, forceRequired: false, current };
      }
    } catch {
      /* ignore */
    }
  }

  const config = await fetchMobileVersionConfig();
  try {
    await AsyncStorage.setItem(LAST_STORE_CHECK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }

  if (!config) {
    if (options?.showAlertIfUpToDate) {
      Alert.alert(
        'Check for Updates',
        `You are using version ${current}.\n\nCould not reach the update server.`,
      );
    }
    return { updateAvailable: false, forceRequired: false, current };
  }

  const belowMinimum = compareSemver(current, config.minimum) < 0;
  const belowLatest = compareSemver(current, config.latest) < 0;

  if (belowMinimum) {
    showStoreUpdateAlert(config, true);
    return {
      updateAvailable: true,
      forceRequired: true,
      current,
      latest: config.latest,
    };
  }

  if (belowLatest) {
    showStoreUpdateAlert(config, false);
    return {
      updateAvailable: true,
      forceRequired: false,
      current,
      latest: config.latest,
    };
  }

  if (options?.showAlertIfUpToDate) {
    Alert.alert(
      'Check for Updates',
      `You are using the latest store version.\n\nVersion: ${current}`,
    );
  }

  return {
    updateAvailable: false,
    forceRequired: false,
    current,
    latest: config.latest,
  };
}

export const storeUpdateService = {
  checkStoreUpdate,
  compareSemver,
  getCurrentAppVersion,
};
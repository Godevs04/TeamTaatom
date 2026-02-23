/**
 * App Update Service
 * Handles automatic update checking and installation using Expo Updates
 */

import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import logger from '../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy import expo-updates to handle cases where it's not installed
let Updates: any = null;
try {
  Updates = require('expo-updates');
} catch (e) {
  // expo-updates not installed - will be available after npm install
  logger.debug('expo-updates not available (will be installed)');
}

const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const LAST_UPDATE_CHECK_KEY = '@taatom:lastUpdateCheck';
const UPDATE_AVAILABLE_KEY = '@taatom:updateAvailable';

interface UpdateInfo {
  isAvailable: boolean;
  isCritical: boolean;
  version?: string;
  message?: string;
}

class UpdateService {
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private isChecking = false;

  /**
   * Check if updates are enabled.
   * False in __DEV__ (Metro) to avoid crashes when expo-updates runs in dev context.
   * True when: production build, expo-updates available, Updates.isEnabled, and EAS project ID set.
   */
  isEnabled(): boolean {
    if (__DEV__) return false;
    if (!Updates) return false;
    const extra = Constants.expoConfig?.extra ?? {};
    const hasEasProject =
      extra.eas?.projectId !== undefined ||
      (extra.EXPO_PROJECT_ID !== undefined && extra.EXPO_PROJECT_ID !== '');
    return !!(Updates.isEnabled && hasEasProject);
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(showAlert = false): Promise<UpdateInfo> {
    if (!this.isEnabled()) {
      logger.debug('Updates not enabled (development mode or Expo Go)');
      return { isAvailable: false, isCritical: false };
    }

    if (this.isChecking) {
      logger.debug('Update check already in progress');
      return { isAvailable: false, isCritical: false };
    }

    this.isChecking = true;

    try {
      if (!Updates || typeof Updates.checkForUpdateAsync !== 'function') {
        logger.warn('Updates module not available');
        return { isAvailable: false, isCritical: false };
      }
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        logger.info('Update available:', {
          manifestId: update.manifest?.id,
          createdAt: update.manifest?.createdAt,
        });

        // Check if this is a critical update
        const isCritical = this.isCriticalUpdate(update.manifest);

        // Store update info
        await AsyncStorage.setItem(UPDATE_AVAILABLE_KEY, JSON.stringify({
          isAvailable: true,
          isCritical,
          version: update.manifest?.version || Constants.expoConfig?.version,
          message: update.manifest?.extra?.updateMessage,
        }));

        if (showAlert) {
          this.showUpdateAlert(isCritical, update.manifest);
        }

        return {
          isAvailable: true,
          isCritical,
          version: update.manifest?.version || Constants.expoConfig?.version,
          message: update.manifest?.extra?.updateMessage,
        };
      } else {
        logger.debug('No update available');
        await AsyncStorage.removeItem(UPDATE_AVAILABLE_KEY);
        return { isAvailable: false, isCritical: false };
      }
    } catch (error: any) {
      logger.error('Error checking for updates:', error);
      return { isAvailable: false, isCritical: false };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Download and install available update
   */
  async downloadAndInstallUpdate(): Promise<boolean> {
    if (!this.isEnabled()) {
      logger.warn('Updates not enabled');
      return false;
    }

    try {
      if (!Updates) {
        logger.warn('Updates module not available');
        return false;
      }
      logger.info('Downloading update...');
      const result = await Updates.fetchUpdateAsync();

      if (result.isNew) {
        logger.info('Update downloaded, reloading app...');
        await Updates.reloadAsync();
        return true;
      } else {
        logger.debug('No new update to download');
        return false;
      }
    } catch (error: any) {
      logger.error('Error downloading update:', error);
      Alert.alert(
        'Update Failed',
        'Failed to download update. Please try again later.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  /**
   * Check if update should be checked now (based on last check time)
   */
  async shouldCheckForUpdates(): Promise<boolean> {
    try {
      const lastCheck = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
      if (!lastCheck) {
        return true;
      }

      const lastCheckTime = parseInt(lastCheck, 10);
      const now = Date.now();
      return (now - lastCheckTime) >= UPDATE_CHECK_INTERVAL;
    } catch (error) {
      logger.error('Error checking last update time:', error);
      return true; // Default to checking if we can't determine
    }
  }

  /**
   * Check for updates automatically (respects interval)
   */
  async checkForUpdatesIfNeeded(): Promise<UpdateInfo> {
    const shouldCheck = await this.shouldCheckForUpdates();
    if (!shouldCheck) {
      // Check if we already know about an available update
      const storedUpdate = await AsyncStorage.getItem(UPDATE_AVAILABLE_KEY);
      if (storedUpdate) {
        try {
          return JSON.parse(storedUpdate);
        } catch (e) {
          // Invalid stored data, check for updates
        }
      } else {
        return { isAvailable: false, isCritical: false };
      }
    }

    // Update last check time
    await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());

    return await this.checkForUpdates(true);
  }

  /**
   * Start automatic update checking (checks every 24 hours)
   */
  startAutomaticChecking(): void {
    if (!this.isEnabled()) {
      logger.debug('Automatic update checking disabled (development mode)');
      return;
    }

    // Check immediately on start
    this.checkForUpdatesIfNeeded();

    // Then check periodically
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdatesIfNeeded();
    }, UPDATE_CHECK_INTERVAL);

    logger.debug('Automatic update checking started');
  }

  /**
   * Stop automatic update checking
   */
  stopAutomaticChecking(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      logger.debug('Automatic update checking stopped');
    }
  }

  /**
   * Show update alert to user
   */
  private showUpdateAlert(isCritical: boolean, manifest: any): void {
    const message = manifest?.extra?.updateMessage || 
                   'A new version of the app is available. Would you like to update now?';

    if (isCritical) {
      // Critical update - force update
      Alert.alert(
        'Update Required',
        message + '\n\nThis update is required to continue using the app.',
        [
          {
            text: 'Update Now',
            onPress: () => this.downloadAndInstallUpdate(),
            style: 'default',
          },
        ],
        { cancelable: false }
      );
    } else {
      // Optional update
      Alert.alert(
        'Update Available',
        message,
        [
          {
            text: 'Later',
            style: 'cancel',
          },
          {
            text: 'Update Now',
            onPress: () => this.downloadAndInstallUpdate(),
            style: 'default',
          },
        ]
      );
    }
  }

  /**
   * Check if update is critical based on manifest
   */
  private isCriticalUpdate(manifest: any): boolean {
    if (!manifest) return false;

    // Check if manifest has critical flag
    if (manifest.extra?.isCritical === true) {
      return true;
    }

    // Check version difference (major version change might be critical)
    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    const updateVersion = manifest.version || currentVersion;

    const currentParts = currentVersion.split('.').map(Number);
    const updateParts = updateVersion.split('.').map(Number);

    // Major version change (1.x.x -> 2.x.x) is considered critical
    if (updateParts[0] > currentParts[0]) {
      return true;
    }

    return false;
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
  }

  /**
   * Get current build number
   */
  getCurrentBuildNumber(): string {
    if (Platform.OS === 'ios') {
      return Constants.expoConfig?.ios?.buildNumber || '1';
    } else {
      return String(Constants.expoConfig?.android?.versionCode || 1);
    }
  }

  /**
   * Get update channel (production, preview, development)
   */
  getUpdateChannel(): string {
    if (!Updates) return 'default';
    return Updates.channel || 'default';
  }
}

export const updateService = new UpdateService();


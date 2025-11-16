import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { getUserFromStorage } from './auth';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  variant?: string; // For A/B testing variants (A, B, C, etc.)
  metadata?: Record<string, any>;
}

class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map();
  private userId: string | null = null;
  private isInitialized = false;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async initialize() {
    if (this.isInitialized) return;

    const user = await getUserFromStorage();
    this.userId = user?._id || null;

    // Load cached flags
    await this.loadCachedFlags();

    // Fetch fresh flags
    await this.fetchFlags();

    this.isInitialized = true;
  }

  private async loadCachedFlags() {
    try {
      const cached = await AsyncStorage.getItem('feature_flags');
      if (cached) {
        const data = JSON.parse(cached);
        this.flags = new Map(data.flags || []);
        this.lastFetchTime = data.timestamp || 0;
      }
    } catch (error) {
      console.error('Error loading cached feature flags:', error);
    }
  }

  private async saveCachedFlags() {
    try {
      await AsyncStorage.setItem('feature_flags', JSON.stringify({
        flags: Array.from(this.flags.entries()),
        timestamp: this.lastFetchTime,
      }));
    } catch (error) {
      console.error('Error saving cached feature flags:', error);
    }
  }

  async fetchFlags() {
    const now = Date.now();
    
    // Use cache if recent
    if (now - this.lastFetchTime < this.CACHE_DURATION && this.flags.size > 0) {
      return;
    }

    try {
      const response = await api.get('/api/v1/feature-flags', {
        params: {
          userId: this.userId,
          platform: Platform.OS,
        },
      });

      if (response.data?.flags) {
        this.flags = new Map(
          response.data.flags.map((flag: FeatureFlag) => [flag.name, flag])
        );
        this.lastFetchTime = now;
        await this.saveCachedFlags();
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      // Use cached flags on error
    }
  }

  async refresh() {
    this.lastFetchTime = 0; // Force refresh
    await this.fetchFlags();
  }

  isEnabled(flagName: string): boolean {
    const flag = this.flags.get(flagName);
    return flag?.enabled || false;
  }

  getVariant(flagName: string): string | null {
    const flag = this.flags.get(flagName);
    return flag?.variant || null;
  }

  getMetadata(flagName: string): Record<string, any> | null {
    const flag = this.flags.get(flagName);
    return flag?.metadata || null;
  }

  getAllFlags(): Map<string, FeatureFlag> {
    return new Map(this.flags);
  }
}

export const featureFlagsService = new FeatureFlagsService();

// Convenience functions
export const isFeatureEnabled = (flagName: string): boolean => {
  return featureFlagsService.isEnabled(flagName);
};

export const getFeatureVariant = (flagName: string): string | null => {
  return featureFlagsService.getVariant(flagName);
};

export const getFeatureMetadata = (flagName: string): Record<string, any> | null => {
  return featureFlagsService.getMetadata(flagName);
};


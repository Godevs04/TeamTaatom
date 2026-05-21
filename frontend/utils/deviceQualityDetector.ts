import { Platform, Dimensions } from 'react-native';
import * as Device from 'expo-device';
import logger from './logger';

/**
 * Video quality levels supported by the app
 * Each level represents a resolution and bitrate target
 */
export enum VideoQuality {
  LOW = 'low',           // 360p - for low-end devices
  MEDIUM = 'medium',     // 480p - for mid-range devices
  HIGH = 'high',         // 720p - for high-end devices
  ULTRA = 'ultra',       // 1080p - for premium devices
}

/**
 * Device capability profile
 */
interface DeviceCapabilities {
  quality: VideoQuality;
  maxResolution: {
    width: number;
    height: number;
  };
  estimatedRAM: number; // in MB
  screenDensity: number;
  isLowEndDevice: boolean;
  isMidRangeDevice: boolean;
  isHighEndDevice: boolean;
}

/**
 * Quality configuration with resolution and bitrate targets
 */
interface QualityConfig {
  quality: VideoQuality;
  resolution: {
    width: number;
    height: number;
  };
  bitrate: number; // in kbps
  fps: number;
  description: string;
}

/**
 * Detect device capabilities and determine optimal video quality
 * 
 * Strategy:
 * 1. Check device model and known specs
 * 2. Check available RAM
 * 3. Check screen resolution
 * 4. Check platform (iOS vs Android)
 * 5. Return optimal quality level
 */
class DeviceQualityDetector {
  private cachedCapabilities: DeviceCapabilities | null = null;
  private qualityConfigs: Record<VideoQuality, QualityConfig> = {
    [VideoQuality.LOW]: {
      quality: VideoQuality.LOW,
      resolution: { width: 360, height: 640 },
      bitrate: 500,
      fps: 24,
      description: 'Low quality (360p) - for low-end devices',
    },
    [VideoQuality.MEDIUM]: {
      quality: VideoQuality.MEDIUM,
      resolution: { width: 480, height: 854 },
      bitrate: 1000,
      fps: 30,
      description: 'Medium quality (480p) - for mid-range devices',
    },
    [VideoQuality.HIGH]: {
      quality: VideoQuality.HIGH,
      resolution: { width: 720, height: 1280 },
      bitrate: 2500,
      fps: 30,
      description: 'High quality (720p) - for high-end devices',
    },
    [VideoQuality.ULTRA]: {
      quality: VideoQuality.ULTRA,
      resolution: { width: 1080, height: 1920 },
      bitrate: 5000,
      fps: 60,
      description: 'Ultra quality (1080p) - for premium devices',
    },
  };

  /**
   * Get device capabilities and optimal quality
   */
  getDeviceCapabilities(): DeviceCapabilities {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const capabilities = this.detectCapabilities();
    this.cachedCapabilities = capabilities;

    logger.debug('[DeviceQualityDetector] Device capabilities detected:', {
      quality: capabilities.quality,
      maxResolution: capabilities.maxResolution,
      estimatedRAM: capabilities.estimatedRAM,
      isLowEnd: capabilities.isLowEndDevice,
      isMidRange: capabilities.isMidRangeDevice,
      isHighEnd: capabilities.isHighEndDevice,
    });

    return capabilities;
  }

  /**
   * Detect device capabilities
   */
  private detectCapabilities(): DeviceCapabilities {
    const screenDimensions = Dimensions.get('window');
    const screenDensity = screenDimensions.scale || 1;
    const screenWidth = screenDimensions.width;
    const screenHeight = screenDimensions.height;

    // Estimate RAM based on device model
    const estimatedRAM = this.estimateDeviceRAM();

    // Determine quality based on multiple factors
    const quality = this.determineQuality(estimatedRAM, screenWidth, screenHeight);

    // Calculate max resolution based on screen
    const maxResolution = this.calculateMaxResolution(screenWidth, screenHeight);

    return {
      quality,
      maxResolution,
      estimatedRAM,
      screenDensity,
      isLowEndDevice: quality === VideoQuality.LOW,
      isMidRangeDevice: quality === VideoQuality.MEDIUM,
      isHighEndDevice: quality === VideoQuality.HIGH || quality === VideoQuality.ULTRA,
    };
  }

  /**
   * Estimate device RAM based on model
   * Returns estimated RAM in MB
   */
  private estimateDeviceRAM(): number {
    const deviceModel = Device.modelName || '';
    const deviceBrand = Device.brand || '';

    // iOS device estimation
    if (Platform.OS === 'ios') {
      // iPhone models with known RAM
      if (deviceModel.includes('iPhone 15 Pro Max')) return 8192;
      if (deviceModel.includes('iPhone 15 Pro')) return 8192;
      if (deviceModel.includes('iPhone 15 Plus')) return 6144;
      if (deviceModel.includes('iPhone 15')) return 6144;
      if (deviceModel.includes('iPhone 14 Pro Max')) return 6144;
      if (deviceModel.includes('iPhone 14 Pro')) return 6144;
      if (deviceModel.includes('iPhone 14 Plus')) return 6144;
      if (deviceModel.includes('iPhone 14')) return 6144;
      if (deviceModel.includes('iPhone 13 Pro Max')) return 6144;
      if (deviceModel.includes('iPhone 13 Pro')) return 6144;
      if (deviceModel.includes('iPhone 13 mini')) return 4096;
      if (deviceModel.includes('iPhone 13')) return 4096;
      if (deviceModel.includes('iPhone 12 Pro Max')) return 6144;
      if (deviceModel.includes('iPhone 12 Pro')) return 6144;
      if (deviceModel.includes('iPhone 12 mini')) return 4096;
      if (deviceModel.includes('iPhone 12')) return 4096;
      if (deviceModel.includes('iPhone 11 Pro Max')) return 4096;
      if (deviceModel.includes('iPhone 11 Pro')) return 4096;
      if (deviceModel.includes('iPhone 11')) return 4096;
      if (deviceModel.includes('iPhone XS Max')) return 4096;
      if (deviceModel.includes('iPhone XS')) return 4096;
      if (deviceModel.includes('iPhone XR')) return 3072;
      if (deviceModel.includes('iPhone X')) return 3072;
      if (deviceModel.includes('iPhone 8 Plus')) return 3072;
      if (deviceModel.includes('iPhone 8')) return 2048;
      if (deviceModel.includes('iPhone 7 Plus')) return 3072;
      if (deviceModel.includes('iPhone 7')) return 2048;
      // Default for older iPhones
      return 2048;
    }

    // Android device estimation
    if (Platform.OS === 'android') {
      // Samsung Galaxy S series (flagship)
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy S24')) return 12288;
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy S23')) return 8192;
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy S22')) return 8192;
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy S21')) return 8192;
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy S20')) return 8192;
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy S10')) return 8192;

      // Samsung Galaxy A series (mid-range)
      if (deviceBrand.includes('Samsung') && deviceModel.includes('Galaxy A')) return 4096;

      // Google Pixel series
      if (deviceBrand.includes('Google') && deviceModel.includes('Pixel 8')) return 12288;
      if (deviceBrand.includes('Google') && deviceModel.includes('Pixel 7')) return 8192;
      if (deviceBrand.includes('Google') && deviceModel.includes('Pixel 6')) return 8192;

      // OnePlus (flagship)
      if (deviceBrand.includes('OnePlus')) return 8192;

      // Xiaomi (mid-range to flagship)
      if (deviceBrand.includes('Xiaomi')) return 6144;

      // Realme (budget to mid-range)
      if (deviceBrand.includes('Realme')) return 4096;

      // Motorola (mid-range)
      if (deviceBrand.includes('Motorola')) return 4096;

      // Default for unknown Android devices
      return 3072;
    }

    // Default fallback
    return 2048;
  }

  /**
   * Determine optimal video quality based on device capabilities
   */
  private determineQuality(
    estimatedRAM: number,
    screenWidth: number,
    screenHeight: number
  ): VideoQuality {
    // Priority 1: Check RAM (most important for video playback)
    if (estimatedRAM >= 8192) {
      // 8GB+ RAM → Ultra quality
      return VideoQuality.ULTRA;
    }
    if (estimatedRAM >= 6144) {
      // 6GB+ RAM → High quality
      return VideoQuality.HIGH;
    }
    if (estimatedRAM >= 4096) {
      // 4GB+ RAM → Medium quality
      return VideoQuality.MEDIUM;
    }
    if (estimatedRAM >= 3072) {
      // 3GB+ RAM → Medium quality (can handle it)
      return VideoQuality.MEDIUM;
    }
    // Less than 3GB → Low quality
    return VideoQuality.LOW;
  }

  /**
   * Calculate max resolution based on screen dimensions
   */
  private calculateMaxResolution(
    screenWidth: number,
    screenHeight: number
  ): { width: number; height: number } {
    // For portrait orientation (typical for shorts)
    const maxWidth = Math.min(screenWidth, 1080);
    const maxHeight = Math.min(screenHeight, 1920);

    return {
      width: maxWidth,
      height: maxHeight,
    };
  }

  /**
   * Get quality configuration for a specific quality level
   */
  getQualityConfig(quality: VideoQuality): QualityConfig {
    return this.qualityConfigs[quality];
  }

  /**
   * Get all quality configurations
   */
  getAllQualityConfigs(): Record<VideoQuality, QualityConfig> {
    return this.qualityConfigs;
  }

  /**
   * Get recommended quality for current device
   */
  getRecommendedQuality(): VideoQuality {
    return this.getDeviceCapabilities().quality;
  }

  /**
   * Get recommended quality config for current device
   */
  getRecommendedQualityConfig(): QualityConfig {
    const quality = this.getRecommendedQuality();
    return this.getQualityConfig(quality);
  }

  /**
   * Check if device can support a specific quality
   */
  canSupportQuality(quality: VideoQuality): boolean {
    const capabilities = this.getDeviceCapabilities();
    const qualityLevels = [VideoQuality.LOW, VideoQuality.MEDIUM, VideoQuality.HIGH, VideoQuality.ULTRA];
    const currentQualityIndex = qualityLevels.indexOf(capabilities.quality);
    const requestedQualityIndex = qualityLevels.indexOf(quality);

    return requestedQualityIndex <= currentQualityIndex;
  }

  /**
   * Get fallback quality if requested quality is not supported
   */
  getFallbackQuality(quality: VideoQuality): VideoQuality {
    if (this.canSupportQuality(quality)) {
      return quality;
    }

    // Return recommended quality as fallback
    return this.getRecommendedQuality();
  }

  /**
   * Clear cached capabilities (useful for testing)
   */
  clearCache(): void {
    this.cachedCapabilities = null;
  }
}

// Export singleton instance
export const deviceQualityDetector = new DeviceQualityDetector();

// Export types
export type { DeviceCapabilities, QualityConfig };

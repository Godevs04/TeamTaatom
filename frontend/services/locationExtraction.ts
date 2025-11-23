/**
 * Location Extraction Service
 * Handles extraction of location data from photos/videos using multiple strategies
 */

import * as MediaLibrary from 'expo-media-library';
import { getAddressFromCoords } from '../utils/locationUtils';
import { createLogger } from '../utils/logger';

const logger = createLogger('LocationExtractionService');

export interface LocationResult {
  lat: number;
  lng: number;
  address?: string;
}

export class LocationExtractionService {
  /**
   * Extract location from photos/videos using multiple fallback strategies
   */
  static async extractFromPhotos(
    assets: any[],
    selectionTime: number
  ): Promise<LocationResult | null> {
    try {
      // Strategy 1: Try EXIF data from asset ID
      const exifLocation = await this.getLocationFromEXIF(assets);
      if (exifLocation) {
        logger.debug('Location found via EXIF data');
        return exifLocation;
      }

      // Strategy 2: Try MediaLibrary by asset ID
      const idLocation = await this.getLocationByAssetId(assets);
      if (idLocation) {
        logger.debug('Location found via asset ID');
        return idLocation;
      }

      // Strategy 3: Try MediaLibrary by filename matching
      const filenameLocation = await this.getLocationByFilename(assets, selectionTime);
      if (filenameLocation) {
        logger.debug('Location found via filename matching');
        return filenameLocation;
      }

      logger.warn('No location found in photo metadata');
      return null;
    } catch (error) {
      logger.error('Location extraction failed', error);
      return null;
    }
  }

  /**
   * Get location from EXIF data using asset ID
   */
  private static async getLocationFromEXIF(
    assets: any[]
  ): Promise<LocationResult | null> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      for (const asset of assets) {
        const assetId = (asset as any).id;
        if (!assetId) continue;

        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
          const location = this.parseLocation(assetInfo.location);
          
          if (location) {
            const address = await getAddressFromCoords(location.lat, location.lng);
            return { ...location, address };
          }
        } catch (error) {
          logger.debug('Error getting asset by ID', error);
        }
      }

      return null;
    } catch (error) {
      logger.error('EXIF extraction failed', error);
      return null;
    }
  }

  /**
   * Get location by matching asset ID
   */
  private static async getLocationByAssetId(
    assets: any[]
  ): Promise<LocationResult | null> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      for (const asset of assets) {
        const assetId = (asset as any).id;
        if (!assetId) continue;

        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
          const location = this.parseLocation(assetInfo.location);
          
          if (location) {
            const address = await getAddressFromCoords(location.lat, location.lng);
            return { ...location, address };
          }
        } catch (error) {
          // Continue to next asset
        }
      }

      return null;
    } catch (error) {
      logger.error('Asset ID location extraction failed', error);
      return null;
    }
  }

  /**
   * Get location by matching filename
   */
  private static async getLocationByFilename(
    assets: any[],
    selectionTime: number
  ): Promise<LocationResult | null> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      // Get recent assets
      const recentAssets = await MediaLibrary.getAssetsAsync({
        first: 30,
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: MediaLibrary.SortBy.modificationTime,
      });

      logger.debug('Found recent assets:', recentAssets.assets.length);

      // Try to match by filename
      let assetsToCheck: any[] = [];
      
      for (const selectedAsset of assets) {
        const selectedFileName = selectedAsset.fileName;
        if (!selectedFileName) continue;

        // Search for matching filename
        for (const mediaAsset of recentAssets.assets) {
          try {
            const assetInfo = await MediaLibrary.getAssetInfoAsync(mediaAsset.id);
            const assetFileName = assetInfo.localUri?.split('/').pop() || '';
            
            if (
              assetFileName.toLowerCase().includes(selectedFileName.toLowerCase()) ||
              selectedFileName.toLowerCase().includes(assetFileName.toLowerCase())
            ) {
              assetsToCheck.push(mediaAsset);
              break;
            }
          } catch (error) {
            // Continue searching
          }
        }
        
        if (assetsToCheck.length > 0) break;
      }

      // Fallback to most recent if no match
      if (assetsToCheck.length === 0) {
        const sortedAssets = recentAssets.assets.sort(
          (a, b) => (b.modificationTime || 0) - (a.modificationTime || 0)
        );
        assetsToCheck = sortedAssets.slice(0, 1);
        logger.debug('No filename match, using most recent photo');
      }

      // Extract location from matched assets
      for (const mediaAsset of assetsToCheck) {
        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(mediaAsset.id);
          const location = this.parseLocation(assetInfo.location);
          
          if (location) {
            const address = await getAddressFromCoords(location.lat, location.lng);
            return { ...location, address };
          }
        } catch (error) {
          logger.error('Error getting asset info', error);
        }
      }

      return null;
    } catch (error) {
      logger.error('Filename location extraction failed', error);
      return null;
    }
  }

  /**
   * Parse location data from MediaLibrary location object
   */
  private static parseLocation(
    location: any
  ): { lat: number; lng: number } | null {
    if (!location) return null;

    try {
      const latValue: any = location.latitude;
      const lngValue: any = location.longitude;

      const lat = typeof latValue === 'number' 
        ? latValue 
        : parseFloat(latValue?.toString() || '0');
      
      const lng = typeof lngValue === 'number' 
        ? lngValue 
        : parseFloat(lngValue?.toString() || '0');

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
      }
    } catch (error) {
      logger.error('Error parsing location', error);
    }

    return null;
  }
}


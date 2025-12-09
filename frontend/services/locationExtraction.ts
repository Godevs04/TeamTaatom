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
  hasExifGps: boolean;      // true if location came from EXIF/asset embedded GPS
  takenAt?: Date | null;    // capture date from EXIF or asset metadata
  rawSource: 'exif' | 'asset' | 'manual' | 'none'; // Source type for determining TripScore source
}

export class LocationExtractionService {
  /**
   * Extract location from photos/videos using multiple fallback strategies
   * Returns enhanced location data with EXIF metadata for TripScore v2
   * 
   * NEW RULE: Both EXIF GPS and assetInfo.location are treated as strong GPS evidence
   * This ensures original camera photos with GPS (even if stored in assetInfo.location)
   * get medium trust instead of low trust.
   */
  static async extractFromPhotos(
    assets: any[],
    selectionTime: number
  ): Promise<LocationResult | null> {
    try {
      // Strategy 1: Try EXIF data OR assetInfo.location from asset ID (highest priority)
      // Both are treated as strong GPS evidence (hasExifGps = true)
      const exifLocation = await this.getLocationFromEXIF(assets);
      if (exifLocation) {
        logger.debug('Location found via EXIF data or assetInfo.location');
        return {
          ...exifLocation,
          hasExifGps: true,  // Both EXIF GPS and assetInfo.location are treated as verified
          rawSource: 'exif'  // Maps to gallery_exif (medium trust)
        };
      }

      // Strategy 2: Try MediaLibrary by asset ID (medium priority)
      // assetInfo.location is now treated as strong GPS evidence
      const idLocation = await this.getLocationByAssetId(assets);
      if (idLocation) {
        logger.debug('Location found via asset ID');
        return {
          ...idLocation,
          hasExifGps: true,  // assetInfo.location is treated as verified GPS
          rawSource: 'exif'  // Maps to gallery_exif (medium trust)
        };
      }

      // Strategy 3: Try MediaLibrary by filename matching (low priority)
      // assetInfo.location is now treated as strong GPS evidence
      const filenameLocation = await this.getLocationByFilename(assets, selectionTime);
      if (filenameLocation) {
        logger.debug('Location found via filename matching');
        return {
          ...filenameLocation,
          hasExifGps: true,  // assetInfo.location is treated as verified GPS
          rawSource: 'exif'  // Maps to gallery_exif (medium trust)
        };
      }

      logger.warn('No location found in photo metadata');
      return null;
    } catch (error) {
      logger.error('Location extraction failed', error);
      return null;
    }
  }

  /**
   * Get location from EXIF data OR assetInfo.location using asset ID
   * Returns location with EXIF metadata including takenAt timestamp
   * 
   * NEW RULE: Both EXIF GPS and assetInfo.location are treated as strong GPS evidence
   * because many phones store GPS in assetInfo.location, not just EXIF.
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
          const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId, {
            shouldDownloadFromNetwork: false
          });
          
          // Check for location from either EXIF GPS or assetInfo.location
          // Both are treated as strong GPS evidence
          let strongGpsFound = false;
          let gpsLat: number | null = null;
          let gpsLng: number | null = null;
          
          // 1. Check EXIF GPS first (if available)
          const exif = assetInfo.exif as any;
          if (exif?.GPSLatitude && exif?.GPSLongitude) {
            strongGpsFound = true;
            gpsLat = typeof exif.GPSLatitude === 'number' 
              ? exif.GPSLatitude 
              : parseFloat(exif.GPSLatitude?.toString() || '0');
            gpsLng = typeof exif.GPSLongitude === 'number' 
              ? exif.GPSLongitude 
              : parseFloat(exif.GPSLongitude?.toString() || '0');
          }
          
          // 2. Check assetInfo.location (OS-level photo GPS)
          // This is also strong evidence for original camera photos
          if (!strongGpsFound) {
            const location = this.parseLocation(assetInfo.location);
            if (location) {
              strongGpsFound = true;
              gpsLat = location.lat;
              gpsLng = location.lng;
            }
          }
          
          if (strongGpsFound && gpsLat && gpsLng && gpsLat !== 0 && gpsLng !== 0) {
            const address = await getAddressFromCoords(gpsLat, gpsLng);
            
            // Extract takenAt from EXIF or asset creation time
            let takenAt: Date | null = null;
            if (exif?.DateTimeOriginal && typeof exif.DateTimeOriginal === 'string') {
              try {
                // Parse EXIF DateTimeOriginal format: "YYYY:MM:DD HH:MM:SS"
                const dateTimeStr = exif.DateTimeOriginal;
                const [datePart, timePart] = dateTimeStr.split(' ');
                if (datePart && timePart) {
                  const [year, month, day] = datePart.split(':').map(Number);
                  const [hour, minute, second] = timePart.split(':').map(Number);
                  takenAt = new Date(year, month - 1, day, hour, minute, second);
                }
              } catch (e) {
                logger.debug('Error parsing EXIF DateTimeOriginal', e);
              }
            }
            if (!takenAt && assetInfo.creationTime) {
              takenAt = new Date(assetInfo.creationTime * 1000); // Convert Unix timestamp to Date
            } else if (!takenAt && assetInfo.modificationTime) {
              takenAt = new Date(assetInfo.modificationTime * 1000);
            }
            
            return { 
              lat: gpsLat,
              lng: gpsLng,
              address,
              hasExifGps: true,  // Both EXIF GPS and assetInfo.location are treated as verified
              takenAt,
              rawSource: 'exif'  // Maps to gallery_exif (medium trust)
            };
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
   * 
   * NEW RULE: assetInfo.location is treated as strong GPS evidence
   * because it represents real location data from the camera/OS
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
            
            // Extract takenAt from asset metadata
            let takenAt: Date | null = null;
            if (assetInfo.creationTime) {
              takenAt = new Date(assetInfo.creationTime * 1000);
            } else if (assetInfo.modificationTime) {
              takenAt = new Date(assetInfo.modificationTime * 1000);
            }
            
            return { 
              ...location, 
              address,
              hasExifGps: true,  // assetInfo.location is treated as verified GPS
              takenAt,
              rawSource: 'exif'  // Maps to gallery_exif (medium trust)
            };
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
   * 
   * NEW RULE: assetInfo.location is treated as strong GPS evidence
   * because it represents real location data from the camera/OS
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
            
            // Extract takenAt from asset metadata
            let takenAt: Date | null = null;
            if (assetInfo.creationTime) {
              takenAt = new Date(assetInfo.creationTime * 1000);
            } else if (assetInfo.modificationTime) {
              takenAt = new Date(assetInfo.modificationTime * 1000);
            }
            
            return { 
              ...location, 
              address,
              hasExifGps: true,  // assetInfo.location is treated as verified GPS
              takenAt,
              rawSource: 'exif'  // Maps to gallery_exif (medium trust)
            };
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


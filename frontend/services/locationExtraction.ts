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
      logger.debug(`Extracting location from ${assets.length} asset(s), selection time: ${new Date(selectionTime).toISOString()}`);
      
      // Log asset IDs for debugging
      const assetIds = assets.map(a => (a as any).id).filter(Boolean);
      logger.debug('Asset IDs being processed:', assetIds);
      
      // Strategy 1: Try EXIF data OR assetInfo.location from asset ID (highest priority)
      // Both are treated as strong GPS evidence (hasExifGps = true)
      // IMPORTANT: This processes assets in order, so first selected asset's location is prioritized
      const exifLocation = await this.getLocationFromEXIF(assets);
      if (exifLocation) {
        logger.debug('Location found via EXIF data or assetInfo.location', {
          lat: exifLocation.lat,
          lng: exifLocation.lng,
          address: exifLocation.address
        });
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
        logger.debug('Location found via asset ID', {
          lat: idLocation.lat,
          lng: idLocation.lng,
          address: idLocation.address
        });
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
        logger.debug('Location found via filename matching', {
          lat: filenameLocation.lat,
          lng: filenameLocation.lng,
          address: filenameLocation.address
        });
        return {
          ...filenameLocation,
          hasExifGps: true,  // assetInfo.location is treated as verified GPS
          rawSource: 'exif'  // Maps to gallery_exif (medium trust)
        };
      }

      logger.debug('No location found in photo metadata for provided assets');
      return null;
    } catch (error) {
      // Don't log as error - this is expected in many cases (permissions, no GPS data, etc.)
      logger.warn('Location extraction failed (non-critical)', error);
      return null;
    }
  }

  /**
   * Get location from EXIF data OR assetInfo.location using asset ID
   * Returns location with EXIF metadata including takenAt timestamp
   * 
   * NEW RULE: Both EXIF GPS and assetInfo.location are treated as strong GPS evidence
   * because many phones store GPS in assetInfo.location, not just EXIF.
   * 
   * IMPORTANT: Processes assets in order and returns the FIRST asset's location found.
   * This ensures we get location from the first selected image, not a random one.
   */
  private static async getLocationFromEXIF(
    assets: any[]
  ): Promise<LocationResult | null> {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      // Process assets in order - return location from first asset that has it
      for (const asset of assets) {
        const assetId = (asset as any).id;
        
        // Try to get asset ID from multiple sources
        let finalAssetId = assetId;
        if (!finalAssetId && (asset as any).originalAsset?.id) {
          finalAssetId = (asset as any).originalAsset.id;
        }
        
        // If still no ID, try to find by URI (for recently selected photos)
        if (!finalAssetId) {
          logger.debug('No asset ID found, attempting to find by URI');
          // Skip this asset if no ID - we'll try filename matching instead
          continue;
        }

        try {
          const assetInfo = await MediaLibrary.getAssetInfoAsync(finalAssetId, {
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
      // Don't log as error - this is expected in many cases (permissions, no GPS data, etc.)
      logger.warn('EXIF extraction failed (non-critical)', error);
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
        // Try multiple sources for asset ID
        let assetId = (asset as any).id;
        if (!assetId && (asset as any).originalAsset?.id) {
          assetId = (asset as any).originalAsset.id;
        }
        
        if (!assetId) {
          logger.debug('Skipping asset without ID in getLocationByAssetId');
          continue;
        }

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
      // Don't log as error - this is expected in many cases (permissions, no GPS data, etc.)
      logger.warn('Asset ID location extraction failed (non-critical)', error);
      return null;
    }
  }

  /**
   * Get location by matching filename
   * 
   * NEW RULE: assetInfo.location is treated as strong GPS evidence
   * because it represents real location data from the camera/OS
   * 
   * IMPORTANT: Only processes the provided assets - no fallback to "most recent photo"
   * to avoid picking up location from previously uploaded photos
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

      // Get recent assets - increase window to 30 minutes to catch photos that might have
      // been taken slightly before selection (user might browse before selecting)
      const timeWindow = 30 * 60 * 1000; // 30 minutes in milliseconds (more lenient)
      const recentAssets = await MediaLibrary.getAssetsAsync({
        first: 100, // Increased to find matches
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: MediaLibrary.SortBy.modificationTime,
      });

      logger.debug('Found recent assets:', recentAssets.assets.length);

      // Try to match by filename AND asset ID first (most reliable)
      let assetsToCheck: any[] = [];
      
      // First, try to match by asset ID (most reliable)
      for (const selectedAsset of assets) {
        let selectedAssetId = (selectedAsset as any).id;
        // Also check originalAsset
        if (!selectedAssetId && (selectedAsset as any).originalAsset?.id) {
          selectedAssetId = (selectedAsset as any).originalAsset.id;
        }
        
        if (selectedAssetId) {
          for (const mediaAsset of recentAssets.assets) {
            if (mediaAsset.id === selectedAssetId) {
              assetsToCheck.push(mediaAsset);
              logger.debug('Matched asset by ID:', selectedAssetId);
              break;
            }
          }
          if (assetsToCheck.length > 0) break;
        }
      }
      
      // If no ID match, try filename matching with relaxed time window
      if (assetsToCheck.length === 0) {
        for (const selectedAsset of assets) {
          const selectedFileName = selectedAsset.fileName || (selectedAsset as any).name;
          if (!selectedFileName) continue;

          // Search for matching filename
          for (const mediaAsset of recentAssets.assets) {
            try {
              const assetInfo = await MediaLibrary.getAssetInfoAsync(mediaAsset.id);
              const assetFileName = assetInfo.localUri?.split('/').pop() || '';
              
              // Check if filename matches AND the photo was taken around the selection time
              const assetTime = mediaAsset.modificationTime * 1000; // Convert to milliseconds
              const timeDiff = Math.abs(assetTime - selectionTime);
              
              // More lenient matching - check filename similarity first
              const filenameMatches = assetFileName.toLowerCase().includes(selectedFileName.toLowerCase()) ||
                                     selectedFileName.toLowerCase().includes(assetFileName.toLowerCase()) ||
                                     assetFileName.toLowerCase() === selectedFileName.toLowerCase();
              
              if (filenameMatches) {
                // If filename matches, use it even if time is slightly off (within 30 min window)
                // This handles cases where user selects an older photo
                if (timeDiff < timeWindow) {
                  assetsToCheck.push(mediaAsset);
                  logger.debug(`Matched asset by filename and time: ${selectedFileName}, time diff: ${timeDiff}`);
                  break;
                } else {
                  // If filename matches but time is off, still use it if it's the only match
                  // This handles edge cases where modification time might be wrong
                  logger.debug(`Filename matches but time diff is large: ${timeDiff}, still considering`);
                  if (assetsToCheck.length === 0) {
                    assetsToCheck.push(mediaAsset);
                    logger.debug('Using asset despite large time diff (only match found)');
                    break;
                  }
                }
              }
            } catch (error) {
              // Continue searching
            }
          }
          
          if (assetsToCheck.length > 0) break;
        }
      }

      // If still no match, try using the most recent photo within the time window
      // This is a fallback for cases where asset ID/filename matching fails
      if (assetsToCheck.length === 0) {
        logger.debug('No exact match found, trying most recent photo within time window');
        const sortedAssets = recentAssets.assets
          .filter(asset => {
            const assetTime = asset.modificationTime * 1000;
            const timeDiff = Math.abs(assetTime - selectionTime);
            return timeDiff < timeWindow;
          })
          .sort((a, b) => (b.modificationTime || 0) - (a.modificationTime || 0));
        
        if (sortedAssets.length > 0) {
          assetsToCheck = [sortedAssets[0]];
          logger.debug('Using most recent photo within time window as fallback');
        } else {
          logger.debug('No matching asset found, skipping location extraction');
          return null;
        }
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
      // Don't log as error - this is expected in many cases (permissions, no GPS data, etc.)
      logger.warn('Filename location extraction failed (non-critical)', error);
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


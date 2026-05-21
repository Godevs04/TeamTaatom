import * as FileSystem from 'expo-file-system';
import { createLogger } from '../../utils/logger';

const logger = createLogger('VideoCache');

const MAX_CACHED_VIDEOS = 8;
const cacheQueue: string[] = []; // ordered oldest → newest

/**
 * Get the cache directory path
 */
function getCachePath(): string {
  // Use the legacy cacheDirectory if available, otherwise construct the path
  const FileSystemModule = FileSystem as any;
  if (FileSystemModule.cacheDirectory) {
    return FileSystemModule.cacheDirectory;
  }
  // Fallback for newer versions - construct cache path
  // documentDirectory is available on the module
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}../Cache/`;
}

async function validateCachedFile(localPath: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (!info.exists) {
      logger.warn(`[VideoCache] Validation failed: file does not exist: ${localPath}`);
      return false;
    }
    if (!info.size || info.size === 0) {
      logger.warn(`[VideoCache] Validation failed: file is empty: ${localPath}`);
      return false;
    }
    logger.debug(`[VideoCache] Validation passed: ${localPath} (${info.size} bytes)`);
    return true;
  } catch (error) {
    logger.warn(`[VideoCache] Validation error for ${localPath}:`, error);
    return false;
  }
}

export async function cacheVideoLocally(remoteUrl: string): Promise<string> {
  try {
    const filename = remoteUrl.split('/').pop() ?? `vid_${Date.now()}.mp4`;
    const cacheDir = getCachePath();
    const localPath = `${cacheDir}shorts/${filename}`;

    logger.info(`[VideoCache] cacheVideoLocally called for: ${filename}`, {
      remoteUrl: remoteUrl.substring(0, 100),
      localPath,
      timestamp: new Date().toISOString()
    });

    // Check if already cached
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      // Validate cached file before using it
      const isValid = await validateCachedFile(localPath);
      if (isValid) {
        // Move to end of queue (recently used)
        const idx = cacheQueue.indexOf(localPath);
        if (idx !== -1) {
          cacheQueue.splice(idx, 1);
        }
        cacheQueue.push(localPath);
        logger.debug(`[VideoCache] Cache hit: ${filename}`);
        logger.info(`[VideoCache] CACHE_HIT for ${filename}, queue: ${cacheQueue.length}/${MAX_CACHED_VIDEOS}`);
        return localPath;
      } else {
        // File is corrupted or invalid, remove from cache
        logger.warn(`[VideoCache] Cache file invalid, removing: ${filename}`);
        await removeCachedVideo(localPath);
        // Fall through to re-download
      }
    } else {
      logger.info(`[VideoCache] CACHE_MISS for ${filename}, will download`);
    }

    // Ensure cache dir exists
    await FileSystem.makeDirectoryAsync(
      `${cacheDir}shorts/`,
      { intermediates: true }
    );

    // Download video
    logger.debug(`[VideoCache] Downloading: ${filename}`);
    logger.info(`[VideoCache] DOWNLOAD_START for ${filename}`);
    try {
      await FileSystem.downloadAsync(remoteUrl, localPath);
      cacheQueue.push(localPath);
      logger.debug(`[VideoCache] Downloaded: ${filename} (queue: ${cacheQueue.length}/${MAX_CACHED_VIDEOS})`);
      logger.info(`[VideoCache] DOWNLOAD_COMPLETE for ${filename}, queue: ${cacheQueue.length}/${MAX_CACHED_VIDEOS}`);
    } catch (downloadError) {
      logger.error(`[VideoCache] Download failed for ${filename}:`, downloadError);
      logger.error(`[VideoCache] DOWNLOAD_FAILED for ${filename}`);
      throw downloadError;
    }

    // Evict oldest if over limit
    while (cacheQueue.length > MAX_CACHED_VIDEOS) {
      const evict = cacheQueue.shift();
      if (evict) {
        try {
          const evictInfo = await FileSystem.getInfoAsync(evict);
          if (evictInfo.exists) {
            await FileSystem.deleteAsync(evict);
            logger.debug(`[VideoCache] Evicted: ${evict.split('/').pop()}`);
            logger.info(`[VideoCache] EVICTED: ${evict.split('/').pop()}`);
          }
        } catch (err) {
          logger.warn(`[VideoCache] Failed to evict ${evict}:`, err);
        }
      }
    }

    return localPath;
  } catch (error) {
    logger.error(`[VideoCache] Error caching video:`, error);
    throw error;
  }
}

export async function clearVideoCache(): Promise<void> {
  try {
    const cacheDir = `${getCachePath()}shorts/`;
    const info = await FileSystem.getInfoAsync(cacheDir);
    if (info.exists) {
      await FileSystem.deleteAsync(cacheDir);
      logger.debug(`[VideoCache] Cleared cache directory`);
    }
    cacheQueue.length = 0;
  } catch (error) {
    logger.error(`[VideoCache] Error clearing cache:`, error);
    throw error;
  }
}

/**
 * Get cache statistics.
 * 
 * @returns Object with cached count and max limit
 */
export function getCacheStats(): { cached: number; max: number } {
  return { cached: cacheQueue.length, max: MAX_CACHED_VIDEOS };
}

/**
 * Get the current cache queue (for debugging).
 * 
 * @returns Array of cached file paths
 */
export function getCacheQueue(): string[] {
  return [...cacheQueue];
}

/**
 * Remove a specific video from cache.
 * 
 * @param localPath - Local file path to remove
 */
export async function removeCachedVideo(localPath: string): Promise<void> {
  try {
    const idx = cacheQueue.indexOf(localPath);
    if (idx !== -1) {
      cacheQueue.splice(idx, 1);
    }
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      await FileSystem.deleteAsync(localPath);
      logger.debug(`[VideoCache] Removed: ${localPath.split('/').pop()}`);
    }
  } catch (error) {
    logger.error(`[VideoCache] Error removing video:`, error);
    throw error;
  }
}

/**
 * Check if a cached video file is still valid and accessible.
 * Used before playback to detect cache misses.
 * 
 * @param localPath - Local file path to check
 * @returns true if file exists and is valid, false otherwise
 */
export async function isCachedVideoValid(localPath: string): Promise<boolean> {
  return validateCachedFile(localPath);
}

/**
 * Preload a video into cache without waiting for download.
 * Useful for preloading next video in feed.
 * 
 * @param remoteUrl - CDN URL of the video
 */
export function preloadVideoAsync(remoteUrl: string): void {
  cacheVideoLocally(remoteUrl).catch((err) => {
    logger.warn(`[VideoCache] Preload failed for ${remoteUrl}:`, err);
  });
}

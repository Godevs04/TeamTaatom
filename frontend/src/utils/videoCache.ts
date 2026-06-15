import * as FileSystem from 'expo-file-system/legacy';
import { createLogger } from '../../utils/logger';

const logger = createLogger('VideoCache');

const MAX_CACHED_VIDEOS = 50;
const cacheQueue: string[] = []; // ordered oldest → newest

// Deduplicate active downloads to prevent concurrent requests for the same video
const activeDownloads = new Map<string, Promise<string>>();

// Synchronous cache locking to prevent race conditions during deletion
const lockedVideoIds = new Set<string>();

// Synchronous in-memory registry of cached video IDs
const cachedVideoIds = new Set<string>();
const cachedVideoExtensions = new Map<string, string>();
let isCacheInitialized = false;

// Pub/sub cache update listeners
type CacheListener = (videoId: string, localUri: string) => void;
const cacheListeners = new Set<CacheListener>();

/**
 * Register a listener to be notified when a video is successfully cached.
 * Returns an unsubscribe function.
 */
export function addCacheListener(listener: CacheListener): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

/**
 * Initialize video cache by scanning the shorts/ directory at startup
 */
export async function initializeVideoCache(): Promise<void> {
  if (isCacheInitialized) return;
  try {
    const cacheDir = getCachePath();
    const shortsCacheDir = `${cacheDir}shorts/`;
    const dirInfo = await FileSystem.getInfoAsync(shortsCacheDir);
    if (dirInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(shortsCacheDir);
      for (const file of files) {
        const parts = file.split('.');
        const id = parts[0];
        const ext = parts[1];
        if (id && ext && (ext === 'mp4' || ext === 'm3u8')) {
          cachedVideoIds.add(id);
          cachedVideoExtensions.set(id, ext);
          const fullPath = `${shortsCacheDir}${file}`;
          if (!cacheQueue.includes(fullPath)) {
            cacheQueue.push(fullPath);
          }
        }
      }
    }
    isCacheInitialized = true;
    logger.info(`[VideoCache] Initialized. Found ${cachedVideoIds.size} cached videos.`);
  } catch (error) {
    logger.error(`[VideoCache] Initialization failed:`, error);
  }
}

// Auto-initialize immediately
initializeVideoCache().catch(() => {});

/**
 * Extract video ID from local path
 */
function getVideoIdFromPath(localPath: string): string | null {
  const filename = localPath.split('/').pop();
  if (!filename) return null;
  const parts = filename.split('.');
  return parts[0] || null;
}

/**
 * Get the cache directory path
 */
function getCachePath(): string {
  const FileSystemModule = FileSystem as any;
  if (FileSystemModule.cacheDirectory) {
    return FileSystemModule.cacheDirectory;
  }
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}../Cache/`;
}

async function validateCachedFile(localPath: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (!info.exists) {
      logger.debug(`[VideoCache] Validation failed: file does not exist: ${localPath}`);
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

/**
 * Retrieve the local URI synchronously using the in-memory cache registry.
 * Returns null if not cached.
 */
export function getLocalVideoUriSync(videoId: string): string | null {
  if (lockedVideoIds.has(videoId)) {
    return null;
  }
  if (cachedVideoIds.has(videoId)) {
    const ext = cachedVideoExtensions.get(videoId) || 'mp4';
    return `${getCachePath()}shorts/${videoId}.${ext}`;
  }
  return null;
}

/**
 * Retrieve the validated local URI for a cached video if it exists.
 * Returns null if the video is not cached or invalid.
 */
export async function getLocalVideoUri(videoId: string): Promise<string | null> {
  if (lockedVideoIds.has(videoId)) {
    logger.debug(`[VideoCache] getLocalVideoUri blocked due to lock for video: ${videoId}`);
    return null;
  }
  
  // Fast path: check registry first before running async disk checks
  if (!cachedVideoIds.has(videoId)) {
    return null;
  }

  try {
    const cacheDir = getCachePath();
    const ext = cachedVideoExtensions.get(videoId) || 'mp4';
    const localPath = `${cacheDir}shorts/${videoId}.${ext}`;

    if (await validateCachedFile(localPath)) {
      return localPath;
    }
    
    // If validation failed, remove from registry
    cachedVideoIds.delete(videoId);
    cachedVideoExtensions.delete(videoId);
    return null;
  } catch (error) {
    logger.warn(`[VideoCache] Error checking local URI for ${videoId}:`, error);
    return null;
  }
}

export async function cacheVideoLocally(videoId: string, remoteUrl: string): Promise<string> {
  const lowercaseUrl = remoteUrl.toLowerCase();
  const isHls = lowercaseUrl.includes('m3u8') || lowercaseUrl.includes('hls');
  if (isHls) {
    logger.debug(`[VideoCache] HLS video detected, skipping local caching: ${videoId}`);
    return remoteUrl;
  }

  if (lockedVideoIds.has(videoId)) {
    logger.warn(`[VideoCache] cacheVideoLocally blocked: video is locked: ${videoId}`);
    throw new Error(`Video cache is locked: ${videoId}`);
  }

  // Return active download promise if already in progress to prevent duplicate fetching
  const existingDownload = activeDownloads.get(videoId);
  if (existingDownload) {
    logger.debug(`[VideoCache] Re-using active download promise for video: ${videoId}`);
    return existingDownload;
  }

  const downloadPromise = (async () => {
    try {
      const lowercaseUrl = remoteUrl.toLowerCase();
      const ext = (lowercaseUrl.includes('m3u8') || lowercaseUrl.includes('hls')) ? 'm3u8' : 'mp4';
      const filename = `${videoId}.${ext}`;
      const cacheDir = getCachePath();
      const localPath = `${cacheDir}shorts/${filename}`;

      logger.info(`[VideoCache] cacheVideoLocally called for video ${videoId}: ${filename}`, {
        remoteUrl: remoteUrl.substring(0, 100),
        localPath,
        timestamp: new Date().toISOString()
      });

      // Check if already cached
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists) {
        // Validate cached file before using it
        const isValid = await validateCachedFile(localPath);
        if (isValid && !lockedVideoIds.has(videoId)) {
          // Move to end of queue (recently used)
          const idx = cacheQueue.indexOf(localPath);
          if (idx !== -1) {
            cacheQueue.splice(idx, 1);
          }
          cacheQueue.push(localPath);
          logger.debug(`[VideoCache] Cache hit: ${filename}`);
          logger.info(`[VideoCache] CACHE_HIT for ${filename}, queue: ${cacheQueue.length}/${MAX_CACHED_VIDEOS}`);
          
          // Sync with registry
          cachedVideoIds.add(videoId);
          cachedVideoExtensions.set(videoId, ext);

          return localPath;
        } else {
          // File is corrupted or invalid, remove from cache
          logger.warn(`[VideoCache] Cache file invalid or locked, removing: ${filename}`);
          lockedVideoIds.add(videoId);
          try {
            await removeCachedVideo(localPath);
          } finally {
            lockedVideoIds.delete(videoId);
          }
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
        
        // Add to registry
        cachedVideoIds.add(videoId);
        cachedVideoExtensions.set(videoId, ext);
        
        // Notify listeners
        cacheListeners.forEach((listener) => {
          try {
            listener(videoId, localPath);
          } catch (listenerError) {
            logger.error(`[VideoCache] Error in cache listener for video ${videoId}:`, listenerError);
          }
        });

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
              const evictId = getVideoIdFromPath(evict);
              if (evictId) {
                cachedVideoIds.delete(evictId);
                cachedVideoExtensions.delete(evictId);
              }
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
      logger.error(`[VideoCache] Error caching video ${videoId}:`, error);
      throw error;
    }
  })();

  activeDownloads.set(videoId, downloadPromise);
  
  try {
    return await downloadPromise;
  } finally {
    activeDownloads.delete(videoId);
  }
}

export async function clearVideoCache(): Promise<void> {
  // Lock all current items in queue during clear
  cacheQueue.forEach(path => {
    const id = getVideoIdFromPath(path);
    if (id) lockedVideoIds.add(id);
  });
  try {
    const cacheDir = `${getCachePath()}shorts/`;
    const info = await FileSystem.getInfoAsync(cacheDir);
    if (info.exists) {
      await FileSystem.deleteAsync(cacheDir);
      logger.debug(`[VideoCache] Cleared cache directory`);
    }
    cacheQueue.length = 0;
    activeDownloads.clear();
    cachedVideoIds.clear();
    cachedVideoExtensions.clear();
  } catch (error) {
    logger.error(`[VideoCache] Error clearing cache:`, error);
    throw error;
  } finally {
    lockedVideoIds.clear();
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
  const videoId = getVideoIdFromPath(localPath);
  if (videoId) {
    lockedVideoIds.add(videoId);
    cachedVideoIds.delete(videoId);
    cachedVideoExtensions.delete(videoId);
  }
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
  } finally {
    if (videoId) {
      lockedVideoIds.delete(videoId);
    }
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
 * @param videoId - ID of the video
 * @param remoteUrl - CDN URL of the video
 */
export function preloadVideoAsync(videoId: string, remoteUrl: string): void {
  cacheVideoLocally(videoId, remoteUrl).catch((err) => {
    logger.warn(`[VideoCache] Preload failed for video ${videoId} (${remoteUrl}):`, err);
  });
}

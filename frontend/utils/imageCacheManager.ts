import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import logger from './logger';

const R2_CACHE_DIR = `${FileSystem.cacheDirectory}r2ImageCache/`;
const MAX_CONCURRENT_DOWNLOADS = 2; // Limit concurrent disk-cache downloads

class ImageCacheManager {
  private static instance: ImageCacheManager;
  private cache: Map<string, boolean> = new Map();
  private loadingPromises: Map<string, Promise<string>> = new Map();
  private downloadQueue: Array<{ url: string; cacheKey: string; cachedPath: string; resolve: (v: string) => void }> = [];
  private activeDownloads: number = 0;

  static getInstance(): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager();
    }
    return ImageCacheManager.instance;
  }

  constructor() {
    this.initR2Cache();
  }

  private async initR2Cache() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(R2_CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(R2_CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      logger.error('Failed to initialize R2 image cache directory:', error);
    }
  }

  private isR2Url(url: string): boolean {
    return url.includes('r2.cloudflarestorage.com') || url.includes('cloudflarestorage.com');
  }

  /**
   * Generate a stable cache key from a URL by stripping query params.
   * Same R2 object → same key regardless of signature.
   */
  private generateStableCacheKey(url: string): string {
    const cleanUrl = url.split('?')[0];
    let hash = 0;
    for (let i = 0; i < cleanUrl.length; i++) {
      const char = cleanUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const pathMatch = cleanUrl.match(/\.([a-zA-Z0-9]+)$/);
    const ext = pathMatch ? pathMatch[1] : 'jpg';
    return `${Math.abs(hash).toString(36)}.${ext}`;
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Get cached local URI for an R2 image if available.
   * Returns local file path if cached, otherwise returns the original URL.
   * Does NOT start any downloads — let Image component handle network loading.
   */
  async getCachedR2Uri(url: string): Promise<string> {
    if (!url || !this.isR2Url(url)) return url;

    const cacheKey = this.generateStableCacheKey(url);
    const cachedPath = `${R2_CACHE_DIR}${cacheKey}`;

    // Fast path: in-memory map
    if (this.cache.has(cacheKey)) {
      return cachedPath;
    }

    // Check disk (async but fast — local filesystem)
    try {
      const info = await FileSystem.getInfoAsync(cachedPath);
      if (info.exists && (info as any).size > 0) {
        this.cache.set(cacheKey, true);
        return cachedPath;
      }
    } catch {
      // Not on disk
    }

    // Not cached — return direct URL so Image component loads from network
    return url;
  }

  /**
   * Synchronous cache check — returns local path if in memory map, else original URL.
   * Use for initial state in components to prevent blank flashes.
   */
  getCachedPathSync(url: string): string {
    if (!url || !this.isR2Url(url)) return url;
    const cacheKey = this.generateStableCacheKey(url);
    if (this.cache.has(cacheKey)) {
      return `${R2_CACHE_DIR}${cacheKey}`;
    }
    return url;
  }

  /**
   * Call AFTER an Image component has successfully loaded an R2 image (onLoad).
   * Downloads to disk cache in background for future instant loads.
   * Throttled to MAX_CONCURRENT_DOWNLOADS to avoid saturating the network.
   */
  cacheAfterDisplay(url: string): void {
    if (!url || !this.isR2Url(url)) return;

    const cacheKey = this.generateStableCacheKey(url);

    // Already cached or already downloading — skip
    if (this.cache.has(cacheKey) || this.loadingPromises.has(cacheKey)) return;

    const cachedPath = `${R2_CACHE_DIR}${cacheKey}`;

    // Enqueue the download
    const promise = new Promise<string>((resolve) => {
      this.downloadQueue.push({ url, cacheKey, cachedPath, resolve });
    });
    this.loadingPromises.set(cacheKey, promise);
    promise.finally(() => this.loadingPromises.delete(cacheKey));

    // Process queue
    this.processQueue();
  }

  private processQueue(): void {
    while (this.activeDownloads < MAX_CONCURRENT_DOWNLOADS && this.downloadQueue.length > 0) {
      const item = this.downloadQueue.shift()!;
      this.activeDownloads++;

      this.downloadR2Image(item.url, item.cachedPath, item.cacheKey)
        .then((result) => item.resolve(result))
        .finally(() => {
          this.activeDownloads--;
          this.processQueue();
        });
    }
  }

  private async downloadR2Image(url: string, cachedPath: string, cacheKey: string): Promise<string> {
    try {
      // Double-check not already on disk (another download might have finished)
      const info = await FileSystem.getInfoAsync(cachedPath);
      if (info.exists && (info as any).size > 0) {
        this.cache.set(cacheKey, true);
        return cachedPath;
      }

      const downloadResult = await FileSystem.downloadAsync(url, cachedPath);
      if (downloadResult.status === 200) {
        this.cache.set(cacheKey, true);
        return cachedPath;
      }
      return url;
    } catch (error) {
      logger.warn('R2 image cache download failed:', { error });
      return url;
    }
  }

  /**
   * Prefetch for non-R2 URLs (Cloudinary etc.) — uses Image.prefetch.
   * For R2 URLs, enqueues a throttled disk download.
   */
  async prefetchImage(url: string): Promise<void> {
    if (!url) return;

    if (this.isR2Url(url)) {
      // Just enqueue a background cache download (throttled)
      this.cacheAfterDisplay(url);
      return;
    }

    // Non-R2: use Image.prefetch
    if (this.cache.has(url)) return;
    if (this.loadingPromises.has(url)) {
      await this.loadingPromises.get(url);
      return;
    }

    const promise = Image.prefetch(url)
      .then(() => { this.cache.set(url, true); return url; })
      .catch(() => url);
    this.loadingPromises.set(url, promise);
    try {
      await promise;
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  isCached(url: string): boolean {
    if (this.isR2Url(url)) {
      return this.cache.has(this.generateStableCacheKey(url));
    }
    return this.cache.has(url);
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.downloadQueue.length = 0;
    FileSystem.deleteAsync(R2_CACHE_DIR, { idempotent: true })
      .then(() => FileSystem.makeDirectoryAsync(R2_CACHE_DIR, { intermediates: true }))
      .catch(() => {});
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Populate the in-memory cache map from files already on disk.
   * Call on app startup so getCachedPathSync() returns local paths after a restart,
   * avoiding network re-fetches of R2 images whose signed URL may have expired.
   */
  async populateCacheFromDisk(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(R2_CACHE_DIR);
      if (!dirInfo.exists) return;
      const files = await FileSystem.readDirectoryAsync(R2_CACHE_DIR);
      for (const file of files) {
        // The filename IS the cache key (see generateStableCacheKey).
        this.cache.set(file, true);
      }
    } catch (error) {
      logger.warn('Failed to populate R2 image cache from disk:', { error });
    }
  }

  /**
   * Clean up cached files older than maxAgeDays.
   * Call on app startup to prevent storage bloat.
   */
  async cleanupOldFiles(maxAgeDays: number = 3): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(R2_CACHE_DIR);
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      const now = Date.now();

      for (const file of files) {
        try {
          const filePath = `${R2_CACHE_DIR}${file}`;
          const info = await FileSystem.getInfoAsync(filePath);
          if (info.exists) {
            const fileAge = now - ((info as any).modificationTime || 0) * 1000;
            if (fileAge > maxAgeMs) {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              this.cache.delete(file);
            }
          }
        } catch {
          // Skip files we can't inspect
        }
      }
    } catch (error) {
      logger.error('Error cleaning up R2 image cache:', error);
    }
  }
}

export const imageCacheManager = ImageCacheManager.getInstance();

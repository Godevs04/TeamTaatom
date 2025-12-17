import { Image } from 'react-native';

class ImageCacheManager {
  private static instance: ImageCacheManager;
  private cache: Map<string, boolean> = new Map();
  private loadingPromises: Map<string, Promise<void>> = new Map();

  static getInstance(): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager();
    }
    return ImageCacheManager.instance;
  }

  async prefetchImage(url: string): Promise<void> {
    if (!url) return;

    // Return existing promise if already loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url);
    }

    // Return immediately if already cached
    if (this.cache.has(url)) {
      return Promise.resolve();
    }

    // Create new loading promise
    const promise = this.loadImage(url);
    this.loadingPromises.set(url, promise);

    try {
      await promise;
      this.cache.set(url, true);
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  private async loadImage(url: string): Promise<void> {
    // Skip prefetch for R2 signed URLs (Cloudflare R2) as they may fail due to CORS
    // React Native's Image component can load them directly via GET requests
    if (url.includes('r2.cloudflarestorage.com') || url.includes('cloudflarestorage.com')) {
      // Mark as cached immediately for R2 URLs - let Image component handle loading
      return Promise.resolve();
    }

    try {
      await Image.prefetch(url);
    } catch (error) {
      // Only log warnings for non-R2 URLs to reduce noise
      if (!url.includes('r2.cloudflarestorage.com') && !url.includes('cloudflarestorage.com')) {
        console.warn('Failed to prefetch image:', url, error);
      }
      // Don't throw error, just log it
    }
  }

  isCached(url: string): boolean {
    return this.cache.has(url);
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const imageCacheManager = ImageCacheManager.getInstance();

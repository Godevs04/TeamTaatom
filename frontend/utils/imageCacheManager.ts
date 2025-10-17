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
    try {
      await Image.prefetch(url);
    } catch (error) {
      console.warn('Failed to prefetch image:', url, error);
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

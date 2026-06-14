import * as FileSystem from 'expo-file-system/legacy';
import React from 'react';
import logger from './logger';

export interface ImageCacheOptions {
  maxCacheSize?: number; // in MB
  maxAge?: number; // in days
  quality?: number;
}

class ImageCacheManager {
  private cacheDir: string;
  private maxCacheSize: number;
  private maxAge: number;

  constructor(options: ImageCacheOptions = {}) {
    this.cacheDir = `${FileSystem.cacheDirectory}imageCache/`;
    this.maxCacheSize = (options.maxCacheSize || 100) * 1024 * 1024; // 100MB default
    this.maxAge = (options.maxAge || 7) * 24 * 60 * 60 * 1000; // 7 days default
    
    this.initializeCache();
  }

  private async initializeCache() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
      }
    } catch (error) {
      logger.error('Failed to initialize image cache:', error);
    }
  }

  /**
   * Get cached image URI or download and cache if not exists
   */
  async getCachedImageUri(url: string, options: ImageCacheOptions = {}): Promise<string> {
    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return url;
    }

    try {
      const cacheKey = this.generateCacheKey(url);
      const cachedPath = `${this.cacheDir}${cacheKey}`;
      
      // Check if cached file exists and is not expired
      const cachedInfo = await FileSystem.getInfoAsync(cachedPath);
      if (cachedInfo.exists) {
        const fileAge = Date.now() - ((cachedInfo as any).modificationTime || 0) * 1000;
        if (fileAge < this.maxAge) {
          return cachedPath;
        } else {
          // Remove expired file
          await FileSystem.deleteAsync(cachedPath);
        }
      }

      // Download and cache the image
      return await this.downloadAndCache(url, cachedPath, options);
    } catch (error) {
      logger.warn('Error getting cached image:', error);
      return url; // Fallback to original URL
    }
  }

  /**
   * Download image and save to cache
   */
  private async downloadAndCache(
    url: string, 
    cachedPath: string, 
    options: ImageCacheOptions = {}
  ): Promise<string> {
    try {
      const downloadResult = await FileSystem.downloadAsync(url, cachedPath);
      
      if (downloadResult.status === 200) {
        // Clean up cache if it's getting too large
        await this.cleanupCache();
        return cachedPath;
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
    } catch (error) {
      logger.warn('Error downloading image:', error);
      return url; // Fallback to original URL
    }
  }

  /**
   * Generate cache key from URL
   */
  private generateCacheKey(url: string): string {
    // Remove query parameters and create a hash-like key
    const cleanUrl = url.split('?')[0];
    const hash = this.simpleHash(cleanUrl);
    const extension = this.getFileExtension(cleanUrl) || 'jpg';
    return `${hash}.${extension}`;
  }

  /**
   * Simple hash function for URLs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get file extension from URL
   */
  private getFileExtension(url: string): string | null {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1] : null;
  }

  /**
   * Clean up cache to maintain size limits
   */
  private async cleanupCache() {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const filePath = `${this.cacheDir}${file}`;
          const info = await FileSystem.getInfoAsync(filePath);
          return {
            name: file,
            path: filePath,
            size: (info as any).size || 0,
            modificationTime: (info as any).modificationTime || 0,
          };
        })
      );

      // Sort by modification time (oldest first)
      fileInfos.sort((a, b) => a.modificationTime - b.modificationTime);

      // Calculate total size
      const totalSize = fileInfos.reduce((sum, file) => sum + file.size, 0);

      // Remove oldest files if cache is too large
      if (totalSize > this.maxCacheSize) {
        const filesToRemove = fileInfos.slice(0, Math.floor(fileInfos.length * 0.3)); // Remove 30% of oldest files
        await Promise.all(
          filesToRemove.map(file => FileSystem.deleteAsync(file.path))
        );
      }
    } catch (error) {
      logger.error('Error cleaning up cache:', error);
    }
  }

  /**
   * Clear all cached images
   */
  async clearCache(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      await Promise.all(
        files.map(file => FileSystem.deleteAsync(`${this.cacheDir}${file}`))
      );
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.cacheDir);
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const info = await FileSystem.getInfoAsync(`${this.cacheDir}${file}`);
          return (info as any).size || 0;
        })
      );
      return fileInfos.reduce((sum: number, size: number) => sum + size, 0);
    } catch (error) {
      logger.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Preload images for better performance
   */
  async preloadImages(urls: string[]): Promise<void> {
    try {
      await Promise.all(
        urls.map(url => this.getCachedImageUri(url))
      );
    } catch (error) {
      logger.warn('Error preloading images:', error);
    }
  }
}

// Create singleton instance
export const imageCache = new ImageCacheManager({
  maxCacheSize: 50, // 50MB cache
  maxAge: 7, // 7 days
});

/**
 * Hook for using cached images
 */
export const useCachedImage = (url: string | null) => {
  const [cachedUri, setCachedUri] = React.useState<string | null>(url);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!url) {
      setCachedUri(null);
      return;
    }

    const loadCachedImage = async () => {
      setLoading(true);
      setError(false);
      
      try {
        const uri = await imageCache.getCachedImageUri(url);
        setCachedUri(uri);
      } catch (err) {
        logger.error('Error loading cached image:', err);
        setError(true);
        setCachedUri(url); // Fallback to original URL
      } finally {
        setLoading(false);
      }
    };

    loadCachedImage();
  }, [url]);

  return { cachedUri, loading, error };
};

/** Photo filter token. Mirrors the union in components/ImageEditModal so
 * any change to the chip list stays type-checked against the URL builder. */
export type CloudinaryFilter = 'original' | 'vivid' | 'warm' | 'cool' | 'bw';

/** Cloudinary effect chain for each chip. Order matters — `e_grayscale`
 * then a tint, etc. Values chosen by eye on a few sample photos; tweak
 * here, every post that uses the filter updates instantly with no
 * re-upload. */
const FILTER_EFFECTS: Record<CloudinaryFilter, string[]> = {
  original: [],
  // Punch up saturation + a touch of contrast.
  vivid: ['e_saturation:60', 'e_contrast:15'],
  // Warm ↑ amber, ↓ blue.
  warm: ['e_red:25', 'e_yellow:15', 'e_blue:-15'],
  // Cool ↑ blue, ↓ amber.
  cool: ['e_blue:25', 'e_cyan:15', 'e_red:-10'],
  // Pure greyscale.
  bw: ['e_grayscale'],
};

/**
 * Optimize Cloudinary URLs for mobile
 */
export const optimizeCloudinaryUrl = (url: string, options: {
  width?: number;
  height?: number;
  quality?: 'auto' | 'auto:low' | 'auto:best' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
  filter?: CloudinaryFilter;
} = {}): string => {
  if (!url.includes('cloudinary.com')) {
    return url;
  }

  const {
    width = 400,
    height = 400,
    quality = 'auto:low',
    format = 'auto',
    filter = 'original',
  } = options;

  const baseUrl = url.split('/upload/')[0];
  const path = url.split('/upload/')[1];

  const transformations = [
    `w_${width}`,
    `h_${height}`,
    'c_limit',
    `q_${quality}`,
    `f_${format}`,
    ...(FILTER_EFFECTS[filter] || []),
  ].join(',');

  return `${baseUrl}/upload/${transformations}/${path}`;
};

/**
 * Apply ONLY the Cloudinary filter effect to an existing URL.
 *
 * Use this when the URL already has its own resize / quality / format
 * transformations baked in (e.g. signed URLs from the backend) and you
 * just want to overlay the user's chosen photo filter on top. Returns
 * the input untouched for `original`, non-Cloudinary URLs, or unknown
 * filter tokens — safe to call on any URL.
 */
export const applyCloudinaryFilter = (url: string, filter?: CloudinaryFilter | string | null): string => {
  if (!url) return url;
  if (!filter || filter === 'original') return url;
  if (!url.includes('cloudinary.com')) return url;
  const effects = FILTER_EFFECTS[filter as CloudinaryFilter];
  if (!effects || effects.length === 0) return url;
  const idx = url.indexOf('/upload/');
  if (idx < 0) return url;
  const baseUrl = url.slice(0, idx);
  const path = url.slice(idx + '/upload/'.length);
  return `${baseUrl}/upload/${effects.join(',')}/${path}`;
};

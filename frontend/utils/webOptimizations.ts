import { Platform } from 'react-native';

/**
 * Web-specific performance optimizations
 */

export const isWeb = Platform.OS === 'web';

/**
 * Debounce function for web performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for web performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastFunc: NodeJS.Timeout | null = null;
  let lastRan: number = 0;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Intersection Observer for lazy loading (web only)
 */
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (!isWeb || typeof window === 'undefined' || !window.IntersectionObserver) {
    return null;
  }
  
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  });
}

/**
 * Request Animation Frame wrapper for smooth animations
 */
export function requestAnimationFrame(callback: () => void): number {
  if (isWeb && typeof window !== 'undefined' && window.requestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16) as unknown as number;
}

/**
 * Cancel Animation Frame wrapper
 */
export function cancelAnimationFrame(id: number): void {
  if (isWeb && typeof window !== 'undefined' && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Web-specific image loading optimization
 */
export function getOptimizedImageUrl(url: string, width?: number): string {
  if (!isWeb || !url) return url;
  
  // If Cloudinary URL, add optimization parameters
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      const optimization = width 
        ? `w_${width},q_auto,f_auto`
        : 'q_auto,f_auto';
      return `${parts[0]}/upload/${optimization}/${parts[1]}`;
    }
  }
  
  return url;
}

/**
 * Remove console logs in production (web)
 */
export function disableConsoleInProduction(): void {
  if (isWeb && typeof window !== 'undefined') {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      console.log = () => {};
      console.debug = () => {};
      console.info = () => {};
    }
  }
}


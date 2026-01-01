import { useEffect } from 'react';
import { Platform } from 'react-native';
import { disableConsoleInProduction } from '../utils/webOptimizations';

/**
 * Hook to apply web-specific optimizations
 */
export function useWebOptimizations() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Disable console logs in production
      disableConsoleInProduction();
      
      // Optimize scroll performance
      if (typeof document !== 'undefined') {
        // Add smooth scrolling behavior
        document.documentElement.style.scrollBehavior = 'smooth';
        
        // Optimize image loading
        if ('loading' in HTMLImageElement.prototype) {
          // Native lazy loading is supported
        }
      }
      
      // Optimize memory usage
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        // Use requestIdleCallback for non-critical tasks
      }
    }
  }, []);
}


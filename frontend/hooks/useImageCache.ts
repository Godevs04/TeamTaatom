import { useState, useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { imageCacheManager } from '../utils/imageCacheManager';

interface UseImageCacheResult {
  imageUri: string | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

export const useImageCache = (imageUrl: string | null): UseImageCacheResult => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadImage = async () => {
    if (!imageUrl) {
      console.log('No image URL provided');
      setLoading(false);
      setError(true);
      return;
    }

    console.log('Loading image:', imageUrl);
    setLoading(true);
    setError(false);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn('Image loading timeout for:', imageUrl);
        setImageUri(imageUrl);
        setLoading(false);
      }
    }, 8000); // 8 second timeout

    try {
      // Use global cache manager for better performance
      await imageCacheManager.prefetchImage(imageUrl);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      console.log('Image loaded successfully:', imageUrl);
      setImageUri(imageUrl);
      setLoading(false);
    } catch (err) {
      console.error('Image prefetch failed for:', imageUrl, err);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Fallback to direct URL
      setImageUri(imageUrl);
      setLoading(false);
    }
  };

  const retry = () => {
    loadImage();
  };

  useEffect(() => {
    loadImage();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [imageUrl]);

  return {
    imageUri,
    loading,
    error,
    retry,
  };
};

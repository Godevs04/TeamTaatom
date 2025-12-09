import { Image } from 'react-native';

interface ImageLoadOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export const loadImageWithFallback = async (
  imageUrl: string,
  options: ImageLoadOptions = {}
): Promise<string> => {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000
  } = options;

  // Strategy 1: Try original URL
  try {
    await Image.prefetch(imageUrl);
    return imageUrl;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Original image failed, trying optimized version');
    }
  }

  // Strategy 2: Try optimized Cloudinary URL (backward compatibility for legacy URLs)
  // Note: New uploads use Sevalla R2 storage URLs which don't need optimization
  if (imageUrl.includes('cloudinary.com')) {
    try {
      const optimizedUrl = generateOptimizedCloudinaryUrl(imageUrl);
      await Image.prefetch(optimizedUrl);
      return optimizedUrl;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Optimized image failed, trying smaller version');
      }
    }

    // Strategy 3: Try even smaller version
    try {
      const smallUrl = generateSmallCloudinaryUrl(imageUrl);
      await Image.prefetch(smallUrl);
      return smallUrl;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Small image failed, using original as fallback');
      }
    }
  }

  // Fallback: Return original URL
  return imageUrl;
};

const generateOptimizedCloudinaryUrl = (originalUrl: string): string => {
  // Extract public ID and generate optimized URL with WebP format and progressive loading
  const urlParts = originalUrl.split('/');
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExtension.split('.')[0];
  
  // Use WebP format (auto-detected by Cloudinary), progressive JPEG flag, and quality optimization
  return `https://res.cloudinary.com/dcvdqhqzc/image/upload/w_800,h_800,c_limit,q_auto:good,f_auto,fl_progressive/taatom/posts/${publicId}`;
};

const generateSmallCloudinaryUrl = (originalUrl: string): string => {
  // Extract public ID and generate small URL for blur-up technique (thumbnail)
  const urlParts = originalUrl.split('/');
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExtension.split('.')[0];
  
  // Small, low-quality image for blur-up placeholder
  return `https://res.cloudinary.com/dcvdqhqzc/image/upload/w_50,h_50,c_limit,q_auto:low,f_auto,fl_progressive,e_blur:200/taatom/posts/${publicId}`;
};

/**
 * Generate a blur-up placeholder URL for progressive image loading
 * This creates a very small, blurred version of the image for instant display
 */
export const generateBlurUpUrl = (originalUrl: string): string => {
  if (!originalUrl.includes('cloudinary.com')) {
    return originalUrl; // Return original if not Cloudinary
  }
  
  const urlParts = originalUrl.split('/');
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExtension.split('.')[0];
  
  // Generate a very small, heavily blurred placeholder (20x20px, blur effect)
  return `https://res.cloudinary.com/dcvdqhqzc/image/upload/w_20,h_20,c_fill,q_auto:low,f_auto,e_blur:400/taatom/posts/${publicId}`;
};

/**
 * Generate WebP format URL for better compression
 */
export const generateWebPUrl = (originalUrl: string, width: number = 800, height: number = 800): string => {
  if (!originalUrl.includes('cloudinary.com')) {
    return originalUrl; // Return original if not Cloudinary
  }
  
  const urlParts = originalUrl.split('/');
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExtension.split('.')[0];
  
  // Force WebP format for better compression
  return `https://res.cloudinary.com/dcvdqhqzc/image/upload/w_${width},h_${height},c_limit,q_auto:good,f_webp,fl_progressive/taatom/posts/${publicId}`;
};

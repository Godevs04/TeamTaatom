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

  // Strategy 2: Try optimized Cloudinary URL
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
  // Extract public ID and generate optimized URL
  const urlParts = originalUrl.split('/');
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExtension.split('.')[0];
  
  return `https://res.cloudinary.com/dcvdqhqzc/image/upload/w_800,h_800,c_limit,q_auto:good,f_auto/taatom/posts/${publicId}`;
};

const generateSmallCloudinaryUrl = (originalUrl: string): string => {
  // Extract public ID and generate small URL
  const urlParts = originalUrl.split('/');
  const publicIdWithExtension = urlParts[urlParts.length - 1];
  const publicId = publicIdWithExtension.split('.')[0];
  
  return `https://res.cloudinary.com/dcvdqhqzc/image/upload/w_400,h_400,c_limit,q_auto:low,f_auto/taatom/posts/${publicId}`;
};

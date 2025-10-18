import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  compress?: boolean;
}

export interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  size: number; // in bytes
  format: string;
}

/**
 * Optimize image for mobile upload
 * Reduces file size while maintaining good quality
 */
export const optimizeImageForUpload = async (
  imageUri: string,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImage> => {
  try {
    const {
      maxWidth = 1200, // Increased for better quality
      maxHeight = 1200, // Increased for better quality
      quality = 0.85, // Increased for better quality while maintaining performance
      format = 'jpeg',
      compress = true
    } = options;

    // Get original image info
    const originalInfo = await FileSystem.getInfoAsync(imageUri);
    if (!originalInfo.exists) {
      throw new Error('Image file not found');
    }

    // Get original image dimensions to maintain aspect ratio
    const originalImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    // Calculate optimal dimensions maintaining aspect ratio
    const aspectRatio = originalImage.width / originalImage.height;
    let targetWidth = maxWidth;
    let targetHeight = maxHeight;

    if (aspectRatio > 1) {
      // Landscape image
      targetHeight = Math.round(maxWidth / aspectRatio);
    } else {
      // Portrait or square image
      targetWidth = Math.round(maxHeight * aspectRatio);
    }

    // Only resize if the image is larger than target dimensions
    const needsResize = originalImage.width > targetWidth || originalImage.height > targetHeight;
    
    const manipulatorOptions: ImageManipulator.Action[] = [];

    // Add resize action only if needed
    if (needsResize) {
      manipulatorOptions.push({
        resize: {
          width: targetWidth,
          height: targetHeight,
        }
      });
    }

    // Add format conversion
    if (format !== 'jpeg') {
      manipulatorOptions.push({
        format: format === 'png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.WEBP,
      } as any);
    }

    // Perform image manipulation with high quality settings
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      manipulatorOptions,
      {
        compress: quality,
        format: format === 'png' ? ImageManipulator.SaveFormat.PNG : 
                format === 'webp' ? ImageManipulator.SaveFormat.WEBP : 
                ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );

    // Get optimized image info
    const optimizedInfo = await FileSystem.getInfoAsync(result.uri);
    
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      size: optimizedInfo.exists ? (optimizedInfo as any).size || 0 : 0,
      format: format,
    };
  } catch (error) {
    console.error('Image optimization error:', error);
    throw new Error('Failed to optimize image');
  }
};

/**
 * Get optimal image dimensions for mobile with high quality
 */
export const getOptimalImageDimensions = (originalWidth: number, originalHeight: number) => {
  const maxWidth = 1200; // Increased for better quality
  const maxHeight = 1200; // Increased for better quality
  
  let { width, height } = { width: originalWidth, height: originalHeight };
  
  // Calculate aspect ratio
  const aspectRatio = width / height;
  
  // Resize maintaining aspect ratio only if significantly larger
  if (width > maxWidth || height > maxHeight) {
    if (aspectRatio > 1) {
      // Landscape
      width = maxWidth;
      height = maxWidth / aspectRatio;
    } else {
      // Portrait
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }
  }
  
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
};

/**
 * Check if image needs optimization - more intelligent approach
 */
export const shouldOptimizeImage = async (imageUri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    if (!info.exists) return false;
    
    // Get image dimensions to make smarter decisions
    const imageInfo = await ImageManipulator.manipulateAsync(imageUri, []);
    
    // Optimize if:
    // 1. File is larger than 2MB (increased threshold for better quality)
    // 2. Image dimensions are larger than 1200x1200
    const maxFileSize = 2 * 1024 * 1024; // 2MB
    const maxDimension = 1200;
    
    const fileSizeTooLarge = (info.size || 0) > maxFileSize;
    const dimensionsTooLarge = imageInfo.width > maxDimension || imageInfo.height > maxDimension;
    
    return fileSizeTooLarge || dimensionsTooLarge;
  } catch (error) {
    console.error('Error checking image size:', error);
    return true; // Optimize by default if we can't check
  }
};

/**
 * Get image compression quality based on file size - optimized for quality
 */
export const getOptimalQuality = (fileSize: number): number => {
  if (fileSize < 500 * 1024) return 0.95; // < 500KB, very high quality
  if (fileSize < 1024 * 1024) return 0.9; // < 1MB, high quality
  if (fileSize < 2 * 1024 * 1024) return 0.85; // < 2MB, good quality
  if (fileSize < 5 * 1024 * 1024) return 0.8; // < 5MB, medium-high quality
  return 0.75; // > 5MB, medium quality (still good)
};

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import logger from '../utils/logger';
import { isHighLatency } from '../utils/connectivity';

export interface PreparedImage {
  uri: string;
  type: string;
  name: string;
}

/**
 * Pre-processes a photo before FormData upload.
 * 
 * 1. [BUG-056] Privacy: Strips all EXIF metadata (GPS coordinates, device info) by running
 *    it through expo-image-manipulator (which creates a new image file containing only raw pixels).
 * 2. [BUG-058] Media Quality: Checks the file size. If it exceeds 2MB, it downscales the
 *    width to 1200px (maintaining aspect ratio) and sets the compression quality to 0.8.
 * 
 * @param imageUri - Local URI of the image to process
 * @param originalName - Original filename (if available)
 * @returns Cleaned and scaled image payload for FormData
 */
export const prepareImageForUpload = async (
  imageUri: string,
  originalName?: string
 ): Promise<PreparedImage> => {
  try {
    const filename = originalName || imageUri.split('/').pop() || 'upload.jpg';
    const extension = filename.split('.').pop()?.toLowerCase();
    const isPng = extension === 'png';
    const format = isPng ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG;
    const type = isPng ? 'image/png' : 'image/jpeg';

    // Check the file size
    let fileSize = 0;
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      fileSize = (fileInfo.exists && (fileInfo as any).size) || 0;
    } catch (sizeError) {
      logger.warn('Failed to retrieve file size in mediaService, using default scaling', sizeError);
    }

    const sizeInMB = fileSize / (1024 * 1024);
    const actions: ImageManipulator.Action[] = [];
    let compressValue = 0.9; // Default high quality
    let targetWidth = 1200;

    // Read the dynamic network latency status
    if (isHighLatency) {
      logger.debug('High latency connection detected. Aggressively scaling and compressing for upload.');
      targetWidth = 800;
      compressValue = 0.6;
    } else if (sizeInMB > 2) {
      logger.debug(`Image exceeds 2MB (${sizeInMB.toFixed(2)}MB). Scaling and compressing...`);
      targetWidth = 1200;
      compressValue = 0.8;
    } else {
      logger.debug(`Image size is ${sizeInMB.toFixed(2)}MB. Stripping EXIF metadata...`);
    }

    // [BUG-058] Upload Compression Scaling
    if (isHighLatency || sizeInMB > 2) {
      // Get image dimensions to maintain aspect ratio
      const imageInfo = await ImageManipulator.manipulateAsync(imageUri, [], { format });
      if (imageInfo.width > targetWidth) {
        actions.push({
          resize: {
            width: targetWidth,
            height: Math.round(imageInfo.height * (targetWidth / imageInfo.width))
          }
        });
      }
    }

    // [BUG-056] EXIF Data Stripping
    // Passing any actions (even empty) to manipulateAsync will output a fresh, clean JPEG/PNG file
    // that lacks the EXIF metadata header from the original camera asset.
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      actions,
      {
        compress: compressValue,
        format,
        base64: false
      }
    );

    logger.debug(`Successfully prepared image for upload: EXIF stripped. Size optimized.`);
    return {
      uri: result.uri,
      type,
      name: filename
    };
  } catch (error) {
    logger.error('Error in mediaService.prepareImageForUpload:', error);
    // Fallback to avoid blocking the user's flow
    return {
      uri: imageUri,
      type: 'image/jpeg',
      name: originalName || 'upload.jpg'
    };
  }
};

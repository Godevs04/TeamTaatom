const logger = require('../../utils/logger');
const { buildMediaKey, uploadObject, getDownloadUrl } = require('../../services/storage');
const fetch = require('node-fetch');

/**
 * Process image job - Migrated to Sevalla Object Storage
 * 
 * Note: This job processor downloads an image from a URL, processes it (if needed),
 * and uploads it to Sevalla Object Storage.
 * 
 * For image transformations, consider using a client-side library like sharp
 * before uploading, or implement a separate image processing service.
 */
const processImageJob = async (job) => {
  const { imageUrl, transformations, publicId } = job.data;

  try {
    // Download image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Generate storage key
    const extension = contentType.split('/')[1] || 'jpg';
    const storageKey = buildMediaKey({
      type: 'post',
      filename: publicId || `processed_${Date.now()}`,
      extension
    });
    
    // Upload to Sevalla Object Storage
    const uploadResult = await uploadObject(imageBuffer, storageKey, contentType);
    
    logger.info(`Image processed and uploaded successfully: ${storageKey}`);
    return { 
      success: true, 
      url: uploadResult.url, 
      publicId: storageKey,
      storageKey: storageKey
    };
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
};

module.exports = {
  processImageJob,
};


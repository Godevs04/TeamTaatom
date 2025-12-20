const cloudinary = require('cloudinary').v2;
const logger = require('../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Verify Cloudinary configuration
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  logger.warn('⚠️  Cloudinary credentials not fully configured - Media upload features may not work');
} else {
  logger.info('✅ Cloudinary configured successfully');
}

// Upload image function
const uploadImage = async (buffer, options = {}) => {
  try {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: options.folder || 'taatom',
          resource_type: options.resource_type || 'image',
          // IMPORTANT: Avoid synchronous video transcoding. Only apply transformations for images.
          transformation: options.resource_type === 'image' ? [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good', format: 'auto' }
          ] : undefined,
          // For big videos, ask Cloudinary to process derived versions asynchronously
          eager: options.resource_type === 'video' ? [
            { width: 720, height: 1280, crop: 'limit', quality: 'auto:good', format: 'mp4' }
          ] : undefined,
          eager_async: options.resource_type === 'video' ? true : undefined,
          ...options
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    logger.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Delete image function
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    logger.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Generate optimized URL for faster loading
const getOptimizedImageUrl = (publicId, options = {}) => {
  const {
    width = 800,
    height = 800,
    quality = 'auto:good',
    format = 'auto'
  } = options;

  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop: 'limit', quality, format }
    ]
  });
};

// Generate a JPEG thumbnail URL for a video public id
const getVideoThumbnailUrl = (publicId, options = {}) => {
  const {
    width = 720,
    height = 1280,
    quality = 'auto:good',
  } = options;

  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width, height, crop: 'limit', quality },
      { start_offset: 'auto' }
    ]
  });
};

// Upload song (audio file) to Cloudinary
const uploadSong = async (buffer, filename, mimetype) => {
  try {
    return new Promise((resolve, reject) => {
      // Sanitize filename for public_id (remove extension)
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '');
      const publicId = `taatom/songs/${Date.now()}-${sanitizedFilename}`;

      cloudinary.uploader.upload_stream(
        {
          resource_type: 'video', // Cloudinary treats audio files as video
          public_id: publicId, // Full path in public_id, no folder needed
          // Don't specify format - Cloudinary will preserve original format
          // Don't apply transformations for audio - keep original quality
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary song upload error:', error);
            reject(error);
          } else {
            logger.debug('Cloudinary song upload successful:', { 
              publicId: result.public_id, 
              url: result.secure_url 
            });
            resolve({
              key: result.public_id, // Store public_id as key for deletion
              url: result.secure_url, // Full Cloudinary URL
              publicId: result.public_id
            });
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    logger.error('Error uploading song to Cloudinary:', error);
    throw error;
  }
};

// Delete song from Cloudinary
const deleteSong = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'video'
    });
    logger.debug('Cloudinary song deletion result:', result);
    return result;
  } catch (error) {
    logger.error('Error deleting song from Cloudinary:', error);
    throw error;
  }
};

// Upload locale image to Cloudinary
const uploadLocaleImage = async (buffer, filename, mimetype) => {
  try {
    return new Promise((resolve, reject) => {
      // Sanitize filename for public_id (remove extension)
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '');
      const publicId = `taatom/locales/${Date.now()}-${sanitizedFilename}`;

      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: publicId, // Full path in public_id, no folder needed
          transformation: [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto:good', format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary locale image upload error:', error);
            reject(error);
          } else {
            logger.debug('Cloudinary locale image upload successful:', { 
              publicId: result.public_id, 
              url: result.secure_url 
            });
            resolve({
              key: result.public_id, // Store public_id as key for deletion
              url: result.secure_url, // Full Cloudinary URL
              publicId: result.public_id
            });
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    logger.error('Error uploading locale image to Cloudinary:', error);
    throw error;
  }
};

// Delete locale image from Cloudinary
const deleteLocaleImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image'
    });
    logger.debug('Cloudinary locale image deletion result:', result);
    return result;
  } catch (error) {
    logger.error('Error deleting locale image from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  getOptimizedImageUrl,
  getVideoThumbnailUrl,
  uploadSong,
  deleteSong,
  uploadLocaleImage,
  deleteLocaleImage
};

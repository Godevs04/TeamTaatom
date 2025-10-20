const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcvdqhqzc',
  api_key: process.env.CLOUDINARY_API_KEY || '334331849171356',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'iE5awSFtO-dNpFoMFKXOfJlGD2U'
});

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
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

// Delete image function
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
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

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  getOptimizedImageUrl,
  getVideoThumbnailUrl
};

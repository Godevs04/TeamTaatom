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
          transformation: options.resource_type === 'video' ? [
            { width: 720, height: 1280, crop: 'limit', quality: 'auto' }
          ] : [
            { width: 800, height: 800, crop: 'limit', quality: 'auto' }
          ],
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

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage
};

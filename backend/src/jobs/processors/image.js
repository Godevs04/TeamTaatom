const cloudinary = require('cloudinary').v2;
const logger = require('../../utils/logger');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Process image job
const processImageJob = async (job) => {
  const { imageUrl, transformations, publicId } = job.data;

  try {
    const options = {
      transformation: transformations || [
        { width: 1080, height: 1080, crop: 'limit', quality: 'auto' },
      ],
      folder: 'taatom',
      ...(publicId && { public_id: publicId }),
    };

    const result = await cloudinary.uploader.upload(imageUrl, options);
    logger.info(`Image processed successfully: ${result.public_id}`);
    return { success: true, url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    logger.error('Error processing image:', error);
    throw error;
  }
};

module.exports = {
  processImageJob,
};


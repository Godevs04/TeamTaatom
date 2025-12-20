const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL; // Optional CDN URL

// Verify AWS S3 connection on module load
const verifyS3Connection = async () => {
  try {
    if (!BUCKET_NAME) {
      logger.warn('⚠️  AWS_S3_BUCKET_NAME not configured - Song upload feature will not work');
      return false;
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      logger.warn('⚠️  AWS credentials not configured - Song upload feature will not work');
      return false;
    }

    if (!CLOUDFRONT_URL) {
      logger.warn('⚠️  AWS_CLOUDFRONT_URL not configured - CloudFront URL is required for private bucket access');
      logger.warn('   Songs will upload but may not be accessible. Please configure CloudFront OAC.');
    }

    // Try to list bucket to verify connection
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    logger.info(`✅ AWS S3 connection successful - Bucket: ${BUCKET_NAME}, Region: ${process.env.AWS_REGION || 'us-east-1'}`);
    
    if (CLOUDFRONT_URL) {
      logger.info(`✅ CloudFront CDN configured: ${CLOUDFRONT_URL}`);
      logger.info('   Using private bucket with CloudFront OAC (Origin Access Control)');
    } else {
      logger.warn('⚠️  CloudFront URL not set - ensure bucket is configured with CloudFront OAC');
    }
    
    return true;
  } catch (error) {
    logger.error('❌ AWS S3 connection failed:', error.message);
    logger.error('   Please check:');
    logger.error('   - AWS_ACCESS_KEY_ID is set correctly');
    logger.error('   - AWS_SECRET_ACCESS_KEY is set correctly');
    logger.error('   - AWS_S3_BUCKET_NAME exists and is accessible');
    logger.error('   - AWS_REGION matches your bucket region');
    logger.error('   - AWS_CLOUDFRONT_URL is set (required for private bucket)');
    logger.warn('⚠️  Song upload feature will not work until AWS S3 is properly configured');
    return false;
  }
};

// Verify connection on module load (non-blocking)
verifyS3Connection().catch(err => {
  logger.error('Error during S3 connection verification:', err);
});

// Upload song to S3 (private bucket with CloudFront OAC)
const uploadSong = async (buffer, filename, mimetype) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET_NAME is not configured');
    }

    if (!CLOUDFRONT_URL) {
      throw new Error('AWS_CLOUDFRONT_URL is not configured. CloudFront URL is required for private bucket access.');
    }

    // Generate unique key with timestamp for better organization
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `songs/${Date.now()}-${sanitizedFilename}`;
    
    // Upload to private S3 bucket (no ACL - bucket owner enforced)
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      CacheControl: 'max-age=31536000' // 1 year cache
      // Note: No ACL parameter - bucket uses "Bucket owner enforced" (ACLs disabled)
    };

    logger.debug('Uploading to S3:', { bucket: BUCKET_NAME, key, contentType: mimetype });
    const result = await s3.upload(params).promise();
    
    // Use CloudFront URL for access (private bucket accessed via CloudFront OAC)
    const fileUrl = `${CLOUDFRONT_URL}/${result.Key}`;
    
    logger.debug('S3 upload successful:', { key: result.Key, fileUrl });
    
    return {
      key: result.Key,
      url: fileUrl, // Always use CloudFront URL
      bucket: result.Bucket
    };
  } catch (error) {
    logger.error('S3 upload error:', error);
    
    // Provide specific error messages
    if (error.code === 'AccessControlListNotSupported') {
      throw new Error('S3 bucket does not allow ACLs. Please ensure bucket uses "Bucket owner enforced" and remove ACL parameters from upload code.');
    }
    
    throw error;
  }
};

// Generate pre-signed URL (if using private bucket)
const getPresignedUrl = (key, expiresIn = 3600) => {
  try {
    return s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    });
  } catch (error) {
    logger.error('S3 presigned URL error:', error);
    throw error;
  }
};

// Delete song from S3
const deleteSong = async (key) => {
  try {
    return s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: key
    }).promise();
  } catch (error) {
    logger.error('S3 delete error:', error);
    throw error;
  }
};

// Upload locale image to S3 (private bucket with CloudFront OAC)
const uploadLocaleImage = async (buffer, filename, mimetype) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET_NAME is not configured');
    }

    if (!CLOUDFRONT_URL) {
      throw new Error('AWS_CLOUDFRONT_URL is not configured. CloudFront URL is required for private bucket access.');
    }

    // Generate unique key with timestamp for better organization
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `locales/${Date.now()}-${sanitizedFilename}`;
    
    // Upload to private S3 bucket (no ACL - bucket owner enforced)
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      CacheControl: 'max-age=31536000' // 1 year cache
      // Note: No ACL parameter - bucket uses "Bucket owner enforced" (ACLs disabled)
    };

    logger.debug('Uploading locale image to S3:', { bucket: BUCKET_NAME, key, contentType: mimetype });
    const result = await s3.upload(params).promise();
    
    // Use CloudFront URL for access (private bucket accessed via CloudFront OAC)
    const fileUrl = `${CLOUDFRONT_URL}/${result.Key}`;
    
    logger.debug('S3 locale image upload successful:', { key: result.Key, fileUrl });
    
    return {
      key: result.Key,
      url: fileUrl, // Always use CloudFront URL
      bucket: result.Bucket
    };
  } catch (error) {
    logger.error('S3 locale image upload error:', error);
    
    // Provide specific error messages
    if (error.code === 'AccessControlListNotSupported') {
      throw new Error('S3 bucket does not allow ACLs. Please ensure bucket uses "Bucket owner enforced" and remove ACL parameters from upload code.');
    }
    
    throw error;
  }
};

// Delete locale image from S3
const deleteLocaleImage = async (key) => {
  try {
    return s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: key
    }).promise();
  } catch (error) {
    logger.error('S3 locale image delete error:', error);
    throw error;
  }
};

module.exports = {
  s3,
  uploadSong,
  uploadLocaleImage,
  getPresignedUrl,
  deleteSong,
  deleteLocaleImage,
  BUCKET_NAME,
  verifyS3Connection
};


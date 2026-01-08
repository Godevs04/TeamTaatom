/**
 * Unified Storage Service for Sevalla Object Storage (Cloudflare R2, S3-compatible)
 * 
 * This service provides a unified interface for all file storage operations,
 * replacing Cloudinary and AWS S3 with Sevalla Object Storage.
 * 
 * All storage operations use pre-signed URLs for security:
 * - Upload: Backend generates pre-signed PUT URL, client uploads directly
 * - View: Backend generates pre-signed GET URL for viewing media
 * - Delete: Backend handles deletion directly
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Initialize S3-compatible client for Sevalla Object Storage
const s3Client = new S3Client({
  region: process.env.SEVALLA_STORAGE_REGION || 'auto',
  endpoint: process.env.SEVALLA_STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.SEVALLA_STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.SEVALLA_STORAGE_SECRET_KEY,
  },
  // Force path-style addressing for S3-compatible services
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.SEVALLA_STORAGE_BUCKET;

// Verify storage configuration
if (!BUCKET_NAME || !process.env.SEVALLA_STORAGE_ENDPOINT || !process.env.SEVALLA_STORAGE_ACCESS_KEY || !process.env.SEVALLA_STORAGE_SECRET_KEY) {
  logger.warn('⚠️  Sevalla storage credentials not fully configured - Media upload features may not work');
} else {
  logger.info('✅ Sevalla storage service initialized');
}

/**
 * Build a deterministic storage key for a file
 * @param {Object} params - Key parameters
 * @param {string} params.type - Media type: 'post', 'profile', 'song', 'locale', 'short'
 * @param {string} params.userId - User ID (optional, for user-specific content)
 * @param {string} params.filename - Original filename (optional)
 * @param {string} params.extension - File extension (optional)
 * @returns {string} Storage key/path
 */
const buildMediaKey = ({ type, userId, filename, extension }) => {
  const timestamp = Date.now();
  const uniqueId = uuidv4().split('-')[0]; // Short unique ID
  
  // Sanitize filename if provided
  let sanitizedFilename = '';
  if (filename) {
    sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^/.]+$/, '');
  }
  
  // Determine extension
  const ext = extension || (filename ? filename.split('.').pop() : 'jpg');
  
  // Build path based on type
  let basePath = '';
  switch (type) {
    case 'post':
    case 'short':
      // Organize posts by user ID for better organization and management
      basePath = `posts/${userId || 'unknown'}/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
      break;
    case 'profile':
      basePath = `profiles/${userId || 'unknown'}/${timestamp}-${uniqueId}`;
      break;
    case 'song':
      basePath = `songs/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
      break;
    case 'locale':
      basePath = `locales/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
      break;
    default:
      basePath = `misc/${timestamp}-${uniqueId}${sanitizedFilename ? `-${sanitizedFilename}` : ''}`;
  }
  
  return `${basePath}.${ext}`;
};

/**
 * Generate a pre-signed PUT URL for uploading a file
 * @param {string} key - Storage key
 * @param {string} contentType - MIME type (e.g., 'image/jpeg', 'video/mp4')
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour, max: 604800 = 7 days)
 * @returns {Promise<string>} Pre-signed PUT URL
 */
const getUploadUrl = async (key, contentType, expiresIn = 3600) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('SEVALLA_STORAGE_BUCKET is not configured');
    }

    // AWS S3-compatible services (including R2) have a maximum expiration of 7 days (604800 seconds)
    const MAX_EXPIRATION = 604800; // 7 days in seconds
    const validExpiresIn = Math.min(expiresIn, MAX_EXPIRATION);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      // Cache control for better CDN performance
      CacheControl: 'max-age=31536000', // 1 year
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: validExpiresIn });
    
    logger.debug('Generated upload URL:', { key, contentType, expiresIn: validExpiresIn });
    return url;
  } catch (error) {
    logger.error('Error generating upload URL:', error);
    throw error;
  }
};

/**
 * Generate a pre-signed GET URL for viewing/downloading a file
 * @param {string} key - Storage key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour, max: 604800 = 7 days)
 * @returns {Promise<string>} Pre-signed GET URL
 */
const getDownloadUrl = async (key, expiresIn = 3600) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('SEVALLA_STORAGE_BUCKET is not configured');
    }

    // AWS S3-compatible services (including R2) have a maximum expiration of 7 days (604800 seconds)
    const MAX_EXPIRATION = 604800; // 7 days in seconds
    const validExpiresIn = Math.min(expiresIn, MAX_EXPIRATION);

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: validExpiresIn });
    
    logger.debug('Generated download URL:', { key, expiresIn: validExpiresIn });
    return url;
  } catch (error) {
    logger.error('Error generating download URL:', error);
    throw error;
  }
};

/**
 * Upload a file using multipart upload for large files (>100MB)
 * @param {Buffer} buffer - File buffer
 * @param {string} key - Storage key
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} Upload result with key and URL
 */
const uploadObjectMultipart = async (buffer, key, contentType) => {
  const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB - use multipart for files larger than this
  const PART_SIZE = 10 * 1024 * 1024; // 10MB per part (minimum 5MB, but 10MB is more efficient)
  
  let uploadId = null; // Track uploadId for cleanup on error
  
  try {
    if (!BUCKET_NAME) {
      throw new Error('SEVALLA_STORAGE_BUCKET is not configured');
    }

    // For files smaller than threshold, use simple upload
    if (buffer.length < MULTIPART_THRESHOLD) {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'max-age=31536000',
      });

      await s3Client.send(command);
      logger.debug('Uploaded object (simple):', { key, contentType, size: buffer.length });
      
      const url = await getDownloadUrl(key, 604800);
      return { key, url };
    }

    // For large files, use multipart upload
    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    logger.info('Starting multipart upload for large file:', { 
      key, 
      size: `${fileSizeMB}MB`, 
      contentType,
      totalParts: Math.ceil(buffer.length / PART_SIZE)
    });
    
    // Step 1: Initialize multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    });
    
    const createResult = await s3Client.send(createCommand);
    uploadId = createResult.UploadId;
    logger.debug('Multipart upload initialized:', { key, uploadId });

    // Step 2: Upload parts
    const parts = [];
    const totalParts = Math.ceil(buffer.length / PART_SIZE);
    
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, buffer.length);
      const partBuffer = buffer.slice(start, end);

      const uploadPartCommand = new UploadPartCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: partBuffer,
      });

      const { ETag } = await s3Client.send(uploadPartCommand);
      parts.push({ PartNumber: partNumber, ETag });
      
      // Log progress every 10% or at key milestones
      if (partNumber % Math.max(1, Math.floor(totalParts / 10)) === 0 || 
          partNumber === 1 || 
          partNumber === totalParts) {
        logger.debug(`Uploaded part ${partNumber}/${totalParts}:`, { 
          key, 
          partNumber, 
          partSize: `${(partBuffer.length / (1024 * 1024)).toFixed(2)}MB`,
          progress: `${Math.round((partNumber / totalParts) * 100)}%`
        });
      }
    }

    // Step 3: Complete multipart upload
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await s3Client.send(completeCommand);
    logger.info('Multipart upload completed:', { 
      key, 
      totalParts, 
      size: `${fileSizeMB}MB`,
      uploadId 
    });
    
    const url = await getDownloadUrl(key, 604800);
    return { key, url };
  } catch (error) {
    logger.error('Error in multipart upload:', {
      error: error.message || error,
      key,
      uploadId,
      stack: error.stack
    });
    
    // If multipart upload was initialized but failed, try to abort it
    if (uploadId) {
      try {
        const abortCommand = new AbortMultipartUploadCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          UploadId: uploadId,
        });
        await s3Client.send(abortCommand);
        logger.debug('Aborted multipart upload:', { key, uploadId });
      } catch (abortError) {
        logger.error('Failed to abort multipart upload:', {
          error: abortError.message || abortError,
          key,
          uploadId
        });
      }
    }
    
    throw error;
  }
};

/**
 * Upload a file directly to storage (for server-side uploads)
 * Automatically uses multipart upload for large files (>100MB)
 * @param {Buffer} buffer - File buffer
 * @param {string} key - Storage key
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} Upload result with key and URL
 */
const uploadObject = async (buffer, key, contentType) => {
  try {
    // Use multipart upload for large files
    return await uploadObjectMultipart(buffer, key, contentType);
  } catch (error) {
    logger.error('Error uploading object:', error);
    throw error;
  }
};

/**
 * Delete an object from storage
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
const deleteObject = async (key) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('SEVALLA_STORAGE_BUCKET is not configured');
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    logger.debug('Deleted object:', { key });
  } catch (error) {
    logger.error('Error deleting object:', error);
    throw error;
  }
};

/**
 * Check if an object exists in storage
 * @param {string} key - Storage key
 * @returns {Promise<boolean>}
 */
const objectExists = async (key) => {
  try {
    if (!BUCKET_NAME) {
      return false;
    }

    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    logger.error('Error checking object existence:', error);
    throw error;
  }
};

/**
 * Get a public URL for an object (if bucket is public)
 * Note: This assumes the bucket has a public domain/CDN configured
 * For private buckets, use getDownloadUrl() instead
 * @param {string} key - Storage key
 * @param {string} baseUrl - Base URL for the storage (optional, from env)
 * @returns {string} Public URL
 */
const getPublicUrl = (key, baseUrl = null) => {
  // If a custom base URL is provided via env, use it
  const customBaseUrl = process.env.SEVALLA_STORAGE_PUBLIC_URL || baseUrl;
  if (customBaseUrl) {
    return `${customBaseUrl.replace(/\/$/, '')}/${key}`;
  }
  
  // Otherwise, construct from endpoint (may not work for all S3-compatible services)
  const endpoint = process.env.SEVALLA_STORAGE_ENDPOINT || '';
  if (endpoint) {
    // Extract domain from endpoint (e.g., https://xxx.r2.cloudflarestorage.com)
    const url = new URL(endpoint);
    return `${url.protocol}//${BUCKET_NAME}.${url.hostname}/${key}`;
  }
  
  // Fallback: return null to indicate public URL is not available
  return null;
};

module.exports = {
  buildMediaKey,
  getUploadUrl,
  getDownloadUrl,
  uploadObject,
  deleteObject,
  objectExists,
  getPublicUrl,
  BUCKET_NAME,
  s3Client,
};


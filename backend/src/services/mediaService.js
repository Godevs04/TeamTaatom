/**
 * Centralized Media Service for Dynamic Signed URL Generation
 * 
 * This service ensures signed URLs are NEVER stored in the database.
 * URLs are generated on-demand with appropriate expiration times.
 * 
 * Expiry Rules:
 * - Audio/Video: 15 minutes (900 seconds)
 * - Images: 5 minutes (300 seconds)
 * - Profile Pictures: 10 minutes (600 seconds)
 */

const { getDownloadUrl } = require('./storage');
const logger = require('../utils/logger');

// Expiration times in seconds
const EXPIRY_TIMES = {
  AUDIO: 900,      // 15 minutes
  VIDEO: 900,      // 15 minutes
  IMAGE: 300,      // 5 minutes
  PROFILE: 600,    // 10 minutes
  LOCALE: 300,     // 5 minutes
  DEFAULT: 600     // 10 minutes
};

/**
 * Generate signed URL for a media object key
 * @param {string} storageKey - Object key in storage
 * @param {string} mediaType - Type: 'audio', 'video', 'image', 'profile', 'locale'
 * @returns {Promise<string|null>} Signed URL or null if key is invalid
 */
const generateSignedUrl = async (storageKey, mediaType = 'DEFAULT') => {
  if (!storageKey || typeof storageKey !== 'string' || storageKey.trim() === '') {
    logger.warn('Invalid storage key provided to generateSignedUrl:', { storageKey, mediaType });
    return null;
  }

  try {
    const expiryTime = EXPIRY_TIMES[mediaType.toUpperCase()] || EXPIRY_TIMES.DEFAULT;
    const signedUrl = await getDownloadUrl(storageKey.trim(), expiryTime);
    
    logger.debug('Generated signed URL:', { 
      storageKey, 
      mediaType, 
      expirySeconds: expiryTime 
    });
    
    return signedUrl;
  } catch (error) {
    logger.error('Error generating signed URL:', {
      storageKey,
      mediaType,
      error: error.message
    });
    return null;
  }
};

/**
 * Generate signed URLs for multiple media objects
 * @param {string[]} storageKeys - Array of object keys
 * @param {string} mediaType - Type: 'audio', 'video', 'image', 'profile', 'locale'
 * @returns {Promise<string[]>} Array of signed URLs (null for invalid keys)
 */
const generateSignedUrls = async (storageKeys, mediaType = 'DEFAULT') => {
  if (!Array.isArray(storageKeys) || storageKeys.length === 0) {
    return [];
  }

  const urlPromises = storageKeys.map(key => 
    generateSignedUrl(key, mediaType).catch(() => null)
  );

  return Promise.all(urlPromises);
};

/**
 * Extract storage key from a signed URL (for migration purposes)
 * @param {string} signedUrl - Full signed URL
 * @returns {string|null} Storage key or null if extraction fails
 */
const extractStorageKeyFromUrl = (signedUrl) => {
  if (!signedUrl || typeof signedUrl !== 'string') {
    return null;
  }

  try {
    const url = new URL(signedUrl);
    // Remove leading slash and query parameters
    const path = url.pathname.replace(/^\//, '');
    
    // Extract bucket name if present (format: bucket-name.domain.com/path)
    // For R2: f6d1d15e6f0b37b4b8fcad3c41a7922d.r2.cloudflarestorage.com/taatom-dev-4r1i8/path
    const pathParts = path.split('/');
    
    // Skip bucket name (first part) if it looks like a bucket identifier
    // Otherwise, use the full path
    if (pathParts.length > 1 && pathParts[0].includes('taatom')) {
      return pathParts.slice(1).join('/');
    }
    
    return path;
  } catch (error) {
    logger.warn('Failed to extract storage key from URL:', { signedUrl, error: error.message });
    return null;
  }
};

/**
 * Check if a URL is a signed URL (contains query parameters)
 * @param {string} url - URL to check
 * @returns {boolean} True if URL appears to be signed
 */
const isSignedUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Check for common signed URL indicators
  return url.includes('X-Amz-') || 
         url.includes('?') && (url.includes('Signature=') || url.includes('Expires='));
};

/**
 * Get the best available storage key from a document
 * Priority: storageKey > cloudinaryKey > s3Key > extracted from URL
 * @param {Object} doc - Document with potential storage keys/URLs
 * @param {string} urlField - Field name containing URL (e.g., 's3Url', 'cloudinaryUrl')
 * @returns {string|null} Storage key or null
 */
const getStorageKeyFromDocument = (doc, urlField = null) => {
  if (!doc) return null;

  // Priority 1: Direct storage key fields
  if (doc.storageKey) return doc.storageKey;
  if (doc.cloudinaryKey) return doc.cloudinaryKey;
  if (doc.s3Key) return doc.s3Key;
  if (doc.imageKey) return doc.imageKey;
  if (doc.profilePicStorageKey) return doc.profilePicStorageKey;

  // Priority 2: Extract from URL if provided
  if (urlField && doc[urlField]) {
    const extracted = extractStorageKeyFromUrl(doc[urlField]);
    if (extracted) return extracted;
  }

  // Priority 3: Try common URL field names
  const urlFields = ['cloudinaryUrl', 's3Url', 'imageUrl', 'videoUrl', 'profilePic'];
  for (const field of urlFields) {
    if (doc[field]) {
      const extracted = extractStorageKeyFromUrl(doc[field]);
      if (extracted) return extracted;
    }
  }

  return null;
};

module.exports = {
  generateSignedUrl,
  generateSignedUrls,
  extractStorageKeyFromUrl,
  isSignedUrl,
  getStorageKeyFromDocument,
  EXPIRY_TIMES
};


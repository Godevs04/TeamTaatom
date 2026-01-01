const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Firebase Admin SDK Configuration
 * 
 * Initializes Firebase Admin using environment variables for production safety.
 * Required environment variables:
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - FIREBASE_CLIENT_EMAIL: Service account client email
 * - FIREBASE_PRIVATE_KEY_BASE64: Service account private key encoded in base64 (recommended for cloud deployments)
 *   OR FIREBASE_PRIVATE_KEY: Service account private key (fallback for local development)
 * 
 * Note: Using base64 encoding prevents issues with newlines and special characters in cloud environments.
 */
let firebaseAdmin = null;

const initializeFirebase = () => {
  // Check if already initialized
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  try {
    // Validate required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64;
    const privateKeyFallback = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail) {
      logger.warn('Firebase Admin SDK: Missing required environment variables. Push notifications will be disabled.');
      logger.warn('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL');
      return null;
    }

    let privateKey;

    // Priority 1: Use base64-encoded key (recommended for cloud deployments)
    if (privateKeyBase64) {
      try {
        // Remove quotes if present (common when copying from JSON or .env)
        let cleanedBase64 = privateKeyBase64.trim();
        if ((cleanedBase64.startsWith('"') && cleanedBase64.endsWith('"')) || 
            (cleanedBase64.startsWith("'") && cleanedBase64.endsWith("'"))) {
          cleanedBase64 = cleanedBase64.slice(1, -1);
        }
        
        // Remove any whitespace/newlines from base64 string (base64 should be continuous)
        cleanedBase64 = cleanedBase64.replace(/\s/g, '').replace(/\n/g, '').replace(/\r/g, '');
        
        // Decode base64 to get the actual private key
        const decoded = Buffer.from(cleanedBase64, 'base64').toString('utf8');
        
        // Validate decoded content
        if (!decoded || decoded.length === 0) {
          logger.error('Firebase: Decoded key is empty');
          return null;
        }
        
        // Start with the decoded key
        privateKey = decoded;
        
        // Handle different formats that might be in the decoded string
        // Case 1: Key has literal \n escape sequences (from JSON)
        if (privateKey.includes('\\n')) {
          privateKey = privateKey.replace(/\\n/g, '\n');
        }
        
        // Case 2: Key has no newlines at all (single line)
        if (!privateKey.includes('\n')) {
          // Try to detect and add newlines around BEGIN/END markers
          if (privateKey.includes('BEGIN PRIVATE KEY-----')) {
            privateKey = privateKey.replace(
              /(-----BEGIN PRIVATE KEY-----)([^-]+)(-----END PRIVATE KEY-----)/,
              '$1\n$2\n$3'
            );
          } else if (privateKey.includes('BEGIN RSA PRIVATE KEY-----')) {
            privateKey = privateKey.replace(
              /(-----BEGIN RSA PRIVATE KEY-----)([^-]+)(-----END RSA PRIVATE KEY-----)/,
              '$1\n$2\n$3'
            );
          }
        }
        
        // Final validation: ensure it's a proper PEM key
        const hasBegin = privateKey.includes('BEGIN PRIVATE KEY') || privateKey.includes('BEGIN RSA PRIVATE KEY');
        const hasEnd = privateKey.includes('END PRIVATE KEY') || privateKey.includes('END RSA PRIVATE KEY');
        
        if (!hasBegin || !hasEnd) {
          logger.error('Firebase: Decoded key does not appear to be a valid PEM format');
          logger.error('Expected format: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----');
          logger.error('Make sure you encoded the complete private key including BEGIN/END lines');
          return null;
        }
        
        logger.debug('Firebase: Using base64-encoded private key (decoded and validated)');
      } catch (decodeError) {
        logger.error('Firebase: Failed to decode base64 private key:', decodeError.message);
        logger.error('Make sure FIREBASE_PRIVATE_KEY_BASE64 contains a valid base64 string');
        logger.error('Tip: Use the helper script: node scripts/encode-firebase-key.js');
        return null;
      }
    } 
    // Priority 2: Fallback to plain private key (for local development)
    else if (privateKeyFallback) {
      // Replace escaped newlines in private key (common when storing in .env)
      privateKey = privateKeyFallback.replace(/\\n/g, '\n');
      logger.debug('Firebase: Using plain private key (fallback mode)');
    } 
    else {
      logger.warn('Firebase Admin SDK: Missing private key. Push notifications will be disabled.');
      logger.warn('Required: FIREBASE_PRIVATE_KEY_BASE64 (recommended) or FIREBASE_PRIVATE_KEY (fallback)');
      return null;
    }
    
    // Validate the private key format before using it
    if (!privateKey || typeof privateKey !== 'string') {
      logger.error('Firebase: Invalid private key format');
      return null;
    }
    
    // Final validation: ensure key contains required PEM markers
    if (!privateKey.includes('PRIVATE KEY') || !privateKey.includes('-----')) {
      logger.error('Firebase: Private key does not appear to be in PEM format');
      logger.error('Expected format: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----');
      return null;
    }

    // Initialize Firebase Admin SDK
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey
      })
    });

    logger.info('✅ Firebase Admin SDK initialized successfully');
    return firebaseAdmin;
  } catch (error) {
    logger.error('❌ Firebase Admin SDK initialization failed:', error.message);
    logger.error('Push notifications will be disabled');
    return null;
  }
};

// Initialize on module load
const adminInstance = initializeFirebase();

module.exports = {
  getAdmin: () => adminInstance || initializeFirebase(),
  isInitialized: () => firebaseAdmin !== null
};


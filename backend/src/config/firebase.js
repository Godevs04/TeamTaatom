const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Firebase Admin SDK Configuration
 * 
 * Initializes Firebase Admin using environment variables for production safety.
 * Required environment variables:
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - FIREBASE_CLIENT_EMAIL: Service account client email
 * - FIREBASE_PRIVATE_KEY: Service account private key (with newlines replaced)
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
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      logger.warn('Firebase Admin SDK: Missing required environment variables. Push notifications will be disabled.');
      logger.warn('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      return null;
    }

    // Replace escaped newlines in private key (common when storing in .env)
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Initialize Firebase Admin SDK
    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey
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


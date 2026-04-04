/**
 * Taatom Official System User Identity
 * 
 * PRODUCTION-GRADE: Fetch from environment variable or database
 * If not found in env, the system will automatically create the user in the database
 * Falls back to the standard ObjectId used in the database
 * 
 * The ID must match a valid ObjectId format for MongoDB references.
 */
const mongoose = require('mongoose');

// Use environment variable or fallback to the standard ObjectId
// Validate that it's a valid ObjectId, otherwise use fallback
let TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID || '000000000000000000000001';

// If env var is set but not a valid ObjectId (e.g., set to username), use fallback
if (process.env.TAATOM_OFFICIAL_USER_ID && !mongoose.Types.ObjectId.isValid(TAATOM_OFFICIAL_USER_ID)) {
  console.warn(`⚠️  TAATOM_OFFICIAL_USER_ID is set to "${process.env.TAATOM_OFFICIAL_USER_ID}" which is not a valid ObjectId. Using fallback: 000000000000000000000001`);
  TAATOM_OFFICIAL_USER_ID = '000000000000000000000001';
}

const TAATOM_OFFICIAL_USER = {
  _id: TAATOM_OFFICIAL_USER_ID,
  username: 'taatom_official',
  fullName: 'Taatom Official',
  isSystem: true,
  isVerified: true,
  role: 'system',
  profilePic: 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1766525159/aefbv7kr261jzp4sptel.png',
  profilePicStorageKey: null
};

module.exports = {
  TAATOM_OFFICIAL_USER_ID,
  TAATOM_OFFICIAL_USER
};


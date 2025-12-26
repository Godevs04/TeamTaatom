/**
 * Taatom Official System User Identity
 * 
 * PRODUCTION-GRADE: Fetch from environment variable or database
 * If not found in env, the system will automatically create the user in the database
 * No hardcoded fallback - must be configured via environment variable or database
 * 
 * The ID must match a valid ObjectId format for MongoDB references.
 */
const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID || null;

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


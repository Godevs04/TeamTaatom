/**
 * Taatom Official System User Identity
 * 
 * This is a static system identity used for admin support chats.
 * DO NOT persist this to the database - it's a read-only constant.
 * 
 * The ID must match a valid ObjectId format for MongoDB references.
 */
const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID || '000000000000000000000001';

const TAATOM_OFFICIAL_USER = {
  _id: TAATOM_OFFICIAL_USER_ID,
  username: 'taatom_official',
  fullName: 'Taatom Official',
  isSystem: true,
  isVerified: true,
  role: 'system',
  profilePic: null, // Can be set to a default Taatom logo URL if needed
  profilePicStorageKey: null
};

module.exports = {
  TAATOM_OFFICIAL_USER_ID,
  TAATOM_OFFICIAL_USER
};


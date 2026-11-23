/**
 * WhatsApp-style Connect group admin helpers.
 * Cap: 1 owner + 2 active co-admins. Co-admins nominate; owner accepts.
 */

const MAX_CO_ADMINS = 2;

const ownerAdminEntry = (ownerId) => ({
  userId: ownerId,
  role: 'owner',
  promotedBy: null,
  status: 'active',
  createdAt: new Date(),
});

const countActiveCoAdmins = (admins = []) =>
  admins.filter((a) => a.role === 'admin' && a.status === 'active').length;

const findAdminEntry = (admins = [], userId) => {
  if (!userId) return null;
  const id = userId.toString();
  return admins.find((a) => (a.userId?._id || a.userId)?.toString() === id) || null;
};

/**
 * Ensure connect_page chat has an owner admin entry (lazy backfill).
 * Mutates chat.admins in memory; caller should save if dirty.
 * @returns {boolean} true if admins were modified
 */
const ensureOwnerAdmin = (chat, ownerId) => {
  if (!chat || chat.type !== 'connect_page' || !ownerId) return false;
  if (!Array.isArray(chat.admins)) chat.admins = [];
  const ownerEntry = chat.admins.find((a) => a.role === 'owner' && a.status === 'active');
  if (ownerEntry) return false;
  // Remove stale owner rows then seed
  chat.admins = chat.admins.filter((a) => a.role !== 'owner');
  chat.admins.unshift(ownerAdminEntry(ownerId));
  return true;
};

/**
 * Map userId → groupRole for API responses.
 */
const resolveGroupRole = (admins = [], userId) => {
  const entry = findAdminEntry(admins, userId);
  if (!entry) return 'member';
  if (entry.role === 'owner' && entry.status === 'active') return 'owner';
  if (entry.role === 'admin' && entry.status === 'active') return 'admin';
  if (entry.status === 'pending') return 'pending_admin';
  return 'member';
};

const attachGroupRolesToParticipants = (participants = [], admins = []) => {
  if (!Array.isArray(participants)) return participants;
  return participants.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const id = p._id || p;
    const groupRole = resolveGroupRole(admins, id);
    if (p.toObject) {
      const plain = p.toObject();
      plain.groupRole = groupRole;
      return plain;
    }
    return { ...p, groupRole };
  });
};

/** Normalize sendPermission; unknown/missing → everyone */
const normalizeSendPermission = (value) => {
  if (value === 'admins' || value === 'owner' || value === 'everyone') return value;
  return 'everyone';
};

/**
 * Whether a user with the given groupRole may send messages under sendPermission.
 */
const canRoleSendMessages = (sendPermission, groupRole) => {
  const perm = normalizeSendPermission(sendPermission);
  if (perm === 'everyone') return true;
  if (perm === 'owner') return groupRole === 'owner';
  if (perm === 'admins') return groupRole === 'owner' || groupRole === 'admin';
  return true;
};

module.exports = {
  MAX_CO_ADMINS,
  ownerAdminEntry,
  countActiveCoAdmins,
  findAdminEntry,
  ensureOwnerAdmin,
  resolveGroupRole,
  attachGroupRolesToParticipants,
  normalizeSendPermission,
  canRoleSendMessages,
};

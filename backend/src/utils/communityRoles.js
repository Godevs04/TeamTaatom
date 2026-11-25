/**
 * Community staff helpers. Owner = ConnectPage.userId.
 * Admins/moderators live on ConnectPage.communityRoles (unlimited).
 */

function ownerIdOf(page) {
  return (page?.userId?._id || page?.userId)?.toString?.() || null;
}

function normalizeRoleEntry(entry) {
  if (!entry) return null;
  const userId = (entry.userId?._id || entry.userId)?.toString?.();
  if (!userId || !entry.role) return null;
  return { userId, role: entry.role, status: entry.status || 'active' };
}

function listStaff(page) {
  return (page?.communityRoles || [])
    .map(normalizeRoleEntry)
    .filter(Boolean);
}

function resolveCommunityRole(page, userId) {
  const uid = userId?.toString?.();
  if (!uid || !page) return null;
  if (ownerIdOf(page) === uid) return 'owner';
  const hit = listStaff(page).find((e) => e.userId === uid);
  return hit?.role || null;
}

function canManageCommunity(page, userId) {
  const role = resolveCommunityRole(page, userId);
  return role === 'owner' || role === 'admin';
}

function canModerateCommunity(page, userId) {
  const role = resolveCommunityRole(page, userId);
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

function isEventHost(event, userId) {
  const uid = userId?.toString?.();
  if (!uid || !event) return false;
  const hosts = (event.hostIds || []).map((h) => (h?._id || h)?.toString?.()).filter(Boolean);
  const createdBy = (event.createdBy?._id || event.createdBy)?.toString?.();
  return hosts.includes(uid) || createdBy === uid;
}

const COMMUNITY_INBOX_HIDDEN_TYPES = [
  'community_group',
  'community_event',
  'community_event_team',
  'community_event_dm',
  'community_event_announce',
];

function isCommunityChatType(type) {
  return COMMUNITY_INBOX_HIDDEN_TYPES.includes(type);
}

/**
 * If the user is allowed into a community_* room but missing from participants,
 * add them and return { ok: true, joined: true }. Otherwise { ok, joined, error }.
 * Call only when the user is NOT already a participant.
 */
async function ensureCommunityRoomAccess(chat, userId) {
  const uid = userId?.toString?.();
  if (!uid || !chat || !isCommunityChatType(chat.type)) {
    return {
      ok: false,
      joined: false,
      error: ['BUSINESS_INSUFFICIENT_PERMISSIONS', 'You are not a participant of this chat'],
    };
  }

  const mongoose = require('mongoose');
  const ConnectPage = require('../models/ConnectPage');
  const ConnectFollow = require('../models/ConnectFollow');
  const pageId = chat.connectPageId?._id || chat.connectPageId;
  if (!pageId) {
    return {
      ok: false,
      joined: false,
      error: ['BUSINESS_INSUFFICIENT_PERMISSIONS', 'You are not a participant of this chat'],
    };
  }

  const page = await ConnectPage.findById(pageId).lean();
  if (!page || page.status !== 'active') {
    return {
      ok: false,
      joined: false,
      error: ['RESOURCE_NOT_FOUND', 'Community not found'],
    };
  }

  const role = resolveCommunityRole(page, uid);
  const isStaff = role === 'owner' || role === 'admin' || role === 'moderator';
  let isCommunityMember = isStaff;
  if (!isCommunityMember) {
    const follow = await ConnectFollow.findOne({
      connectPageId: pageId,
      followerId: uid,
      status: 'active',
    })
      .select('_id')
      .lean();
    isCommunityMember = !!follow;
  }

  let allowed = false;

  if (chat.type === 'community_group') {
    const CommunityGroupChat = require('../models/CommunityGroupChat');
    const group = await CommunityGroupChat.findOne({
      chatId: chat._id,
      status: 'active',
    }).lean();
    if (!group) {
      return {
        ok: false,
        joined: false,
        error: ['RESOURCE_NOT_FOUND', 'Group chat not found'],
      };
    }
    // Staff always; public + community member; otherwise must already be a participant
    if (isStaff) allowed = true;
    else if (group.privacy === 'public' && isCommunityMember) allowed = true;
  } else if (chat.type === 'community_event' || chat.type === 'community_event_announce') {
    const CommunityEvent = require('../models/CommunityEvent');
    const CommunityEventRegistration = require('../models/CommunityEventRegistration');
    const CommunityEventTeam = require('../models/CommunityEventTeam');
    const event = await CommunityEvent.findOne({
      $or: [{ chatId: chat._id }, { announcementChatId: chat._id }],
      status: { $ne: 'cancelled' },
    }).lean();
    if (!event) {
      return {
        ok: false,
        joined: false,
        error: ['RESOURCE_NOT_FOUND', 'Event chat not found'],
      };
    }
    if (isStaff || isEventHost(event, uid)) {
      allowed = true;
    } else {
      const reg = await CommunityEventRegistration.findOne({
        eventId: event._id,
        status: 'active',
        $or: [{ userId: uid }, { teamId: { $ne: null } }],
      }).lean();
      if (reg?.userId && reg.userId.toString() === uid) allowed = true;
      else if (reg?.teamId) {
        const team = await CommunityEventTeam.findById(reg.teamId).select('memberIds').lean();
        allowed = !!(team?.memberIds || []).some((id) => id && id.toString() === uid);
      }
    }
  } else if (chat.type === 'community_event_team') {
    const CommunityEventTeam = require('../models/CommunityEventTeam');
    const team = await CommunityEventTeam.findOne({ teamChatId: chat._id }).lean();
    if (!team) {
      return {
        ok: false,
        joined: false,
        error: ['RESOURCE_NOT_FOUND', 'Team chat not found'],
      };
    }
    allowed =
      isStaff ||
      (team.captainId && team.captainId.toString() === uid) ||
      (team.memberIds || []).some((id) => id && id.toString() === uid);
  } else if (chat.type === 'community_event_dm') {
    // Strict: only existing participants (hosts / requester already added on create)
    allowed = false;
  }

  if (!allowed) {
    return {
      ok: false,
      joined: false,
      error: ['BUSINESS_INSUFFICIENT_PERMISSIONS', 'You are not a participant of this chat'],
    };
  }

  const Chat = require('../models/Chat');
  await Chat.findByIdAndUpdate(chat._id, {
    $addToSet: { participants: new mongoose.Types.ObjectId(uid) },
  });

  return { ok: true, joined: true };
}

module.exports = {
  ownerIdOf,
  listStaff,
  resolveCommunityRole,
  canManageCommunity,
  canModerateCommunity,
  isEventHost,
  COMMUNITY_INBOX_HIDDEN_TYPES,
  isCommunityChatType,
  ensureCommunityRoomAccess,
};

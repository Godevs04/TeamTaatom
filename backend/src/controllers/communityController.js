const mongoose = require('mongoose');
const ConnectPage = require('../models/ConnectPage');
const ConnectFollow = require('../models/ConnectFollow');
const Chat = require('../models/Chat');
const User = require('../models/User');
const Post = require('../models/Post');
const Like = require('../models/Like');
const CommunityGroupChat = require('../models/CommunityGroupChat');
const CommunityGroupJoinRequest = require('../models/CommunityGroupJoinRequest');
const CommunityEvent = require('../models/CommunityEvent');
const CommunityEventTeam = require('../models/CommunityEventTeam');
const CommunityEventRegistration = require('../models/CommunityEventRegistration');
const CommunityEventCompetition = require('../models/CommunityEventCompetition');
const CommunityEventSubmission = require('../models/CommunityEventSubmission');
const CommunityEventJudgeScore = require('../models/CommunityEventJudgeScore');
const Notification = require('../models/Notification');
const { sendNotificationToUser } = require('../utils/sendNotification');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');
const {
  ownerIdOf,
  resolveCommunityRole,
  canManageCommunity,
  canModerateCommunity,
  isEventHost,
} = require('../utils/communityRoles');
const { ownerAdminEntry } = require('../utils/connectGroupAdmins');
const { generateSignedUrl, generateSignedUrls } = require('../services/mediaService');

async function loadPage(pageId) {
  if (!mongoose.Types.ObjectId.isValid(pageId)) return null;
  return ConnectPage.findById(pageId);
}

/** Resolve a displayable preview image for posts/shorts/long videos in competition UIs. */
async function resolveCompetitionPostPreview(post) {
  if (!post) return null;
  const out = {
    _id: post._id,
    type: post.type,
    caption: post.caption || '',
    thumbnailUrl: post.thumbnailUrl || '',
    imageUrl: post.imageUrl || '',
    images: Array.isArray(post.images) ? post.images.slice(0, 4) : [],
  };

  try {
    if (post.type === 'photo' || !post.type) {
      if (post.storageKeys?.length) {
        const urls = await generateSignedUrls(post.storageKeys.slice(0, 4), 'IMAGE');
        if (urls?.length) {
          out.images = urls.filter(Boolean);
          out.imageUrl = urls[0] || out.imageUrl;
          out.thumbnailUrl = out.thumbnailUrl || urls[0] || '';
        }
      } else if (post.storageKey) {
        const url = await generateSignedUrl(post.storageKey, 'IMAGE');
        if (url) {
          out.imageUrl = url;
          out.thumbnailUrl = out.thumbnailUrl || url;
        }
      }
    } else if (post.type === 'short' || post.type === 'long_video') {
      const thumbKey =
        post.thumbnailUrl && !/^https?:\/\//i.test(post.thumbnailUrl)
          ? post.thumbnailUrl
          : (post.storageKeys || []).find(
              (k) => k && (k.endsWith('.jpg') || k.endsWith('.jpeg') || k.endsWith('.png') || k.endsWith('.webp'))
            );
      if (thumbKey) {
        const url = await generateSignedUrl(thumbKey, 'IMAGE');
        if (url) {
          out.thumbnailUrl = url;
          out.imageUrl = out.imageUrl || url;
        }
      } else if (post.thumbnailUrl && /^https?:\/\//i.test(post.thumbnailUrl)) {
        out.thumbnailUrl = post.thumbnailUrl;
        out.imageUrl = out.imageUrl || post.thumbnailUrl;
      } else if (post.imageUrl && /^https?:\/\//i.test(post.imageUrl)) {
        out.thumbnailUrl = post.imageUrl;
        out.imageUrl = post.imageUrl;
      }
    }
  } catch (e) {
    logger.warn('resolveCompetitionPostPreview failed:', e?.message);
  }

  if (!out.thumbnailUrl) {
    out.thumbnailUrl = out.imageUrl || (out.images && out.images[0]) || '';
  }
  return out;
}

async function assertCommunityMember(pageId, userId) {
  const page = await loadPage(pageId);
  if (!page || page.status !== 'active') {
    return { error: ['RESOURCE_NOT_FOUND', 'Community not found'] };
  }
  const uid = userId.toString();
  if (ownerIdOf(page) === uid) return { page, role: 'owner', isMember: true };
  const role = resolveCommunityRole(page, uid);
  if (role) return { page, role, isMember: true };
  const follow = await ConnectFollow.findOne({
    connectPageId: pageId,
    followerId: userId,
    status: 'active',
  }).lean();
  if (follow) return { page, role: null, isMember: true };
  return { page, role: null, isMember: false };
}

async function createChatRoom({
  type,
  title,
  connectPageId,
  participants,
  ownerId,
  relatedType,
  relatedId,
}) {
  const unique = [...new Set((participants || []).map((p) => p.toString()))].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const chat = await Chat.create({
    type,
    title: title || '',
    connectPageId: connectPageId || null,
    participants: unique,
    admins: ownerId ? [ownerAdminEntry(ownerId)] : [],
    sendPermission: 'everyone',
    relatedEntity: relatedType
      ? { type: relatedType, refId: relatedId || null }
      : undefined,
    messages: [],
  });
  return chat;
}

function serializeGroupChat(doc, extras = {}) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    _id: o._id,
    connectPageId: o.connectPageId,
    name: o.name,
    description: o.description || '',
    privacy: o.privacy,
    requireJoinProof: !!o.requireJoinProof,
    proofPrompt: o.proofPrompt || '',
    chatId: o.chatId,
    createdBy: o.createdBy,
    memberCount: o.memberCount || 0,
    isDefault: !!o.isDefault,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...extras,
  };
}

const ENTRY_MEDIA_KINDS = ['post', 'short', 'long_video'];
const ALL_ENTRY_MEDIA = ['post', 'short', 'long_video'];

/** Coerce legacy string or array into a sorted unique media-kind array. */
function normalizeAllowedMedia(value) {
  if (value == null || value === '' || value === 'all' || value === 'both') {
    return [...ALL_ENTRY_MEDIA];
  }
  if (Array.isArray(value)) {
    // Legacy docs sometimes stored ['both'] / ['all'] after schema migration
    if (
      value.length === 0 ||
      value.every((v) => v === 'both' || v === 'all' || v == null || v === '')
    ) {
      return [...ALL_ENTRY_MEDIA];
    }
    const set = new Set(
      value.filter((v) => typeof v === 'string' && ENTRY_MEDIA_KINDS.includes(v))
    );
    const resolved = ENTRY_MEDIA_KINDS.filter((k) => set.has(k));
    return resolved.length ? resolved : [...ALL_ENTRY_MEDIA];
  }
  if (typeof value === 'string' && ENTRY_MEDIA_KINDS.includes(value)) {
    return [value];
  }
  return [...ALL_ENTRY_MEDIA];
}

function isValidAllowedMediaInput(value) {
  if (value == null || value === '' || value === 'all' || value === 'both') return true;
  if (typeof value === 'string') return ENTRY_MEDIA_KINDS.includes(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return value.every((v) => typeof v === 'string' && ENTRY_MEDIA_KINDS.includes(v));
  }
  return false;
}

function postTypeToEntryKind(postType) {
  if (postType === 'short') return 'short';
  if (postType === 'long_video') return 'long_video';
  // photo / post / missing → feed post
  return 'post';
}

function isEntryMediaAllowed(allowedMedia, postType) {
  const allowed = normalizeAllowedMedia(allowedMedia);
  if (allowed.length === 0) return false;
  return allowed.includes(postTypeToEntryKind(postType));
}

const EVENT_TEMPLATE_KEYS = [
  'best_short',
  'photo_dump',
  'long_story',
  'open_media',
  'team_challenge',
];

function serializeEvent(doc, extras = {}) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    _id: o._id,
    connectPageId: o.connectPageId,
    title: o.title,
    description: o.description || '',
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    location: o.location || { address: '', coordinates: { latitude: 0, longitude: 0 } },
    coverImage: o.coverImage || '',
    maxParticipants: o.maxParticipants,
    visibility: o.visibility,
    participationMode: o.participationMode,
    allowedEntryMedia: normalizeAllowedMedia(o.allowedEntryMedia),
    templateKey: o.templateKey || null,
    hostIds: o.hostIds || [],
    createdBy: o.createdBy,
    registrationOpen: o.registrationOpen !== false,
    participantCount: o.participantCount || 0,
    waitlistCount: o.waitlistCount || 0,
    chatId: o.chatId,
    announcementChatId: o.announcementChatId,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...extras,
  };
}

function isEventFull(event) {
  return !!(event.maxParticipants && (event.participantCount || 0) >= event.maxParticipants);
}

async function addUserToEventChats(event, userId) {
  if (event.chatId) {
    await Chat.findByIdAndUpdate(event.chatId, { $addToSet: { participants: userId } });
  }
  if (event.announcementChatId) {
    await Chat.findByIdAndUpdate(event.announcementChatId, {
      $addToSet: { participants: userId },
    });
  }
}

/** Promote oldest waitlisted individual registration into an open seat. */
async function promoteNextWaitlisted(event) {
  if (!event || isEventFull(event)) return null;
  const next = await CommunityEventRegistration.findOne({
    eventId: event._id,
    status: 'waitlisted',
    userId: { $ne: null },
  }).sort({ createdAt: 1 });
  if (!next) return null;

  next.status = 'active';
  await next.save();
  event.participantCount = (event.participantCount || 0) + 1;
  event.waitlistCount = Math.max(0, (event.waitlistCount || 0) - 1);
  await event.save();
  await addUserToEventChats(event, next.userId);

  try {
    const page = await loadPage(event.connectPageId);
    const pageName = page?.name || 'community';
    const body = `A spot opened — you're in for ${event.title}`;
    await Notification.createNotification({
      type: 'community_event_waitlist_promoted',
      fromUser: event.createdBy,
      toUser: next.userId,
      metadata: {
        kind: 'community_event_waitlist_promoted',
        connectPageId: event.connectPageId.toString(),
        eventId: event._id.toString(),
        pageName,
        eventTitle: event.title,
        message: `A spot opened — you're in for ${event.title}`,
      },
    }).catch(() => null);
    await sendNotificationToUser({
      userId: next.userId.toString(),
      title: "You're off the waitlist",
      body,
      data: {
        type: 'community_event_waitlist_promoted',
        connectPageId: event.connectPageId.toString(),
        eventId: event._id.toString(),
        fromUserId: event.createdBy.toString(),
        pageName,
        eventTitle: event.title,
        kind: 'community_event_waitlist_promoted',
      },
    }).catch(() => null);
  } catch (e) {
    logger.warn('promoteNextWaitlisted notify failed:', e?.message);
  }
  return next;
}

function canJudgeCompetition(event, competition, userId, page = null) {
  if (isEventHost(event, userId)) return true;
  if (page && canManageCommunity(page, userId)) return true;
  const uid = userId.toString();
  return (competition.judgeIds || []).some((id) => id && id.toString() === uid);
}

/** Coerce legacy string allowedMedia ('both'|'all'|'post'|…) before mongoose array enum validation. */
function sanitizeCompetitionDoc(competition) {
  if (!competition) return competition;
  competition.allowedMedia = normalizeAllowedMedia(competition.allowedMedia);
  if (typeof competition.markModified === 'function') {
    competition.markModified('allowedMedia');
  }
  if (!['engagement', 'judges', 'hybrid'].includes(competition.rankMode)) {
    competition.rankMode = 'engagement';
  }
  if (competition.judgeWeight == null || Number.isNaN(Number(competition.judgeWeight))) {
    competition.judgeWeight = 50;
  }
  return competition;
}

// ─────────────────────────────────────────────
// Find (member search)
// ─────────────────────────────────────────────

const searchCommunityMembers = async (req, res) => {
  try {
    const { pageId } = req.params;
    const q = (req.query.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const access = await assertCommunityMember(pageId, req.user._id);
    if (access.error) return sendError(res, access.error[0], access.error[1]);
    if (!access.isMember && access.page.type === 'private') {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Join this community to find members');
    }

    const follows = await ConnectFollow.find({
      connectPageId: pageId,
      status: 'active',
    })
      .select('followerId')
      .lean();
    const memberIds = new Set(follows.map((f) => f.followerId.toString()));
    const ownerId = ownerIdOf(access.page);
    if (ownerId) memberIds.add(ownerId);
    (access.page.communityRoles || []).forEach((r) => {
      const id = (r.userId?._id || r.userId)?.toString?.();
      if (id) memberIds.add(id);
    });

    const ids = [...memberIds].map((id) => new mongoose.Types.ObjectId(id));
    const filter = { _id: { $in: ids } };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ username: rx }, { fullName: rx }];
    }

    const users = await User.find(filter)
      .select('fullName username profilePic profilePicStorageKey')
      .limit(limit)
      .lean();

    const roleByUser = {};
    if (ownerId) roleByUser[ownerId] = 'owner';
    (access.page.communityRoles || []).forEach((r) => {
      const id = (r.userId?._id || r.userId)?.toString?.();
      if (id) roleByUser[id] = r.role;
    });

    return sendSuccess(res, 200, 'Members', {
      members: users.map((u) => ({
        ...u,
        communityRole: roleByUser[u._id.toString()] || 'member',
      })),
    });
  } catch (error) {
    logger.error('searchCommunityMembers error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to search members');
  }
};

// ─────────────────────────────────────────────
// Community roles
// ─────────────────────────────────────────────

const listCommunityRoles = async (req, res) => {
  try {
    const access = await assertCommunityMember(req.params.pageId, req.user._id);
    if (access.error) return sendError(res, access.error[0], access.error[1]);
    const page = access.page;
    const ownerId = ownerIdOf(page);
    const owner = ownerId
      ? await User.findById(ownerId).select('fullName username profilePic').lean()
      : null;
    const staffIds = (page.communityRoles || []).map((r) => r.userId);
    const staffUsers = staffIds.length
      ? await User.find({ _id: { $in: staffIds } }).select('fullName username profilePic').lean()
      : [];
    const byId = Object.fromEntries(staffUsers.map((u) => [u._id.toString(), u]));
    return sendSuccess(res, 200, 'Community roles', {
      owner,
      myRole: resolveCommunityRole(page, req.user._id),
      staff: (page.communityRoles || []).map((r) => ({
        userId: r.userId,
        role: r.role,
        assignedBy: r.assignedBy,
        createdAt: r.createdAt,
        user: byId[(r.userId?._id || r.userId)?.toString?.()] || null,
      })),
    });
  } catch (error) {
    logger.error('listCommunityRoles error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to list roles');
  }
};

const assignCommunityRole = async (req, res) => {
  try {
    const { pageId } = req.params;
    const { userId, role } = req.body;
    if (!['admin', 'moderator'].includes(role)) {
      return sendError(res, 'VALIDATION_FAILED', 'role must be admin or moderator');
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid user ID');
    }
    const page = await loadPage(pageId);
    if (!page) return sendError(res, 'RESOURCE_NOT_FOUND', 'Community not found');
    if (!canManageCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only owner/admins can assign roles');
    }
    if (ownerIdOf(page) === userId.toString()) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Owner already has full control');
    }
    const follow = await ConnectFollow.findOne({
      connectPageId: pageId,
      followerId: userId,
      status: 'active',
    }).lean();
    if (!follow) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'User must be a community member');
    }
    page.communityRoles = (page.communityRoles || []).filter(
      (r) => (r.userId?._id || r.userId).toString() !== userId.toString()
    );
    page.communityRoles.push({
      userId,
      role,
      assignedBy: req.user._id,
      createdAt: new Date(),
    });
    page.markModified('communityRoles');
    await page.save();
    return sendSuccess(res, 200, 'Role assigned', {
      staff: page.communityRoles,
      myRole: resolveCommunityRole(page, req.user._id),
    });
  } catch (error) {
    logger.error('assignCommunityRole error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to assign role');
  }
};

const revokeCommunityRole = async (req, res) => {
  try {
    const { pageId, userId } = req.params;
    const page = await loadPage(pageId);
    if (!page) return sendError(res, 'RESOURCE_NOT_FOUND', 'Community not found');
    if (!canManageCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only owner/admins can revoke roles');
    }
    page.communityRoles = (page.communityRoles || []).filter(
      (r) => (r.userId?._id || r.userId).toString() !== userId.toString()
    );
    page.markModified('communityRoles');
    await page.save();
    return sendSuccess(res, 200, 'Role revoked', { staff: page.communityRoles });
  } catch (error) {
    logger.error('revokeCommunityRole error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to revoke role');
  }
};

// ─────────────────────────────────────────────
// Group chats
// ─────────────────────────────────────────────

/**
 * Migrate legacy ConnectPage.chatRoomId into a default "General" CommunityGroupChat
 * so the hub list is not empty while the old page group chat card still worked.
 */
async function ensureDefaultGeneralGroupChat(page) {
  if (!page?._id || !page.chatRoomId) return null;

  const existingDefault = await CommunityGroupChat.findOne({
    connectPageId: page._id,
    status: 'active',
    $or: [{ isDefault: true }, { chatId: page.chatRoomId }],
  });
  if (existingDefault) {
    if (!existingDefault.isDefault) {
      existingDefault.isDefault = true;
      await existingDefault.save();
    }
    return existingDefault;
  }

  const chat = await Chat.findById(page.chatRoomId).select('participants type').lean();
  if (!chat) return null;

  const ownerId = ownerIdOf(page);
  const privacy =
    page.type === 'private' || page.type === 'followers' ? 'request' : 'public';

  try {
    return await CommunityGroupChat.create({
      connectPageId: page._id,
      name: 'General',
      description: 'Main community group chat',
      privacy,
      requireJoinProof: false,
      proofPrompt: '',
      chatId: page.chatRoomId,
      createdBy: ownerId || page.userId,
      memberCount: Array.isArray(chat.participants) ? chat.participants.length : 0,
      isDefault: true,
      status: 'active',
    });
  } catch (err) {
    // Race: another request may have created it
    if (err?.code === 11000) {
      return CommunityGroupChat.findOne({
        connectPageId: page._id,
        chatId: page.chatRoomId,
        status: 'active',
      });
    }
    logger.warn('ensureDefaultGeneralGroupChat failed:', err?.message);
    return null;
  }
}

const listGroupChats = async (req, res) => {
  try {
    const { pageId } = req.params;
    const access = await assertCommunityMember(pageId, req.user._id);
    if (access.error) return sendError(res, access.error[0], access.error[1]);

    await ensureDefaultGeneralGroupChat(access.page);

    const groups = await CommunityGroupChat.find({
      connectPageId: pageId,
      status: 'active',
    })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();

    const memberships = await Chat.find({
      _id: { $in: groups.map((g) => g.chatId).filter(Boolean) },
      participants: req.user._id,
    })
      .select('_id')
      .lean();
    const memberOf = new Set(memberships.map((c) => c._id.toString()));

    const pending = await CommunityGroupJoinRequest.find({
      groupChatId: { $in: groups.map((g) => g._id) },
      userId: req.user._id,
      status: 'pending',
    })
      .select('groupChatId')
      .lean();
    const pendingSet = new Set(pending.map((p) => p.groupChatId.toString()));

    return sendSuccess(res, 200, 'Group chats', {
      groupChats: groups.map((g) => {
        const inRoom = memberOf.has(g.chatId.toString());
        // Public default/legacy rooms: community members can open (connect_page auto-joins)
        const publicOpen =
          access.isMember &&
          g.privacy === 'public' &&
          (g.isDefault || g.chatId?.toString() === access.page.chatRoomId?.toString());
        return serializeGroupChat(g, {
          isMember: inRoom || publicOpen,
          joinRequestPending: pendingSet.has(g._id.toString()),
          canManage: canManageCommunity(access.page, req.user._id),
        });
      }),
    });
  } catch (error) {
    logger.error('listGroupChats error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to list group chats');
  }
};

const createGroupChat = async (req, res) => {
  try {
    const { pageId } = req.params;
    const {
      name,
      description = '',
      privacy = 'public',
      requireJoinProof = false,
      proofPrompt = '',
    } = req.body;

    if (!name || !String(name).trim()) {
      return sendError(res, 'VALIDATION_FAILED', 'Name is required');
    }
    if (!['public', 'request', 'invite'].includes(privacy)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid privacy');
    }

    const page = await loadPage(pageId);
    if (!page) return sendError(res, 'RESOURCE_NOT_FOUND', 'Community not found');
    if (!canManageCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only owner/admins can create group chats');
    }

    const ownerId = ownerIdOf(page);
    const chat = await createChatRoom({
      type: 'community_group',
      title: String(name).trim(),
      connectPageId: pageId,
      participants: [ownerId, req.user._id].filter(Boolean),
      ownerId,
      relatedType: 'community_group_chat',
    });

    const group = await CommunityGroupChat.create({
      connectPageId: pageId,
      name: String(name).trim(),
      description: String(description || '').slice(0, 500),
      privacy,
      requireJoinProof: privacy === 'request' ? !!requireJoinProof : false,
      proofPrompt: String(proofPrompt || '').slice(0, 300),
      chatId: chat._id,
      createdBy: req.user._id,
      memberCount: chat.participants.length,
    });

    chat.relatedEntity = { type: 'community_group_chat', refId: group._id };
    await chat.save();

    return sendSuccess(res, 201, 'Group chat created', {
      groupChat: serializeGroupChat(group, { isMember: true, chatId: chat._id }),
    });
  } catch (error) {
    logger.error('createGroupChat error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create group chat');
  }
};

const joinGroupChat = async (req, res) => {
  try {
    const { groupChatId } = req.params;
    const { proofText = '', proofFileUrl = '' } = req.body || {};
    const group = await CommunityGroupChat.findById(groupChatId);
    if (!group || group.status !== 'active') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Group chat not found');
    }

    const access = await assertCommunityMember(group.connectPageId, req.user._id);
    if (access.error) return sendError(res, access.error[0], access.error[1]);
    if (!access.isMember) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Join the community first');
    }

    const chat = await Chat.findById(group.chatId);
    if (!chat) return sendError(res, 'RESOURCE_NOT_FOUND', 'Chat room missing');

    const already = (chat.participants || []).some(
      (p) => p && p.toString() === req.user._id.toString()
    );
    if (already) {
      return sendSuccess(res, 200, 'Already a member', {
        groupChat: serializeGroupChat(group, { isMember: true }),
      });
    }

    if (group.privacy === 'invite') {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'This chat is invite only');
    }

    if (group.privacy === 'request') {
      if (group.requireJoinProof && !String(proofText || proofFileUrl).trim()) {
        return sendError(res, 'VALIDATION_FAILED', 'Proof is required for this chat');
      }
      const existing = await CommunityGroupJoinRequest.findOne({
        groupChatId,
        userId: req.user._id,
        status: 'pending',
      });
      if (existing) {
        return sendSuccess(res, 200, 'Join request already pending', {
          joinRequestPending: true,
        });
      }
      await CommunityGroupJoinRequest.create({
        groupChatId,
        connectPageId: group.connectPageId,
        userId: req.user._id,
        proofText: String(proofText || '').slice(0, 1000),
        proofFileUrl: String(proofFileUrl || ''),
        status: 'pending',
      });

      try {
        const ownerId = ownerIdOf(access.page);
        // Owner + admins + moderators all review join proofs
        const staff = (access.page.communityRoles || [])
          .filter((r) => r.role === 'admin' || r.role === 'moderator')
          .map((r) => r.userId);
        const notifyIds = [...new Set([ownerId, ...staff.map((s) => s.toString())].filter(Boolean))];
        const actorName = req.user.fullName || req.user.username || 'Someone';
        const body = `${actorName} requested to join ${group.name}`;
        await Promise.all(
          notifyIds.map(async (toUser) => {
            await Notification.createNotification({
              type: 'community_group_join',
              fromUser: req.user._id,
              toUser,
              metadata: {
                kind: 'community_group_join',
                connectPageId: group.connectPageId.toString(),
                groupChatId: group._id.toString(),
                pageName: access.page.name,
                groupName: group.name,
                message: `requested to join ${group.name}`,
              },
            }).catch(() => null);
            await sendNotificationToUser({
              userId: toUser.toString(),
              title: 'Group chat join request',
              body,
              data: {
                type: 'community_group_join',
                connectPageId: group.connectPageId.toString(),
                groupChatId: group._id.toString(),
                fromUserId: req.user._id.toString(),
                pageName: access.page.name,
                groupName: group.name,
                kind: 'community_group_join',
              },
            }).catch(() => null);
          })
        );
      } catch (e) {
        logger.warn('joinGroupChat notify failed:', e?.message);
      }

      return sendSuccess(res, 200, 'Join request sent', { joinRequestPending: true });
    }

    chat.participants.push(req.user._id);
    await chat.save();
    group.memberCount = chat.participants.length;
    await group.save();

    return sendSuccess(res, 200, 'Joined group chat', {
      groupChat: serializeGroupChat(group, { isMember: true }),
    });
  } catch (error) {
    logger.error('joinGroupChat error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to join group chat');
  }
};

const listGroupJoinRequests = async (req, res) => {
  try {
    const { groupChatId } = req.params;
    const group = await CommunityGroupChat.findById(groupChatId);
    if (!group) return sendError(res, 'RESOURCE_NOT_FOUND', 'Group chat not found');
    const page = await loadPage(group.connectPageId);
    if (!page || !canModerateCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Not allowed');
    }
    const requests = await CommunityGroupJoinRequest.find({
      groupChatId,
      status: 'pending',
    })
      .populate('userId', 'fullName username profilePic')
      .sort({ createdAt: -1 })
      .lean();
    return sendSuccess(res, 200, 'Join requests', { requests });
  } catch (error) {
    logger.error('listGroupJoinRequests error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to list join requests');
  }
};

const reviewGroupJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) {
      return sendError(res, 'VALIDATION_FAILED', 'action must be accept or reject');
    }
    const request = await CommunityGroupJoinRequest.findById(requestId);
    if (!request || request.status !== 'pending') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Request not found');
    }
    const group = await CommunityGroupChat.findById(request.groupChatId);
    const page = await loadPage(request.connectPageId);
    if (!group || !page || !canModerateCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Not allowed');
    }

    request.status = action === 'accept' ? 'accepted' : 'rejected';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    if (action === 'accept') {
      const chat = await Chat.findById(group.chatId);
      if (chat) {
        const exists = (chat.participants || []).some(
          (p) => p && p.toString() === request.userId.toString()
        );
        if (!exists) {
          chat.participants.push(request.userId);
          await chat.save();
          group.memberCount = chat.participants.length;
          await group.save();
        }
      }
      try {
        const actorName = req.user.fullName || req.user.username || 'Someone';
        const body = `${actorName} accepted your request to join ${group.name}`;
        await Notification.createNotification({
          type: 'community_group_join_approved',
          fromUser: req.user._id,
          toUser: request.userId,
          metadata: {
            kind: 'community_group_join',
            connectPageId: group.connectPageId.toString(),
            groupChatId: group._id.toString(),
            pageName: page.name,
            groupName: group.name,
            message: `accepted your request to join ${group.name}`,
          },
        });
        await sendNotificationToUser({
          userId: request.userId.toString(),
          title: 'Group chat request accepted',
          body,
          data: {
            type: 'community_group_join_approved',
            connectPageId: group.connectPageId.toString(),
            groupChatId: group._id.toString(),
            fromUserId: req.user._id.toString(),
            pageName: page.name,
            groupName: group.name,
            kind: 'community_group_join',
          },
        });
      } catch (_) {
        /* non-critical */
      }
    }

    return sendSuccess(res, 200, action === 'accept' ? 'Request accepted' : 'Request rejected', {
      request,
    });
  } catch (error) {
    logger.error('reviewGroupJoinRequest error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to review request');
  }
};

const inviteToGroupChat = async (req, res) => {
  try {
    const { groupChatId } = req.params;
    const { userId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid user ID');
    }
    const group = await CommunityGroupChat.findById(groupChatId);
    if (!group) return sendError(res, 'RESOURCE_NOT_FOUND', 'Group chat not found');
    const page = await loadPage(group.connectPageId);
    if (!page || !canModerateCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Not allowed');
    }
    const access = await assertCommunityMember(group.connectPageId, userId);
    if (!access.isMember) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Invitee must be a community member');
    }
    const chat = await Chat.findById(group.chatId);
    if (!chat) return sendError(res, 'RESOURCE_NOT_FOUND', 'Chat missing');
    const exists = (chat.participants || []).some((p) => p && p.toString() === userId.toString());
    if (!exists) {
      chat.participants.push(userId);
      await chat.save();
      group.memberCount = chat.participants.length;
      await group.save();
    }
    return sendSuccess(res, 200, 'Member invited', {
      groupChat: serializeGroupChat(group, { isMember: true }),
    });
  } catch (error) {
    logger.error('inviteToGroupChat error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to invite');
  }
};

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

const listEvents = async (req, res) => {
  try {
    const { pageId } = req.params;
    const access = await assertCommunityMember(pageId, req.user._id);
    if (access.error) return sendError(res, access.error[0], access.error[1]);

    const filter = { connectPageId: pageId, status: { $ne: 'cancelled' } };
    if (!access.isMember) {
      filter.visibility = 'public';
    }

    const events = await CommunityEvent.find(filter).sort({ startsAt: 1 }).lean();
    const eventIds = events.map((e) => e._id);
    const myRegs = await CommunityEventRegistration.find({
      eventId: { $in: eventIds },
      status: { $in: ['active', 'waitlisted'] },
      $or: [{ userId: req.user._id }, { teamId: { $exists: true } }],
    }).lean();

    const myTeams = await CommunityEventTeam.find({
      eventId: { $in: eventIds },
      $or: [{ captainId: req.user._id }, { memberIds: req.user._id }],
      status: { $ne: 'withdrawn' },
    })
      .select('_id eventId chatId name isComplete')
      .lean();
    const teamByEvent = Object.fromEntries(myTeams.map((t) => [t.eventId.toString(), t]));

    const competitions = eventIds.length
      ? await CommunityEventCompetition.find({ eventId: { $in: eventIds } }).lean()
      : [];
    const competitionByEvent = Object.fromEntries(
      competitions.map((c) => [c.eventId.toString(), c])
    );

    const registeredEventIds = new Set();
    const waitlistedEventIds = new Set();
    const regStatusByEvent = {};
    myRegs.forEach((r) => {
      const eid = r.eventId.toString();
      if (r.userId && r.userId.toString() === req.user._id.toString()) {
        regStatusByEvent[eid] = r.status;
        if (r.status === 'active') registeredEventIds.add(eid);
        if (r.status === 'waitlisted') waitlistedEventIds.add(eid);
      }
      const myTeam = teamByEvent[eid];
      if (r.teamId && myTeam && myTeam._id.toString() === r.teamId.toString() && r.status === 'active') {
        registeredEventIds.add(eid);
        regStatusByEvent[eid] = 'active';
      }
    });
    // Team membership alone counts as registered for group/both modes
    Object.keys(teamByEvent).forEach((eid) => {
      registeredEventIds.add(eid);
      if (!regStatusByEvent[eid]) regStatusByEvent[eid] = 'active';
    });

    return sendSuccess(res, 200, 'Events', {
      events: events.map((e) => {
        const eid = e._id.toString();
        const competition = competitionByEvent[eid] || null;
        const competitionOut = competition
          ? {
              ...competition,
              allowedMedia: normalizeAllowedMedia(
                competition.allowedMedia || e.allowedEntryMedia
              ),
            }
          : null;
        return serializeEvent(e, {
          isRegistered: registeredEventIds.has(eid),
          isWaitlisted: waitlistedEventIds.has(eid),
          registrationStatus: regStatusByEvent[eid] || null,
          isFull: isEventFull(e),
          canManage:
            canManageCommunity(access.page, req.user._id) || isEventHost(e, req.user._id),
          myTeam: teamByEvent[eid] || null,
          competition: competitionOut,
        });
      }),
    });
  } catch (error) {
    logger.error('listEvents error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to list events');
  }
};

const createEvent = async (req, res) => {
  try {
    const { pageId } = req.params;
    const page = await loadPage(pageId);
    if (!page) return sendError(res, 'RESOURCE_NOT_FOUND', 'Community not found');
    if (!canManageCommunity(page, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only owner/admins can create events');
    }

    const {
      title,
      description = '',
      startsAt,
      endsAt = null,
      location = {},
      coverImage = '',
      maxParticipants = null,
      visibility = 'members',
      participationMode = 'individual',
      allowedEntryMedia = 'all',
      templateKey = null,
      hostIds = [],
      registrationOpen = true,
    } = req.body;

    if (!title || !startsAt) {
      return sendError(res, 'VALIDATION_FAILED', 'title and startsAt are required');
    }
    if (!['individual', 'group', 'both'].includes(participationMode)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid participationMode');
    }
    if (!['public', 'members', 'private'].includes(visibility)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid visibility');
    }
    if (templateKey && !EVENT_TEMPLATE_KEYS.includes(templateKey)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid templateKey');
    }
    if (!isValidAllowedMediaInput(allowedEntryMedia)) {
      return sendError(
        res,
        'VALIDATION_FAILED',
        'allowedEntryMedia must be a non-empty list of post, short, and/or long_video'
      );
    }
    const resolvedEntryMedia = normalizeAllowedMedia(allowedEntryMedia);
    if (resolvedEntryMedia.length === 0) {
      return sendError(res, 'VALIDATION_FAILED', 'Select at least one allowed entry type');
    }

    const ownerId = ownerIdOf(page);
    const hosts = [
      ...new Set(
        [req.user._id.toString(), ownerId, ...(hostIds || []).map((h) => h.toString())].filter(
          Boolean
        )
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const eventChat = await createChatRoom({
      type: 'community_event',
      title: `${String(title).trim()} · Event`,
      connectPageId: pageId,
      participants: hosts,
      ownerId: req.user._id,
      relatedType: 'community_event',
    });

    const announceChat = await createChatRoom({
      type: 'community_event_announce',
      title: `${String(title).trim()} · Announcements`,
      connectPageId: pageId,
      participants: hosts,
      ownerId: req.user._id,
      relatedType: 'community_event',
    });

    const event = await CommunityEvent.create({
      connectPageId: pageId,
      title: String(title).trim().slice(0, 120),
      description: String(description || '').slice(0, 5000),
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      location: {
        address: location?.address || '',
        coordinates: {
          latitude: Number(location?.coordinates?.latitude) || 0,
          longitude: Number(location?.coordinates?.longitude) || 0,
        },
      },
      coverImage: coverImage || '',
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      visibility,
      participationMode,
      allowedEntryMedia: resolvedEntryMedia,
      templateKey: templateKey || undefined,
      hostIds: hosts,
      createdBy: req.user._id,
      registrationOpen: registrationOpen !== false,
      chatId: eventChat._id,
      announcementChatId: announceChat._id,
      status: 'published',
      waitlistCount: 0,
    });

    eventChat.relatedEntity = { type: 'community_event', refId: event._id };
    announceChat.relatedEntity = { type: 'community_event', refId: event._id };
    await eventChat.save();
    await announceChat.save();

    // Host is in for individual/both events so they can open competitions without a second Register tap
    if (event.participationMode !== 'group') {
      try {
        await CommunityEventRegistration.create({
          eventId: event._id,
          connectPageId: pageId,
          mode: 'individual',
          userId: req.user._id,
          status: 'active',
        });
        event.participantCount = 1;
        await event.save();
      } catch (regErr) {
        logger.warn('createEvent host auto-register skipped:', regErr?.message || regErr);
      }
    }

    // Notify active community members (best-effort)
    try {
      const followers = await ConnectFollow.find({
        connectPageId: pageId,
        status: 'active',
      })
        .select('followerId')
        .lean();
      const recipientIds = [
        ...new Set(
          followers
            .map((f) => (f.followerId?._id || f.followerId)?.toString())
            .filter((id) => id && id !== req.user._id.toString())
        ),
      ].slice(0, 200);
      const actorName = req.user.fullName || req.user.username || 'A host';
      const body = `${actorName} published ${event.title}`;
      await Promise.all(
        recipientIds.map(async (toUser) => {
          await Notification.createNotification({
            type: 'community_event_published',
            fromUser: req.user._id,
            toUser,
            metadata: {
              kind: 'community_event_published',
              connectPageId: pageId.toString(),
              eventId: event._id.toString(),
              pageName: page.name,
              eventTitle: event.title,
              message: `published ${event.title}`,
            },
          }).catch(() => null);
          await sendNotificationToUser({
            userId: toUser,
            title: 'New community event',
            body,
            data: {
              type: 'community_event_published',
              connectPageId: pageId.toString(),
              eventId: event._id.toString(),
              fromUserId: req.user._id.toString(),
              pageName: page.name,
              eventTitle: event.title,
              kind: 'community_event_published',
            },
          }).catch(() => null);
        })
      );
    } catch (e) {
      logger.warn('createEvent notify failed:', e?.message);
    }

    return sendSuccess(res, 201, 'Event created', { event: serializeEvent(event) });
  } catch (error) {
    logger.error('createEvent error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create event');
  }
};

const getEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await CommunityEvent.findById(eventId).lean();
    if (!event || event.status === 'cancelled') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    }
    const access = await assertCommunityMember(event.connectPageId, req.user._id);
    if (access.error) return sendError(res, access.error[0], access.error[1]);
    if (event.visibility !== 'public' && !access.isMember) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Members only');
    }

    const competition = await CommunityEventCompetition.findOne({ eventId }).lean();
    const myRegistration = await CommunityEventRegistration.findOne({
      eventId,
      userId: req.user._id,
      status: { $in: ['active', 'waitlisted'] },
    }).lean();
    const myTeam = await CommunityEventTeam.findOne({
      eventId,
      $or: [{ captainId: req.user._id }, { memberIds: req.user._id }],
      status: { $ne: 'withdrawn' },
    }).lean();
    const isRegistered =
      !!(myRegistration && myRegistration.status === 'active') || !!myTeam;
    const isWaitlisted = !!(myRegistration && myRegistration.status === 'waitlisted');

    return sendSuccess(res, 200, 'Event', {
      event: serializeEvent(event, {
        canManage:
          canManageCommunity(access.page, req.user._id) || isEventHost(event, req.user._id),
        isRegistered,
        isWaitlisted,
        registrationStatus: myRegistration?.status || (myTeam ? 'active' : null),
        isFull: isEventFull(event),
        myTeam: myTeam || null,
        competition: competition || null,
      }),
    });
  } catch (error) {
    logger.error('getEvent error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to load event');
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await CommunityEvent.findById(req.params.eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    const page = await loadPage(event.connectPageId);
    if (!page || (!canManageCommunity(page, req.user._id) && !isEventHost(event, req.user._id))) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Not allowed');
    }
    const fields = [
      'title',
      'description',
      'startsAt',
      'endsAt',
      'coverImage',
      'maxParticipants',
      'visibility',
      'participationMode',
      'allowedEntryMedia',
      'templateKey',
      'registrationOpen',
      'status',
    ];
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        if (key === 'startsAt' || key === 'endsAt') {
          event[key] = req.body[key] ? new Date(req.body[key]) : null;
        } else if (key === 'allowedEntryMedia') {
          if (!isValidAllowedMediaInput(req.body[key])) {
            return sendError(
              res,
              'VALIDATION_FAILED',
              'allowedEntryMedia must be a non-empty list of post, short, and/or long_video'
            );
          }
          const resolved = normalizeAllowedMedia(req.body[key]);
          if (resolved.length === 0) {
            return sendError(res, 'VALIDATION_FAILED', 'Select at least one allowed entry type');
          }
          event[key] = resolved;
        } else if (key === 'templateKey') {
          if (req.body[key] && !EVENT_TEMPLATE_KEYS.includes(req.body[key])) {
            return sendError(res, 'VALIDATION_FAILED', 'Invalid templateKey');
          }
          event[key] = req.body[key] || undefined;
        } else {
          event[key] = req.body[key];
        }
      }
    }
    if (req.body.location) event.location = req.body.location;
    await event.save();

    // Keep competition media rules in sync when host changes event settings
    if (req.body.allowedEntryMedia !== undefined) {
      await CommunityEventCompetition.updateOne(
        { eventId: event._id },
        { $set: { allowedMedia: normalizeAllowedMedia(event.allowedEntryMedia) } }
      );
    }

    return sendSuccess(res, 200, 'Event updated', { event: serializeEvent(event) });
  } catch (error) {
    logger.error('updateEvent error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to update event');
  }
};

const registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await CommunityEvent.findById(eventId);
    if (!event || event.status === 'cancelled') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    }
    if (!event.registrationOpen) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Registration is closed');
    }
    const access = await assertCommunityMember(event.connectPageId, req.user._id);
    if (!access.isMember) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Join the community first');
    }
    if (event.participationMode === 'group') {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'This event requires team registration');
    }

    const existing = await CommunityEventRegistration.findOne({
      eventId,
      userId: req.user._id,
      status: { $in: ['active', 'waitlisted'] },
    });
    if (existing) {
      return sendSuccess(res, 200, existing.status === 'waitlisted' ? 'Already waitlisted' : 'Already registered', {
        registration: existing,
        isWaitlisted: existing.status === 'waitlisted',
        isRegistered: existing.status === 'active',
      });
    }

    // Reactivate a prior cancellation if a seat is free; otherwise waitlist
    const prior = await CommunityEventRegistration.findOne({
      eventId,
      userId: req.user._id,
      status: 'cancelled',
    });

    const full = isEventFull(event);
    const nextStatus = full ? 'waitlisted' : 'active';

    let registration;
    if (prior) {
      prior.status = nextStatus;
      prior.mode = 'individual';
      await prior.save();
      registration = prior;
    } else {
      registration = await CommunityEventRegistration.create({
        eventId,
        connectPageId: event.connectPageId,
        mode: 'individual',
        userId: req.user._id,
        status: nextStatus,
      });
    }

    if (nextStatus === 'active') {
      event.participantCount = (event.participantCount || 0) + 1;
      await event.save();
      await addUserToEventChats(event, req.user._id);
      return sendSuccess(res, 201, 'Registered', {
        registration,
        isRegistered: true,
        isWaitlisted: false,
      });
    }

    event.waitlistCount = (event.waitlistCount || 0) + 1;
    await event.save();
    return sendSuccess(res, 201, 'Added to waitlist', {
      registration,
      isRegistered: false,
      isWaitlisted: true,
    });
  } catch (error) {
    logger.error('registerForEvent error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to register');
  }
};

const leaveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');

    const registration = await CommunityEventRegistration.findOne({
      eventId,
      userId: req.user._id,
      status: { $in: ['active', 'waitlisted'] },
    });
    if (!registration) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'You are not registered for this event');
    }

    const wasActive = registration.status === 'active';
    const wasWaitlisted = registration.status === 'waitlisted';
    registration.status = 'cancelled';
    await registration.save();

    if (wasActive) {
      event.participantCount = Math.max(0, (event.participantCount || 0) - 1);
      await event.save();
      await promoteNextWaitlisted(event);
    } else if (wasWaitlisted) {
      event.waitlistCount = Math.max(0, (event.waitlistCount || 0) - 1);
      await event.save();
    }

    return sendSuccess(res, 200, 'Left event', {
      event: serializeEvent(event),
    });
  } catch (error) {
    logger.error('leaveEvent error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to leave event');
  }
};

const createEventTeam = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, expectedSize, memberIds = [] } = req.body;
    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    if (!event.registrationOpen) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Registration is closed');
    }
    if (event.participationMode === 'individual') {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'This event is individual only');
    }
    const access = await assertCommunityMember(event.connectPageId, req.user._id);
    if (!access.isMember) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Join the community first');
    }

    const size = Math.max(2, Math.min(50, Number(expectedSize) || memberIds.length + 1 || 2));
    const inviteIds = [...new Set((memberIds || []).map((id) => id.toString()))].filter(
      (id) => id !== req.user._id.toString()
    );

    for (const mid of inviteIds) {
      const mAccess = await assertCommunityMember(event.connectPageId, mid);
      if (!mAccess.isMember) {
        return sendError(
          res,
          'BUSINESS_INVALID_OPERATION',
          'Every teammate must be a community member with a Taatom account'
        );
      }
    }

    const teamChat = await createChatRoom({
      type: 'community_event_team',
      title: `${String(name || 'Team').trim()} · ${event.title}`,
      connectPageId: event.connectPageId,
      participants: [req.user._id],
      ownerId: req.user._id,
      relatedType: 'community_event_team',
    });

    const team = await CommunityEventTeam.create({
      eventId,
      connectPageId: event.connectPageId,
      name: String(name || 'Team').trim().slice(0, 80),
      captainId: req.user._id,
      memberIds: [req.user._id],
      expectedSize: size,
      pendingInviteIds: inviteIds.map((id) => new mongoose.Types.ObjectId(id)),
      isComplete: 1 >= size,
      teamChatId: teamChat._id,
      status: 1 >= size ? 'active' : 'forming',
    });

    teamChat.relatedEntity = { type: 'community_event_team', refId: team._id };
    await teamChat.save();

    if (team.isComplete) {
      await CommunityEventRegistration.create({
        eventId,
        connectPageId: event.connectPageId,
        mode: 'team',
        teamId: team._id,
        status: 'active',
      });
      event.participantCount = (event.participantCount || 0) + 1;
      await event.save();
      if (event.chatId) {
        await Chat.findByIdAndUpdate(event.chatId, {
          $addToSet: { participants: { $each: team.memberIds } },
        });
      }
    }

    try {
      const actorName = req.user.fullName || req.user.username || 'Someone';
      const body = `${actorName} invited you to join team ${team.name} for ${event.title}`;
      await Promise.all(
        inviteIds.map(async (toUser) => {
          await Notification.createNotification({
            type: 'community_event_team_invite',
            fromUser: req.user._id,
            toUser,
            metadata: {
              kind: 'community_event_team_invite',
              connectPageId: event.connectPageId.toString(),
              eventId: event._id.toString(),
              teamId: team._id.toString(),
              pageName: access.page.name,
              eventTitle: event.title,
              teamName: team.name,
              message: `invited you to join team ${team.name} for ${event.title}`,
            },
          }).catch(() => null);
          await sendNotificationToUser({
            userId: toUser.toString(),
            title: 'Event team invite',
            body,
            data: {
              type: 'community_event_team_invite',
              connectPageId: event.connectPageId.toString(),
              eventId: event._id.toString(),
              teamId: team._id.toString(),
              fromUserId: req.user._id.toString(),
              pageName: access.page.name,
              eventTitle: event.title,
              teamName: team.name,
              kind: 'community_event_team_invite',
            },
          }).catch(() => null);
        })
      );
    } catch (_) {
      /* non-critical */
    }

    return sendSuccess(res, 201, 'Team created', { team });
  } catch (error) {
    logger.error('createEventTeam error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to create team');
  }
};

const acceptTeamInvite = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await CommunityEventTeam.findById(teamId);
    if (!team || team.status === 'withdrawn') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Team not found');
    }
    const pending = (team.pendingInviteIds || []).some(
      (id) => id && id.toString() === req.user._id.toString()
    );
    if (!pending) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'No pending invite');
    }

    const access = await assertCommunityMember(team.connectPageId, req.user._id);
    if (!access.isMember) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Join the community first');
    }

    team.pendingInviteIds = (team.pendingInviteIds || []).filter(
      (id) => id.toString() !== req.user._id.toString()
    );
    if (!(team.memberIds || []).some((id) => id.toString() === req.user._id.toString())) {
      team.memberIds.push(req.user._id);
    }
    team.isComplete = team.memberIds.length >= team.expectedSize && team.pendingInviteIds.length === 0;
    if (team.isComplete) team.status = 'active';
    await team.save();

    if (team.teamChatId) {
      await Chat.findByIdAndUpdate(team.teamChatId, {
        $addToSet: { participants: req.user._id },
      });
    }

    if (team.isComplete) {
      const existingReg = await CommunityEventRegistration.findOne({
        eventId: team.eventId,
        teamId: team._id,
        status: 'active',
      });
      if (!existingReg) {
        await CommunityEventRegistration.create({
          eventId: team.eventId,
          connectPageId: team.connectPageId,
          mode: 'team',
          teamId: team._id,
          status: 'active',
        });
        await CommunityEvent.findByIdAndUpdate(team.eventId, {
          $inc: { participantCount: 1 },
        });
      }
      const event = await CommunityEvent.findById(team.eventId).select('chatId announcementChatId');
      if (event?.chatId) {
        await Chat.findByIdAndUpdate(event.chatId, {
          $addToSet: { participants: { $each: team.memberIds } },
        });
      }
      if (event?.announcementChatId) {
        await Chat.findByIdAndUpdate(event.announcementChatId, {
          $addToSet: { participants: { $each: team.memberIds } },
        });
      }
    }

    return sendSuccess(res, 200, 'Joined team', { team });
  } catch (error) {
    logger.error('acceptTeamInvite error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to accept invite');
  }
};

const openEventHostDm = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { hostUserId } = req.body;
    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    if (!mongoose.Types.ObjectId.isValid(hostUserId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid host');
    }
    if (!isEventHost(event, hostUserId)) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'User is not an event host');
    }

    const registered =
      (await CommunityEventRegistration.exists({
        eventId,
        userId: req.user._id,
        status: 'active',
      })) ||
      (await CommunityEventTeam.exists({
        eventId,
        $or: [{ captainId: req.user._id }, { memberIds: req.user._id }],
        status: { $ne: 'withdrawn' },
      }));
    if (!registered && !isEventHost(event, req.user._id)) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Register for the event first');
    }

    let chat = await Chat.findOne({
      type: 'community_event_dm',
      'relatedEntity.refId': event._id,
      participants: { $all: [req.user._id, hostUserId], $size: 2 },
    });
    if (!chat) {
      chat = await createChatRoom({
        type: 'community_event_dm',
        title: `${event.title} · Host chat`,
        connectPageId: event.connectPageId,
        participants: [req.user._id, hostUserId],
        ownerId: hostUserId,
        relatedType: 'community_event',
        relatedId: event._id,
      });
    }

    return sendSuccess(res, 200, 'Event DM ready', { chatId: chat._id });
  } catch (error) {
    logger.error('openEventHostDm error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to open host chat');
  }
};

// ─────────────────────────────────────────────
// Competition rankings
// ─────────────────────────────────────────────

const upsertCompetition = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    const page = await loadPage(event.connectPageId);
    if (!page || (!canManageCommunity(page, req.user._id) && !isEventHost(event, req.user._id))) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only hosts can manage competition');
    }

    const {
      enabled = true,
      rankBy = 'likes',
      rankMode = 'engagement',
      judgeWeight = 50,
      judgeIds,
      allowedMedia,
      rulesText = '',
      submissionsOpen = true,
      startsAt = null,
      endsAt = null,
      frozen = false,
    } = req.body;

    if (!['likes', 'views'].includes(rankBy)) {
      return sendError(res, 'VALIDATION_FAILED', 'rankBy must be likes or views');
    }
    if (!['engagement', 'judges', 'hybrid'].includes(rankMode)) {
      return sendError(res, 'VALIDATION_FAILED', 'rankMode must be engagement, judges, or hybrid');
    }
    const resolvedJudgeWeight = Math.max(0, Math.min(100, Number(judgeWeight) || 50));
    const mediaInput =
      allowedMedia !== undefined ? allowedMedia : event.allowedEntryMedia || ALL_ENTRY_MEDIA;
    if (!isValidAllowedMediaInput(mediaInput)) {
      return sendError(
        res,
        'VALIDATION_FAILED',
        'allowedMedia must be a non-empty list of post, short, and/or long_video'
      );
    }
    const resolvedMedia = normalizeAllowedMedia(mediaInput);
    if (resolvedMedia.length === 0) {
      return sendError(res, 'VALIDATION_FAILED', 'Select at least one allowed entry type');
    }
    const resolvedJudgeIds = Array.isArray(judgeIds)
      ? [...new Set(judgeIds.map((id) => String(id)).filter((id) => mongoose.Types.ObjectId.isValid(id)))]
          .map((id) => new mongoose.Types.ObjectId(id))
      : undefined;

    let competition = await CommunityEventCompetition.findOne({ eventId });
    if (!competition) {
      competition = await CommunityEventCompetition.create({
        eventId,
        connectPageId: event.connectPageId,
        enabled: !!enabled,
        rankBy,
        rankMode,
        judgeWeight: resolvedJudgeWeight,
        judgeIds: resolvedJudgeIds || [],
        allowedMedia: resolvedMedia,
        rulesText: String(rulesText || '').slice(0, 4000),
        submissionsOpen: submissionsOpen !== false,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        frozen: !!frozen,
        createdBy: req.user._id,
      });
    } else {
      competition.enabled = enabled !== undefined ? !!enabled : competition.enabled;
      competition.rankBy = rankBy;
      competition.rankMode = rankMode;
      competition.judgeWeight = resolvedJudgeWeight;
      if (resolvedJudgeIds !== undefined) competition.judgeIds = resolvedJudgeIds;
      competition.allowedMedia = resolvedMedia;
      if (rulesText !== undefined) competition.rulesText = String(rulesText).slice(0, 4000);
      if (submissionsOpen !== undefined) competition.submissionsOpen = !!submissionsOpen;
      if (startsAt !== undefined) competition.startsAt = startsAt ? new Date(startsAt) : null;
      if (endsAt !== undefined) competition.endsAt = endsAt ? new Date(endsAt) : null;
      if (frozen !== undefined) competition.frozen = !!frozen;
      sanitizeCompetitionDoc(competition);
      await competition.save();
    }

    if (competition.frozen) {
      const active = await CommunityEventSubmission.find({
        competitionId: competition._id,
        status: 'active',
      });
      for (const sub of active) {
        const post = await Post.findById(sub.postId).select('likesCount viewsCount views').lean();
        if (!post) continue;
        const likes =
          typeof post.likesCount === 'number'
            ? post.likesCount
            : await Like.countDocuments({ post: post._id });
        const views = post.viewsCount || post.views || 0;
        sub.snapshotLikes = likes;
        sub.snapshotViews = views;
        await sub.save();
      }
    }

    return sendSuccess(res, 200, 'Competition saved', { competition });
  } catch (error) {
    logger.error('upsertCompetition error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to save competition');
  }
};

const submitCompetitionEntry = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { postId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return sendError(res, 'VALIDATION_FAILED', 'Invalid post ID');
    }

    const competition = await CommunityEventCompetition.findOne({ eventId, enabled: true });
    if (!competition) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Competition not enabled');
    }
    if (!competition.submissionsOpen || competition.frozen) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Submissions are closed');
    }
    if (competition.startsAt && competition.startsAt > new Date()) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Competition has not started');
    }
    if (competition.endsAt && competition.endsAt < new Date()) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'Competition has ended');
    }

    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');

    const post = await Post.findById(postId);
    if (!post || !post.isActive) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Post not found');
    }
    const postOwnerId = (post.user?._id || post.user)?.toString();
    if (!postOwnerId || postOwnerId !== req.user._id.toString()) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'You can only submit your own content');
    }

    if (!isEntryMediaAllowed(competition.allowedMedia, post.type)) {
      return sendError(
        res,
        'BUSINESS_INVALID_OPERATION',
        'This media type is not allowed for this event. Pick a post, short, or long video that matches the host rules.'
      );
    }

    const team = await CommunityEventTeam.findOne({
      eventId,
      $or: [{ captainId: req.user._id }, { memberIds: req.user._id }],
      status: { $ne: 'withdrawn' },
    });

    let mode = 'individual';
    let teamId = null;
    if (team) {
      if (!team.isComplete) {
        return sendError(
          res,
          'BUSINESS_INVALID_OPERATION',
          'All teammates must join before the team can compete'
        );
      }
      mode = 'team';
      teamId = team._id;
    } else {
      if (event.participationMode === 'group') {
        return sendError(
          res,
          'BUSINESS_INVALID_OPERATION',
          'This event is team-only — create or join a team first'
        );
      }

      let individual = await CommunityEventRegistration.findOne({
        eventId,
        userId: req.user._id,
        status: 'active',
      });

      // Entering a competition counts as joining: auto-register community members
      // (hosts often close registration after enabling the board).
      if (!individual) {
        const access = await assertCommunityMember(event.connectPageId, req.user._id);
        if (!access.isMember) {
          return sendError(
            res,
            'BUSINESS_INSUFFICIENT_PERMISSIONS',
            'Join the community before entering the competition'
          );
        }
        if (event.status === 'cancelled') {
          return sendError(res, 'BUSINESS_INVALID_OPERATION', 'This event was cancelled');
        }
        if (event.maxParticipants && event.participantCount >= event.maxParticipants) {
          return sendError(res, 'BUSINESS_LIMIT_EXCEEDED', 'Event is full');
        }

        individual = await CommunityEventRegistration.create({
          eventId,
          connectPageId: event.connectPageId,
          mode: 'individual',
          userId: req.user._id,
          status: 'active',
        });
        event.participantCount = (event.participantCount || 0) + 1;
        await event.save();

        if (event.chatId) {
          await Chat.findByIdAndUpdate(event.chatId, {
            $addToSet: { participants: req.user._id },
          });
        }
        if (event.announcementChatId) {
          await Chat.findByIdAndUpdate(event.announcementChatId, {
            $addToSet: { participants: req.user._id },
          });
        }
      }
    }

    // One active submission per user (or per user within a team). Host remove allows a new postId.
    const existingActive = await CommunityEventSubmission.findOne({
      competitionId: competition._id,
      userId: req.user._id,
      status: 'active',
    });
    if (existingActive) {
      return sendError(
        res,
        'RESOURCE_ALREADY_EXISTS',
        'You already have an active submission. Ask the host to remove it before uploading a new entry.'
      );
    }

    const submission = await CommunityEventSubmission.create({
      competitionId: competition._id,
      eventId,
      connectPageId: event.connectPageId,
      mode,
      userId: req.user._id,
      teamId,
      postId: post._id,
      status: 'active',
    });

    return sendSuccess(res, 201, 'Submission entered', { submission });
  } catch (error) {
    logger.error('submitCompetitionEntry error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to submit entry');
  }
};

const removeCompetitionSubmission = async (req, res) => {
  try {
    const { eventId, submissionId } = req.params;
    const { reason = '' } = req.body || {};
    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    const page = await loadPage(event.connectPageId);
    if (!page || (!canModerateCommunity(page, req.user._id) && !isEventHost(event, req.user._id))) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only hosts can remove entries');
    }

    const submission = await CommunityEventSubmission.findOne({
      _id: submissionId,
      eventId,
    });
    if (!submission || submission.status !== 'active') {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Submission not found');
    }

    submission.status = 'removed_by_host';
    submission.removedBy = req.user._id;
    submission.removedAt = new Date();
    submission.removeReason = String(reason || '').slice(0, 500);
    await submission.save();

    try {
      if (submission.userId) {
        const actorName = req.user.fullName || req.user.username || 'Someone';
        const body = `${actorName} removed your competition entry for ${event.title}. You may upload a new post or short with fresh counts.`;
        await Notification.createNotification({
          type: 'community_competition_removed',
          fromUser: req.user._id,
          toUser: submission.userId,
          metadata: {
            kind: 'community_competition_removed',
            connectPageId: event.connectPageId.toString(),
            eventId: event._id.toString(),
            submissionId: submission._id.toString(),
            eventTitle: event.title,
            message: `removed your competition entry for ${event.title}. You may upload a new post or short with fresh counts.`,
          },
        });
        await sendNotificationToUser({
          userId: submission.userId.toString(),
          title: 'Competition entry removed',
          body,
          data: {
            type: 'community_competition_removed',
            connectPageId: event.connectPageId.toString(),
            eventId: event._id.toString(),
            submissionId: submission._id.toString(),
            fromUserId: req.user._id.toString(),
            eventTitle: event.title,
            kind: 'community_competition_removed',
          },
        });
      }
    } catch (_) {
      /* non-critical */
    }

    return sendSuccess(res, 200, 'Submission removed', {
      submission,
      note: 'Participant may submit a new post/short; previous like/view counts do not carry over.',
    });
  } catch (error) {
    logger.error('removeCompetitionSubmission error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to remove submission');
  }
};

const getCompetitionLeaderboard = async (req, res) => {
  try {
    const { eventId } = req.params;
    let competition = await CommunityEventCompetition.findOne({ eventId });
    if (!competition || !competition.enabled) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'Competition not found');
    }

    // Auto-freeze after competition endsAt so display stays but metrics stop changing
    if (
      !competition.frozen &&
      competition.endsAt &&
      new Date(competition.endsAt).getTime() <= Date.now()
    ) {
      const activeSubs = await CommunityEventSubmission.find({
        competitionId: competition._id,
        status: 'active',
      });
      const freezePostIds = activeSubs.map((s) => s.postId);
      const freezePosts = await Post.find({ _id: { $in: freezePostIds } })
        .select('likesCount viewsCount views')
        .lean();
      const freezePostById = Object.fromEntries(
        freezePosts.map((p) => [p._id.toString(), p])
      );
      const freezeLikes = {};
      const counts = await Like.aggregate([
        { $match: { post: { $in: freezePostIds } } },
        { $group: { _id: '$post', count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => {
        freezeLikes[c._id.toString()] = c.count;
      });
      await Promise.all(
        activeSubs.map(async (sub) => {
          const post = freezePostById[sub.postId.toString()];
          sub.snapshotLikes = freezeLikes[sub.postId.toString()] ?? post?.likesCount ?? 0;
          sub.snapshotViews = post?.viewsCount || post?.views || 0;
          await sub.save();
        })
      );
      competition.frozen = true;
      competition.submissionsOpen = false;
      sanitizeCompetitionDoc(competition);
      await competition.save();
    }

    const competitionLean = competition.toObject ? competition.toObject() : competition;
    const rankMode = competitionLean.rankMode || 'engagement';
    const judgeWeight = Math.max(0, Math.min(100, Number(competitionLean.judgeWeight) || 50));

    const submissions = await CommunityEventSubmission.find({
      competitionId: competition._id,
      status: 'active',
    })
      .populate('userId', 'fullName username profilePic')
      .populate('teamId', 'name memberIds captainId isComplete')
      .lean();

    const postIds = submissions.map((s) => s.postId);
    const posts = await Post.find({ _id: { $in: postIds } })
      .select(
        'type caption thumbnailUrl imageUrl images videoUrl storageKey storageKeys likesCount viewsCount views user'
      )
      .lean();
    const previewList = await Promise.all(posts.map((p) => resolveCompetitionPostPreview(p)));
    const postById = Object.fromEntries(
      posts.map((p, i) => [p._id.toString(), { ...p, preview: previewList[i] }])
    );

    const likeCounts = {};
    if (!competitionLean.frozen) {
      const counts = await Like.aggregate([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => {
        likeCounts[c._id.toString()] = c.count;
      });
    }

    const subIds = submissions.map((s) => s._id);
    const scores = await CommunityEventJudgeScore.find({
      competitionId: competition._id,
      submissionId: { $in: subIds },
    }).lean();
    const scoresBySub = {};
    scores.forEach((s) => {
      const key = s.submissionId.toString();
      if (!scoresBySub[key]) scoresBySub[key] = [];
      scoresBySub[key].push(s.score);
    });

    const rows = [];
    for (const sub of submissions) {
      const post = postById[sub.postId.toString()];
      if (!post) continue;
      const likes = competitionLean.frozen
        ? sub.snapshotLikes ?? 0
        : likeCounts[post._id.toString()] ?? post.likesCount ?? 0;
      const views = competitionLean.frozen
        ? sub.snapshotViews ?? 0
        : post.viewsCount || post.views || 0;
      const engagement = competitionLean.rankBy === 'views' ? views : likes;
      const judgeList = scoresBySub[sub._id.toString()] || [];
      const judgeScore =
        judgeList.length > 0
          ? judgeList.reduce((a, b) => a + b, 0) / judgeList.length
          : null;
      const preview = post.preview || {};
      rows.push({
        submissionId: sub._id,
        mode: sub.mode,
        user: sub.userId,
        team: sub.teamId,
        post: {
          _id: post._id,
          type: post.type,
          caption: post.caption,
          thumbnailUrl: preview.thumbnailUrl || post.thumbnailUrl || post.imageUrl || '',
          imageUrl: preview.imageUrl || post.imageUrl || '',
          images: preview.images || post.images || [],
        },
        likes,
        views,
        engagement,
        judgeScore,
        judgeCount: judgeList.length,
        metric: engagement,
      });
    }

    // Normalize for hybrid/judges ranking
    const maxEngagement = Math.max(...rows.map((r) => r.engagement), 1);
    rows.forEach((row) => {
      const engNorm = (row.engagement / maxEngagement) * 10;
      const judgeNorm = row.judgeScore == null ? 0 : row.judgeScore;
      if (rankMode === 'judges') {
        row.metric = judgeNorm;
      } else if (rankMode === 'hybrid') {
        const w = judgeWeight / 100;
        row.metric = engNorm * (1 - w) + judgeNorm * w;
      } else {
        row.metric = row.engagement;
      }
    });

    // Team aggregation: sum member metrics under the same teamId
    const teamBuckets = new Map();
    const individualRows = [];
    for (const row of rows) {
      if (row.mode === 'team' && row.team?._id) {
        const key = row.team._id.toString();
        const bucket = teamBuckets.get(key) || {
          mode: 'team',
          team: row.team,
          submissions: [],
          likes: 0,
          views: 0,
          engagement: 0,
          judgeScore: null,
          judgeCount: 0,
          metric: 0,
          _judgeSum: 0,
          _judgeN: 0,
        };
        bucket.submissions.push(row);
        bucket.likes += row.likes;
        bucket.views += row.views;
        bucket.engagement += row.engagement;
        bucket.metric += row.metric;
        if (row.judgeScore != null) {
          bucket._judgeSum += row.judgeScore;
          bucket._judgeN += 1;
        }
        bucket.judgeCount += row.judgeCount;
        teamBuckets.set(key, bucket);
      } else {
        individualRows.push(row);
      }
    }
    for (const bucket of teamBuckets.values()) {
      bucket.judgeScore = bucket._judgeN > 0 ? bucket._judgeSum / bucket._judgeN : null;
      delete bucket._judgeSum;
      delete bucket._judgeN;
    }

    const leaderboard = [...individualRows, ...teamBuckets.values()].sort(
      (a, b) => b.metric - a.metric
    );
    leaderboard.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    return sendSuccess(res, 200, 'Leaderboard', {
      competition: competitionLean,
      leaderboard,
      rankBy: competitionLean.rankBy,
      rankMode,
      judgeWeight,
      frozen: !!competitionLean.frozen,
    });
  } catch (error) {
    logger.error('getCompetitionLeaderboard error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to load leaderboard');
  }
};

const scoreCompetitionSubmission = async (req, res) => {
  try {
    const { eventId, submissionId } = req.params;
    const score = Number(req.body.score);
    if (!Number.isFinite(score) || score < 1 || score > 10) {
      return sendError(res, 'VALIDATION_FAILED', 'score must be between 1 and 10');
    }

    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    const competition = await CommunityEventCompetition.findOne({ eventId, enabled: true });
    if (!competition) return sendError(res, 'RESOURCE_NOT_FOUND', 'Competition not found');
    const page = await loadPage(event.connectPageId);
    if (!canJudgeCompetition(event, competition, req.user._id, page)) {
      return sendError(
        res,
        'BUSINESS_INSUFFICIENT_PERMISSIONS',
        'Only event hosts, community managers, or assigned judges can score entries'
      );
    }
    // Allow scoring even after freeze/showcase so hosts can finalize hybrid ranks,
    // then republish the showcase if needed.

    const submission = await CommunityEventSubmission.findOne({
      _id: submissionId,
      eventId,
      status: 'active',
    });
    if (!submission) {
      return sendError(res, 'RESOURCE_NOT_FOUND', 'That entry is no longer on the leaderboard');
    }

    const doc = await CommunityEventJudgeScore.findOneAndUpdate(
      {
        competitionId: competition._id,
        submissionId: submission._id,
        judgeId: req.user._id,
      },
      {
        $set: {
          score,
          eventId: event._id,
        },
        $setOnInsert: {
          competitionId: competition._id,
          submissionId: submission._id,
          judgeId: req.user._id,
        },
      },
      { upsert: true, new: true }
    );

    return sendSuccess(res, 200, 'Score saved', { score: doc });
  } catch (error) {
    logger.error('scoreCompetitionSubmission error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to save score');
  }
};

const publishCompetitionShowcase = async (req, res) => {
  try {
    const { eventId } = req.params;
    const limit = Math.min(Math.max(Number(req.body.limit) || 5, 1), 20);
    const event = await CommunityEvent.findById(eventId);
    if (!event) return sendError(res, 'RESOURCE_NOT_FOUND', 'Event not found');
    const page = await loadPage(event.connectPageId);
    if (!page || (!canManageCommunity(page, req.user._id) && !isEventHost(event, req.user._id))) {
      return sendError(res, 'BUSINESS_INSUFFICIENT_PERMISSIONS', 'Only hosts can publish showcase');
    }

    const competition = await CommunityEventCompetition.findOne({ eventId, enabled: true });
    if (!competition) return sendError(res, 'RESOURCE_NOT_FOUND', 'Competition not found');

    const submissions = await CommunityEventSubmission.find({
      competitionId: competition._id,
      status: 'active',
    }).lean();
    if (!submissions.length) {
      return sendError(res, 'BUSINESS_INVALID_OPERATION', 'No active submissions to showcase');
    }

    const postIds = submissions.map((s) => s.postId);
    const posts = await Post.find({ _id: { $in: postIds } })
      .select('likesCount viewsCount views')
      .lean();
    const postById = Object.fromEntries(posts.map((p) => [p._id.toString(), p]));
    const likeCounts = {};
    const counts = await Like.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]);
    counts.forEach((c) => {
      likeCounts[c._id.toString()] = c.count;
    });

    const scores = await CommunityEventJudgeScore.find({
      competitionId: competition._id,
      submissionId: { $in: submissions.map((s) => s._id) },
    }).lean();
    const scoresBySub = {};
    scores.forEach((s) => {
      const key = s.submissionId.toString();
      if (!scoresBySub[key]) scoresBySub[key] = [];
      scoresBySub[key].push(s.score);
    });

    const rankMode = competition.rankMode || 'engagement';
    const judgeWeight = Math.max(0, Math.min(100, Number(competition.judgeWeight) || 50));
    const rows = submissions.map((sub) => {
      const post = postById[sub.postId.toString()];
      const likes = competition.frozen
        ? sub.snapshotLikes ?? 0
        : likeCounts[sub.postId.toString()] ?? post?.likesCount ?? 0;
      const views = competition.frozen
        ? sub.snapshotViews ?? 0
        : post?.viewsCount || post?.views || 0;
      const engagement = competition.rankBy === 'views' ? views : likes;
      const judgeList = scoresBySub[sub._id.toString()] || [];
      const judgeScore =
        judgeList.length > 0
          ? judgeList.reduce((a, b) => a + b, 0) / judgeList.length
          : null;
      return {
        submissionId: sub._id,
        postId: sub.postId,
        userId: sub.userId,
        engagement,
        judgeScore,
      };
    });
    const maxEngagement = Math.max(...rows.map((r) => r.engagement), 1);
    rows.forEach((row) => {
      const engNorm = (row.engagement / maxEngagement) * 10;
      const judgeNorm = row.judgeScore == null ? 0 : row.judgeScore;
      if (rankMode === 'judges') row.metric = judgeNorm;
      else if (rankMode === 'hybrid') {
        const w = judgeWeight / 100;
        row.metric = engNorm * (1 - w) + judgeNorm * w;
      } else row.metric = row.engagement;
    });
    rows.sort((a, b) => b.metric - a.metric);
    const top = rows.slice(0, limit).map((r, idx) => ({
      submissionId: r.submissionId,
      postId: r.postId,
      userId: r.userId,
      rank: idx + 1,
      metric: r.metric,
    }));

    competition.showcase = {
      publishedAt: new Date(),
      entries: top,
    };
    if (!competition.frozen) {
      competition.frozen = true;
      competition.submissionsOpen = false;
    }
    sanitizeCompetitionDoc(competition);
    await competition.save();

    try {
      const registrants = await CommunityEventRegistration.find({
        eventId,
        status: 'active',
        userId: { $ne: null },
      })
        .select('userId')
        .limit(200)
        .lean();
      const pageName = page.name || 'community';
      const body = `Winners are up for ${event.title}`;
      await Promise.all(
        registrants.map(async (reg) => {
          if (!reg.userId) return;
          await Notification.createNotification({
            type: 'community_event_showcase_published',
            fromUser: req.user._id,
            toUser: reg.userId,
            metadata: {
              kind: 'community_event_showcase_published',
              connectPageId: event.connectPageId.toString(),
              eventId: event._id.toString(),
              pageName,
              eventTitle: event.title,
              message: `published winners for ${event.title}`,
            },
          }).catch(() => null);
          await sendNotificationToUser({
            userId: reg.userId.toString(),
            title: 'Event winners',
            body,
            data: {
              type: 'community_event_showcase_published',
              connectPageId: event.connectPageId.toString(),
              eventId: event._id.toString(),
              fromUserId: req.user._id.toString(),
              pageName,
              eventTitle: event.title,
              kind: 'community_event_showcase_published',
            },
          }).catch(() => null);
        })
      );
    } catch (e) {
      logger.warn('showcase notify failed:', e?.message);
    }

    return sendSuccess(res, 200, 'Showcase published', {
      showcase: competition.showcase,
      competition,
    });
  } catch (error) {
    logger.error('publishCompetitionShowcase error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to publish showcase');
  }
};

const getCompetitionShowcase = async (req, res) => {
  try {
    const { eventId } = req.params;
    const competition = await CommunityEventCompetition.findOne({ eventId }).lean();
    if (!competition) return sendError(res, 'RESOURCE_NOT_FOUND', 'Competition not found');
    const showcase = competition.showcase || { publishedAt: null, entries: [] };
    if (!showcase.publishedAt || !showcase.entries?.length) {
      return sendSuccess(res, 200, 'Showcase', { showcase: { publishedAt: null, entries: [] } });
    }

    const postIds = showcase.entries.map((e) => e.postId).filter(Boolean);
    const userIds = showcase.entries.map((e) => e.userId).filter(Boolean);
    const [posts, users] = await Promise.all([
      Post.find({ _id: { $in: postIds } })
        .select('type caption thumbnailUrl imageUrl images storageKey storageKeys')
        .lean(),
      User.find({ _id: { $in: userIds } })
        .select('fullName username profilePic')
        .lean(),
    ]);
    const previews = await Promise.all(posts.map((p) => resolveCompetitionPostPreview(p)));
    const postById = Object.fromEntries(
      posts.map((p, i) => [p._id.toString(), previews[i] || p])
    );
    const userById = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    return sendSuccess(res, 200, 'Showcase', {
      showcase: {
        publishedAt: showcase.publishedAt,
        entries: showcase.entries.map((e) => ({
          ...e,
          post: postById[e.postId?.toString()] || null,
          user: userById[e.userId?.toString()] || null,
        })),
      },
    });
  } catch (error) {
    logger.error('getCompetitionShowcase error:', error);
    return sendError(res, 'SERVER_ERROR', 'Failed to load showcase');
  }
};

module.exports = {
  searchCommunityMembers,
  listCommunityRoles,
  assignCommunityRole,
  revokeCommunityRole,
  listGroupChats,
  createGroupChat,
  joinGroupChat,
  listGroupJoinRequests,
  reviewGroupJoinRequest,
  inviteToGroupChat,
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  registerForEvent,
  leaveEvent,
  createEventTeam,
  acceptTeamInvite,
  openEventHostDm,
  upsertCompetition,
  submitCompetitionEntry,
  removeCompetitionSubmission,
  getCompetitionLeaderboard,
  scoreCompetitionSubmission,
  publishCompetitionShowcase,
  getCompetitionShowcase,
};

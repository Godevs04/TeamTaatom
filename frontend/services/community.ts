import api from './api';
import { parseError } from '../utils/errorCodes';

async function unwrap<T>(promise: Promise<any>): Promise<T> {
  try {
    const response = await promise;
    return (response.data?.data ?? response.data) as T;
  } catch (error: any) {
    const parsed = parseError(error);
    throw new Error(parsed.userMessage);
  }
}

export type CommunityRole = 'owner' | 'admin' | 'moderator' | 'member' | null;

export type CommunityGroupChat = {
  _id: string;
  connectPageId: string;
  name: string;
  description?: string;
  privacy: 'public' | 'request' | 'invite';
  requireJoinProof?: boolean;
  proofPrompt?: string;
  chatId: string;
  memberCount?: number;
  isDefault?: boolean;
  isMember?: boolean;
  joinRequestPending?: boolean;
  canManage?: boolean;
};

export type CommunityEvent = {
  _id: string;
  connectPageId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string | null;
  location?: { address?: string; coordinates?: { latitude?: number; longitude?: number } };
  coverImage?: string;
  maxParticipants?: number | null;
  visibility?: string;
  participationMode: 'individual' | 'group' | 'both';
  hostIds?: string[];
  registrationOpen?: boolean;
  participantCount?: number;
  chatId?: string | null;
  announcementChatId?: string | null;
  status?: string;
  isRegistered?: boolean;
  canManage?: boolean;
  myTeam?: { _id?: string; chatId?: string; name?: string; isComplete?: boolean } | null;
  competition?: CommunityCompetition | null;
};

export type CommunityCompetition = {
  _id: string;
  eventId: string;
  enabled: boolean;
  rankBy: 'likes' | 'views';
  allowedMedia: 'post' | 'short' | 'both';
  rulesText?: string;
  submissionsOpen?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  frozen?: boolean;
};

export type LeaderboardRow = {
  rank: number;
  mode: 'individual' | 'team';
  metric: number;
  likes: number;
  views: number;
  user?: any;
  team?: any;
  post?: any;
  submissions?: any[];
  submissionId?: string;
};

export const searchCommunityMembers = (pageId: string, q = '', limit = 20) =>
  unwrap<{ members: any[] }>(
    api.get(`/api/v1/connect/page/${pageId}/members/search`, { params: { q, limit } })
  );

export const listCommunityRoles = (pageId: string) =>
  unwrap<{ owner: any; myRole: CommunityRole; staff: any[] }>(
    api.get(`/api/v1/connect/page/${pageId}/roles`)
  );

export const assignCommunityRole = (pageId: string, userId: string, role: 'admin' | 'moderator') =>
  unwrap(api.post(`/api/v1/connect/page/${pageId}/roles`, { userId, role }));

export const revokeCommunityRole = (pageId: string, userId: string) =>
  unwrap(api.delete(`/api/v1/connect/page/${pageId}/roles/${userId}`));

export const listGroupChats = (pageId: string) =>
  unwrap<{ groupChats: CommunityGroupChat[] }>(
    api.get(`/api/v1/connect/page/${pageId}/group-chats`)
  );

export const createGroupChat = (
  pageId: string,
  body: {
    name: string;
    description?: string;
    privacy?: 'public' | 'request' | 'invite';
    requireJoinProof?: boolean;
    proofPrompt?: string;
  }
) => unwrap<{ groupChat: CommunityGroupChat }>(api.post(`/api/v1/connect/page/${pageId}/group-chats`, body));

export const joinGroupChat = (
  groupChatId: string,
  body?: { proofText?: string; proofFileUrl?: string }
) => unwrap(api.post(`/api/v1/connect/group-chats/${groupChatId}/join`, body || {}));

export const inviteToGroupChat = (groupChatId: string, userId: string) =>
  unwrap(api.post(`/api/v1/connect/group-chats/${groupChatId}/invite`, { userId }));

export const listGroupJoinRequests = (groupChatId: string) =>
  unwrap<{ requests: any[] }>(api.get(`/api/v1/connect/group-chats/${groupChatId}/join-requests`));

export const reviewGroupJoinRequest = (requestId: string, action: 'accept' | 'reject') =>
  unwrap(api.post(`/api/v1/connect/group-join-requests/${requestId}/review`, { action }));

export const listCommunityEvents = (pageId: string) =>
  unwrap<{ events: CommunityEvent[] }>(api.get(`/api/v1/connect/page/${pageId}/events`));

export const createCommunityEvent = (pageId: string, body: Record<string, unknown>) =>
  unwrap<{ event: CommunityEvent }>(api.post(`/api/v1/connect/page/${pageId}/events`, body));

export const getCommunityEvent = (eventId: string) =>
  unwrap<{ event: CommunityEvent }>(api.get(`/api/v1/connect/events/${eventId}`));

export const updateCommunityEvent = (eventId: string, body: Record<string, unknown>) =>
  unwrap<{ event: CommunityEvent }>(api.patch(`/api/v1/connect/events/${eventId}`, body));

export const registerForCommunityEvent = (eventId: string) =>
  unwrap(api.post(`/api/v1/connect/events/${eventId}/register`));

export const createEventTeam = (
  eventId: string,
  body: { name: string; expectedSize: number; memberIds?: string[] }
) => unwrap<{ team: any }>(api.post(`/api/v1/connect/events/${eventId}/teams`, body));

export const acceptEventTeamInvite = (teamId: string) =>
  unwrap(api.post(`/api/v1/connect/event-teams/${teamId}/accept`));

export const openEventHostDm = (eventId: string, hostUserId: string) =>
  unwrap<{ chatId: string }>(api.post(`/api/v1/connect/events/${eventId}/host-dm`, { hostUserId }));

export const upsertEventCompetition = (eventId: string, body: Record<string, unknown>) =>
  unwrap<{ competition: CommunityCompetition }>(
    api.post(`/api/v1/connect/events/${eventId}/competition`, body)
  );

export const submitCompetitionEntry = (eventId: string, postId: string) =>
  unwrap(api.post(`/api/v1/connect/events/${eventId}/competition/submissions`, { postId }));

export const removeCompetitionSubmission = (eventId: string, submissionId: string, reason?: string) =>
  unwrap(
    api.delete(`/api/v1/connect/events/${eventId}/competition/submissions/${submissionId}`, {
      data: { reason },
    })
  );

export const getCompetitionLeaderboard = (eventId: string) =>
  unwrap<{
    competition: CommunityCompetition;
    leaderboard: LeaderboardRow[];
    rankBy: 'likes' | 'views';
    frozen: boolean;
  }>(api.get(`/api/v1/connect/events/${eventId}/competition/leaderboard`));

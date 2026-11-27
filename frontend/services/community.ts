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

export type AllowedEntryMedia = 'post' | 'short' | 'long_video';

export type EventTemplateKey =
  | 'best_short'
  | 'photo_dump'
  | 'long_story'
  | 'open_media'
  | 'team_challenge';

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
  /** Multi-select: post | short | long_video. Legacy string 'all'|'both'|single kind still accepted on read. */
  allowedEntryMedia?: AllowedEntryMedia[] | AllowedEntryMedia | 'all' | 'both';
  templateKey?: EventTemplateKey | null;
  hostIds?: string[];
  registrationOpen?: boolean;
  participantCount?: number;
  waitlistCount?: number;
  chatId?: string | null;
  announcementChatId?: string | null;
  status?: string;
  isRegistered?: boolean;
  isWaitlisted?: boolean;
  isFull?: boolean;
  registrationStatus?: 'active' | 'waitlisted' | 'cancelled' | null;
  canManage?: boolean;
  myTeam?: { _id?: string; chatId?: string; name?: string; isComplete?: boolean } | null;
  competition?: CommunityCompetition | null;
  /** Present on global events feed */
  page?: {
    _id?: string;
    name?: string;
    profileImage?: string;
    category?: string;
  } | null;
};

export type CommunityCompetition = {
  _id: string;
  eventId: string;
  enabled: boolean;
  rankBy: 'likes' | 'views';
  rankMode?: 'engagement' | 'judges' | 'hybrid';
  judgeWeight?: number;
  judgeIds?: string[];
  allowedMedia?: AllowedEntryMedia[] | AllowedEntryMedia | 'all' | 'both';
  rulesText?: string;
  submissionsOpen?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  frozen?: boolean;
  showcase?: {
    publishedAt?: string | null;
    entries?: Array<{
      submissionId?: string;
      postId?: string;
      userId?: string;
      rank?: number;
      metric?: number;
      post?: any;
      user?: any;
    }>;
  };
};

export type LeaderboardRow = {
  rank: number;
  mode: 'individual' | 'team';
  metric: number;
  likes: number;
  views: number;
  engagement?: number;
  judgeScore?: number | null;
  judgeCount?: number;
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

/** Public events + events the current user has joined. */
export const listEventsFeed = (page = 1, limit = 20) =>
  unwrap<{
    events: CommunityEvent[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(api.get('/api/v1/connect/events', { params: { page, limit } }));

export const createCommunityEvent = (pageId: string, body: Record<string, unknown>) =>
  unwrap<{ event: CommunityEvent }>(api.post(`/api/v1/connect/page/${pageId}/events`, body));

export const getCommunityEvent = (eventId: string) =>
  unwrap<{ event: CommunityEvent }>(api.get(`/api/v1/connect/events/${eventId}`));

export const updateCommunityEvent = (eventId: string, body: Record<string, unknown>) =>
  unwrap<{ event: CommunityEvent }>(api.patch(`/api/v1/connect/events/${eventId}`, body));

export const registerForCommunityEvent = (eventId: string) =>
  unwrap<{
    registration?: any;
    isRegistered?: boolean;
    isWaitlisted?: boolean;
  }>(api.post(`/api/v1/connect/events/${eventId}/register`));

export const leaveCommunityEvent = (eventId: string) =>
  unwrap<{ event: CommunityEvent }>(api.delete(`/api/v1/connect/events/${eventId}/register`));

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
    rankMode?: 'engagement' | 'judges' | 'hybrid';
    judgeWeight?: number;
    frozen: boolean;
  }>(api.get(`/api/v1/connect/events/${eventId}/competition/leaderboard`));

export const scoreCompetitionSubmission = (
  eventId: string,
  submissionId: string,
  score: number
) =>
  unwrap(
    api.put(`/api/v1/connect/events/${eventId}/competition/submissions/${submissionId}/score`, {
      score,
    })
  );

export const publishCompetitionShowcase = (eventId: string, limit = 5) =>
  unwrap<{ showcase: CommunityCompetition['showcase']; competition: CommunityCompetition }>(
    api.post(`/api/v1/connect/events/${eventId}/competition/showcase`, { limit })
  );

export const getCompetitionShowcase = (eventId: string) =>
  unwrap<{ showcase: NonNullable<CommunityCompetition['showcase']> }>(
    api.get(`/api/v1/connect/events/${eventId}/competition/showcase`)
  );

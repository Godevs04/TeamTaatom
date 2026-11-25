import { api } from "./axios";

type ApiEnvelope<T> = {
  data?: T;
} & T;

async function unwrap<T>(res: { data: ApiEnvelope<T> }): Promise<T> {
  return (res.data?.data ?? res.data) as T;
}

export type CommunityMember = {
  _id: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
  communityRole?: "owner" | "admin" | "moderator" | "member" | null;
};

export type CommunityStaffMember = {
  userId: string | { _id?: string };
  role: "admin" | "moderator";
  user?: {
    _id?: string;
    fullName?: string;
    username?: string;
    profilePic?: string;
  } | null;
};

export type CommunityOwner = {
  _id?: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
} | null;

export type CommunityJoinRequest = {
  _id: string;
  userId?: {
    _id?: string;
    fullName?: string;
    username?: string;
  } | null;
};

export type AllowedEntryMedia = "post" | "short" | "long_video";

export type EventTemplateKey =
  | "best_short"
  | "photo_dump"
  | "long_story"
  | "open_media"
  | "team_challenge";

export type CommunityCompetition = {
  _id?: string;
  enabled?: boolean;
  submissionsOpen?: boolean;
  rankBy?: "likes" | "views" | string;
  rankMode?: "engagement" | "judges" | "hybrid";
  judgeWeight?: number;
  judgeIds?: string[];
  frozen?: boolean;
  allowedMedia?: AllowedEntryMedia[] | AllowedEntryMedia | "all" | "both" | string;
  showcase?: {
    publishedAt?: string | null;
    entries?: Array<{
      submissionId?: string;
      postId?: string;
      userId?: string;
      rank?: number;
      metric?: number;
      post?: { _id?: string; type?: string; caption?: string; thumbnailUrl?: string; imageUrl?: string };
      user?: { _id?: string; fullName?: string; username?: string; profilePic?: string };
    }>;
  };
};

export type LeaderboardRow = {
  rank: number;
  metric?: number | string;
  submissionId?: string;
  mode?: "individual" | "team" | string;
  judgeScore?: number | null;
  judgeCount?: number;
  user?: { _id?: string; fullName?: string; username?: string } | null;
  team?: { _id?: string; name?: string } | null;
  post?: {
    _id?: string;
    type?: string;
    caption?: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    images?: string[];
  } | null;
};

export type CommunityGroupChat = {
  _id: string;
  name: string;
  privacy: "public" | "request" | "invite";
  requireJoinProof?: boolean;
  chatId: string;
  memberCount?: number;
  isDefault?: boolean;
  isMember?: boolean;
  joinRequestPending?: boolean;
  canManage?: boolean;
  description?: string;
};

export type CommunityEvent = {
  _id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  participationMode: "individual" | "group" | "both";
  /** Multi-select array; legacy string still accepted on read. */
  allowedEntryMedia?: AllowedEntryMedia[] | AllowedEntryMedia | "all" | "both";
  templateKey?: EventTemplateKey | null;
  waitlistCount?: number;
  isRegistered?: boolean;
  isWaitlisted?: boolean;
  isFull?: boolean;
  registrationStatus?: "active" | "waitlisted" | "cancelled" | null;
  canManage?: boolean;
  chatId?: string | null;
  announcementChatId?: string | null;
  hostIds?: string[];
  registrationOpen?: boolean;
  participantCount?: number;
  description?: string;
  maxParticipants?: number | null;
  visibility?: string;
  status?: string;
  location?: { address?: string };
  myTeam?: { _id?: string; chatId?: string; name?: string; isComplete?: boolean } | null;
  competition?: CommunityCompetition | null;
};

export async function searchCommunityMembers(pageId: string, q = "") {
  const res = await api.get(`/connect/page/${pageId}/members/search`, { params: { q } });
  return unwrap<{ members: CommunityMember[] }>(res);
}

export async function listCommunityRoles(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}/roles`);
  return unwrap<{ owner: CommunityOwner; myRole: string; staff: CommunityStaffMember[] }>(res);
}

export async function assignCommunityRole(
  pageId: string,
  userId: string,
  role: "admin" | "moderator"
) {
  const res = await api.post(`/connect/page/${pageId}/roles`, { userId, role });
  return unwrap<Record<string, unknown>>(res);
}

export async function revokeCommunityRole(pageId: string, userId: string) {
  const res = await api.delete(`/connect/page/${pageId}/roles/${userId}`);
  return unwrap<Record<string, unknown>>(res);
}

export async function inviteToGroupChat(groupChatId: string, userId: string) {
  const res = await api.post(`/connect/group-chats/${groupChatId}/invite`, { userId });
  return unwrap<Record<string, unknown>>(res);
}

export async function getCommunityEvent(eventId: string) {
  const res = await api.get(`/connect/events/${eventId}`);
  return unwrap<{ event: CommunityEvent }>(res);
}

export async function updateCommunityEvent(eventId: string, body: Record<string, unknown>) {
  const res = await api.patch(`/connect/events/${eventId}`, body);
  return unwrap<{ event: CommunityEvent }>(res);
}

export async function openEventHostDm(eventId: string, hostUserId: string) {
  const res = await api.post(`/connect/events/${eventId}/host-dm`, { hostUserId });
  return unwrap<{ chatId: string }>(res);
}

export async function listGroupChats(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}/group-chats`);
  return unwrap<{ groupChats: CommunityGroupChat[] }>(res);
}

export async function createGroupChat(
  pageId: string,
  body: {
    name: string;
    privacy?: string;
    requireJoinProof?: boolean;
    proofPrompt?: string;
    description?: string;
  }
) {
  const res = await api.post(`/connect/page/${pageId}/group-chats`, body);
  return unwrap<{ groupChat: CommunityGroupChat }>(res);
}

export async function joinGroupChat(
  groupChatId: string,
  body?: { proofText?: string; proofFileUrl?: string }
) {
  const res = await api.post(`/connect/group-chats/${groupChatId}/join`, body || {});
  return unwrap<Record<string, unknown>>(res);
}

export async function listGroupJoinRequests(groupChatId: string) {
  const res = await api.get(`/connect/group-chats/${groupChatId}/join-requests`);
  return unwrap<{ requests: CommunityJoinRequest[] }>(res);
}

export async function reviewGroupJoinRequest(requestId: string, action: "accept" | "reject") {
  const res = await api.post(`/connect/group-join-requests/${requestId}/review`, { action });
  return unwrap<Record<string, unknown>>(res);
}

export async function listCommunityEvents(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}/events`);
  return unwrap<{ events: CommunityEvent[] }>(res);
}

export async function createCommunityEvent(pageId: string, body: Record<string, unknown>) {
  const res = await api.post(`/connect/page/${pageId}/events`, body);
  return unwrap<{ event: CommunityEvent }>(res);
}

export async function registerForCommunityEvent(eventId: string) {
  const res = await api.post(`/connect/events/${eventId}/register`);
  return unwrap<{
    registration?: unknown;
    isRegistered?: boolean;
    isWaitlisted?: boolean;
  }>(res);
}

export async function leaveCommunityEvent(eventId: string) {
  const res = await api.delete(`/connect/events/${eventId}/register`);
  return unwrap<{ event: CommunityEvent }>(res);
}

export async function createEventTeam(
  eventId: string,
  body: { name: string; expectedSize: number; memberIds?: string[] }
) {
  const res = await api.post(`/connect/events/${eventId}/teams`, body);
  return unwrap<Record<string, unknown>>(res);
}

export async function acceptEventTeamInvite(teamId: string) {
  const res = await api.post(`/connect/event-teams/${teamId}/accept`);
  return unwrap<Record<string, unknown>>(res);
}

export async function upsertEventCompetition(eventId: string, body: Record<string, unknown>) {
  const res = await api.post(`/connect/events/${eventId}/competition`, body);
  return unwrap<Record<string, unknown>>(res);
}

export async function submitCompetitionEntry(eventId: string, postId: string) {
  const res = await api.post(`/connect/events/${eventId}/competition/submissions`, { postId });
  return unwrap<Record<string, unknown>>(res);
}

export async function removeCompetitionSubmission(
  eventId: string,
  submissionId: string,
  reason?: string
) {
  const res = await api.delete(`/connect/events/${eventId}/competition/submissions/${submissionId}`, {
    data: { reason },
  });
  return unwrap<Record<string, unknown>>(res);
}

export async function getCompetitionLeaderboard(eventId: string) {
  const res = await api.get(`/connect/events/${eventId}/competition/leaderboard`);
  return unwrap<{
    competition: CommunityCompetition;
    leaderboard: LeaderboardRow[];
    rankBy: "likes" | "views";
    rankMode?: "engagement" | "judges" | "hybrid";
    judgeWeight?: number;
    frozen: boolean;
  }>(res);
}

export async function scoreCompetitionSubmission(
  eventId: string,
  submissionId: string,
  score: number
) {
  const res = await api.put(
    `/connect/events/${eventId}/competition/submissions/${submissionId}/score`,
    { score }
  );
  return unwrap<Record<string, unknown>>(res);
}

export async function publishCompetitionShowcase(eventId: string, limit = 5) {
  const res = await api.post(`/connect/events/${eventId}/competition/showcase`, { limit });
  return unwrap<{ showcase: CommunityCompetition["showcase"]; competition: CommunityCompetition }>(
    res
  );
}

export async function getCompetitionShowcase(eventId: string) {
  const res = await api.get(`/connect/events/${eventId}/competition/showcase`);
  return unwrap<{ showcase: NonNullable<CommunityCompetition["showcase"]> }>(res);
}

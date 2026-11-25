import { api } from "./axios";

async function unwrap<T>(res: { data: any }): Promise<T> {
  return (res.data?.data ?? res.data) as T;
}

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
  isRegistered?: boolean;
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
  competition?: { enabled?: boolean; submissionsOpen?: boolean; rankBy?: string } | null;
};

export async function searchCommunityMembers(pageId: string, q = "") {
  const res = await api.get(`/connect/page/${pageId}/members/search`, { params: { q } });
  return unwrap<{ members: any[] }>(res);
}

export async function listCommunityRoles(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}/roles`);
  return unwrap<{ owner: any; myRole: string; staff: any[] }>(res);
}

export async function assignCommunityRole(
  pageId: string,
  userId: string,
  role: "admin" | "moderator"
) {
  const res = await api.post(`/connect/page/${pageId}/roles`, { userId, role });
  return unwrap(res);
}

export async function revokeCommunityRole(pageId: string, userId: string) {
  const res = await api.delete(`/connect/page/${pageId}/roles/${userId}`);
  return unwrap(res);
}

export async function inviteToGroupChat(groupChatId: string, userId: string) {
  const res = await api.post(`/connect/group-chats/${groupChatId}/invite`, { userId });
  return unwrap(res);
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
  return unwrap(res);
}

export async function listGroupJoinRequests(groupChatId: string) {
  const res = await api.get(`/connect/group-chats/${groupChatId}/join-requests`);
  return unwrap<{ requests: any[] }>(res);
}

export async function reviewGroupJoinRequest(requestId: string, action: "accept" | "reject") {
  const res = await api.post(`/connect/group-join-requests/${requestId}/review`, { action });
  return unwrap(res);
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
  return unwrap(res);
}

export async function createEventTeam(
  eventId: string,
  body: { name: string; expectedSize: number; memberIds?: string[] }
) {
  const res = await api.post(`/connect/events/${eventId}/teams`, body);
  return unwrap(res);
}

export async function acceptEventTeamInvite(teamId: string) {
  const res = await api.post(`/connect/event-teams/${teamId}/accept`);
  return unwrap(res);
}

export async function upsertEventCompetition(eventId: string, body: Record<string, unknown>) {
  const res = await api.post(`/connect/events/${eventId}/competition`, body);
  return unwrap(res);
}

export async function submitCompetitionEntry(eventId: string, postId: string) {
  const res = await api.post(`/connect/events/${eventId}/competition/submissions`, { postId });
  return unwrap(res);
}

export async function removeCompetitionSubmission(
  eventId: string,
  submissionId: string,
  reason?: string
) {
  const res = await api.delete(`/connect/events/${eventId}/competition/submissions/${submissionId}`, {
    data: { reason },
  });
  return unwrap(res);
}

export async function getCompetitionLeaderboard(eventId: string) {
  const res = await api.get(`/connect/events/${eventId}/competition/leaderboard`);
  return unwrap<{
    competition: any;
    leaderboard: any[];
    rankBy: "likes" | "views";
    frozen: boolean;
  }>(res);
}

import { api } from "./axios";
import type { Post } from "../types/post";
import type { User } from "../types/user";
import type { Chat, ChatMessage } from "../types/chat";
import type { Notification } from "../types/notification";
import type { PaginationCursor, PaginationOffset } from "../types/api";

export async function authMe(): Promise<{ user: User }> {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function authSignIn(input: { email: string; password: string }) {
  const res = await api.post("/auth/signin", input);
  return res.data as { success?: boolean; message?: string; user?: User; token?: string };
}

export async function checkUsernameAvailability(username: string): Promise<{ available?: boolean; error?: string }> {
  try {
    const res = await api.get("/auth/check-username", { params: { username } });
    const data = res.data as { available?: boolean; success?: boolean; error?: string };
    if (data && typeof data.available === "boolean") return { available: data.available };
    if (data && data.success === false) return { available: false, error: data.error || "Username check failed" };
    return { available: false, error: "Unable to determine username availability" };
  } catch (err: unknown) {
    const ax = err as { response?: { status: number; data?: { error?: string; message?: string } } };
    if (ax.response?.status === 400) {
      return { available: false, error: ax.response.data?.error || "Invalid username format" };
    }
    if (ax.response?.data && typeof (ax.response.data as { available?: boolean }).available === "boolean") {
      return { available: (ax.response.data as { available: boolean }).available };
    }
    return { error: (ax.response?.data as { error?: string })?.error || "Unable to check username" };
  }
}

export async function authSignUp(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  termsAccepted?: boolean;
}) {
  const res = await api.post("/auth/signup", { ...input, termsAccepted: input.termsAccepted ?? true });
  return res.data as { success?: boolean; message?: string };
}

export async function authVerifyOtp(input: { email: string; otp: string }) {
  const res = await api.post("/auth/verify-otp", input);
  return res.data as { success?: boolean; message?: string; user?: User; token?: string };
}

export async function authResendOtp(input: { email: string }) {
  const res = await api.post("/auth/resend-otp", input);
  return res.data;
}

export async function authForgotPassword(input: { email: string }) {
  const res = await api.post("/auth/forgot-password", input);
  return res.data;
}

export async function authResetPassword(input: { email: string; token: string; newPassword: string }) {
  const res = await api.post("/auth/reset-password", input);
  return res.data;
}

export async function authLogout() {
  const res = await api.post("/auth/logout");
  return res.data;
}

export type FeedMode = "recents" | "friends" | "popular";

export async function getFeed(params?: {
  limit?: number;
  cursor?: string;
  useCursor?: boolean;
  page?: number;
  feed?: FeedMode;
}) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.useCursor) search.set("useCursor", "true");
  if (params?.page) search.set("page", String(params.page));
  if (params?.feed && ["recents", "friends", "popular"].includes(params.feed)) {
    search.set("feed", params.feed);
  }

  const res = await api.get(`/posts?${search.toString()}`);
  return res.data as {
    posts: Post[];
    pagination: PaginationOffset | PaginationCursor;
  };
}

function isValidPostId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
}

export async function getPostById(id: string) {
  if (!isValidPostId(id)) {
    throw new Error("Invalid post ID");
  }
  const res = await api.get(`/posts/${id}`);
  const data = res.data as { post?: Post };
  return (data.post ?? res.data) as Post;
}

export async function toggleLike(postId: string) {
  const res = await api.post(`/posts/${postId}/like`);
  return res.data as { isLiked: boolean; likesCount: number; message?: string };
}

export async function addComment(postId: string, text: string) {
  const res = await api.post(`/posts/${postId}/comments`, { text });
  return res.data;
}

export async function deletePost(postId: string) {
  const res = await api.delete(`/posts/${postId}`);
  return res.data as { message?: string };
}

export async function archivePost(postId: string) {
  const res = await api.patch(`/posts/${postId}/archive`);
  return res.data as { message?: string; post?: Post };
}

export async function hidePost(postId: string) {
  const res = await api.patch(`/posts/${postId}/hide`);
  return res.data as { message?: string };
}

export type ReportReason =
  | "spam"
  | "abuse"
  | "inappropriate_content"
  | "harassment"
  | "other";

export async function createReport(params: {
  type: ReportReason;
  reportedUserId: string;
  postId?: string;
  reason: string;
}) {
  const res = await api.post("/reports", params);
  return res.data as { reportId?: string; message?: string };
}

export async function getProfile(id: string) {
  const res = await api.get(`/profile/${id}`);
  return res.data as { profile: User };
}

export type ProfileListUser = User & { isFollowing?: boolean };

export async function getProfileFollowers(
  userId: string,
  page = 1,
  limit = 20
) {
  const res = await api.get(`/profile/${userId}/followers`, { params: { page, limit } });
  return res.data as {
    users: ProfileListUser[];
    pagination?: { currentPage: number; totalPages: number; totalUsers: number; hasNextPage: boolean; limit: number };
  };
}

export async function getProfileFollowing(
  userId: string,
  page = 1,
  limit = 20
) {
  const res = await api.get(`/profile/${userId}/following`, { params: { page, limit } });
  return res.data as {
    users: ProfileListUser[];
    pagination?: { currentPage: number; totalPages: number; totalUsers: number; hasNextPage: boolean; limit: number };
  };
}

export async function followProfile(userId: string) {
  const res = await api.post(`/profile/${userId}/follow`);
  return res.data as { isFollowing?: boolean; followRequestSent?: boolean; message?: string };
}

export async function getBlockStatus(userId: string) {
  const res = await api.get(`/profile/${userId}/block-status`);
  return res.data as { blocked: boolean };
}

export async function blockUser(userId: string) {
  const res = await api.post(`/profile/${userId}/block`);
  return res.data as { blocked: boolean; message?: string };
}

export async function getFollowRequests() {
  const res = await api.get("/profile/follow-requests");
  return res.data as { followRequests: import("../types/user").FollowRequest[] };
}

export async function approveFollowRequest(requestId: string) {
  const res = await api.post(`/profile/follow-requests/${requestId}/approve`);
  return res.data as { message?: string; followersCount?: number; alreadyProcessed?: boolean };
}

export async function rejectFollowRequest(requestId: string) {
  const res = await api.post(`/profile/follow-requests/${requestId}/reject`);
  return res.data as { message?: string };
}

export async function updateProfile(userId: string, form: FormData) {
  const res = await api.put(`/profile/${userId}`, form, {
    headers: { "Content-Type": undefined } as unknown as Record<string, string>,
  });
  return res.data as { profile?: User; message?: string };
}

export async function getUserPosts(userId: string, page = 1, limit = 20) {
  const res = await api.get(`/posts/user/${userId}?page=${page}&limit=${limit}`);
  return res.data as { posts: Post[]; pagination?: PaginationOffset };
}

export async function searchUsers(q: string, limit = 20) {
  const res = await api.get(`/profile/search?query=${encodeURIComponent(q)}&limit=${limit}`);
  return res.data as { users: User[] };
}

export async function getSuggestedUsers(limit = 50) {
  const res = await api.get("/profile/suggested-users", { params: { limit } });
  return res.data as { users: User[] };
}

/** Returns a taatom.com (or configured) short link such as https://taatom.com/s/xxxxx */
export async function createPostShortUrl(postId: string): Promise<string | null> {
  try {
    const res = await api.post("/short-url/create", { postId });
    const body = res.data as { data?: { shortUrl?: string } };
    const url = body.data?.shortUrl;
    return typeof url === "string" && url.length > 0 ? url : null;
  } catch {
    return null;
  }
}

export async function createPost(form: FormData, onUploadProgress?: (pct: number) => void) {
  const res = await api.post("/posts", form, {
    headers: { "Content-Type": undefined } as unknown as Record<string, string>,
    onUploadProgress: (e) => {
      if (!onUploadProgress) return;
      if (!e.total) return;
      onUploadProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data as { message?: string; post?: Post };
}

export async function createShort(form: FormData, onUploadProgress?: (pct: number) => void) {
  const res = await api.post("/shorts", form, {
    headers: { "Content-Type": undefined } as unknown as Record<string, string>,
    timeout: 120_000,
    onUploadProgress: (e) => {
      if (!onUploadProgress) return;
      if (!e.total) return;
      onUploadProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data as { message?: string; short?: Post };
}

export async function searchPosts(q: string, page = 1, limit = 20) {
  const res = await api.get(`/search/posts?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
  return res.data as { posts: Post[]; pagination?: PaginationOffset };
}

// Hashtags (parity with mobile services/hashtags)
export type HashtagInfo = {
  name: string;
  postCount: number;
  lastUsedAt?: string;
};

export async function searchHashtags(q: string, limit = 20): Promise<HashtagInfo[]> {
  const res = await api.get("/hashtags/search", { params: { q, limit } });
  const data = res.data as { hashtags?: HashtagInfo[] };
  return data.hashtags ?? [];
}

export async function getTrendingHashtags(
  limit = 20,
  timeRange: "1h" | "24h" | "7d" | "30d" = "24h"
): Promise<HashtagInfo[]> {
  const res = await api.get("/hashtags/trending", { params: { limit, timeRange } });
  const data = res.data as { hashtags?: HashtagInfo[] };
  return data.hashtags ?? [];
}

export async function getHashtagDetails(name: string): Promise<HashtagInfo> {
  const slug = name.replace(/^#/, "").toLowerCase();
  const res = await api.get(`/hashtags/${encodeURIComponent(slug)}`);
  const data = res.data as { hashtag: HashtagInfo };
  return data.hashtag;
}

export type HashtagPostsPayload = {
  hashtag: HashtagInfo;
  posts: Post[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalPosts: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    limit: number;
  };
};

export async function getHashtagPosts(hashtag: string, page = 1, limit = 20): Promise<HashtagPostsPayload> {
  const slug = hashtag.replace(/^#/, "").toLowerCase();
  const res = await api.get(`/hashtags/${encodeURIComponent(slug)}/posts`, {
    params: { page, limit },
  });
  return res.data as HashtagPostsPayload;
}

export async function getUserShorts(userId: string, page = 1, limit = 20) {
  const res = await api.get(`/shorts/user/${userId}`, { params: { page, limit } });
  const data = res.data as { shorts?: Post[]; totalShorts?: number };
  return {
    shorts: data.shorts ?? [],
    totalShorts: typeof data.totalShorts === "number" ? data.totalShorts : 0,
  };
}

// Locale type (places) - aligned with app/backend
export type Locale = {
  _id: string;
  name: string;
  countryCode: string;
  stateProvince?: string;
  stateCode?: string;
  city?: string;
  imageUrl?: string;
  /** Gallery signed URLs (same order as SuperAdmin upload). */
  imageUrls?: string[];
  description?: string;
  spotTypes?: string[];
  latitude?: number;
  longitude?: number;
};

// Locales (places) - params aligned with app/backend: search, countryCode, stateCode, spotTypes, page, limit
export async function getLocales(params?: { search?: string; countryCode?: string; stateCode?: string; spotTypes?: string[]; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.search) search.set("search", params.search);
  if (params?.countryCode) search.set("countryCode", params.countryCode);
  if (params?.stateCode) search.set("stateCode", params.stateCode);
  if (params?.spotTypes?.length) search.set("spotTypes", params.spotTypes.join(","));
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const res = await api.get(`/locales?${search.toString()}`);
  return res.data as { locales: Locale[]; pagination?: { total: number; totalPages: number } };
}

export async function getLocaleCountries() {
  const res = await api.get("/locales/countries");
  const data = res.data as { countries?: Array<{ code: string; name?: string; localeCount?: number }> };
  return { countries: data?.countries ?? [] };
}

export async function getLocaleStates(countryCode: string) {
  const res = await api.get("/locales/states", { params: { countryCode } });
  const data = res.data as { states?: Array<{ stateCode: string; stateProvince: string }> };
  return { states: data?.states ?? [] };
}

export async function getLocaleSpotTypes() {
  const res = await api.get("/locales/spot-types");
  const data = res.data as { spotTypes?: string[] };
  return { spotTypes: data?.spotTypes ?? [] };
}

export async function getLocaleById(id: string) {
  const res = await api.get(`/locales/${id}`);
  return res.data as { locale: Locale };
}

// Shorts (short-form videos)
export async function getShorts(params?: { page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit ?? 20));
  const res = await api.get(`/shorts?${search.toString()}`);
  return res.data as { shorts: Post[]; pagination?: PaginationOffset };
}

// Settings
export async function getSettings() {
  const res = await api.get("/settings");
  return res.data as Record<string, unknown>;
}

export async function updateSettings(settings: Record<string, unknown>) {
  const res = await api.put("/settings", { settings });
  return res.data as { settings?: Record<string, unknown> };
}

export async function updateSettingCategory(category: string, data: Record<string, unknown>) {
  const res = await api.put(`/settings/${category}`, data);
  return res.data as Record<string, unknown>;
}

export async function resetSettings() {
  const res = await api.post("/settings/reset");
  return res.data as Record<string, unknown>;
}

// Chat
export async function listChats() {
  const res = await api.get("/chat");
  return res.data as { chats: Chat[] };
}

export async function getChat(otherUserId: string) {
  const res = await api.get(`/chat/${otherUserId}`);
  return res.data as { chat: Chat };
}

export async function getChatMessages(otherUserId: string, page = 1, limit = 50) {
  const res = await api.get(`/chat/${otherUserId}/messages`, { params: { page, limit } });
  return res.data as { messages: ChatMessage[] };
}

export async function sendChatMessage(otherUserId: string, text: string) {
  const res = await api.post(`/chat/${otherUserId}/messages`, { text });
  return res.data as { message: ChatMessage };
}

export async function markChatMessagesSeen(otherUserId: string) {
  const res = await api.post(`/chat/${otherUserId}/mark-all-seen`);
  return res.data as { success?: boolean };
}

export async function clearChat(otherUserId: string) {
  const res = await api.delete(`/chat/${otherUserId}/messages`);
  return res.data as { success?: boolean };
}

export async function toggleChatMute(otherUserId: string) {
  const res = await api.post(`/chat/${otherUserId}/mute`);
  return res.data as { muted: boolean };
}

export async function getChatMuteStatus(otherUserId: string) {
  const res = await api.get(`/chat/${otherUserId}/mute-status`);
  return res.data as { muted: boolean };
}

// Notifications
export async function getNotifications(page = 1, limit = 20) {
  const res = await api.get("/notifications", { params: { page, limit } });
  return res.data as { notifications: Notification[]; unreadCount?: number; pagination?: PaginationOffset };
}

export async function markNotificationAsRead(id: string) {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data as { success?: boolean };
}

export async function markAllNotificationsAsRead() {
  const res = await api.put("/notifications/read-all");
  return res.data as { success?: boolean };
}

export async function getNotificationsUnreadCount() {
  const res = await api.get("/notifications/unread-count");
  return res.data as { unreadCount: number };
}

// Collections
export type Collection = {
  _id: string;
  name: string;
  description?: string;
  user?: User;
  posts?: Post[];
  coverImage?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export async function getCollections(userId?: string) {
  const params = userId ? { userId } : {};
  const res = await api.get("/collections", { params });
  return res.data as { collections: Collection[] };
}

export async function getCollection(id: string) {
  const res = await api.get(`/collections/${id}`);
  return res.data as { collection: Collection };
}

export async function createCollection(data: { name: string; description?: string; isPublic?: boolean }) {
  const res = await api.post("/collections", data);
  return res.data as { collection: Collection };
}

export async function updateCollection(id: string, data: { name?: string; description?: string; isPublic?: boolean }) {
  const res = await api.put(`/collections/${id}`, data);
  return res.data as { collection: Collection };
}

export async function deleteCollection(id: string) {
  const res = await api.delete(`/collections/${id}`);
  return res.data as { success?: boolean };
}

export async function addPostToCollection(collectionId: string, postId: string) {
  const res = await api.post(`/collections/${collectionId}/posts`, { postId });
  return res.data as { collection: Collection };
}

export async function removePostFromCollection(collectionId: string, postId: string) {
  const res = await api.delete(`/collections/${collectionId}/posts/${postId}`);
  return res.data as { collection: Collection };
}

export async function reorderCollectionPosts(collectionId: string, postIds: string[]) {
  const res = await api.put(`/collections/${collectionId}/reorder`, { postIds });
  return res.data as { collection: Collection };
}

// Activity
export async function getActivity(page = 1, limit = 20) {
  const res = await api.get("/activity", { params: { page, limit } });
  return res.data as { activities: Array<{ _id: string; type: string; user?: User; post?: Post; createdAt?: string; [k: string]: unknown }>; pagination?: PaginationOffset };
}

/** Search for a place (Google Places) - for detect place on create post/short */
export type SearchPlaceResult = {
  lat: number;
  lng: number;
  name: string;
  formattedAddress: string;
  city: string;
  country: string;
  countryCode: string;
  stateProvince: string;
  placeId?: string;
  continent?: string;
};
export async function searchPlaceUser(placeName: string): Promise<SearchPlaceResult | null> {
  const res = await api.post<{ success?: boolean; data?: SearchPlaceResult }>("/maps/search-place-user", {
    placeName: placeName.trim(),
  });
  const data = res.data as { success?: boolean; data?: SearchPlaceResult };
  return data?.success && data?.data ? data.data : null;
}

// User management (account activity, sessions, blocked users)
export async function getAccountActivity() {
  const res = await api.get("/users/me/activity");
  return res.data as { activities: import("../types/user").AccountActivity[]; totalCount?: number };
}

export async function getActiveSessions() {
  const res = await api.get("/users/me/sessions");
  return res.data as { sessions: import("../types/user").ActiveSession[]; totalCount?: number };
}

export async function logoutFromSession(sessionId: string) {
  await api.delete(`/users/me/sessions/${sessionId}`);
}

export async function getBlockedUsers() {
  const res = await api.get("/users/me/blocked");
  return res.data as { blockedUsers: import("../types/user").BlockedUser[]; totalCount?: number };
}

export async function unblockUser(userId: string) {
  await api.delete(`/users/me/blocked/${userId}`);
}



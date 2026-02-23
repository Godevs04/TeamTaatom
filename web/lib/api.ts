import { api } from "./axios";
import type { Post } from "../types/post";
import type { User } from "../types/user";
import type { PaginationCursor, PaginationOffset } from "../types/api";

export async function authMe(): Promise<{ user: User }> {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function authSignIn(input: { email: string; password: string }) {
  const res = await api.post("/auth/signin", input);
  return res.data as { success?: boolean; message?: string; user?: User; token?: string };
}

export async function authSignUp(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
}) {
  const res = await api.post("/auth/signup", input);
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

export async function getFeed(params?: { limit?: number; cursor?: string; useCursor?: boolean; page?: number }) {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.useCursor) search.set("useCursor", "true");
  if (params?.page) search.set("page", String(params.page));

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

export async function getProfile(id: string) {
  const res = await api.get(`/profile/${id}`);
  return res.data as { profile: User };
}

export async function getUserPosts(userId: string, page = 1, limit = 20) {
  const res = await api.get(`/posts/user/${userId}?page=${page}&limit=${limit}`);
  return res.data as { posts: Post[]; pagination?: PaginationOffset };
}

export async function searchUsers(q: string, limit = 20) {
  const res = await api.get(`/profile/search?query=${encodeURIComponent(q)}&limit=${limit}`);
  return res.data as { users: User[] };
}

export async function createPost(form: FormData, onUploadProgress?: (pct: number) => void) {
  const res = await api.post("/posts", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (!onUploadProgress) return;
      if (!e.total) return;
      onUploadProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data as { message?: string; post?: Post };
}

export async function searchPosts(q: string, page = 1, limit = 20) {
  const res = await api.get(`/search/posts?query=${encodeURIComponent(q)}&page=${page}&limit=${limit}`);
  return res.data as { posts: Post[]; pagination?: PaginationOffset };
}

// Locales (places)
export async function getLocales(params?: { search?: string; countryCode?: string; stateCode?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.search) search.set("search", params.search);
  if (params?.countryCode) search.set("countryCode", params.countryCode);
  if (params?.stateCode) search.set("stateCode", params.stateCode);
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  const res = await api.get(`/locales?${search.toString()}`);
  return res.data as { locales: Array<{ _id: string; name: string; countryCode: string; stateProvince?: string; stateCode?: string; imageUrl?: string }>; pagination?: { total: number; totalPages: number } };
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



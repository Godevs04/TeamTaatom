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

export async function getPostById(id: string) {
  const res = await api.get(`/posts/${id}`);
  return res.data as Post;
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



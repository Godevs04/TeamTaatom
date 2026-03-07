import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { STORAGE_KEYS } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

/** Liked post IDs persisted for feed (survives refresh). */
export function getLikedPostIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.likedPostIds);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function setLikedPostIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.likedPostIds, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

/** Merge persisted liked IDs into posts so UI shows correct heart and count. */
export function mergeLikedIntoPosts<T extends { _id: string; isLiked?: boolean; likesCount?: number }>(
  posts: T[],
  likedIds: string[]
): T[] {
  const set = new Set(likedIds);
  return posts.map((p) => {
    const isLiked = p.isLiked ?? set.has(p._id);
    return { ...p, isLiked };
  });
}


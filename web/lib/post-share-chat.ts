import type { Post } from "../types/post";

/** Payload format from mobile ShareModal (must stay in sync with frontend/components/ShareModal.tsx). */
export const POST_SHARE_PREFIX = "[POST_SHARE]" as const;

export type ParsedPostShare = {
  postId: string;
  imageUrl: string;
  shareUrl: string;
  caption: string;
  authorName: string;
};

/**
 * Parse chat text like: [POST_SHARE]postId|imageUrl|shareUrl|caption|authorName
 * Pipes in caption can truncate fields; mobile uses the same split rules.
 */
export function parsePostShareMessage(text: string): ParsedPostShare | null {
  if (!text || !text.startsWith(POST_SHARE_PREFIX)) return null;
  try {
    const data = text.slice(POST_SHARE_PREFIX.length);
    const parts = data.split("|");
    if (parts.length < 3) return null;
    return {
      postId: (parts[0] || "").trim(),
      imageUrl: (parts[1] || "").trim(),
      shareUrl: (parts[2] || "").trim(),
      caption: (parts[3] || "").trim(),
      authorName: (parts[4] || "").trim(),
    };
  } catch {
    return null;
  }
}

/** Clean hostname for UI (e.g. taatom.com). */
export function getWebBrandingHost(): string {
  const raw =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_WEB_URL
      ? process.env.NEXT_PUBLIC_WEB_URL
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  try {
    if (!raw) return "taatom.com";
    const h = new URL(raw).hostname;
    if (h === "localhost" || h.startsWith("127.")) return "taatom.com";
    return h.replace(/^www\./i, "");
  } catch {
    return "taatom.com";
  }
}

/** One-line preview for chat inbox (avoids raw [POST_SHARE]… URLs). */
/** Full trip URL for the current web origin (used before short URL resolves). */
export function getDefaultTripShareUrl(postId: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WEB_URL) || "";
  const base = origin.replace(/\/$/, "");
  return base ? `${base}/trip/${postId}` : `/trip/${postId}`;
}

/**
 * Build the same chat payload the mobile app sends (frontend/components/ShareModal.tsx).
 * `shareUrl` should be the public link (short URL preferred, else trip URL).
 */
export function buildPostShareChatMessage(
  post: Pick<Post, "_id" | "caption" | "imageUrl" | "images" | "mediaUrl" | "videoUrl" | "thumbnailUrl" | "user">,
  shareUrl: string
): string {
  let imageUrl = post.imageUrl?.trim() || "";
  if (!imageUrl && post.images?.length) imageUrl = (post.images[0] || "").trim();
  if (!imageUrl && post.mediaUrl) imageUrl = post.mediaUrl.trim();
  if (!imageUrl && post.videoUrl) imageUrl = post.videoUrl.trim();
  if (!imageUrl && post.thumbnailUrl) imageUrl = post.thumbnailUrl.trim();
  const postData = [
    post._id,
    imageUrl,
    shareUrl,
    post.caption || "",
    post.user?.fullName || "",
  ].join("|");
  return `${POST_SHARE_PREFIX}${postData}`;
}

export function formatChatMessagePreview(text: string): string {
  const trimmed = (text ?? "").trim();
  const shared = parsePostShareMessage(trimmed);
  if (shared) {
    if (shared.caption) {
      const cap = shared.caption.length > 72 ? `${shared.caption.slice(0, 72)}…` : shared.caption;
      return `Shared a post: ${cap}`;
    }
    return "Shared a post";
  }
  return trimmed;
}

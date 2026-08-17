import type { Post } from "../types/post";
import type { Journey } from "../types/journey";

/** Payload format from mobile ShareModal (must stay in sync with frontend/components/ShareModal.tsx). */
export const POST_SHARE_PREFIX = "[POST_SHARE]" as const;

/** Payload format from mobile ShareModal (must stay in sync with frontend/components/ShareModal.tsx). */
export const JOURNEY_SHARE_PREFIX = "[JOURNEY_SHARE]" as const;

export type ParsedPostShare = {
  postId: string;
  imageUrl: string;
  shareUrl: string;
  caption: string;
  authorName: string;
};

export type ParsedJourneyShare = {
  journeyId: string;
  shareUrl: string;
  title: string;
  distance: string;
  status: string;
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

/**
 * Parse chat text like: [JOURNEY_SHARE]journeyId|shareUrl|title|distance|status
 * Mirrors mobile's frontend/app/chat/thread.tsx's parseJourneyShare exactly,
 * including its `>= 3` part threshold and per-field fallbacks.
 */
export function parseJourneyShareMessage(text: string): ParsedJourneyShare | null {
  if (!text || !text.startsWith(JOURNEY_SHARE_PREFIX)) return null;
  try {
    const data = text.slice(JOURNEY_SHARE_PREFIX.length);
    const parts = data.split("|");
    if (parts.length < 3) return null;
    return {
      journeyId: (parts[0] || "").trim(),
      shareUrl: (parts[1] || "").trim(),
      title: (parts[2] || "Journey").trim() || "Journey",
      distance: (parts[3] || "").trim(),
      status: (parts[4] || "completed").trim() || "completed",
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
 * Full journey URL for the current web origin (used before the short URL
 * resolves, or if it fails). Points at /journeys/:id directly rather than
 * /journey/:id — middleware.ts already redirects the singular path to this
 * one, so linking straight here skips that hop, matching how the post
 * version above points at /trip/:id rather than /post/:id.
 */
export function getDefaultJourneyShareUrl(journeyId: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (typeof process !== "undefined" && process.env.NEXT_PUBLIC_WEB_URL) || "";
  const base = origin.replace(/\/$/, "");
  return base ? `${base}/journeys/${journeyId}` : `/journeys/${journeyId}`;
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

/**
 * Build the same chat payload the mobile app sends (frontend/components/ShareModal.tsx).
 * `shareUrl` should be the public link (short URL preferred, else journey URL).
 */
export function buildJourneyShareChatMessage(
  journey: Pick<Journey, "_id" | "title" | "distanceTraveled" | "status">,
  shareUrl: string
): string {
  const distanceTraveled = journey.distanceTraveled;
  const distance = distanceTraveled
    ? distanceTraveled >= 1000
      ? `${(distanceTraveled / 1000).toFixed(1)} km`
      : `${Math.round(distanceTraveled)} m`
    : "";
  const journeyData = [
    journey._id,
    shareUrl,
    journey.title || "Journey",
    distance,
    journey.status || "completed",
  ].join("|");
  return `${JOURNEY_SHARE_PREFIX}${journeyData}`;
}

export function formatChatMessagePreview(text: string): string {
  const trimmed = (text ?? "").trim();
  const sharedPost = parsePostShareMessage(trimmed);
  if (sharedPost) {
    if (sharedPost.caption) {
      const cap = sharedPost.caption.length > 72 ? `${sharedPost.caption.slice(0, 72)}…` : sharedPost.caption;
      return `Shared a post: ${cap}`;
    }
    return "Shared a post";
  }
  const sharedJourney = parseJourneyShareMessage(trimmed);
  if (sharedJourney) {
    return `Shared a journey: ${sharedJourney.title}`;
  }
  return trimmed;
}

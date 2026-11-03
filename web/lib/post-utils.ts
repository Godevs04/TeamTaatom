import type { Post } from "../types/post";

/**
 * Returns the best display string for a post's location.
 * Backend stores address in location.address and/or detectedPlace; some responses may also have top-level address.
 */
export function getPostDisplayLocation(post: Post | null | undefined): string {
  if (!post) return "Unknown location";
  const loc = post.location;
  const dp = post.detectedPlace;
  if (loc?.address && loc.address.trim() && loc.address !== "Unknown Location") {
    return loc.address.trim();
  }
  if (dp?.name?.trim()) return dp.name.trim();
  if (dp?.formattedAddress?.trim()) return dp.formattedAddress.trim();
  if (post.address?.trim()) return post.address.trim();
  return "Unknown location";
}

/**
 * Rewrites an absolute backend API URL (e.g. the HLS playlist proxy
 * `https://<backend>/api/v1/shorts?hls=master...`) to a same-origin path so the
 * browser goes through the Next.js `/api/v1/*` rewrite. Fetching the backend
 * host directly from the page fails on CORS / mixed content. Anything that is
 * not under `/api/v1/` (signed storage URLs, CDNs) is returned unchanged.
 */
export function toSameOriginApiUrl(raw: string): string {
  if (!raw || !/^https?:\/\//i.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.startsWith("/api/v1/")) return `${parsed.pathname}${parsed.search}`;
  } catch {
    // not a parseable URL — leave as-is
  }
  return raw;
}

/** Playable video URL for a short / long video, routed through the web proxy when it points at our API. */
export function getPlayableVideoUrl(post: Pick<Post, "mediaUrl" | "videoUrl"> | null | undefined): string {
  const raw = post?.mediaUrl || post?.videoUrl || "";
  return typeof raw === "string" ? toSameOriginApiUrl(raw) : "";
}

/**
 * Returns latitude/longitude for a post (for map display).
 * Prefers location.coordinates, then detectedPlace, then top-level latitude/longitude.
 */
export function getPostCoordinates(post: Post | null | undefined): { lat: number; lng: number } | null {
  if (!post) return null;
  const coords = post.location?.coordinates;
  const lat = coords?.latitude ?? post.detectedPlace?.latitude ?? post.latitude;
  const lng = coords?.longitude ?? post.detectedPlace?.longitude ?? post.longitude;
  if (typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }
  return null;
}

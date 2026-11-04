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

/**
 * Browser-playable video URL: same-origin API proxy, and for the HLS playlist
 * proxy also `seg=proxy` so the backend lists segments as same-origin proxy
 * URLs. Without it segments are signed storage-bucket URLs, which hls.js
 * (Chrome/Firefox/Edge) can't fetch cross-origin unless the bucket has CORS.
 */
export function toWebVideoUrl(raw: string): string {
  const url = toSameOriginApiUrl(raw);
  if (!/[?&]hls=master\b/.test(url) || /[?&]seg=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}seg=proxy`;
}

/** Playable video URL for a short / long video (see toWebVideoUrl). */
export function getPlayableVideoUrl(post: Pick<Post, "mediaUrl" | "videoUrl"> | null | undefined): string {
  const raw = post?.mediaUrl || post?.videoUrl || "";
  return typeof raw === "string" ? toWebVideoUrl(raw) : "";
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

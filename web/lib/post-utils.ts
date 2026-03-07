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

export const APP_NAME = "Taatom";

// Backend origin (absolute) for server-side fetches
export const BACKEND_ORIGIN =
  process.env.BACKEND_ORIGIN ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:3000";

// Preferred: client talks to Next.js proxy (same-origin cookies), Next rewrites to backend
export const API_V1_PROXY = "/api/v1";
export const API_V1_ABS = `${BACKEND_ORIGIN.replace(/\/$/, "")}/api/v1`;

/** Google Maps API key from env (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Use for map embeds, geocode, etc. */
export function getGoogleMapsApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return key && String(key).trim() ? String(key).trim() : undefined;
}

export const STORAGE_KEYS = {
  webFallbackToken: "taatom_web_token", // only used if backend returns token for cross-origin dev fallback
  likedPostIds: "taatom_posts_liked_ids",
  savedPostIds: "taatom_posts_saved_ids",
  savedLocaleIds: "taatom_saved_locales", // JSON array of full locale objects (mirrors app savedLocales)
} as const;


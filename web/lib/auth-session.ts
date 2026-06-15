import { STORAGE_KEYS } from "./constants";

const DEV_AUTH_COOKIE = "devAuth=1; path=/; max-age=86400; samesite=lax";
const CLEAR_DEV_AUTH_COOKIE = "devAuth=; path=/; max-age=0; samesite=lax";

/** Persist web auth session (dev bearer fallback + middleware hint cookie). */
export function applyWebAuthSession(token?: string | null): void {
  if (typeof window === "undefined") return;

  if (token) {
    sessionStorage.setItem(STORAGE_KEYS.webFallbackToken, token);
    document.cookie = DEV_AUTH_COOKIE;
  } else if (sessionStorage.getItem(STORAGE_KEYS.webFallbackToken)) {
    // Cookie-only session (httpOnly authToken set by backend) — still hint middleware in dev.
    document.cookie = DEV_AUTH_COOKIE;
  }
}

/** Clear client-side web auth session state. httpOnly cookies are cleared by POST /auth/logout. */
export function clearWebAuthSession(): void {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(STORAGE_KEYS.webFallbackToken);
  document.cookie = CLEAR_DEV_AUTH_COOKIE;
}

export function hasWebAuthSession(): boolean {
  if (typeof window === "undefined") return false;
  return !!sessionStorage.getItem(STORAGE_KEYS.webFallbackToken);
}

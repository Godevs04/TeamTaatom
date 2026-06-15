import { PROFILE_ONBOARDING_VERSION } from "./profile-onboarding-version";
import type { User } from "../types/user";

function isSafeNextPath(next: string | null | undefined): next is string {
  return Boolean(next && next.startsWith("/") && !next.startsWith("//"));
}

/** Post sign-in destination — mirrors mobile sign-in routing. */
export function getPostSignInPath(user: User | null | undefined, nextUrl?: string | null): string {
  if (isSafeNextPath(nextUrl)) return nextUrl;

  const version = user?.profileOnboardingVersion ?? 0;
  if (version < PROFILE_ONBOARDING_VERSION) return "/onboarding/welcome";

  return "/feed";
}

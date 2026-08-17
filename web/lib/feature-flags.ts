"use client";

import { useQuery } from "@tanstack/react-query";
import { getFeatureFlags, type FeatureFlag } from "./api";

/** Matches mobile's featureFlags.ts CACHE_DURATION. */
const FLAGS_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Fetches the current user's feature flags once per session and keeps them
 * fresh for 5 minutes, mirroring mobile's featureFlagsService — but without
 * porting its hand-rolled Map + AsyncStorage cache. React Query already gives
 * "fetch once, share across every caller" (same query key, one in-flight
 * request) and "stay fresh for N minutes" (staleTime) natively here, so this
 * is deliberately in-memory only: no sessionStorage/localStorage persistence.
 * Nothing on web needs flags available before the first paint the way a cold
 * mobile app launch does, and a short 5-minute cache isn't worth the risk of
 * a stale flag surviving in localStorage across sessions.
 *
 * `enabled` should be the caller's authenticated-user check (e.g. `!!user`
 * from useAuth()) — the endpoint requires auth, and passing it explicitly
 * here (rather than importing useAuth internally) keeps this module usable
 * without pulling in the auth context, and avoids a circular import back
 * into auth-context.tsx, which is what triggers the first fetch.
 */
export function useFeatureFlags(enabled: boolean) {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: getFeatureFlags,
    enabled,
    staleTime: FLAGS_STALE_TIME_MS,
    retry: false,
  });
}

export function isFeatureEnabled(flags: FeatureFlag[] | undefined, name: string): boolean {
  return flags?.find((f) => f.name === name)?.enabled ?? false;
}

export function getFeatureVariant(flags: FeatureFlag[] | undefined, name: string): string | null {
  return flags?.find((f) => f.name === name)?.variant ?? null;
}

export function getFeatureMetadata(
  flags: FeatureFlag[] | undefined,
  name: string
): Record<string, unknown> | null {
  return flags?.find((f) => f.name === name)?.metadata ?? null;
}

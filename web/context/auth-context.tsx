"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authLogout, authMe, authSignIn, getProfile, getGlobalSubscriptionStatus } from "../lib/api";
import { applyWebAuthSession, clearWebAuthSession } from "../lib/auth-session";
import { getLoginLocationHint } from "../lib/login-location";
import type { User } from "../types/user";
import { PROFILE_ONBOARDING_VERSION } from "../lib/profile-onboarding-version";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isPremium: boolean;
  isPremiumLoading: boolean;
  refresh: () => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/auth");

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authMe,
    retry: false,
    enabled: !isAuthPage,
  });

  const authUser = meQuery.data?.user ?? null;
  const needsProfilePicFallback = !!authUser?._id && !authUser?.profilePic;

  const profileFallbackQuery = useQuery({
    queryKey: ["profile", authUser?._id],
    queryFn: () => getProfile(authUser!._id),
    enabled: needsProfilePicFallback,
    staleTime: 5 * 60 * 1000,
  });

  const premiumQuery = useQuery({
    queryKey: ["auth", "premiumStatus"],
    queryFn: getGlobalSubscriptionStatus,
    retry: false,
    enabled: !!authUser,
  });

  const isPremium = premiumQuery.data?.isPremium ?? false;
  const isPremiumLoading = !!authUser && premiumQuery.isLoading;

  const user: User | null = React.useMemo(() => {
    if (!authUser) return null;
    const profilePic =
      authUser.profilePic ??
      profileFallbackQuery.data?.profile?.profilePic ??
      undefined;
    return profilePic ? { ...authUser, profilePic } : authUser;
  }, [authUser, profileFallbackQuery.data?.profile?.profilePic]);

  const refresh = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    await qc.invalidateQueries({ queryKey: ["auth", "premiumStatus"] });
    if (authUser?._id) {
      await qc.invalidateQueries({ queryKey: ["profile", authUser._id] });
    }
    await qc.refetchQueries({ queryKey: ["auth", "me"] });
  }, [qc, authUser?._id]);

  const signIn = React.useCallback(
    async (input: { email: string; password: string }) => {
      const loginLocation = await getLoginLocationHint();
      const res = await authSignIn({ ...input, loginLocation });

      applyWebAuthSession(res?.token ?? null);

      if (res?.user) {
        qc.setQueryData(["auth", "me"], { user: res.user });
      }

      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      const refreshed = await qc.fetchQuery({ queryKey: ["auth", "me"], queryFn: authMe });
      const signedInUser = refreshed?.user ?? res?.user ?? null;

      if (!signedInUser) {
        throw new Error("Sign-in succeeded but user profile is unavailable");
      }

      return signedInUser;
    },
    [qc]
  );

  const signOut = React.useCallback(async () => {
    try {
      await authLogout();
    } catch {
      // Still sign out locally if backend fails (e.g. session already expired, network error)
    } finally {
      clearWebAuthSession();
      qc.removeQueries({ queryKey: ["auth"] });
      qc.removeQueries({ queryKey: ["profile"] });
      router.replace("/auth/login");
    }
  }, [qc, router]);

  const value: AuthState = {
    user,
    isLoading: isAuthPage ? false : (meQuery.isLoading || isPremiumLoading),
    isPremium,
    isPremiumLoading,
    refresh,
    signIn,
    signOut,
  };

  React.useEffect(() => {
    if (isAuthPage || meQuery.isLoading || isPremiumLoading || !user) return;
    if (pathname?.startsWith("/onboarding")) return;
    if ((user.profileOnboardingVersion ?? 0) >= PROFILE_ONBOARDING_VERSION) return;
    router.replace("/onboarding/welcome");
  }, [isAuthPage, meQuery.isLoading, isPremiumLoading, user, pathname, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

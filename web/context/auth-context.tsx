"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authLogout, authMe, authSignIn, getProfile, getGlobalSubscriptionStatus } from "../lib/api";
import { applyWebAuthSession, clearWebAuthSession } from "../lib/auth-session";
import { getLoginLocationHint } from "../lib/login-location";
import { useFeatureFlags } from "../lib/feature-flags";
import { connectSocket, disconnectSocket, subscribeSocket, unsubscribeSocket } from "../lib/socket";
import type { User } from "../types/user";
import type { Post } from "../types/post";
import { PROFILE_ONBOARDING_VERSION } from "../lib/profile-onboarding-version";

type NotificationSocketPayload = { userId?: string; notification?: { _id: string } };

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

  // Infrastructure only: primes the feature-flags cache once per session so
  // it's warm by the time anything needs it. Nothing reads flags yet — no
  // gated feature exists on web — so the result is intentionally unused here.
  useFeatureFlags(!!authUser);

  // Connect the chat/presence socket once per authenticated session, and
  // disconnect when the session ends for any reason (explicit sign-out,
  // cookie/session expiry causing authMe to stop returning a user, etc.) —
  // not just the explicit signOut() path below, which additionally
  // disconnects immediately rather than waiting for this effect to react.
  React.useEffect(() => {
    if (authUser) {
      connectSocket();
    } else {
      disconnectSocket();
    }
  }, [authUser]);

  // Bell-badge unread count, shared (by query key, not props) between
  // site-header.tsx and mobile-bottom-nav.tsx. Seeded via
  // getNotificationsUnreadCount by whichever of those mounts first; this
  // effect only owns the live +1 on each `notification` socket event, mirroring
  // mobile's profile.tsx badge (any event means one more unread, no need to
  // read the payload's fields for the count itself). Query key is
  // ["notificationsUnreadCount"], not ["notifications", "unreadCount"] --
  // see notification-badge.tsx for why a shared "notifications" prefix
  // collides with existing fuzzy setQueriesData({queryKey: ["notifications"]})
  // callers elsewhere in the app.
  React.useEffect(() => {
    if (!authUser) return;
    const onNotification = (payload: NotificationSocketPayload) => {
      if (!payload?.notification?._id) return;
      qc.setQueryData<{ unreadCount: number }>(["notificationsUnreadCount"], (old) => ({
        unreadCount: (old?.unreadCount ?? 0) + 1,
      }));
    };

    const onPostStatsUpdated = (data: { postId?: string; likesCount?: number; commentsCount?: number }) => {
      if (!data?.postId) return;
      const { postId, likesCount, commentsCount } = data;

      // 1. Update single post query if active
      qc.setQueryData<{ post?: Post } | Post>(["post", postId], (old) => {
        if (!old) return old;
        if ("post" in old && old.post) {
          return {
            ...old,
            post: {
              ...old.post,
              ...(typeof likesCount === "number" ? { likesCount } : {}),
              ...(typeof commentsCount === "number" ? { commentsCount } : {}),
            },
          };
        }
        return {
          ...old,
          ...(typeof likesCount === "number" ? { likesCount } : {}),
          ...(typeof commentsCount === "number" ? { commentsCount } : {}),
        } as Post;
      });

      // 2. Update infinite feed queries
      qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: Array.isArray(page?.posts)
              ? page.posts.map((p: Post) =>
                  p._id === postId
                    ? {
                        ...p,
                        ...(typeof likesCount === "number" ? { likesCount } : {}),
                        ...(typeof commentsCount === "number" ? { commentsCount } : {}),
                      }
                    : p
                )
              : page.posts,
          })),
        };
      });

      // 3. Update hashtag queries
      qc.setQueriesData({ queryKey: ["hashtag-posts"] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            posts: Array.isArray(page?.posts)
              ? page.posts.map((p: Post) =>
                  p._id === postId
                    ? {
                        ...p,
                        ...(typeof likesCount === "number" ? { likesCount } : {}),
                        ...(typeof commentsCount === "number" ? { commentsCount } : {}),
                      }
                    : p
                )
              : page.posts,
          })),
        };
      });

      // 4. Invalidate likers list
      qc.invalidateQueries({ queryKey: ["post-likers", postId] });
    };

    subscribeSocket<NotificationSocketPayload>("notification", onNotification);
    subscribeSocket<{ postId?: string; likesCount?: number; commentsCount?: number }>("post:stats_updated", onPostStatsUpdated);

    return () => {
      unsubscribeSocket<NotificationSocketPayload>("notification", onNotification);
      unsubscribeSocket<{ postId?: string; likesCount?: number; commentsCount?: number }>("post:stats_updated", onPostStatsUpdated);
    };
  }, [authUser, qc]);

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
      disconnectSocket();
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

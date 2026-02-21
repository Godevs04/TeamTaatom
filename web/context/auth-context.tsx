"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authLogout, authMe, authSignIn } from "../lib/api";
import type { User } from "../types/user";
import { STORAGE_KEYS } from "../lib/constants";

type AuthState = {
  user: User | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authMe,
    retry: false,
  });

  const refresh = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [qc]);

  const signIn = React.useCallback(
    async (input: { email: string; password: string }) => {
      const res = await authSignIn(input);

      // Cross-origin dev fallback: backend may return { token } instead of cookie
      if (res?.token && typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEYS.webFallbackToken, res.token);
        // Flag for middleware in dev (does not contain the token)
        document.cookie = "devAuth=1; path=/; max-age=86400; samesite=lax";
      }

      await refresh();
    },
    [refresh]
  );

  const signOut = React.useCallback(async () => {
    try {
      await authLogout();
    } finally {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEYS.webFallbackToken);
        document.cookie = "devAuth=; path=/; max-age=0; samesite=lax";
      }
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
    }
  }, [qc]);

  const value: AuthState = {
    user: meQuery.data?.user ?? null,
    isLoading: meQuery.isLoading,
    refresh,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


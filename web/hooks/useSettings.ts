"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettingCategory } from "../lib/api";

type Settings = {
  privacy?: {
    profileVisibility?: "public" | "followers" | "private";
    showEmail?: boolean;
    showLocation?: boolean;
    allowMessages?: "everyone" | "followers" | "none";
    requireFollowApproval?: boolean;
    allowFollowRequests?: boolean;
  };
  notifications?: {
    pushNotifications?: boolean;
    emailNotifications?: boolean;
    likesNotifications?: boolean;
    commentsNotifications?: boolean;
    followsNotifications?: boolean;
    messagesNotifications?: boolean;
  };
  account?: {
    language?: string;
    theme?: "light" | "dark" | "auto";
    dataUsage?: "low" | "medium" | "high";
  };
};

const SETTINGS_QUERY_KEY = ["settings"];

export function useSettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const res = await getSettings();
      return (res as { settings?: Settings }).settings ?? {};
    },
  });
  const updateCategory = useMutation({
    mutationFn: ({ category, data }: { category: "privacy" | "notifications" | "account"; data: Record<string, unknown> }) =>
      updateSettingCategory(category, data),
    onSuccess: (_, { category }) => {
      qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  });
  return {
    settings: query.data as Settings | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    updateCategory: (category: "privacy" | "notifications" | "account", data: Record<string, unknown>) =>
      updateCategory.mutateAsync({ category, data }),
    isUpdating: updateCategory.isPending,
  };
}

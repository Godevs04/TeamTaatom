"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSettings } from "../../../../hooks/useSettings";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";

export default function PrivacySettingsPage() {
  const { settings, isLoading, updateCategory, isUpdating } = useSettings();
  const updatingRef = useRef<Set<string>>(new Set());

  const handleUpdate = useCallback(
    async (key: string, value: unknown) => {
      if (updatingRef.current.has(key)) return;
      updatingRef.current.add(key);
      try {
        await updateCategory("privacy", { [key]: value });
        toast.success("Setting updated");
      } catch {
        toast.error("Failed to update setting");
      } finally {
        updatingRef.current.delete(key);
      }
    },
    [updateCategory]
  );

  const privacy = settings?.privacy ?? {};
  const profileVisibility = (privacy.profileVisibility as "public" | "followers" | "private") ?? "public";
  const showEmail = privacy.showEmail ?? false;
  const showLocation = privacy.showLocation ?? true;
  const allowMessages = (privacy.allowMessages as "everyone" | "followers" | "none") ?? "everyone";
  const requireFollowApproval = privacy.requireFollowApproval ?? false;
  const allowFollowRequests = privacy.allowFollowRequests ?? true;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Privacy & Security</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Control who can see your profile and message you.</p>

        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Profile visibility</label>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Who can see your profile.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["public", "followers", "private"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleUpdate("profileVisibility", v)}
                  disabled={isUpdating}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    profileVisibility === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/50">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Show email</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Allow others to see your email.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showEmail}
              onClick={() => handleUpdate("showEmail", !showEmail)}
              disabled={isUpdating}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                showEmail ? "bg-primary" : "bg-slate-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  showEmail ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/50">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Show location</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Show location on posts and profile.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showLocation}
              onClick={() => handleUpdate("showLocation", !showLocation)}
              disabled={isUpdating}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                showLocation ? "bg-primary" : "bg-slate-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  showLocation ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Who can message you</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["everyone", "followers", "none"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleUpdate("allowMessages", v)}
                  disabled={isUpdating}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    allowMessages === v
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/50">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Require follow approval</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Approve new followers.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requireFollowApproval}
              onClick={() => handleUpdate("requireFollowApproval", !requireFollowApproval)}
              disabled={isUpdating}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                requireFollowApproval ? "bg-primary" : "bg-slate-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  requireFollowApproval ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 dark:border-zinc-700/80 dark:bg-zinc-800/50">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Allow follow requests</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Let others send follow requests.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowFollowRequests}
              onClick={() => handleUpdate("allowFollowRequests", !allowFollowRequests)}
              disabled={isUpdating}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                allowFollowRequests ? "bg-primary" : "bg-slate-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  allowFollowRequests ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

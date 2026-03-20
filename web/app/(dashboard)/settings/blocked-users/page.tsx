"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserX, RefreshCw, User2 } from "lucide-react";
import { getBlockedUsers, unblockUser } from "../../../../lib/api";
import type { BlockedUser } from "../../../../types/user";
import { toast } from "sonner";

export default function BlockedUsersSettingsPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getBlockedUsers();
      setBlockedUsers(res.blockedUsers ?? []);
    } catch {
      toast.error("Failed to load blocked users");
      setBlockedUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleUnblock = async (userId: string, username?: string) => {
    setUnblockingId(userId);
    try {
      await unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
      toast.success(username ? `@${username} has been unblocked` : "User unblocked");
    } catch {
      toast.error("Failed to unblock");
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-6 md:px-8 md:py-7 dark:border-zinc-800/70 dark:from-zinc-800/40">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Blocked users
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Users you’ve blocked. Unblock to allow them to see your profile and contact you again.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="px-5 py-6 md:px-8 md:py-7">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 dark:border-zinc-700">
            <UserX className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">No blocked users</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">When you block someone, they’ll appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {blockedUsers.map((u) => {
              const isActing = unblockingId === u._id;
              return (
                <li
                  key={u._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                      {u.profilePic ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={u.profilePic}
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User2 className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{u.fullName ?? "User"}</p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">@{u.username ?? "—"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(u._id, u.username)}
                    disabled={isActing}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700 disabled:opacity-60"
                  >
                    {isActing ? "…" : "Unblock"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}

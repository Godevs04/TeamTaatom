"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, RefreshCw, User2 } from "lucide-react";
import { approveFollowRequest, getFollowRequests, rejectFollowRequest } from "../../../../lib/api";
import type { FollowRequest as FollowRequestType } from "../../../../types/user";
import { toast } from "sonner";

export default function FollowRequestsSettingsPage() {
  const [followRequests, setFollowRequests] = useState<FollowRequestType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getFollowRequests();
      setFollowRequests(res.followRequests ?? []);
    } catch {
      toast.error("Failed to load follow requests");
      setFollowRequests([]);
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

  const handleApprove = async (requestId: string) => {
    setActingId(requestId);
    try {
      await approveFollowRequest(requestId);
      setFollowRequests((prev) => prev.filter((r) => r._id !== requestId));
      toast.success("Request approved");
    } catch {
      toast.error("Failed to approve");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActingId(requestId);
    try {
      await rejectFollowRequest(requestId);
      setFollowRequests((prev) => prev.filter((r) => r._id !== requestId));
      toast.success("Request declined");
    } catch {
      toast.error("Failed to decline");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
              Follow requests
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Approve or decline people who want to follow you.
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

        {loading ? (
          <div className="mt-6 flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : followRequests.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 dark:border-zinc-700">
            <UserPlus className="h-12 w-12 text-slate-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-400">No pending requests</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">When someone requests to follow you, they’ll appear here.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {followRequests.map((req) => {
              const u = req.user;
              const isActing = actingId === req._id;
              return (
                <li
                  key={req._id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                      {u?.profilePic ? (
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
                      <p className="truncate font-medium text-slate-900 dark:text-white">{u?.fullName ?? "User"}</p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">@{u?.username ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(req._id)}
                      disabled={isActing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-60"
                    >
                      {isActing ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(req._id)}
                      disabled={isActing}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-700 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

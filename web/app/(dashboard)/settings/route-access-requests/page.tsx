"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  GitPullRequest,
  RefreshCw,
  User2,
  X,
} from "lucide-react";
import {
  approveRouteAccess,
  getRouteAccessRequests,
  rejectRouteAccess,
  type RouteAccessRequest,
} from "../../../../lib/api";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Button } from "../../../../components/ui/button";
import { toast } from "sonner";
import { cn } from "../../../../lib/utils";

function formatRelativeDate(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function RouteAccessRequestsPage() {
  const [requests, setRequests] = useState<RouteAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getRouteAccessRequests();
      setRequests(res.requests ?? []);
    } catch {
      toast.error("Failed to load route access requests");
      setRequests([]);
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

  const handleApprove = async (request: RouteAccessRequest) => {
    setActingId(request._id);
    try {
      await approveRouteAccess(request._id);
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
      toast.success(
        `${request.user?.fullName || request.user?.username || "User"} can now view your completed traveling routes!`
      );
    } catch {
      toast.error("Failed to approve request");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (request: RouteAccessRequest) => {
    setActingId(request._id);
    try {
      await rejectRouteAccess(request._id);
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
      toast.success(
        `Route access request from ${request.user?.fullName || request.user?.username || "user"} has been declined`
      );
    } catch {
      toast.error("Failed to decline request");
    } finally {
      setActingId(null);
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
        <div className="border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-6 md:px-8 md:py-7 dark:border-zinc-800/70 dark:from-zinc-800/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Route Access Requests
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Approve or decline requests to view your traveling routes.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="px-5 py-6 md:px-8 md:py-7">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center dark:border-zinc-700">
              <GitPullRequest className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">
                No pending requests
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                When someone requests to view your traveling routes, their request will appear here
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => {
                const busy = actingId === request._id;
                return (
                  <li
                    key={request._id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 sm:flex-nowrap"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                        {request.user?.profilePic ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={request.user.profilePic}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <User2 className="h-6 w-6 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-zinc-100">
                          {request.user?.fullName || "Traveler"}
                        </p>
                        <p className="truncate text-sm text-slate-500 dark:text-zinc-400">
                          @{request.user?.username || "user"}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-zinc-500">
                          {formatRelativeDate(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl text-destructive hover:bg-destructive/10"
                        disabled={busy}
                        onClick={() => handleReject(request)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={busy}
                        onClick={() => handleApprove(request)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
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

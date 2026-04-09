"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getActivity } from "../../../lib/api";
import { useAuth } from "../../../context/auth-context";
import { Button } from "../../../components/ui/button";
import { Activity, User } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";

export default function ActivityPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["activity"],
    queryFn: () => getActivity(1, 30),
    enabled: !!user,
  });

  const activities = data?.activities ?? [];

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">Sign in to view activity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 md:text-3xl">Activity Feed</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">See what your friends are up to.</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-slate-600 dark:text-zinc-400">Failed to load activity.</p>
          <Button className="mt-4 rounded-xl" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
            <Activity className="h-8 w-8 text-slate-400 dark:text-zinc-500" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-zinc-50">No activity yet</h3>
          <p className="mt-2 text-[15px] text-slate-500 dark:text-zinc-400">When people you follow post or like, it will show here.</p>
          <Link href="/search">
            <Button className="mt-6 rounded-xl">Find people to follow</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const actUser = a.user && typeof a.user === "object" ? a.user : null;
            const postId = a.post && typeof a.post === "object" && "_id" in a.post ? (a.post as { _id: string })._id : null;
            const typeLabel = a.type === "post" ? "shared a post" : a.type === "like" ? "liked a post" : "was active";
            return (
              <div
                key={a._id}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                  {actUser && "profilePic" in actUser && (actUser as { profilePic?: string }).profilePic ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={(actUser as { profilePic: string }).profilePic} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-slate-900 dark:text-zinc-50">
                    {actUser && "fullName" in actUser ? (actUser as { fullName?: string }).fullName ?? "Someone" : "Someone"}{" "}
                    {typeLabel}
                  </p>
                  {a.createdAt && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(a.createdAt).toLocaleDateString()}</p>
                  )}
                </div>
                {postId && (
                  <Button variant="outline" size="sm" className="rounded-xl shrink-0" asChild>
                    <Link href={`/trip/${postId}`}>View</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

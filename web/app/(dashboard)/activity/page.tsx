"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getActivity, type ActivityType } from "../../../lib/api";
import { useAuth } from "../../../context/auth-context";
import { Button } from "../../../components/ui/button";
import { Activity, User, ImagePlus, Heart, MessageCircle, UserPlus, Library, Loader2 } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";
import { cn } from "../../../lib/utils";

const FILTERS: { id: ActivityType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "post_created", label: "Posts" },
  { id: "post_liked", label: "Likes" },
  { id: "comment_added", label: "Comments" },
  { id: "user_followed", label: "Follows" },
];

/** Mirrors mobile's getActivityText (frontend/app/activity/index.tsx) --
 * same wording, same fallback for a type the Mongoose enum can't actually
 * produce (post_mention is mobile-only future-proofing, not a real value). */
function getActivityLabel(type: string, targetUserName?: string): string {
  switch (type) {
    case "post_created":
      return "created a new post";
    case "post_liked":
      return "liked a post";
    case "comment_added":
      return "commented on a post";
    case "user_followed":
      return targetUserName ? `followed ${targetUserName}` : "followed someone";
    case "collection_created":
      return "created a collection";
    default:
      return "did something";
  }
}

function ActivityIcon({ type }: { type: string }) {
  const className = "h-6 w-6";
  switch (type) {
    case "post_created":
      return <ImagePlus className={className} />;
    case "post_liked":
      return <Heart className={className} />;
    case "comment_added":
      return <MessageCircle className={className} />;
    case "user_followed":
      return <UserPlus className={className} />;
    case "collection_created":
      return <Library className={className} />;
    default:
      return <Activity className={className} />;
  }
}

export default function ActivityPage() {
  const { user } = useAuth();
  const [filterType, setFilterType] = React.useState<ActivityType | "all">("all");

  const q = useInfiniteQuery({
    queryKey: ["activity", filterType],
    queryFn: ({ pageParam = 1 }) =>
      getActivity(pageParam, 20, filterType === "all" ? undefined : filterType),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      if (!p) return undefined;
      return p.hasNextPage ? p.currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!user,
  });

  const activities = React.useMemo(
    () => q.data?.pages.flatMap((p) => p.activities) ?? [],
    [q.data]
  );

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

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterType(f.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filterType === f.id
                ? "border-primary bg-primary text-on-primary"
                : "border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-slate-600 dark:text-zinc-400">Failed to load activity.</p>
          <Button className="mt-4 rounded-xl" onClick={() => q.refetch()}>Try again</Button>
        </div>
      ) : activities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
            <Activity className="h-8 w-8 text-slate-400 dark:text-zinc-500" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-zinc-50">No activity yet</h3>
          <p className="mt-2 text-[15px] text-slate-500 dark:text-zinc-400">
            {filterType === "all"
              ? "When people you follow post or like, it will show here."
              : "No activity of this type yet."}
          </p>
          {filterType === "all" && (
            <Link href="/search">
              <Button className="mt-6 rounded-xl">Find people to follow</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {activities.map((a) => {
              const actUser = a.user;
              const targetUser = a.targetUser;
              const post = a.post;
              const collection = a.collection;
              const typeLabel = getActivityLabel(a.type, targetUser?.fullName || targetUser?.username);
              const viewHref = post?._id
                ? `/trip/${post._id}`
                : collection?._id
                  ? `/collections/${collection._id}`
                  : targetUser?._id
                    ? `/profile/${targetUser._id}`
                    : null;
              return (
                <div
                  key={a._id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                    {actUser?.profilePic ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={actUser.profilePic} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ActivityIcon type={a.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-slate-900 dark:text-zinc-50">
                      {actUser?.fullName ?? "Someone"} {typeLabel}
                    </p>
                    {a.createdAt && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{new Date(a.createdAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  {viewHref && (
                    <Button variant="outline" size="sm" className="rounded-xl shrink-0" asChild>
                      <Link href={viewHref}>View</Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {q.hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
                className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              >
                {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

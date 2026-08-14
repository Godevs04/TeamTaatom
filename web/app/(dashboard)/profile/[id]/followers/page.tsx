"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  getProfileFollowers,
  getProfileFollowing,
  followProfile,
  type ProfileListUser,
} from "../../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../../lib/auth-errors";
import { Button } from "../../../../../components/ui/button";
import { Card } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { UserPlus, UserMinus, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const LIMIT = 20;

export default function ProfileFollowersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const type = (searchParams.get("type") === "following" ? "following" : "followers") as "followers" | "following";
  const queryClient = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", id],
    queryFn: () => getProfile(id),
    enabled: !!id,
  });
  const profile = profileQ.data?.profile;

  const listQ = useInfiniteQuery({
    queryKey: ["profile", id, type],
    queryFn: ({ pageParam = 1 }) =>
      type === "followers"
        ? getProfileFollowers(id, pageParam, LIMIT)
        : getProfileFollowing(id, pageParam, LIMIT),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      if (!p) return undefined;
      return p.hasNextPage ? p.currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!id,
  });
  // De-duplicate by _id across pages -- defensive against any overlap/race
  // between pages, mirroring mobile's followers.tsx.
  const users = React.useMemo(() => {
    const flat = listQ.data?.pages.flatMap((p) => p.users) ?? [];
    const seen = new Set<string>();
    return flat.filter((u) => {
      if (seen.has(u._id)) return false;
      seen.add(u._id);
      return true;
    });
  }, [listQ.data]);

  const followMutation = useMutation({
    mutationFn: (userId: string) => followProfile(userId),
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      queryClient.invalidateQueries({ queryKey: ["profile", id, type] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const displayName = profile?.fullName || profile?.username || "User";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" asChild>
          <Link href={`/profile/${id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">
            {type === "followers" ? "Followers" : "Following"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{displayName}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={type === "followers" ? "default" : "outline"}
          size="sm"
          className="rounded-xl"
          asChild
        >
          <Link href={`/profile/${id}/followers?type=followers`}>Followers</Link>
        </Button>
        <Button
          variant={type === "following" ? "default" : "outline"}
          size="sm"
          className="rounded-xl"
          asChild
        >
          <Link href={`/profile/${id}/followers?type=following`}>Following</Link>
        </Button>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/80 p-10 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            No {type} yet.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {users.map((u: ProfileListUser) => (
            <li key={u._id}>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
                <Link
                  href={`/profile/${u._id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.profilePic || ""}
                      alt={u.fullName || "User"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-zinc-50">
                      {u.fullName || u.username || "Traveler"}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-zinc-400">@{u.username || "user"}</p>
                  </div>
                </Link>
                {u._id !== id && (
                  <Button
                    variant={u.isFollowing ? "outline" : "default"}
                    size="sm"
                    className="shrink-0 rounded-xl gap-1.5"
                    onClick={() => followMutation.mutate(u._id)}
                    disabled={followMutation.isPending && followMutation.variables === u._id}
                  >
                    {followMutation.isPending && followMutation.variables === u._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : u.isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {listQ.hasNextPage && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => listQ.fetchNextPage()}
            disabled={listQ.isFetchingNextPage}
            className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            {listQ.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            {listQ.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

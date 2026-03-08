"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  const listQ = useQuery({
    queryKey: ["profile", id, type, 1],
    queryFn: () =>
      type === "followers"
        ? getProfileFollowers(id, 1, LIMIT)
        : getProfileFollowing(id, 1, LIMIT),
    enabled: !!id,
  });
  const users = listQ.data?.users ?? [];
  const pagination = listQ.data?.pagination;

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
          <h1 className="text-xl font-semibold text-slate-900">
            {type === "followers" ? "Followers" : "Following"}
          </h1>
          <p className="text-sm text-slate-500">{displayName}</p>
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
        <Card className="rounded-2xl border border-slate-200/80 p-10 text-center shadow-premium">
          <p className="text-sm text-slate-500">
            No {type} yet.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {users.map((u: ProfileListUser) => (
            <li key={u._id}>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-premium">
                <Link
                  href={`/profile/${u._id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.profilePic || ""}
                      alt={u.fullName || "User"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {u.fullName || u.username || "Traveler"}
                    </p>
                    <p className="truncate text-xs text-slate-500">@{u.username || "user"}</p>
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

      {pagination?.hasNextPage && (
        <p className="text-center text-sm text-slate-500">
          More results available; pagination can be added later.
        </p>
      )}
    </div>
  );
}

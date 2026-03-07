"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { followProfile } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import type { User } from "../../types/user";
import { UserPen, Settings, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ProfileActionsProps = {
  profile: User;
};

export function ProfileActions({ profile }: ProfileActionsProps) {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const isSelf = !!me && me._id === profile._id;

  const followMutation = useMutation({
    mutationFn: () => followProfile(profile._id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile", profile._id] });
      if (data?.followRequestSent) {
        toast.success("Follow request sent");
      } else {
        toast.success(data?.isFollowing ? "Following" : "Unfollowed");
      }
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  if (isSelf) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
          <Link href="/settings/account">
            <UserPen className="h-4 w-4" />
            Edit profile
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>
    );
  }

  const isFollowing = profile.isFollowing ?? false;
  const followRequestSent = profile.followRequestSent ?? false;

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        className="rounded-xl gap-2"
        onClick={() => followMutation.mutate()}
        disabled={followMutation.isPending}
      >
        {followMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : followRequestSent ? (
          "Requested"
        ) : isFollowing ? (
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
    </div>
  );
}

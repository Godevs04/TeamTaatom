"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import {
  blockUser,
  createReport,
  followProfile,
  getBlockStatus,
  type ReportReason,
} from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import type { User } from "../../types/user";
import {
  UserPen,
  Settings,
  UserPlus,
  UserMinus,
  Loader2,
  MoreHorizontal,
  Ban,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "inappropriate_content", label: "Inappropriate Content" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
];

type ProfileActionsProps = {
  profile: User;
};

export function ProfileActions({ profile }: ProfileActionsProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user: me } = useAuth();
  const isSelf = !!me && me._id === profile._id;

  const [isFollowing, setIsFollowing] = React.useState(profile.isFollowing ?? false);
  const [followRequestSent, setFollowRequestSent] = React.useState(
    profile.followRequestSent ?? false
  );
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setIsFollowing(profile.isFollowing ?? false);
    setFollowRequestSent(profile.followRequestSent ?? false);
  }, [profile._id, profile.isFollowing, profile.followRequestSent]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const blockQ = useQuery({
    queryKey: ["block-status", profile._id],
    queryFn: () => getBlockStatus(profile._id),
    enabled: !isSelf && !!me,
  });

  const isBlocked = blockQ.data?.isBlocked ?? false;

  const followMutation = useMutation({
    mutationFn: () => followProfile(profile._id),
    onSuccess: (data) => {
      if (data?.followRequestSent !== undefined) {
        setFollowRequestSent(data.followRequestSent);
      }
      if (data?.isFollowing !== undefined) {
        setIsFollowing(data.isFollowing);
      }
      queryClient.invalidateQueries({ queryKey: ["profile", profile._id] });
      router.refresh();
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

  const blockMutation = useMutation({
    mutationFn: () => blockUser(profile._id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["block-status", profile._id] });
      queryClient.invalidateQueries({ queryKey: ["profile", profile._id] });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      toast.success(data.isBlocked ? "User blocked" : "User unblocked");
      setMenuOpen(false);
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const reportMutation = useMutation({
    mutationFn: (reason: ReportReason) =>
      createReport({
        type: reason,
        reportedUserId: profile._id,
        reason: REPORT_REASONS.find((r) => r.id === reason)?.label ?? reason,
      }),
    onSuccess: () => {
      toast.success("User reported. Thank you for helping keep our community safe.");
      setReportOpen(false);
      setMenuOpen(false);
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const handleBlockClick = () => {
    const name = profile.fullName || profile.username || "this user";
    const msg = isBlocked
      ? `Unblock ${name}? You will be able to message and interact again.`
      : `Block ${name}? They won't be able to message you or see your profile.`;
    if (window.confirm(msg)) {
      blockMutation.mutate();
    }
  };

  if (isSelf) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
          <Link href="/settings/account#profile">
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="sm"
        className="rounded-xl gap-2"
        onClick={() => followMutation.mutate()}
        disabled={followMutation.isPending || isBlocked}
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

      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl px-2.5"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={handleBlockClick}
              disabled={blockMutation.isPending}
            >
              <Ban className="h-4 w-4" />
              {isBlocked ? "Unblock user" : "Block user"}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setReportOpen(true);
                setMenuOpen(false);
              }}
            >
              <Flag className="h-4 w-4" />
              Report user
            </button>
          </div>
        )}
      </div>

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReportOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="report-user-title"
          >
            <h3 id="report-user-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Report user
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Why are you reporting {profile.fullName || profile.username}?
            </p>
            <ul className="mt-4 space-y-1">
              {REPORT_REASONS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={reportMutation.isPending}
                    className={cn(
                      "w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      "text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    )}
                    onClick={() => reportMutation.mutate(r.id)}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full rounded-xl"
              onClick={() => setReportOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

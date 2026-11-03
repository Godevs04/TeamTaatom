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
  Ban,
  Flag,
  Loader2,
  LogOut,
  MessageCircle,
  MoreVertical,
  Settings,
  Share2,
  Video,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "../../context/confirm-context";
import { cn } from "../../lib/utils";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "inappropriate_content", label: "Inappropriate Content" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
];

const MENU_ITEM =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-800";

function useIsSelf(profile: User) {
  const { user: me } = useAuth();
  return !!me && me._id === profile._id;
}

/**
 * Follow / Following / Request Sent + Message buttons shown inside the profile
 * card for other users (mirrors mobile app/profile/[id].tsx action row).
 */
export function ProfileFollowButtons({ profile }: { profile: User }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();
  const { user: me } = useAuth();
  const isSelf = useIsSelf(profile);

  const [isFollowing, setIsFollowing] = React.useState(profile.isFollowing ?? false);
  const [followRequestSent, setFollowRequestSent] = React.useState(profile.followRequestSent ?? false);

  React.useEffect(() => {
    setIsFollowing(profile.isFollowing ?? false);
    setFollowRequestSent(profile.followRequestSent ?? false);
  }, [profile._id, profile.isFollowing, profile.followRequestSent]);

  const blockQ = useQuery({
    queryKey: ["block-status", profile._id],
    queryFn: () => getBlockStatus(profile._id),
    enabled: !isSelf && !!me,
  });
  const isBlocked = blockQ.data?.isBlocked ?? false;

  const followMutation = useMutation({
    mutationFn: () => followProfile(profile._id),
    onSuccess: (data) => {
      if (data?.followRequestSent !== undefined) setFollowRequestSent(data.followRequestSent);
      if (data?.isFollowing !== undefined) setIsFollowing(data.isFollowing);
      queryClient.invalidateQueries({ queryKey: ["profile", profile._id] });
      queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      // Follower count and post visibility come from the server-rendered page.
      router.refresh();
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (isSelf || !me) return null;

  const onFollowClick = async () => {
    if (isFollowing) {
      const name = profile.fullName || profile.username || "this user";
      const ok = await confirm({
        title: `Unfollow ${name}?`,
        description: "You will stop seeing their posts in your feed.",
        confirmText: "Unfollow",
        cancelText: "Cancel",
        variant: "destructive",
      });
      if (!ok) return;
    }
    followMutation.mutate();
  };

  const label = followRequestSent ? "Request Sent" : isFollowing ? "Following" : "Follow";

  return (
    <div className="mt-4 flex w-full gap-2.5">
      <button
        type="button"
        onClick={() => void onFollowClick()}
        disabled={followMutation.isPending || isBlocked}
        className={cn(
          "flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold transition-opacity disabled:opacity-60",
          isFollowing
            ? "border border-primary text-primary dark:border-sky-400 dark:text-sky-400"
            : "bg-gradient-to-r from-taatom-ocean to-taatom-emerald text-white hover:opacity-90"
        )}
      >
        {followMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </button>
      {isFollowing ? (
        <Link
          href={`/chat/${profile._id}`}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-taatom-emerald to-taatom-ocean text-sm font-bold text-white hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          Message
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Kebab menu. Own profile: Upload long video, Creator Dashboard, Settings,
 * Copy link, Sign out (mobile profile header menu). Other users: Copy link,
 * Block / Unblock, Report.
 */
export function ProfileMenu({ profile }: { profile: User }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();
  const { user: me, signOut } = useAuth();
  const isSelf = useIsSelf(profile);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const blockQ = useQuery({
    queryKey: ["block-status", profile._id],
    queryFn: () => getBlockStatus(profile._id),
    enabled: !isSelf && !!me,
  });
  const isBlocked = blockQ.data?.isBlocked ?? false;

  const blockMutation = useMutation({
    mutationFn: () => blockUser(profile._id),
    onSuccess: (data) => {
      for (const key of [["block-status", profile._id], ["profile", profile._id], ["posts"], ["feed"], ["chat"], ["journeys"], ["search"]]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(data.isBlocked ? "User blocked" : "User unblocked");
      setMenuOpen(false);
      router.refresh();
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${profile._id}`);
      toast.success("Profile link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    } finally {
      setMenuOpen(false);
    }
  };

  const handleBlockClick = async () => {
    setMenuOpen(false);
    const name = profile.fullName || profile.username || "this user";
    const action = isBlocked ? "Unblock" : "Block";
    const ok = await confirm({
      title: `${action} ${name}?`,
      description: isBlocked
        ? "You will be able to view their profile and interact again."
        : "They will not be able to view your profile, posts, or message you.",
      confirmText: action,
      variant: isBlocked ? "default" : "destructive",
    });
    if (ok) blockMutation.mutate();
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: "Sign out?",
      description: "You will need to sign in again to use Taatom.",
      confirmText: "Sign out",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    await signOut();
    router.replace("/");
  };

  if (!me) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full text-primary dark:text-sky-400"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="More actions"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-5 w-5" />
      </Button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[210px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {isSelf ? (
            <>
              <Link href="/upload-long-video" role="menuitem" className={MENU_ITEM} onClick={() => setMenuOpen(false)}>
                <Video className="h-4 w-4" />
                Upload long video
              </Link>
              <Link href="/creator-monetization" role="menuitem" className={MENU_ITEM} onClick={() => setMenuOpen(false)}>
                <Wallet className="h-4 w-4" />
                Creator Dashboard
              </Link>
              <Link href="/settings" role="menuitem" className={MENU_ITEM} onClick={() => setMenuOpen(false)}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={handleCopyLink}>
                <Share2 className="h-4 w-4" />
                Copy profile link
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(MENU_ITEM, "text-red-600 dark:text-red-400")}
                onClick={() => void handleSignOut()}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className={MENU_ITEM} onClick={handleCopyLink}>
                <Share2 className="h-4 w-4" />
                Copy profile link
              </button>
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM}
                onClick={() => void handleBlockClick()}
                disabled={blockMutation.isPending}
              >
                <Ban className="h-4 w-4" />
                {isBlocked ? "Unblock user" : "Block user"}
              </button>
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM}
                onClick={() => {
                  setReportOpen(true);
                  setMenuOpen(false);
                }}
              >
                <Flag className="h-4 w-4" />
                Report user
              </button>
            </>
          )}
        </div>
      )}

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
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => reportMutation.mutate(r.id)}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" className="mt-3 w-full rounded-xl" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

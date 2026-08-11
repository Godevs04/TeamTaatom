"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User2, X } from "lucide-react";
import { approveFollowRequest, rejectFollowRequest } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { Button } from "../ui/button";
import { toast } from "sonner";
import type { Notification, NotificationResponse } from "../../types/notification";

/**
 * Inline approve/decline for a follow_request notification, mirroring mobile's
 * FollowRequestPopup (frontend/components/FollowRequestPopup.tsx). The
 * notification's own href would otherwise send the recipient to the
 * *requester's* profile, which has no accept/decline UI at all — this stays on
 * the notifications list instead of navigating anywhere.
 */
export function FollowRequestModal({
  open,
  notification,
  onClose,
}: {
  open: boolean;
  notification: Notification | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const requester =
    notification?.fromUser && typeof notification.fromUser === "object"
      ? notification.fromUser
      : null;
  const requesterId = requester?._id;

  /**
   * Patches the notification out of the cached list rather than refetching.
   * The backend rewrites this notification's own `type` to
   * follow_request_accepted/rejected on approve/reject (a value this app's
   * NotificationType union doesn't model), so a refetch here would render it
   * as an unrecognized "New notification" — removing it sidesteps that
   * entirely rather than trying to render a type the UI has no label for.
   */
  const removeFromList = () => {
    if (!notification) return;
    qc.setQueriesData<NotificationResponse>({ queryKey: ["notifications"] }, (old) => {
      if (!old) return old;
      const removed = old.notifications.find((n) => n._id === notification._id);
      const notifications = old.notifications.filter((n) => n._id !== notification._id);
      const unreadCount =
        removed && !removed.isRead && typeof old.unreadCount === "number"
          ? Math.max(old.unreadCount - 1, 0)
          : old.unreadCount;
      return { ...old, notifications, unreadCount };
    });
  };

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!requesterId) throw new Error("Missing requester");
      return approveFollowRequest(requesterId);
    },
    onSuccess: () => {
      removeFromList();
      toast.success(`You accepted ${requester?.fullName || requester?.username || "their"} follow request`);
      onClose();
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!requesterId) throw new Error("Missing requester");
      return rejectFollowRequest(requesterId);
    },
    onSuccess: () => {
      removeFromList();
      toast.success("Request declined");
      onClose();
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (!open || !notification) return null;

  const isActing = approveMutation.isPending || rejectMutation.isPending;
  const name = requester?.fullName || requester?.username || "Someone";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={isActing ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Follow request"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Follow request</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onClose}
            disabled={isActing}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            {requester?.profilePic ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={requester.profilePic}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User2 className="h-8 w-8 text-slate-400" />
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-zinc-50">{name}</p>
            {requester?.username && (
              <p className="text-sm text-slate-500 dark:text-zinc-400">@{requester.username}</p>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400">wants to follow you</p>
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 dark:border-zinc-800">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => rejectMutation.mutate()}
            disabled={isActing || !requesterId}
          >
            {rejectMutation.isPending ? "Declining…" : "Decline"}
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={() => approveMutation.mutate()}
            disabled={isActing || !requesterId}
          >
            {approveMutation.isPending ? "Accepting…" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User2, X } from "lucide-react";
import { approveFollowRequest, rejectFollowRequest } from "../../lib/api";
import {
  connectAcceptFollowRequest,
  connectRejectFollowRequest,
} from "../../lib/connect-api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { Button } from "../ui/button";
import { toast } from "sonner";
import type {
  Notification,
  NotificationResponse,
  NotificationType,
} from "../../types/notification";

function isConnectPageFollow(n: Notification | null): boolean {
  return !!(n?.metadata?.kind === "connect_page_follow" || n?.metadata?.connectPageId);
}

function isAlreadyProcessedError(e: unknown): boolean {
  const msg = getFriendlyErrorMessage(e).toLowerCase();
  return (
    msg.includes("already processed") ||
    msg.includes("already approved") ||
    msg.includes("no pending") ||
    msg.includes("not found")
  );
}

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

  const isConnect = isConnectPageFollow(notification);
  const connectPageId = notification?.metadata?.connectPageId;
  const pageName = notification?.metadata?.pageName || "this community";

  /**
   * Backend rewrites this row to follow_request_accepted / rejected — keep it in
   * the list (same as mobile) so the owner still sees the outcome, and clear the
   * unread badge if needed.
   */
  const markResolved = (action: "accepted" | "rejected") => {
    if (!notification || !requesterId) return;
    const nextType: NotificationType =
      action === "accepted" ? "follow_request_accepted" : "follow_request_rejected";

    qc.setQueriesData<NotificationResponse>({ queryKey: ["notifications"] }, (old) => {
      if (!old) return old;
      let unreadDelta = 0;
      const notifications = old.notifications.map((n) => {
        const fromId =
          n.fromUser && typeof n.fromUser === "object" ? n.fromUser._id : undefined;
        const sameNotif = n._id === notification._id;
        const sameConnectPending =
          isConnect &&
          n.type === "follow_request" &&
          isConnectPageFollow(n) &&
          n.metadata?.connectPageId === connectPageId &&
          fromId === requesterId;
        const sameProfilePending =
          !isConnect &&
          n.type === "follow_request" &&
          !isConnectPageFollow(n) &&
          fromId === requesterId;
        if (!sameNotif && !sameConnectPending && !sameProfilePending) return n;
        if (!n.isRead) unreadDelta += 1;
        return {
          ...n,
          type: nextType,
          isRead: true,
          metadata: {
            ...(n.metadata || {}),
            ...(isConnect && connectPageId
              ? { kind: "connect_page_follow", connectPageId, audience: "owner" }
              : {}),
          },
        };
      });
      const unreadCount =
        typeof old.unreadCount === "number"
          ? Math.max(old.unreadCount - unreadDelta, 0)
          : old.unreadCount;
      return { ...old, notifications, unreadCount };
    });

    if (!notification.isRead) {
      qc.setQueryData<{ unreadCount: number }>(["notificationsUnreadCount"], (old) => ({
        unreadCount: Math.max(0, (old?.unreadCount ?? 1) - 1),
      }));
    }

    if (isConnect && connectPageId) {
      void qc.invalidateQueries({ queryKey: ["connect-page-followers", connectPageId] });
      void qc.invalidateQueries({ queryKey: ["connect-page", connectPageId] });
    }
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!requesterId) throw new Error("Missing requester");
      if (isConnect) {
        if (!connectPageId) throw new Error("Missing community page");
        await connectAcceptFollowRequest(connectPageId, requesterId);
        return;
      }
      await approveFollowRequest(requesterId);
    },
    onSuccess: () => {
      markResolved("accepted");
      toast.success(
        isConnect
          ? `Accepted ${requester?.fullName || requester?.username || "their"} join request`
          : `Accepted ${requester?.fullName || requester?.username || "their"} follow request`,
      );
      onClose();
    },
    onError: (e: unknown) => {
      if (isAlreadyProcessedError(e)) {
        markResolved("accepted");
        toast.success("Request was already processed");
        onClose();
        return;
      }
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!requesterId) throw new Error("Missing requester");
      if (isConnect) {
        if (!connectPageId) throw new Error("Missing community page");
        await connectRejectFollowRequest(connectPageId, requesterId);
        return;
      }
      await rejectFollowRequest(requesterId);
    },
    onSuccess: () => {
      markResolved("rejected");
      toast.success(isConnect ? "Join request declined" : "Request declined");
      onClose();
    },
    onError: (e: unknown) => {
      if (isAlreadyProcessedError(e)) {
        markResolved("rejected");
        toast.success("Request was already processed");
        onClose();
        return;
      }
      toast.error(getFriendlyErrorMessage(e));
    },
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
        aria-label={isConnect ? "Community join request" : "Follow request"}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
            {isConnect ? "Community join request" : "Follow request"}
          </h3>
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
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            {isConnect ? `requested to join ${pageName}` : "wants to follow you"}
          </p>
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

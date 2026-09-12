"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsAsRead } from "../../../lib/api";
import { groupNotificationsByTime, getNotificationLink } from "../../../lib/notifications";
import { subscribeSocket, unsubscribeSocket } from "../../../lib/socket";
import type { Notification, NotificationResponse, NotificationType } from "../../../types/notification";
import { Button } from "../../../components/ui/button";
import { AtSign, Bell, Check, Heart, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";
import { FollowRequestModal } from "../../../components/notifications/follow-request-modal";
import { cn } from "../../../lib/utils";
import { useMounted } from "../../../hooks/use-mounted";

type NotificationSocketPayload = { userId?: string; notification?: Notification };

function actorName(n: Notification): string {
  const fromUser = n.fromUser && typeof n.fromUser === "object" ? n.fromUser : null;
  return (fromUser && (fromUser.fullName || fromUser.username)) || "Someone";
}

function actionCopy(type: NotificationType | undefined): string {
  switch (type) {
    case "like":
      return "liked your post";
    case "comment":
      return "commented on your post";
    case "follow":
      return "started following you";
    case "follow_request":
      return "requested to follow you";
    case "follow_approved":
      return "approved your follow request";
    case "post_mention":
      return "mentioned you in a post";
    default:
      return "sent you a notification";
  }
}

function TypeGlyph({ type }: { type?: NotificationType }) {
  const wrap = "flex h-4 w-4 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white dark:ring-zinc-900";
  switch (type) {
    case "like":
      return (
        <span className={cn(wrap, "bg-rose-500")}>
          <Heart className="h-2.5 w-2.5 fill-current" />
        </span>
      );
    case "comment":
    case "post_mention":
      return (
        <span className={cn(wrap, "bg-sky-500")}>
          {type === "post_mention" ? <AtSign className="h-2.5 w-2.5" /> : <MessageCircle className="h-2.5 w-2.5" />}
        </span>
      );
    case "follow_approved":
      return (
        <span className={cn(wrap, "bg-emerald-500")}>
          <UserCheck className="h-2.5 w-2.5" />
        </span>
      );
    case "follow":
    case "follow_request":
      return (
        <span className={cn(wrap, "bg-primary")}>
          <UserPlus className="h-2.5 w-2.5" />
        </span>
      );
    default:
      return (
        <span className={cn(wrap, "bg-slate-400")}>
          <Bell className="h-2.5 w-2.5" />
        </span>
      );
  }
}

function formatTime(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function NotificationTime({ iso }: { iso?: string }) {
  const mounted = useMounted();
  if (!iso) return null;
  if (!mounted) {
    return <time dateTime={iso}>{iso.slice(0, 10)}</time>;
  }
  return <time dateTime={iso}>{formatTime(iso)}</time>;
}

function NotificationRow({ n, onOpenRequest }: { n: Notification; onOpenRequest: (n: Notification) => void }) {
  const link = getNotificationLink(n);
  const fromUser = n.fromUser && typeof n.fromUser === "object" ? n.fromUser : null;
  const avatar = fromUser && "profilePic" in fromUser ? fromUser.profilePic : undefined;
  const postThumb =
    n.post && typeof n.post === "object"
      ? n.post.thumbnailUrl || n.post.imageUrl
      : undefined;
  const showPostThumb = !!postThumb && ["like", "comment", "post_mention"].includes(n.type ?? "");
  const name = actorName(n);
  const unread = !n.isRead;

  const row = (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3 transition-colors",
        unread
          ? "bg-primary/[0.045] hover:bg-primary/[0.07] dark:bg-primary/10 dark:hover:bg-primary/[0.14]"
          : "hover:bg-slate-50/90 dark:hover:bg-zinc-800/40"
      )}
    >
      <div className="relative h-11 w-11 shrink-0">
        <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:ring-zinc-700/70">
          {avatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400 dark:text-zinc-500">
              {name.trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5">
          <TypeGlyph type={n.type} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-5 text-slate-600 dark:text-zinc-300">
          <span className="font-semibold text-slate-900 dark:text-zinc-50">{name}</span>{" "}
          {actionCopy(n.type)}
        </p>
        <p className="mt-0.5 text-[12px] text-slate-400 dark:text-zinc-500">
          <NotificationTime iso={n.createdAt} />
        </p>
      </div>

      {n.type === "follow_request" ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          Review
        </span>
      ) : null}

      {showPostThumb ? (
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/60 dark:bg-zinc-800 dark:ring-zinc-700/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={postThumb} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}

      {unread ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
      ) : (
        <span className="w-2 shrink-0" aria-hidden />
      )}
    </div>
  );

  if (n.type === "follow_request") {
    return (
      <button type="button" onClick={() => onOpenRequest(n)} className="block w-full text-left">
        {row}
      </button>
    );
  }
  if (link?.href) {
    return <Link href={link.href}>{row}</Link>;
  }
  return row;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const mounted = useMounted();
  const [activeRequest, setActiveRequest] = React.useState<Notification | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(1, 50),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.setQueryData(["notificationsUnreadCount"], { unreadCount: 0 });
    },
  });

  React.useEffect(() => {
    const onNotification = (payload: NotificationSocketPayload) => {
      const incoming = payload?.notification;
      if (!incoming?._id) return;
      queryClient.setQueriesData<NotificationResponse>({ queryKey: ["notifications"] }, (old) => {
        if (!old) return old;
        if (old.notifications.some((n) => n._id === incoming._id)) return old;
        return {
          ...old,
          notifications: [incoming, ...old.notifications],
          unreadCount: (old.unreadCount ?? 0) + 1,
        };
      });
    };
    subscribeSocket<NotificationSocketPayload>("notification", onNotification);
    return () => unsubscribeSocket<NotificationSocketPayload>("notification", onNotification);
  }, [queryClient]);

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? notifications.filter((n) => !n.isRead).length;
  const sections = groupNotificationsByTime(notifications);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
              Notifications
            </h1>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                {unreadCount} new
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">Likes, comments, and follows</p>
        </div>
        {unreadCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-600 dark:text-zinc-300"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        ) : null}
      </header>

      {!mounted || isPending ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-zinc-800/80">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-11 w-11 rounded-lg" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-14 text-center dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-sm text-slate-600 dark:text-zinc-400">Couldn’t load notifications.</p>
          <Button className="mt-4 rounded-full" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
            <Bell className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-zinc-50">You&apos;re all caught up</h3>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500 dark:text-zinc-400">
            Likes, comments, and new followers will appear here.
          </p>
          <Button className="mt-5 rounded-full" size="sm" asChild>
            <Link href="/feed">Explore feed</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90">
          {sections.map((section, sIdx) => (
            <section key={section.title}>
              <h2
                className={cn(
                  "bg-slate-50/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:bg-zinc-800/50 dark:text-zinc-500",
                  sIdx > 0 && "border-t border-slate-100 dark:border-zinc-800/80"
                )}
              >
                {section.title}
              </h2>
              <ul className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {section.data.map((n) => (
                  <li key={n._id}>
                    <NotificationRow n={n} onOpenRequest={setActiveRequest} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <FollowRequestModal
        open={activeRequest !== null}
        notification={activeRequest}
        onClose={() => setActiveRequest(null)}
      />
    </div>
  );
}

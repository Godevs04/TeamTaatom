"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markAllNotificationsAsRead } from "../../../lib/api";
import { groupNotificationsByTime, getNotificationLink } from "../../../lib/notifications";
import type { Notification } from "../../../types/notification";
import { Button } from "../../../components/ui/button";
import { Bell, ImageIcon, User } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";

function getNotificationLabel(n: Notification): string {
  const fromName = n.fromUser && typeof n.fromUser === "object" && "fullName" in n.fromUser
    ? (n.fromUser as { fullName?: string }).fullName
    : "Someone";
  switch (n.type) {
    case "like":
      return `${fromName} liked your post`;
    case "comment":
      return `${fromName} commented on your post`;
    case "follow":
      return `${fromName} started following you`;
    case "follow_request":
      return `${fromName} requested to follow you`;
    case "follow_approved":
      return `${fromName} approved your follow request`;
    case "post_mention":
      return `${fromName} mentioned you in a post`;
    default:
      return "New notification";
  }
}

function formatTime(createdAt: string | undefined): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(1, 50),
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? notifications.filter((n) => !n.isRead).length;
  const sections = groupNotificationsByTime(notifications);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Activity and updates</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-200/80"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Mark all read
          </Button>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
          <p className="text-slate-600">Failed to load notifications.</p>
          <Button className="mt-4 rounded-xl" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-premium">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Bell className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900">No notifications yet</h3>
          <p className="mt-2 text-[15px] text-slate-500">When you get likes, comments or new followers, they&apos;ll show here.</p>
          <div className="mt-6">
            <Button className="rounded-xl" asChild>
              <Link href="/feed">Explore feed</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{section.title}</h2>
              <div className="space-y-2">
                {section.data.map((n) => {
                  const link = getNotificationLink(n);
                  const fromUser = n.fromUser && typeof n.fromUser === "object" ? n.fromUser : null;
                  const postImg = n.post && typeof n.post === "object" && "imageUrl" in n.post ? (n.post as { imageUrl?: string }).imageUrl : undefined;
                  const content = (
                    <div
                      className={`flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium transition-shadow hover:shadow-premium-hover ${
                        !n.isRead ? "border-l-4 border-l-primary" : ""
                      }`}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {postImg && ["like", "comment"].includes(n.type ?? "") ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={postImg} alt="" className="h-full w-full object-cover" />
                        ) : fromUser && "profilePic" in fromUser && fromUser.profilePic ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={(fromUser as { profilePic: string }).profilePic} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            {n.type === "follow" || n.type === "follow_request" || n.type === "follow_approved" ? (
                              <User className="h-6 w-6" />
                            ) : (
                              <ImageIcon className="h-6 w-6" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-slate-900">{getNotificationLabel(n)}</p>
                        <p className="text-xs text-slate-500">{formatTime(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                  if (link?.href) {
                    return (
                      <Link key={n._id} href={link.href}>
                        {content}
                      </Link>
                    );
                  }
                  return <div key={n._id}>{content}</div>;
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

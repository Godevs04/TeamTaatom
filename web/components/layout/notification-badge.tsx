"use client";

import { useQuery } from "@tanstack/react-query";
import { getNotificationsUnreadCount } from "../../lib/api";
import { useAuth } from "../../context/auth-context";
import { cn } from "../../lib/utils";

/**
 * Unread-notification count dot/pill for the bell icon. Reads the shared
 * ["notificationsUnreadCount"] query key — seeded here via
 * getNotificationsUnreadCount, then kept live by auth-context.tsx's
 * `notification` socket subscription (+1 per event) and reset by
 * notifications/page.tsx's "Mark all read" mutation. Renders nothing at 0.
 * Parent element must be `position: relative` for the absolute placement.
 *
 * Deliberately NOT ["notifications", "unreadCount"] -- confirmed live that a
 * key sharing the "notifications" prefix gets swept up by every existing
 * fuzzy setQueriesData({queryKey: ["notifications"]}) call already in the app
 * (e.g. follow-request-modal.tsx, and this feature's own live-prepend below),
 * which expect a {notifications, unreadCount} list shape and crash
 * (`Cannot read properties of undefined (reading 'some')`) when they instead
 * hit this hook's plain {unreadCount} shape. A flat, differently-named key
 * avoids the collision entirely rather than auditing every current and future
 * fuzzy match against ["notifications"].
 */
export function NotificationBadge({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["notificationsUnreadCount"],
    queryFn: getNotificationsUnreadCount,
    enabled: !!user,
    staleTime: 30_000,
  });

  const count = data?.unreadCount ?? 0;
  if (count <= 0) return null;

  return (
    <span
      data-testid="notification-unread-badge"
      className={cn(
        "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-on-primary",
        className
      )}
      aria-hidden
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

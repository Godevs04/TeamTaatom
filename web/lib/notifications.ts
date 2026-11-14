import type { Notification } from "../types/notification";
import { contentHref, contentNoun, refId } from "./content-routes";

export type NotificationSection = { title: string; data: Notification[] };

function getDayStart(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function groupNotificationsByTime(notifications: Notification[]): NotificationSection[] {
  if (!Array.isArray(notifications) || notifications.length === 0) return [];

  const todayStart = getDayStart(new Date());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const lastWeekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  const lastMonthStart = todayStart - 30 * 24 * 60 * 60 * 1000;

  const buckets: Record<string, Notification[]> = {
    Today: [],
    Yesterday: [],
    "Last 7 days": [],
    "Last 30 days": [],
    Older: [],
  };

  for (const n of notifications) {
    const t = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    if (t >= todayStart) buckets.Today.push(n);
    else if (t >= yesterdayStart) buckets.Yesterday.push(n);
    else if (t >= lastWeekStart) buckets["Last 7 days"].push(n);
    else if (t >= lastMonthStart) buckets["Last 30 days"].push(n);
    else buckets.Older.push(n);
  }

  const order: (keyof typeof buckets)[] = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"];
  const sections: NotificationSection[] = [];
  for (const title of order) {
    if (buckets[title].length > 0) {
      sections.push({ title, data: buckets[title] });
    }
  }
  return sections;
}

/** True when a comment notification is really an @mention inside a comment. */
export function isCommentMention(n: Notification): boolean {
  return n.type === "post_mention" && !!(n.comment || n.metadata?.commentId || n.metadata?.text);
}

export function getNotificationLink(n: Notification): { href: string; label: string } | null {
  const fromId = refId(n.fromUser);
  const postId = refId(n.post);
  const postType = n.post?.type || n.metadata?.postType || null;
  const ownerId = refId(n.post?.user) || n.metadata?.postOwnerId || null;

  switch (n.type) {
    case "like":
    case "comment":
    case "post_mention":
      if (!postId) return null;
      return {
        href: contentHref(postId, postType, ownerId, {
          openComments: n.type === "comment" || isCommentMention(n),
        }),
        label: `View ${contentNoun(postType)}`,
      };
    case "follow":
    case "follow_approved":
    case "follow_request_accepted":
    case "route_access_approved":
      if (fromId) return { href: `/profile/${fromId}`, label: "View profile" };
      return null;
    case "follow_request":
    case "follow_request_rejected":
    case "route_access_accepted":
    case "route_access_rejected":
      return null;
    case "route_access_request":
      return { href: "/settings/route-access-requests", label: "Review request" };
    case "subscription_active": {
      const pageId = n.metadata?.connectPageId;
      return pageId ? { href: `/connect/page/${pageId}`, label: "Open page" } : null;
    }
    case "creator_program":
      return { href: "/creator-monetization", label: "Open Creator Dashboard" };
    default:
      return fromId ? { href: `/profile/${fromId}`, label: "View" } : null;
  }
}

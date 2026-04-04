import type { Notification } from "../types/notification";

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

export function getNotificationLink(n: Notification): { href: string; label: string } | null {
  const fromId = n.fromUser && typeof n.fromUser === "object" && "_id" in n.fromUser ? (n.fromUser as { _id: string })._id : null;
  const postId = n.post && typeof n.post === "object" && "_id" in n.post ? (n.post as { _id: string })._id : null;

  switch (n.type) {
    case "like":
    case "comment":
    case "post_mention":
      if (postId) return { href: `/feed?postId=${postId}`, label: "View post" };
      return null;
    case "follow":
    case "follow_approved":
      if (fromId) return { href: `/profile/${fromId}`, label: "View profile" };
      return null;
    case "follow_request":
      if (fromId) return { href: `/profile/${fromId}`, label: "View request" };
      return null;
    default:
      return fromId ? { href: `/profile/${fromId}`, label: "View" } : null;
  }
}

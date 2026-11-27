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

  const connectPageId = n.metadata?.connectPageId || null;
  const isConnectFollow =
    n.metadata?.kind === "connect_page_follow" ||
    n.type === "connect_follow_request" ||
    n.type === "connect_follow_accepted";

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
    case "connect_follow_request":
    case "connect_follow_accepted":
      return connectPageId
        ? { href: `/connect/page/${connectPageId}`, label: "Open community" }
        : null;
    case "follow":
    case "follow_approved":
    case "follow_request_accepted":
    case "route_access_approved": {
      if (
        (isConnectFollow ||
          n.metadata?.kind === "community_group_join" ||
          n.metadata?.kind === "community_event_published" ||
          n.metadata?.kind === "community_event_team_invite" ||
          n.metadata?.kind === "community_competition_removed") &&
        connectPageId
      ) {
        return { href: `/connect/page/${connectPageId}`, label: "Open community" };
      }
      if (fromId) return { href: `/profile/${fromId}`, label: "View profile" };
      return null;
    }
    case "follow_request":
      // Connect join requests deep-link to the page; profile follows use the in-page modal
      if (isConnectFollow && connectPageId) {
        return { href: `/connect/page/${connectPageId}`, label: "Open community" };
      }
      return null;
    case "follow_request_rejected":
    case "route_access_accepted":
    case "route_access_rejected":
      return null;
    case "route_access_request":
      return { href: "/settings/route-access-requests", label: "Review request" };
    case "subscription_active": {
      return connectPageId ? { href: `/connect/page/${connectPageId}`, label: "Open page" } : null;
    }
    case "creator_program":
      return { href: "/creator-monetization", label: "Open Creator Dashboard" };
    case "community_group_join":
    case "community_group_join_approved":
    case "community_event_published":
    case "community_event_team_invite":
    case "community_competition_removed":
    case "community_event_reminder":
    case "community_competition_closing":
    case "community_event_waitlist_promoted":
    case "community_event_showcase_published": {
      return connectPageId ? { href: `/connect/page/${connectPageId}`, label: "Open community" } : null;
    }
    default:
      if (postId) {
        return {
          href: contentHref(postId, postType, ownerId),
          label: `View ${contentNoun(postType)}`,
        };
      }
      return fromId ? { href: `/profile/${fromId}`, label: "View" } : null;
  }
}

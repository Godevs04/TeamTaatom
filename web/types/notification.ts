import type { User } from "./user";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "follow_request"
  | "follow_approved"
  | "follow_request_accepted"
  | "follow_request_rejected"
  | "post_mention"
  | "subscription_active"
  | "route_access_request"
  | "route_access_approved"
  | "route_access_accepted"
  | "route_access_rejected"
  | "creator_program"
  | "community_group_join"
  | "community_group_join_approved"
  | "community_event_published"
  | "community_event_team_invite"
  | "community_competition_removed";

export type Notification = {
  _id: string;
  type: NotificationType;
  fromUser?: User | { _id: string; fullName?: string; username?: string; profilePic?: string };
  toUser?: string | User;
  post?: {
    _id: string;
    type?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    user?: string | { _id: string };
  };
  comment?: { _id: string; text?: string };
  isRead?: boolean;
  metadata?: {
    message?: string;
    text?: string;
    commentId?: string;
    postType?: string;
    postOwnerId?: string;
    connectPageId?: string;
    /** Distinguishes community join requests from profile follows. */
    kind?: string;
    pageName?: string;
    audience?: string;
    groupName?: string;
    groupChatId?: string;
    eventId?: string;
    eventTitle?: string;
    teamId?: string;
    teamName?: string;
    submissionId?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationResponse = {
  notifications: Notification[];
  unreadCount?: number;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalNotifications?: number;
    hasNextPage: boolean;
    limit: number;
  };
};

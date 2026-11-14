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
  | "creator_program";

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

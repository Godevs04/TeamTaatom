import type { User } from "./user";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "follow_request"
  | "follow_approved"
  | "post_mention";

export type Notification = {
  _id: string;
  type: NotificationType;
  fromUser?: User | { _id: string; fullName?: string; username?: string; profilePic?: string };
  toUser?: string | User;
  post?: { _id: string; imageUrl?: string; thumbnailUrl?: string };
  comment?: { _id: string; text?: string };
  isRead?: boolean;
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

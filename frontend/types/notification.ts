export interface Notification {
  _id: string;
  type:
    | 'like'
    | 'comment'
    | 'follow'
    | 'follow_request'
    | 'follow_approved'
    | 'post_mention'
    | 'follow_request_accepted'
    | 'follow_request_rejected';
  fromUser: {
    _id: string;
    fullName: string;
    profilePic: string;
    email?: string;
  };
  toUser: string;
  post?: {
    _id: string;
    imageUrl: string;
    caption?: string;
  };
  comment?: {
    _id: string;
    text: string;
  };
  metadata?: {
    requesterName?: string;
    requesterProfilePic?: string;
    requestId?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalNotifications: number;
    hasNextPage: boolean;
    limit: number;
  };
}

export interface MarkAsReadResponse {
  message: string;
  unreadCount: number;
}


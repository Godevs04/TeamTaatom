import type { User } from "./user";

export type ChatGroupRole = "owner" | "admin" | "member" | "pending_admin";

export type ChatParticipant = {
  _id: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
  isVerified?: boolean;
  /** Present on connect_page group chats */
  groupRole?: ChatGroupRole;
};

/**
 * Media/file attached to a chat message. `post` is the share-a-post variant, which
 * carries a preview rather than a storage object.
 *
 * `url` is a signed storage link: the backend re-signs it to a fresh 1-hour URL on
 * every message read, so render whatever the API returned and never cache it.
 */
export type ChatAttachment = {
  type: "image" | "video" | "file" | "post";
  url?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
  storageKey?: string;
};

export type ChatMessage = {
  _id: string;
  sender: string | ChatParticipant | { _id: string };
  text: string;
  attachments?: ChatAttachment[];
  timestamp?: string;
  createdAt?: string;
  seen?: boolean;
  status?: "sent" | "delivered" | "read";
  deliveredAt?: string | null;
  readAt?: string | null;
  isEdited?: boolean;
  editedAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  /** Group chat: sender display name (populated by backend for connect_page chats) */
  senderName?: string;
  /** Group chat: sender profile picture URL */
  senderProfilePic?: string;
  /** Group chat: sender Owner/Admin role for chips */
  senderGroupRole?: ChatGroupRole;
  /** System notice (promote/demote), centered — not a normal bubble */
  isSystem?: boolean;
  seenBy?: string[];
};

export type ConnectPageRef = {
  _id: string;
  name: string;
  profileImage?: string;
  followerCount?: number;
};

export type Chat = {
  _id: string;
  participants: ChatParticipant[];
  messages?: ChatMessage[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
  updatedAt?: string;
  createdAt?: string;
  type?: "user_chat" | "admin_support" | "connect_page";
  connectPageId?: string | ConnectPageRef;
  /** Viewer's role in connect group chat */
  myGroupRole?: ChatGroupRole;
  /** Who may send messages: everyone | admins | owner */
  sendPermission?: "everyone" | "admins" | "owner";
  /** Whether the current viewer may send messages */
  canSendMessages?: boolean;
};

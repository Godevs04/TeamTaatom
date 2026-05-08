import type { User } from "./user";

export type ChatParticipant = {
  _id: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
  isVerified?: boolean;
};

export type ChatMessage = {
  _id: string;
  sender: string | ChatParticipant | { _id: string };
  text: string;
  timestamp?: string;
  createdAt?: string;
  seen?: boolean;
  /** Group chat: sender display name (populated by backend for connect_page chats) */
  senderName?: string;
  /** Group chat: sender profile picture URL */
  senderProfilePic?: string;
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
  updatedAt?: string;
  createdAt?: string;
  type?: "user_chat" | "admin_support" | "connect_page";
  connectPageId?: ConnectPageRef | string | null;
};

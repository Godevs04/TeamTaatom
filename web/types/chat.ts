import type { User } from "./user";

export type ChatParticipant = {
  _id: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
};

export type ChatMessage = {
  _id: string;
  sender: string | ChatParticipant | { _id: string };
  text: string;
  timestamp?: string;
  createdAt?: string;
  seen?: boolean;
};

export type Chat = {
  _id: string;
  participants: ChatParticipant[];
  messages?: ChatMessage[];
  lastMessage?: ChatMessage;
  updatedAt?: string;
  createdAt?: string;
};

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getChat,
  getChatMessages,
  sendChatMessage,
  markChatMessagesSeen,
  getProfile,
} from "../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../lib/auth-errors";
import { useAuth } from "../../../../context/auth-context";
import type { ChatMessage, ChatParticipant } from "../../../../types/chat";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { ArrowLeft, Send, User } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";
import { parsePostShareMessage } from "../../../../lib/post-share-chat";
import { PostShareCard } from "../../../../components/chat/post-share-card";

function normalizeSenderId(sender: ChatMessage["sender"]): string {
  if (typeof sender === "string") return sender;
  const o = sender as { _id?: string };
  return o?._id ?? "";
}

export default function ChatConversationPage() {
  const params = useParams();
  const userId = params.userId as string;
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const myId = me?._id ?? "";
  const [input, setInput] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: chatData } = useQuery({
    queryKey: ["chat", userId],
    queryFn: () => getChat(userId),
    enabled: !!userId && !!myId,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat", userId, "messages"],
    queryFn: () => getChatMessages(userId),
    enabled: !!userId && !!myId,
  });

  const { data: profileData } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });

  React.useEffect(() => {
    if (!userId || !myId) return;
    markChatMessagesSeen(userId).catch(() => {});
  }, [userId, myId]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendChatMessage(userId, text),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "messages"] });
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages?.length]);

  const otherUser = profileData?.profile ?? chatData?.chat?.participants?.find((p: ChatParticipant) => (p._id ?? "") === userId);
  const displayName = otherUser?.fullName ?? otherUser?.username ?? "User";
  const messages: ChatMessage[] = messagesData?.messages ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  if (!myId) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
        <p className="text-slate-600">Sign in to chat.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-premium">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/chat">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {otherUser?.profilePic ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={otherUser.profilePic} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <User className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-slate-900">{displayName}</h1>
          <p className="truncate text-xs text-slate-500">@{otherUser?.username ?? "user"}</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <Link href={`/profile/${userId}`}>Profile</Link>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-3/4 rounded-2xl" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-slate-500">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = normalizeSenderId(msg.sender) === myId;
            const text = msg.text ?? "";
            const postShare = parsePostShareMessage(text);
            return (
              <div
                key={msg._id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(80%,360px)] rounded-2xl px-2 py-2 sm:px-3 sm:py-2.5 ${
                    postShare
                      ? isMe
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-900"
                      : isMe
                        ? "bg-primary px-4 py-2.5 text-white"
                        : "bg-slate-100 px-4 py-2.5 text-slate-900"
                  }`}
                >
                  {postShare ? (
                    <PostShareCard share={postShare} isSent={isMe} />
                  ) : (
                    <p className="text-[15px] leading-snug">{text}</p>
                  )}
                  {msg.createdAt && (
                    <p className={`mt-1.5 px-1 text-xs ${isMe ? "text-white/80" : "text-slate-500"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-xl border-slate-200/80"
            maxLength={2000}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 rounded-xl"
            disabled={!input.trim() || sendMutation.isPending}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

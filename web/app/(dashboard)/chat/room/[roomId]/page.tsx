"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getChatByRoomId,
  getRoomMessages,
  sendRoomMessage,
  markRoomMessagesSeen,
} from "../../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../../lib/auth-errors";
import { useAuth } from "../../../../../context/auth-context";
import type { ChatMessage, ConnectPageRef } from "../../../../../types/chat";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { ArrowLeft, Send, Users } from "lucide-react";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { toast } from "sonner";

function normalizeSenderId(sender: ChatMessage["sender"]): string {
  if (typeof sender === "string") return sender;
  const o = sender as { _id?: string };
  return o?._id ?? "";
}

export default function GroupChatRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const myId = me?._id ?? "";
  const [input, setInput] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: chatData } = useQuery({
    queryKey: ["chat-room", roomId],
    queryFn: () => getChatByRoomId(roomId),
    enabled: !!roomId && !!myId,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-room", roomId, "messages"],
    queryFn: () => getRoomMessages(roomId),
    enabled: !!roomId && !!myId,
  });

  React.useEffect(() => {
    if (!roomId || !myId) return;
    markRoomMessagesSeen(roomId).catch(() => {});
  }, [roomId, myId]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendRoomMessage(roomId, text),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      queryClient.invalidateQueries({ queryKey: ["chat-room", roomId, "messages"] });
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages?.length]);

  const chat = chatData?.chat;
  const participants = chat?.participants ?? [];
  const messages: ChatMessage[] = messagesData?.messages ?? [];

  // Extract connect page info for the header
  const connectPage =
    chat?.connectPageId && typeof chat.connectPageId === "object"
      ? (chat.connectPageId as ConnectPageRef)
      : null;
  const groupName = connectPage?.name ?? "Group Chat";
  const groupImage = connectPage?.profileImage;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  };

  if (!myId) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">Sign in to chat.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-slate-200/80 bg-white shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/chat">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-primary/10 dark:bg-primary/20">
          {groupImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={groupImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-slate-900 dark:text-zinc-50">{groupName}</h1>
          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
            {participants.length} members
          </p>
        </div>
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
            <p className="text-sm text-slate-500 dark:text-zinc-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = normalizeSenderId(msg.sender) === myId;
            const senderName = msg.senderName ?? "";
            const senderPic = msg.senderProfilePic;
            return (
              <div
                key={msg._id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && (
                  <div className="mr-2 mt-1 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                    {senderPic ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={senderPic} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                        {senderName?.slice(0, 1)?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[min(80%,360px)] rounded-2xl px-4 py-2.5 ${
                    isMe
                      ? "bg-primary text-on-primary"
                      : "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {!isMe && senderName && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">{senderName}</p>
                  )}
                  <p className="text-[15px] leading-snug">{msg.text}</p>
                  {(msg.createdAt || msg.timestamp) && (
                    <p className={`mt-1.5 text-xs ${isMe ? "text-white/80" : "text-slate-500 dark:text-zinc-400"}`}>
                      {new Date(msg.createdAt || msg.timestamp || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
      <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4 dark:border-zinc-800">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-xl border-slate-200/80 bg-background dark:border-zinc-700"
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

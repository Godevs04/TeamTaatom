"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getChatByRoomId,
  getRoomMessages,
  sendRoomMessage,
  uploadChatMedia,
  markRoomMessagesSeen,
} from "../../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../../lib/auth-errors";
import { useAuth } from "../../../../../context/auth-context";
import type { ChatMessage, ConnectPageRef } from "../../../../../types/chat";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, Users } from "lucide-react";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { toast } from "sonner";
import { ChatComposer } from "../../../../../components/chat/chat-composer";
import { MessageAttachments } from "../../../../../components/chat/message-attachments";
import {
  MessageStatusTicks,
  getGroupMessageReceiptStatus,
  messageTime,
} from "../../../../../components/chat/message-status-ticks";
import { subscribeSocket, unsubscribeSocket } from "../../../../../lib/socket";
import { parsePostShareMessage, parseJourneyShareMessage } from "../../../../../lib/post-share-chat";
import { PostShareCard } from "../../../../../components/chat/post-share-card";
import { JourneyShareCard } from "../../../../../components/chat/journey-share-card";

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

  // Live message delivery + seen receipts for the group/room chat. Sending is
  // unchanged (still the REST call below); this only subscribes. Typing and
  // online/offline presence are intentionally not wired here: the backend's
  // `typing` socket handler only supports a single `to` recipient (no
  // room/broadcast form), and there's no single "other user" for a group
  // chat's presence dot the way there is on the 1:1 thread page.
  React.useEffect(() => {
    if (!roomId || !myId) return;

    const onMessageNew = (payload: { chatId?: string; message?: ChatMessage }) => {
      if (!payload?.message || payload.chatId !== roomId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat-room", roomId, "messages"], (old) => {
        if (!old) return old;
        if (old.messages.some((m) => m._id === payload.message!._id)) return old;
        return { ...old, messages: [...old.messages, payload.message!] };
      });
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    };

    const onSeen = (payload: { messageId?: string; chatId?: string; seenBy?: string[] }) => {
      if (payload?.chatId !== roomId || !payload.messageId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat-room", roomId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m._id === payload.messageId ? { ...m, seenBy: payload.seenBy ?? m.seenBy } : m
          ),
        };
      });
    };

    subscribeSocket("message:new", onMessageNew);
    subscribeSocket("seen", onSeen);

    return () => {
      unsubscribeSocket("message:new", onMessageNew);
      unsubscribeSocket("seen", onSeen);
    };
  }, [roomId, myId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: async ({ text, files }: { text: string; files: File[] }) => {
      // Two-step: upload attachments first, then send the message referencing them.
      const attachments = files.length > 0 ? (await uploadChatMedia(files)).attachments : undefined;
      return sendRoomMessage(roomId, text, attachments);
    },
    onSuccess: () => {
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
  const otherParticipantIds = participants
    .map((p) => (typeof p === "string" ? p : p._id))
    .filter((id): id is string => !!id && id !== myId);

  // Extract connect page info for the header
  const connectPage =
    chat?.connectPageId && typeof chat.connectPageId === "object"
      ? (chat.connectPageId as ConnectPageRef)
      : null;
  const groupName = connectPage?.name ?? "Group Chat";
  const groupImage = connectPage?.profileImage;

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
            const text = msg.text ?? "";
            const postShare = parsePostShareMessage(text);
            const journeyShare = !postShare ? parseJourneyShareMessage(text) : null;
            const hasAttachments = (msg.attachments?.length ?? 0) > 0;
            const tightPadding = !!postShare || !!journeyShare || hasAttachments;
            const timeStr = messageTime(msg);
            const status = isMe ? getGroupMessageReceiptStatus(msg, otherParticipantIds) : "sent";
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
                  className={`max-w-[min(80%,360px)] rounded-2xl px-2 py-2 sm:px-3 sm:py-2.5 ${
                    tightPadding
                      ? isMe
                        ? "bg-primary text-on-primary"
                        : "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : isMe
                        ? "bg-primary px-4 py-2.5 text-on-primary"
                        : "bg-slate-100 px-4 py-2.5 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {!isMe && senderName && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">{senderName}</p>
                  )}
                  {postShare ? (
                    <PostShareCard share={postShare} isSent={isMe} />
                  ) : journeyShare ? (
                    <JourneyShareCard share={journeyShare} isSent={isMe} />
                  ) : (
                    <>
                      <MessageAttachments attachments={msg.attachments} isMe={isMe} />
                      {text ? (
                        <p className={`text-[15px] leading-snug${hasAttachments ? " mt-2 px-1" : ""}`}>
                          {text}
                        </p>
                      ) : null}
                    </>
                  )}
                  {(timeStr || isMe) && (
                    <div
                      className={`mt-1.5 flex items-center justify-end gap-1 px-1 text-xs ${
                        isMe ? "text-white/80" : "text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {timeStr ? (
                        <span>
                          {new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                      {isMe ? <MessageStatusTicks status={status} /> : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatComposer
        onSend={(text, files) => sendMutation.mutateAsync({ text, files })}
        isSending={sendMutation.isPending}
      />
    </div>
  );
}

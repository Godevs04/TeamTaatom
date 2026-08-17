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
  editChatMessage,
  deleteChatMessage,
} from "../../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../../lib/auth-errors";
import { useAuth } from "../../../../../context/auth-context";
import { useConfirm } from "../../../../../context/confirm-context";
import type { ChatMessage, ConnectPageRef } from "../../../../../types/chat";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft, Users, MoreHorizontal, Edit2, Trash2, X } from "lucide-react";
import { Skeleton } from "../../../../../components/ui/skeleton";
import { toast } from "sonner";
import { ChatComposer } from "../../../../../components/chat/chat-composer";
import { MessageAttachments } from "../../../../../components/chat/message-attachments";
import {
  MessageStatusTicks,
  getGroupMessageReceiptStatus,
  messageTime,
} from "../../../../../components/chat/message-status-ticks";
import { subscribeSocket, unsubscribeSocket, emitSocket } from "../../../../../lib/socket";
import { parsePostShareMessage, parseJourneyShareMessage } from "../../../../../lib/post-share-chat";
import { PostShareCard } from "../../../../../components/chat/post-share-card";
import { JourneyShareCard } from "../../../../../components/chat/journey-share-card";

const TYPING_CLEAR_MS = 2500;

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
  const confirm = useConfirm();
  const myId = me?._id ?? "";
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [editingMessage, setEditingMessage] = React.useState<ChatMessage | null>(null);
  const [activeMsgMenuId, setActiveMsgMenuId] = React.useState<string | null>(null);
  const [typingName, setTypingName] = React.useState<string | null>(null);
  const typingClearTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [roomId, myId, messagesData?.messages?.length]);

  // Live delivery, seen receipts, edits, deletes, and group typing.
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

    const onStatusChanged = (payload: {
      chatId?: string;
      messageIds?: string[];
      status?: "sent" | "delivered" | "read";
    }) => {
      if (!payload?.messageIds || !payload.status) return;
      if (payload.chatId && payload.chatId !== roomId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat-room", roomId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) => {
            if (!payload.messageIds!.includes(m._id)) return m;
            if (payload.status !== "read" && (m.status === "read" || m.seen || m.readAt)) return m;
            const next: ChatMessage = { ...m, status: payload.status };
            if (payload.status === "read") {
              next.seen = true;
              next.readAt = m.readAt ?? new Date().toISOString();
            }
            if (payload.status === "delivered") {
              next.deliveredAt = m.deliveredAt ?? new Date().toISOString();
            }
            return next;
          }),
        };
      });
    };

    const onCleared = (payload: { chatId?: string }) => {
      if (!payload?.chatId || payload.chatId !== roomId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat-room", roomId, "messages"], (old) =>
        old ? { ...old, messages: [] } : old
      );
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    };

    const onMessageEdited = (payload: { chatId?: string; messageId?: string; text?: string; editedAt?: string }) => {
      if (payload?.chatId && payload.chatId !== roomId) return;
      if (!payload?.messageId || !payload.text) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat-room", roomId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m._id === payload.messageId ? { ...m, text: payload.text!, isEdited: true, editedAt: payload.editedAt } : m
          ),
        };
      });
    };

    const onMessageDeleted = (payload: { chatId?: string; messageId?: string }) => {
      if (payload?.chatId && payload.chatId !== roomId) return;
      if (!payload?.messageId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat-room", roomId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m._id === payload.messageId ? { ...m, isDeleted: true, text: "", attachments: [] } : m
          ),
        };
      });
    };

    const onTyping = (payload: { from?: string; roomId?: string }) => {
      if (payload?.roomId !== roomId || !payload.from || payload.from === myId) return;
      const name =
        (chatData?.chat?.participants ?? []).find((p) => (typeof p === "string" ? p : p._id) === payload.from);
      const label = typeof name === "object" ? name.fullName || name.username || "Someone" : "Someone";
      setTypingName(label);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
      typingClearTimeoutRef.current = setTimeout(() => setTypingName(null), TYPING_CLEAR_MS);
    };

    const onTypingStop = (payload: { from?: string; roomId?: string }) => {
      if (payload?.roomId !== roomId) return;
      setTypingName(null);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    };

    subscribeSocket("message:new", onMessageNew);
    subscribeSocket("seen", onSeen);
    subscribeSocket("message:status_changed", onStatusChanged);
    subscribeSocket("chat:cleared", onCleared);
    subscribeSocket("chat:message_edited", onMessageEdited);
    subscribeSocket("chat:message_deleted", onMessageDeleted);
    subscribeSocket("typing", onTyping);
    subscribeSocket("typing:stop", onTypingStop);

    return () => {
      unsubscribeSocket("message:new", onMessageNew);
      unsubscribeSocket("seen", onSeen);
      unsubscribeSocket("message:status_changed", onStatusChanged);
      unsubscribeSocket("chat:cleared", onCleared);
      unsubscribeSocket("chat:message_edited", onMessageEdited);
      unsubscribeSocket("chat:message_deleted", onMessageDeleted);
      unsubscribeSocket("typing", onTyping);
      unsubscribeSocket("typing:stop", onTypingStop);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    };
  }, [roomId, myId, queryClient, chatData?.chat?.participants]);

  const sendMutation = useMutation({
    mutationFn: async ({ text, files }: { text: string; files: File[] }) => {
      if (editingMessage) {
        return editChatMessage(roomId, editingMessage._id, text);
      }
      const attachments = files.length > 0 ? (await uploadChatMedia(files)).attachments : undefined;
      return sendRoomMessage(roomId, text, attachments);
    },
    onSuccess: () => {
      setEditingMessage(null);
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      queryClient.invalidateQueries({ queryKey: ["chat-room", roomId, "messages"] });
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  const deleteMsgMutation = useMutation({
    mutationFn: ({ messageId }: { messageId: string }) => deleteChatMessage(roomId, messageId),
    onSuccess: () => {
      setActiveMsgMenuId(null);
      queryClient.invalidateQueries({ queryKey: ["chat-room", roomId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      toast.success("Message deleted");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
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
            {typingName ? `${typingName} is typing…` : `${participants.length} members`}
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
            const isDeleted = msg.isDeleted === true;
            const text = msg.text ?? "";
            const postShare = !isDeleted ? parsePostShareMessage(text) : null;
            const journeyShare = !isDeleted && !postShare ? parseJourneyShareMessage(text) : null;
            const hasAttachments = !isDeleted && (msg.attachments?.length ?? 0) > 0;
            const tightPadding = !!postShare || !!journeyShare || hasAttachments;
            const timeStr = messageTime(msg);
            const status = isMe ? getGroupMessageReceiptStatus(msg, otherParticipantIds) : "sent";
            return (
              <div
                key={msg._id}
                className={`group relative flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                {isMe && !isDeleted && (
                  <div className="relative mr-1.5 self-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      aria-label="Message options"
                      onClick={() => setActiveMsgMenuId((prev) => (prev === msg._id ? null : msg._id))}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {activeMsgMenuId === msg._id && (
                      <div className="absolute right-0 bottom-full z-30 mb-1 min-w-[120px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                        {text && (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            onClick={() => {
                              setEditingMessage(msg);
                              setActiveMsgMenuId(null);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          onClick={async () => {
                            setActiveMsgMenuId(null);
                            const ok = await confirm({
                              title: "Delete Message",
                              description: "Are you sure you want to delete this message?",
                              confirmText: "Delete",
                              variant: "destructive",
                            });
                            if (ok) {
                              deleteMsgMutation.mutate({ messageId: msg._id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
                    isDeleted
                      ? "border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-500"
                      : tightPadding
                        ? isMe
                          ? "bg-primary text-on-primary"
                          : "bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : isMe
                          ? "bg-primary px-4 py-2.5 text-on-primary"
                          : "bg-slate-100 px-4 py-2.5 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  {!isMe && senderName && !isDeleted && (
                    <p className="mb-0.5 text-xs font-semibold text-primary">{senderName}</p>
                  )}
                  {isDeleted ? (
                    <p className="italic text-xs">This message was deleted</p>
                  ) : postShare ? (
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
                  {(timeStr || (isMe && !isDeleted)) && (
                    <div
                      className={`mt-1.5 flex items-center justify-end gap-1 px-1 text-xs ${
                        isMe ? "text-white/80" : "text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {msg.isEdited && !isDeleted ? <span className="text-[10px] opacity-75">(edited)</span> : null}
                      {timeStr ? (
                        <span>
                          {new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                      {isMe && !isDeleted ? <MessageStatusTicks status={status} /> : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {typingName ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3.5 py-2 text-xs text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-zinc-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-zinc-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-zinc-500" />
              <span className="ml-1 text-[11px] font-medium">{typingName} is typing…</span>
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {editingMessage ? (
        <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300">
          <div className="flex items-center gap-2 truncate">
            <Edit2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">
              Editing: <span className="font-medium">{editingMessage.text}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditingMessage(null)}
            className="ml-2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Input */}
      <ChatComposer
        onSend={(text, files) => sendMutation.mutateAsync({ text, files })}
        isSending={sendMutation.isPending}
        onTyping={() => emitSocket("typing", { roomId })}
        onStopTyping={() => emitSocket("typing:stop", { roomId })}
        initialText={editingMessage?.text ?? ""}
        editing={!!editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        placeholder={editingMessage ? "Edit message…" : undefined}
      />
    </div>
  );
}

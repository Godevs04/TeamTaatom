"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getChat,
  getChatMessages,
  sendChatMessage,
  uploadChatMedia,
  editChatMessage,
  deleteChatMessage,
  markChatMessagesSeen,
  getProfile,
  clearChat,
  toggleChatMute,
  getChatMuteStatus,
  blockUser,
  getBlockStatus,
} from "../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../lib/auth-errors";
import { useAuth } from "../../../../context/auth-context";
import type { ChatMessage, ChatParticipant } from "../../../../types/chat";
import { Button } from "../../../../components/ui/button";
import { ArrowLeft, User, MoreHorizontal, Trash2, Bell, BellOff, Ban, Check, CheckCheck, Edit2, X } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";
import { parsePostShareMessage, parseJourneyShareMessage } from "../../../../lib/post-share-chat";
import { PostShareCard } from "../../../../components/chat/post-share-card";
import { JourneyShareCard } from "../../../../components/chat/journey-share-card";
import { ChatComposer } from "../../../../components/chat/chat-composer";
import { MessageAttachments } from "../../../../components/chat/message-attachments";
import { subscribeSocket, unsubscribeSocket, emitSocket } from "../../../../lib/socket";
import { useConfirm } from "../../../../context/confirm-context";

/** Matches mobile's frontend/app/chat/thread.tsx: auto-clear 2s after the last received typing event. */
const TYPING_CLEAR_MS = 2500;

function normalizeSenderId(sender: ChatMessage["sender"]): string {
  if (typeof sender === "string") return sender;
  const o = sender as { _id?: string };
  return o?._id ?? "";
}

export default function ChatConversationPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const myId = me?._id ?? "";
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

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

  const muteQ = useQuery({
    queryKey: ["chat", userId, "mute-status"],
    queryFn: () => getChatMuteStatus(userId),
    enabled: !!userId && !!myId,
  });
  const isMuted = muteQ.data?.muted ?? false;

  // Shared cache key with profile-actions.tsx's block query — both surfaces
  // reflect the same block state instead of diverging.
  const blockQ = useQuery({
    queryKey: ["block-status", userId],
    queryFn: () => getBlockStatus(userId),
    enabled: !!userId && !!myId,
  });
  const isBlocked = blockQ.data?.isBlocked ?? false;

  React.useEffect(() => {
    if (!userId || !myId) return;
    markChatMessagesSeen(userId).catch(() => {});
  }, [userId, myId]);

  const chatId = chatData?.chat?._id;
  const [isTyping, setIsTyping] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(false);
  const typingClearTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingMessage, setEditingMessage] = React.useState<ChatMessage | null>(null);
  const [activeMsgMenuId, setActiveMsgMenuId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId || !myId) return;

    const onMessageNew = (payload: { chatId?: string; message?: ChatMessage }) => {
      if (!payload?.message || !chatId || payload.chatId !== chatId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat", userId, "messages"], (old) => {
        if (!old) return old;
        if (old.messages.some((m) => m._id === payload.message!._id)) return old;
        return { ...old, messages: [...old.messages, payload.message!] };
      });
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    };

    const onSeen = (payload: { from?: string; messageId?: string; messageIds?: string[] }) => {
      if (payload?.from !== userId) return;
      const ids = payload.messageIds ?? (payload.messageId ? [payload.messageId] : []);
      if (ids.length === 0) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat", userId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            ids.includes(m._id) ? { ...m, seen: true, status: "read" as const } : m
          ),
        };
      });
    };

    const onStatusChanged = (payload: { chatId?: string; messageIds?: string[]; status?: "sent" | "delivered" | "read" }) => {
      if (!payload?.messageIds || !payload.status) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat", userId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            payload.messageIds!.includes(m._id) ? { ...m, status: payload.status } : m
          ),
        };
      });
    };

    const onMessageEdited = (payload: { chatId?: string; messageId?: string; text?: string; isEdited?: boolean; editedAt?: string }) => {
      if (!payload?.messageId || !payload.text) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat", userId, "messages"], (old) => {
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
      if (!payload?.messageId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat", userId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m._id === payload.messageId ? { ...m, isDeleted: true, text: "", attachments: [] } : m
          ),
        };
      });
    };

    const onTyping = (payload: { from?: string }) => {
      if (payload?.from !== userId) return;
      setIsTyping(true);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
      typingClearTimeoutRef.current = setTimeout(() => setIsTyping(false), TYPING_CLEAR_MS);
    };

    const onTypingStop = (payload: { from?: string }) => {
      if (payload?.from !== userId) return;
      setIsTyping(false);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    };

    const onOnline = (payload: { userId?: string }) => {
      if (payload?.userId === userId) setIsOnline(true);
    };
    const onOffline = (payload: { userId?: string }) => {
      if (payload?.userId === userId) setIsOnline(false);
    };

    subscribeSocket("message:new", onMessageNew);
    subscribeSocket("seen", onSeen);
    subscribeSocket("message:status_changed", onStatusChanged);
    subscribeSocket("chat:message_edited", onMessageEdited);
    subscribeSocket("chat:message_deleted", onMessageDeleted);
    subscribeSocket("typing", onTyping);
    subscribeSocket("typing:stop", onTypingStop);
    subscribeSocket("user:online", onOnline);
    subscribeSocket("user:offline", onOffline);

    return () => {
      unsubscribeSocket("message:new", onMessageNew);
      unsubscribeSocket("seen", onSeen);
      unsubscribeSocket("message:status_changed", onStatusChanged);
      unsubscribeSocket("chat:message_edited", onMessageEdited);
      unsubscribeSocket("chat:message_deleted", onMessageDeleted);
      unsubscribeSocket("typing", onTyping);
      unsubscribeSocket("typing:stop", onTypingStop);
      unsubscribeSocket("user:online", onOnline);
      unsubscribeSocket("user:offline", onOffline);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    };
  }, [userId, myId, chatId, queryClient]);

  const seenEmittedForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!userId || !myId || !chatId) return;
    if (seenEmittedForRef.current === chatId) return;
    const unseen = (messagesData?.messages ?? []).filter(
      (m) => normalizeSenderId(m.sender) === userId && !m.seen
    );
    if (unseen.length === 0) return;
    seenEmittedForRef.current = chatId;
    for (const msg of unseen) {
      emitSocket("seen", { to: userId, messageId: msg._id, chatId });
    }
  }, [userId, myId, chatId, messagesData?.messages]);

  const sendMutation = useMutation({
    mutationFn: async ({ text, files }: { text: string; files: File[] }) => {
      if (editingMessage && chatId) {
        return editChatMessage(chatId, editingMessage._id, text);
      }
      const attachments = files.length > 0 ? (await uploadChatMedia(files)).attachments : undefined;
      return sendChatMessage(userId, text, attachments);
    },
    onSuccess: () => {
      setEditingMessage(null);
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "messages"] });
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  const editMsgMutation = useMutation({
    mutationFn: ({ messageId, text }: { messageId: string; text: string }) => {
      if (!chatId) throw new Error("Chat not found");
      return editChatMessage(chatId, messageId, text);
    },
    onSuccess: () => {
      setEditingMessage(null);
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "messages"] });
      toast.success("Message edited");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const deleteMsgMutation = useMutation({
    mutationFn: ({ messageId }: { messageId: string }) => {
      if (!chatId) throw new Error("Chat not found");
      return deleteChatMessage(chatId, messageId);
    },
    onSuccess: () => {
      setActiveMsgMenuId(null);
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      toast.success("Message deleted");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearChat(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      toast.success("Chat cleared");
      setMenuOpen(false);
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const muteMutation = useMutation({
    mutationFn: () => toggleChatMute(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "mute-status"] });
      toast.success(data.muted ? "Notifications muted" : "Notifications unmuted");
      setMenuOpen(false);
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockUser(userId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["block-status", userId] });
      queryClient.invalidateQueries({ queryKey: ["chat"] });
      toast.success(data.isBlocked ? "User blocked" : "User unblocked");
      setMenuOpen(false);
      if (data.isBlocked) router.push("/chat");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const handleClearClick = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: "Clear Chat History",
      description: "Are you sure you want to clear this entire chat history? This action cannot be undone.",
      confirmText: "Clear Chat",
      variant: "destructive",
    });
    if (ok) {
      clearMutation.mutate();
    }
  };

  const handleBlockClick = async () => {
    setMenuOpen(false);
    const action = isBlocked ? "Unblock" : "Block";
    const ok = await confirm({
      title: `${action} User`,
      description: isBlocked
        ? `Are you sure you want to unblock ${displayName}?`
        : `Are you sure you want to block ${displayName}? They will not be able to message you or see your profile.`,
      confirmText: action,
      variant: isBlocked ? "default" : "destructive",
    });
    if (ok) {
      blockMutation.mutate();
    }
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages?.length, isTyping]);

  const messages = messagesData?.messages ?? [];
  const otherUser = chatData?.chat?.participants?.find((p: ChatParticipant) => (p._id ?? "").toString() !== myId) || profileData?.profile;
  const displayName = otherUser?.fullName ?? otherUser?.username ?? "User";

  if (!myId) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">Sign in to chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-[calc(100vh-4rem)] max-w-4xl mx-auto rounded-none md:rounded-3xl border-0 md:border border-slate-200/80 bg-white shadow-none md:shadow-premium overflow-hidden dark:border-zinc-800/80 dark:bg-zinc-900/90">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 p-3 sm:p-4 dark:border-zinc-800">
        <Button variant="ghost" size="icon" className="rounded-xl shrink-0" asChild>
          <Link href="/chat">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="relative">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
            {otherUser?.profilePic ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={otherUser.profilePic} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
                <User className="h-5 w-5" />
              </div>
            )}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-slate-900 dark:text-zinc-50">
            {displayName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isTyping ? "typing…" : `@${otherUser?.username ?? "user"}`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="hidden sm:inline-flex rounded-xl" asChild>
          <Link href={`/profile/${userId}`}>Profile</Link>
        </Button>
        <div className="relative" ref={menuRef}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <Link
                href={`/profile/${userId}`}
                className="flex sm:hidden w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4" />
                View Profile
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={handleClearClick}
                disabled={clearMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Clear chat
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => muteMutation.mutate()}
                disabled={muteMutation.isPending}
              >
                {isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                {isMuted ? "Unmute notifications" : "Mute notifications"}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={handleBlockClick}
                disabled={blockMutation.isPending}
              >
                <Ban className="h-4 w-4" />
                {isBlocked ? "Unblock user" : "Block user"}
              </button>
            </div>
          )}
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
            <p className="text-sm text-slate-500 dark:text-zinc-400">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = normalizeSenderId(msg.sender) === myId;
            const text = msg.text ?? "";
            const postShare = !msg.isDeleted ? parsePostShareMessage(text) : null;
            const journeyShare = !msg.isDeleted && !postShare ? parseJourneyShareMessage(text) : null;
            const hasAttachments = !msg.isDeleted && (msg.attachments?.length ?? 0) > 0;
            const tightPadding = !!postShare || !!journeyShare || hasAttachments;
            const isDeleted = msg.isDeleted === true;
            const status = msg.status ?? (msg.seen ? "read" : "sent");

            return (
              <div
                key={msg._id}
                className={`group relative flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                {/* Actions Trigger for own active messages */}
                {isMe && !isDeleted && (
                  <div className="relative mr-1.5 self-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                  {msg.createdAt && (
                    <div
                      className={`mt-1.5 flex items-center justify-end gap-1 px-1 text-xs ${
                        isMe ? "text-white/80" : "text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {msg.isEdited && !isDeleted ? <span className="text-[10px] opacity-75">(edited)</span> : null}
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isMe && !isDeleted && (
                        <span className="inline-flex items-center ml-0.5" title={`Message ${status}`} aria-label={`Message ${status}`}>
                          {status === "read" ? (
                            <CheckCheck className="h-3.5 w-3.5 text-sky-200" />
                          ) : status === "delivered" ? (
                            <CheckCheck className="h-3.5 w-3.5 text-white/70" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-white/70" />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Live typing indicator bubble */}
        {isTyping ? (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3.5 py-2 text-xs text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-zinc-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-zinc-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 dark:bg-zinc-500" />
              <span className="ml-1 text-[11px] font-medium">{displayName} is typing…</span>
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {/* Edit banner when editing message */}
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
        isSending={sendMutation.isPending || editMsgMutation.isPending}
        onTyping={() => emitSocket("typing", { to: userId })}
        onStopTyping={() => emitSocket("typing:stop", { to: userId })}
        disabled={isBlocked}
        initialText={editingMessage?.text ?? ""}
        editing={!!editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        placeholder={isBlocked ? "You've blocked this user" : editingMessage ? "Edit message…" : undefined}
      />
    </div>
  );
}

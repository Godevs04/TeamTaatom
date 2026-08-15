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
import { ArrowLeft, User, MoreHorizontal, Trash2, Bell, BellOff, Ban } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";
import { parsePostShareMessage, parseJourneyShareMessage } from "../../../../lib/post-share-chat";
import { PostShareCard } from "../../../../components/chat/post-share-card";
import { JourneyShareCard } from "../../../../components/chat/journey-share-card";
import { ChatComposer } from "../../../../components/chat/chat-composer";
import { MessageAttachments } from "../../../../components/chat/message-attachments";
import { subscribeSocket, unsubscribeSocket, emitSocket } from "../../../../lib/socket";

/** Matches mobile's frontend/app/chat/thread.tsx: auto-clear 2s after the last received typing event. */
const TYPING_CLEAR_MS = 2000;

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

  // Live message delivery + typing + seen receipts + presence. Sending itself is
  // unchanged (still the REST call below) — sendChatMessage already makes the
  // backend emit message:new/message:sent/chat:update server-side, so this effect
  // only needs to subscribe, not change how sends work.
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

    const onSeen = (payload: { from?: string; messageId?: string }) => {
      if (payload?.from !== userId || !payload.messageId) return;
      queryClient.setQueryData<{ messages: ChatMessage[] }>(["chat", userId, "messages"], (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) => (m._id === payload.messageId ? { ...m, seen: true } : m)),
        };
      });
    };

    const onTyping = (payload: { from?: string }) => {
      if (payload?.from !== userId) return;
      setIsTyping(true);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
      typingClearTimeoutRef.current = setTimeout(() => setIsTyping(false), TYPING_CLEAR_MS);
    };

    const onOnline = (payload: { userId?: string }) => {
      if (payload?.userId === userId) setIsOnline(true);
    };
    const onOffline = (payload: { userId?: string }) => {
      if (payload?.userId === userId) setIsOnline(false);
    };

    subscribeSocket("message:new", onMessageNew);
    subscribeSocket("seen", onSeen);
    subscribeSocket("typing", onTyping);
    subscribeSocket("user:online", onOnline);
    subscribeSocket("user:offline", onOffline);

    return () => {
      unsubscribeSocket("message:new", onMessageNew);
      unsubscribeSocket("seen", onSeen);
      unsubscribeSocket("typing", onTyping);
      unsubscribeSocket("user:online", onOnline);
      unsubscribeSocket("user:offline", onOffline);
      if (typingClearTimeoutRef.current) clearTimeout(typingClearTimeoutRef.current);
    };
  }, [userId, myId, chatId, queryClient]);

  // Emit the socket 'seen' receipt alongside the durable REST markChatMessagesSeen
  // call above (mobile's pattern), not instead of it — one emit per currently-
  // unseen message from the other user, guarded so it only runs once per thread.
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
      // Two-step: upload attachments first, then send the message referencing them.
      const attachments = files.length > 0 ? (await uploadChatMedia(files)).attachments : undefined;
      return sendChatMessage(userId, text, attachments);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      queryClient.invalidateQueries({ queryKey: ["chat", userId, "messages"] });
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
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
      // Staying in a thread with someone you just blocked doesn't make sense.
      if (data.isBlocked) router.push("/chat");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const handleClearClick = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all messages in this chat? This action cannot be undone."
      )
    ) {
      clearMutation.mutate();
    }
  };

  const handleBlockClick = () => {
    const name = displayName;
    const msg = isBlocked
      ? `Unblock ${name}? You will be able to message and interact again.`
      : `Block ${name}? They won't be able to message you or see your profile.`;
    if (window.confirm(msg)) {
      blockMutation.mutate();
    }
  };

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages?.length]);

  const otherUser = profileData?.profile ?? chatData?.chat?.participants?.find((p: ChatParticipant) => (p._id ?? "") === userId);
  const displayName = otherUser?.fullName ?? otherUser?.username ?? "User";
  const messages: ChatMessage[] = messagesData?.messages ?? [];

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
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
          {otherUser?.profilePic ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={otherUser.profilePic} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
              <User className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-semibold text-slate-900 dark:text-zinc-50">{displayName}</h1>
            {isOnline && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                title="Online"
                aria-label="Online"
              />
            )}
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-zinc-400">
            {isTyping ? "typing…" : `@${otherUser?.username ?? "user"}`}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
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
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
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
            const postShare = parsePostShareMessage(text);
            const journeyShare = !postShare ? parseJourneyShareMessage(text) : null;
            const hasAttachments = (msg.attachments?.length ?? 0) > 0;
            const tightPadding = !!postShare || !!journeyShare || hasAttachments;
            return (
              <div
                key={msg._id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
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
                  {msg.createdAt && (
                    <p className={`mt-1.5 px-1 text-xs ${isMe ? "text-white/80" : "text-slate-500 dark:text-zinc-400"}`}>
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
      <ChatComposer
        onSend={(text, files) => sendMutation.mutateAsync({ text, files })}
        isSending={sendMutation.isPending}
        onTyping={() => emitSocket("typing", { to: userId })}
        disabled={isBlocked}
        placeholder={isBlocked ? "You've blocked this user" : undefined}
      />
    </div>
  );
}

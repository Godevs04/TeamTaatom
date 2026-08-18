"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteChatRoom, listChats } from "../../../lib/api";
import { formatChatMessagePreview } from "../../../lib/post-share-chat";
import { getFriendlyErrorMessage } from "../../../lib/auth-errors";
import { useAuth } from "../../../context/auth-context";
import { subscribeSocket, unsubscribeSocket } from "../../../lib/socket";
import type { Chat, ChatParticipant, ConnectPageRef } from "../../../types/chat";
import { MessageCircle, Trash2, User, Users } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";
import { toast } from "sonner";

import { useConfirm } from "../../../context/confirm-context";

/** Shared link chrome inside chat row card. */
const ROW_LINK_CLASS = "flex min-w-0 flex-1 items-center gap-4 p-4";

function DeleteChatButton({
  chatName,
  disabled,
  onConfirm,
}: {
  chatName: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Delete chat with ${chatName}`}
      title="Delete chat"
      className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
      onClick={async () => {
        const ok = await confirm({
          title: "Delete Conversation",
          description: `Are you sure you want to delete the chat with "${chatName}"? This action cannot be undone.`,
          confirmText: "Delete",
          variant: "destructive",
        });
        if (ok) {
          onConfirm();
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function getOtherParticipant(chat: Chat, myId: string): ChatParticipant | undefined {
  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  return participants.find((p) => (p._id ?? (p as unknown as { _id?: string })._id) !== myId);
}

function formatTime(str: string | undefined): string {
  if (!str) return "";
  try {
    const d = new Date(str);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function ChatListPage() {
  const { user } = useAuth();
  const myId = user?._id ?? "";
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["chat", "list"],
    queryFn: listChats,
    enabled: !!myId,
  });

  // Live-update the list on any new message, seen receipt, or unread count update
  React.useEffect(() => {
    if (!myId) return;
    const onChatUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
    };
    const onUnreadUpdate = (data?: { chatId?: string; unreadCount?: number }) => {
      if (data?.chatId && typeof data.unreadCount === "number") {
        queryClient.setQueryData<{ chats: Chat[] }>(["chat", "list"], (old) => {
          if (!old?.chats) return old;
          return {
            ...old,
            chats: old.chats.map((c) => (c._id === data.chatId ? { ...c, unreadCount: data.unreadCount } : c)),
          };
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["chat", "list"] });
      }
    };

    subscribeSocket("chat:update", onChatUpdate);
    subscribeSocket("message:new", onChatUpdate);
    subscribeSocket("chat:seen", onChatUpdate);
    subscribeSocket("chat:cleared", onChatUpdate);
    subscribeSocket("chat:unread_count_updated", onUnreadUpdate);

    return () => {
      unsubscribeSocket("chat:update", onChatUpdate);
      unsubscribeSocket("message:new", onChatUpdate);
      unsubscribeSocket("chat:seen", onChatUpdate);
      unsubscribeSocket("chat:cleared", onChatUpdate);
      unsubscribeSocket("chat:unread_count_updated", onUnreadUpdate);
    };
  }, [myId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: ({ chatId }: { chatId: string; conversationKey: unknown[] }) =>
      deleteChatRoom(chatId),
    onSuccess: (_res, { chatId, conversationKey }) => {
      // Patch the list for instant removal, mirroring mobile's local filter.
      queryClient.setQueryData<{ chats: Chat[] }>(["chat", "list"], (old) =>
        old ? { ...old, chats: old.chats.filter((c) => c._id !== chatId) } : old
      );
      // Drop the conversation's own cache too, so navigating back to that thread
      // refetches (and 404s) instead of rendering a stale copy of a deleted chat.
      queryClient.removeQueries({ queryKey: conversationKey });
      toast.success("Chat deleted");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const chats = data?.chats ?? [];

  if (!myId) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">Sign in to view conversations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 md:text-3xl">Chat</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Your conversations</p>
      </header>

      {isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90"
            >
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-slate-600 dark:text-zinc-400">Failed to load conversations.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-95"
          >
            Try again
          </button>
        </div>
      ) : chats.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
            <MessageCircle className="h-8 w-8 text-slate-400 dark:text-zinc-500" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-zinc-50">No conversations yet</h3>
          <p className="mt-2 text-[15px] text-slate-500 dark:text-zinc-400">Start a chat from a user&apos;s profile.</p>
          <Link
            href="/search"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 hover:opacity-95"
          >
            Find people
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const lastMsg = chat.lastMessage ?? chat.messages?.[chat.messages.length - 1];
            const attachmentHint = lastMsg?.attachments?.[0];
            const attachmentPreview =
              attachmentHint?.type === "image"
                ? "Photo"
                : attachmentHint?.type === "video"
                  ? "Video"
                  : attachmentHint?.fileName || (attachmentHint ? "Attachment" : "");
            const rawPreview = lastMsg?.isDeleted
              ? "This message was deleted"
              : lastMsg?.text
                ? lastMsg.text
                : attachmentPreview || "No messages yet";
            const preview = rawPreview === "No messages yet" ? rawPreview : formatChatMessagePreview(rawPreview);
            const time = formatTime(lastMsg?.timestamp ?? lastMsg?.createdAt ?? chat.updatedAt);
            const unreadCount = chat.unreadCount ?? 0;
            const isUnread = unreadCount > 0;

            const cardClass = `flex items-center gap-1 rounded-2xl border transition-all duration-200 pr-2 shadow-premium hover:shadow-premium-hover ${
              isUnread
                ? "border-primary/40 bg-primary/[0.03] dark:border-primary/30 dark:bg-primary/[0.06] ring-1 ring-primary/20"
                : "border-slate-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/90"
            }`;

            // Connect page group chats
            if (chat.type === "connect_page") {
              const cpRef =
                chat.connectPageId && typeof chat.connectPageId === "object"
                  ? (chat.connectPageId as ConnectPageRef)
                  : null;
              const groupName = cpRef?.name ?? "Group Chat";
              const groupImage = cpRef?.profileImage;
              return (
                <div key={chat._id} className={cardClass}>
                  <Link href={`/chat/room/${chat._id}`} className={ROW_LINK_CLASS}>
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-primary/10 ring-1 ring-slate-200/80 dark:bg-primary/20 dark:ring-zinc-700/80 relative">
                      {groupImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={groupImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-primary">
                          <Users className="h-7 w-7" />
                        </div>
                      )}
                      {isUnread ? (
                        <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white dark:ring-zinc-900" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate text-[15px] ${
                            isUnread
                              ? "font-bold text-slate-900 dark:text-zinc-50"
                              : "font-semibold text-slate-900 dark:text-zinc-50"
                          }`}
                        >
                          {groupName}
                        </span>
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Connect
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-zinc-500">
                        {(cpRef?.followerCount ?? 0) + 1} members
                      </div>
                      <div
                        className={`truncate text-sm ${
                          isUnread
                            ? "font-medium text-slate-900 dark:text-zinc-100"
                            : "text-slate-500 dark:text-zinc-400"
                        }`}
                      >
                        {preview}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {time ? (
                        <span
                          className={`text-xs ${
                            isUnread ? "font-semibold text-primary" : "text-slate-400 dark:text-zinc-500"
                          }`}
                        >
                          {time}
                        </span>
                      ) : null}
                      {unreadCount > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary shadow-sm animate-in zoom-in-50 duration-200">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                  <DeleteChatButton
                    chatName={groupName}
                    disabled={deleteMutation.isPending}
                    onConfirm={() =>
                      deleteMutation.mutate({
                        chatId: chat._id,
                        conversationKey: ["chat-room", chat._id],
                      })
                    }
                  />
                </div>
              );
            }

            // Regular 1-on-1 chats
            const other = getOtherParticipant(chat, myId);
            if (!other) return null;
            const otherId = other._id ?? (other as unknown as { _id?: string })._id ?? "";
            const otherName = other.fullName ?? other.username ?? "User";
            return (
              <div key={chat._id} className={cardClass}>
                <Link href={`/chat/${otherId}`} className={ROW_LINK_CLASS}>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80 relative">
                    {other.profilePic ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={other.profilePic} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
                        <User className="h-7 w-7" />
                      </div>
                    )}
                    {isUnread ? (
                      <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white dark:ring-zinc-900" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-[15px] ${
                        isUnread
                          ? "font-bold text-slate-900 dark:text-zinc-50"
                          : "font-semibold text-slate-900 dark:text-zinc-50"
                      }`}
                    >
                      {otherName}
                    </div>
                    <div
                      className={`truncate text-sm ${
                        isUnread
                          ? "font-medium text-slate-900 dark:text-zinc-100"
                          : "text-slate-500 dark:text-zinc-400"
                      }`}
                    >
                      {preview}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {time ? (
                      <span
                        className={`text-xs ${
                          isUnread ? "font-semibold text-primary" : "text-slate-400 dark:text-zinc-500"
                        }`}
                      >
                        {time}
                      </span>
                    ) : null}
                    {unreadCount > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary shadow-sm animate-in zoom-in-50 duration-200">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </div>
                </Link>
                <DeleteChatButton
                  chatName={otherName}
                  disabled={deleteMutation.isPending}
                  onConfirm={() =>
                    deleteMutation.mutate({
                      chatId: chat._id,
                      conversationKey: ["chat", otherId],
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

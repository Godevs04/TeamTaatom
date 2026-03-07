"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listChats } from "../../../lib/api";
import { useAuth } from "../../../context/auth-context";
import type { Chat, ChatParticipant } from "../../../types/chat";
import { MessageCircle, User } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";

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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["chat", "list"],
    queryFn: listChats,
    enabled: !!myId,
  });

  const chats = data?.chats ?? [];

  if (!myId) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
        <p className="text-slate-600">Sign in to view conversations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Chat</h1>
        <p className="mt-1 text-sm text-slate-500">Your conversations</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
          <p className="text-slate-600">Failed to load conversations.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Try again
          </button>
        </div>
      ) : chats.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-premium">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <MessageCircle className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900">No conversations yet</h3>
          <p className="mt-2 text-[15px] text-slate-500">Start a chat from a user&apos;s profile.</p>
          <Link
            href="/search"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-95"
          >
            Find people
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const other = getOtherParticipant(chat, myId);
            const lastMsg = chat.lastMessage ?? chat.messages?.[chat.messages.length - 1];
            const preview = lastMsg?.text ?? "No messages yet";
            const time = formatTime(lastMsg?.timestamp ?? lastMsg?.createdAt ?? chat.updatedAt);
            if (!other) return null;
            const otherId = other._id ?? (other as unknown as { _id?: string })._id ?? "";
            return (
              <Link
                key={chat._id}
                href={`/chat/${otherId}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium transition-shadow hover:shadow-premium-hover"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
                  {other.profilePic ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={other.profilePic} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-slate-900">
                    {other.fullName ?? other.username ?? "User"}
                  </div>
                  <div className="truncate text-sm text-slate-500">{preview}</div>
                </div>
                {time ? <span className="shrink-0 text-xs text-slate-400">{time}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

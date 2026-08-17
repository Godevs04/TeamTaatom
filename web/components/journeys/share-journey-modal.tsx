"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Share2,
  Link2,
  MessageCircle,
  Loader2,
  ArrowLeft,
  Search,
  Navigation,
} from "lucide-react";
import type { Journey } from "../../types/journey";
import type { User } from "../../types/user";
import type { Chat, ConnectPageRef } from "../../types/chat";
import {
  createJourneyShortUrl,
  getSuggestedUsers,
  listChats,
  searchUsers,
  sendChatMessage,
  sendRoomMessage,
} from "../../lib/api";
import {
  buildJourneyShareChatMessage,
  getDefaultJourneyShareUrl,
} from "../../lib/post-share-chat";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type ShareJourneyModalProps = {
  open: boolean;
  onClose: () => void;
  journey: Journey;
  currentUserId?: string;
};

export function ShareJourneyModal({ open, onClose, journey, currentUserId }: ShareJourneyModalProps) {
  const qc = useQueryClient();
  const [phase, setPhase] = React.useState<"main" | "chat">("main");
  const [shareUrl, setShareUrl] = React.useState("");
  const [urlLoading, setUrlLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  React.useEffect(() => {
    if (!open) {
      setPhase("main");
      setShareUrl("");
      setSearchQuery("");
      setDebouncedSearch("");
      setUrlLoading(false);
      return;
    }
    const fallback = getDefaultJourneyShareUrl(journey._id);
    setShareUrl(fallback);
    setUrlLoading(true);
    createJourneyShortUrl(journey._id)
      .then((short) => {
        if (short) setShareUrl(short);
      })
      .catch(() => {})
      .finally(() => setUrlLoading(false));
  }, [open, journey._id]);

  const displayUrl = shareUrl || getDefaultJourneyShareUrl(journey._id);
  const title = journey.title || "Journey";
  const shareText = `${title}\n\n${displayUrl}`;

  const suggestedQuery = useQuery({
    queryKey: ["suggested-users", "share-journey-modal"],
    queryFn: () => getSuggestedUsers(40),
    enabled: open && phase === "chat",
  });

  const searchQueryResult = useQuery({
    queryKey: ["profile-search", debouncedSearch, "share-journey-modal"],
    queryFn: () => searchUsers(debouncedSearch, 30),
    enabled: open && phase === "chat" && debouncedSearch.length >= 2,
  });

  const chatsQuery = useQuery({
    queryKey: ["chat", "list"],
    queryFn: listChats,
    enabled: open && phase === "chat",
  });

  const groupChats: Chat[] = React.useMemo(
    () => (chatsQuery.data?.chats ?? []).filter((c) => c.type === "connect_page"),
    [chatsQuery.data?.chats]
  );

  const listUsers: User[] = React.useMemo(() => {
    if (debouncedSearch.length >= 2) {
      return searchQueryResult.data?.users ?? [];
    }
    return suggestedQuery.data?.users ?? [];
  }, [debouncedSearch.length, searchQueryResult.data?.users, suggestedQuery.data?.users]);

  const visibleUsers = React.useMemo(
    () =>
      listUsers.filter((u) => {
        if (!currentUserId) return true;
        return u._id !== currentUserId;
      }),
    [listUsers, currentUserId]
  );

  const listLoading =
    phase === "chat" && (debouncedSearch.length >= 2 ? searchQueryResult.isLoading : suggestedQuery.isLoading);

  const sendMutation = useMutation({
    mutationFn: (target: { kind: "user" | "room"; id: string }) => {
      const text = buildJourneyShareChatMessage(journey, displayUrl);
      return target.kind === "room" ? sendRoomMessage(target.id, text) : sendChatMessage(target.id, text);
    },
    onSuccess: () => {
      toast.success("Journey sent in chat");
      void qc.invalidateQueries({ queryKey: ["chat"] });
      onClose();
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const systemShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: title.slice(0, 80),
          text: shareText,
          url: displayUrl,
        });
        onClose();
        return;
      } catch (e: unknown) {
        const err = e as { name?: string };
        // User dismissed the sheet — not a share, and no fallback copy either.
        if (err?.name === "AbortError") return;
      }
    }
    await copyLink();
  };

  const openFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(displayUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
    onClose();
  };

  const openTwitter = () => {
    const text = encodeURIComponent(title.slice(0, 200));
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(displayUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-h-[85vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-journey-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800 sm:px-5">
          {phase === "chat" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-xl"
              onClick={() => setPhase("main")}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <span className="w-10" />
          )}
          <h2 id="share-journey-title" className="text-lg font-bold text-slate-900 dark:text-zinc-50">
            {phase === "chat" ? "Send to chat" : "Share journey"}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {phase === "main" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="flex gap-3 p-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Navigation className="h-9 w-9 text-emerald-500" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{title}</p>
                  {typeof journey.distanceTraveled === "number" ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-zinc-400">
                      {journey.distanceTraveled >= 1000
                        ? `${(journey.distanceTraveled / 1000).toFixed(1)} km`
                        : `${Math.round(journey.distanceTraveled)} m`}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    <p className="truncate text-xs font-medium text-primary">{displayUrl}</p>
                    {urlLoading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" aria-hidden /> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => void systemShare()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
              >
                <Share2 className="h-7 w-7 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-zinc-200">Share</span>
              </button>
              <button
                type="button"
                onClick={openFacebook}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
              >
                <span className="text-2xl leading-none" aria-hidden>
                  f
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-zinc-200">Facebook</span>
              </button>
              <button
                type="button"
                onClick={openTwitter}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
              >
                <span className="text-xl font-bold leading-none text-slate-800 dark:text-zinc-200" aria-hidden>
                  𝕏
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-zinc-200">Twitter</span>
              </button>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
              >
                <Link2 className="h-7 w-7 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-zinc-200">Copy link</span>
              </button>
              <button
                type="button"
                onClick={() => setPhase("chat")}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
              >
                <MessageCircle className="h-7 w-7 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-zinc-200">Send to chat</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-100 p-3 dark:border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" aria-hidden />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users…"
                  className="rounded-xl border-slate-200 pl-10 dark:border-zinc-700 dark:bg-zinc-800/60"
                />
              </div>
              {debouncedSearch.length > 0 && debouncedSearch.length < 2 ? (
                <p className="mt-2 text-center text-xs text-slate-500 dark:text-zinc-400">Type at least 2 characters to search</p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : visibleUsers.length === 0 && (debouncedSearch.length >= 2 || groupChats.length === 0) ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">No chats found</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {debouncedSearch.length < 2
                    ? groupChats.map((chat) => {
                        const cpRef =
                          chat.connectPageId && typeof chat.connectPageId === "object"
                            ? (chat.connectPageId as ConnectPageRef)
                            : null;
                        const groupName = cpRef?.name ?? "Group Chat";
                        return (
                          <li key={chat._id}>
                            <button
                              type="button"
                              disabled={sendMutation.isPending}
                              onClick={() => sendMutation.mutate({ kind: "room", id: chat._id })}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-zinc-800/80"
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                                {cpRef?.profileImage ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={cpRef.profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  groupName.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900 dark:text-zinc-50">{groupName}</p>
                                <p className="truncate text-xs text-slate-500 dark:text-zinc-400">Group</p>
                              </div>
                              {sendMutation.isPending ? (
                                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                              ) : null}
                            </button>
                          </li>
                        );
                      })
                    : null}
                  {visibleUsers.map((u) => (
                    <li key={u._id}>
                      <button
                        type="button"
                        disabled={sendMutation.isPending}
                        onClick={() => sendMutation.mutate({ kind: "user", id: u._id })}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-zinc-800/80"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                          {u.profilePic ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={u.profilePic} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400 dark:text-zinc-500">
                              {(u.fullName || u.username || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900 dark:text-zinc-50">{u.fullName || u.username || "User"}</p>
                          {u.username ? (
                            <p className="truncate text-xs text-slate-500 dark:text-zinc-400">@{u.username}</p>
                          ) : null}
                        </div>
                        {sendMutation.isPending ? (
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {phase === "main" ? (
          <div className="shrink-0 border-t border-slate-100 p-3 dark:border-zinc-800">
            <Button type="button" variant="outline" className="w-full rounded-xl" onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

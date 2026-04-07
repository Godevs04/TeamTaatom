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
} from "lucide-react";
import type { Post } from "../../types/post";
import type { User } from "../../types/user";
import {
  createPostShortUrl,
  getSuggestedUsers,
  searchUsers,
  sendChatMessage,
} from "../../lib/api";
import {
  buildPostShareChatMessage,
  getDefaultTripShareUrl,
} from "../../lib/post-share-chat";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type SharePostModalProps = {
  open: boolean;
  onClose: () => void;
  post: Post;
  currentUserId?: string;
};

function previewImageUrl(post: Post): string {
  return (
    post.imageUrl ||
    (Array.isArray(post.images) && post.images[0]) ||
    post.thumbnailUrl ||
    post.mediaUrl ||
    ""
  );
}

export function SharePostModal({ open, onClose, post, currentUserId }: SharePostModalProps) {
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
    const fallback = getDefaultTripShareUrl(post._id);
    setShareUrl(fallback);
    setUrlLoading(true);
    createPostShortUrl(post._id)
      .then((short) => {
        if (short) setShareUrl(short);
      })
      .catch(() => {})
      .finally(() => setUrlLoading(false));
  }, [open, post._id]);

  const displayUrl = shareUrl || getDefaultTripShareUrl(post._id);
  const shareText = post.caption ? `${post.caption}\n\n${displayUrl}` : displayUrl;
  const img = previewImageUrl(post);
  const author = post.user?.fullName || post.user?.username || "Traveler";

  const suggestedQuery = useQuery({
    queryKey: ["suggested-users", "share-modal"],
    queryFn: () => getSuggestedUsers(40),
    enabled: open && phase === "chat",
  });

  const searchQueryResult = useQuery({
    queryKey: ["profile-search", debouncedSearch, "share-modal"],
    queryFn: () => searchUsers(debouncedSearch, 30),
    enabled: open && phase === "chat" && debouncedSearch.length >= 2,
  });

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
    mutationFn: (userId: string) =>
      sendChatMessage(userId, buildPostShareChatMessage(post, displayUrl)),
    onSuccess: () => {
      toast.success("Post sent in chat");
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
          title: post.caption ? post.caption.slice(0, 80) : "Shared post on Taatom",
          text: shareText,
          url: displayUrl,
        });
        onClose();
        return;
      } catch (e: unknown) {
        const err = e as { name?: string };
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
    const text = post.caption ? encodeURIComponent(post.caption.slice(0, 200)) : "";
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
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-post-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
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
          <h2 id="share-post-title" className="text-lg font-bold text-slate-900">
            {phase === "chat" ? "Send to chat" : "Share post"}
          </h2>
          <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {phase === "main" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex gap-3 p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                  {img ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No preview</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{author}</p>
                  {post.caption ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{post.caption}</p>
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
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100"
              >
                <Share2 className="h-7 w-7 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-slate-800">Share</span>
              </button>
              <button
                type="button"
                onClick={openFacebook}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100"
              >
                <span className="text-2xl leading-none" aria-hidden>
                  f
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-800">Facebook</span>
              </button>
              <button
                type="button"
                onClick={openTwitter}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100"
              >
                <span className="text-xl font-bold leading-none text-slate-800" aria-hidden>
                  𝕏
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-800">Twitter</span>
              </button>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100"
              >
                <Link2 className="h-7 w-7 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-slate-800">Copy link</span>
              </button>
              <button
                type="button"
                onClick={() => setPhase("chat")}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-4 text-center transition-colors hover:bg-slate-100"
              >
                <MessageCircle className="h-7 w-7 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-slate-800">Send to chat</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-100 p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users…"
                  className="rounded-xl border-slate-200 pl-10"
                />
              </div>
              {debouncedSearch.length > 0 && debouncedSearch.length < 2 ? (
                <p className="mt-2 text-center text-xs text-slate-500">Type at least 2 characters to search</p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {listLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : visibleUsers.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">No users found</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visibleUsers.map((u) => (
                    <li key={u._id}>
                      <button
                        type="button"
                        disabled={sendMutation.isPending}
                        onClick={() => sendMutation.mutate(u._id)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
                      >
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100">
                          {u.profilePic ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={u.profilePic} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                              {(u.fullName || u.username || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">{u.fullName || u.username || "User"}</p>
                          {u.username ? (
                            <p className="truncate text-xs text-slate-500">@{u.username}</p>
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
          <div className="shrink-0 border-t border-slate-100 p-3">
            <Button type="button" variant="outline" className="w-full rounded-xl" onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { getPostLikers } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../../lib/utils";
import { subscribeSocket, unsubscribeSocket } from "../../lib/socket";

type PostLikeUpdate = { postId?: string; likesCount?: number };

/** Mobile loads a single large page rather than paginating this list; match that. */
const LIKERS_PAGE_SIZE = 100;

export function PostLikersModal({
  open,
  postId,
  onClose,
}: {
  open: boolean;
  postId: string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["post-likers", postId],
    queryFn: () => getPostLikers(postId, 1, LIKERS_PAGE_SIZE),
    enabled: open,
  });

  if (!open) return null;

  const likers = q.data?.likers ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Likes"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Likes</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {q.isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <div className="py-12 text-center text-sm text-destructive">
              {getFriendlyErrorMessage(q.error)}
            </div>
          ) : likers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Heart className="mb-3 h-12 w-12 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No likes yet</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {likers.map((u) => (
                <li key={u._id}>
                  <Link
                    href={`/profile/${u._id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/80"
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      {u.profilePic ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={u.profilePic}
                          alt={u.fullName || u.username || "User"}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-violet-500/10">
                          <span className="text-sm font-semibold text-primary/70">
                            {(u.fullName || u.username || "U").trim().charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">
                        {u.fullName || u.username || "User"}
                      </p>
                      {u.username && (
                        <p className="truncate text-xs text-slate-500 dark:text-zinc-400">@{u.username}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the like count as a button that opens the likers list, mirroring mobile
 * where the count itself is the tap target. Falls back to plain text at zero likes.
 */
export function PostLikesCount({
  postId,
  likesCount,
  className,
  children,
  suffix,
  live = false,
}: {
  postId: string;
  likesCount: number;
  className?: string;
  children?: React.ReactNode;
  /** Text appended after the live count (e.g. " likes"). Ignored if `children` is passed. */
  suffix?: string;
  /**
   * Subscribe to `post:like:update` and keep the count live. Off by default:
   * this component is also used per-card on list/grid pages (post-card.tsx,
   * rendered many-at-once on the feed), and post:like:update is a global
   * broadcast for every like on every post app-wide -- turning every rendered
   * card into its own socket listener there would be exactly the feed-wide
   * live-patching effort that's a separate, bigger pass. Opt in only where a
   * live count is actually wanted (currently just the single-post detail page).
   */
  live?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState(likesCount);

  // Stay in sync with the prop (e.g. navigating between posts, or a parent
  // refetch bringing a fresh server-rendered value).
  React.useEffect(() => {
    setCount(likesCount);
  }, [likesCount]);

  React.useEffect(() => {
    if (!live) return;
    const onLikeUpdate = (payload: PostLikeUpdate) => {
      if (payload?.postId !== postId || typeof payload.likesCount !== "number") return;
      setCount(payload.likesCount);
    };
    subscribeSocket<PostLikeUpdate>("post:like:update", onLikeUpdate);
    return () => unsubscribeSocket<PostLikeUpdate>("post:like:update", onLikeUpdate);
  }, [live, postId]);

  const label = children ?? (suffix ? `${count}${suffix}` : count);

  if (count <= 0) {
    return <span className={className}>{label}</span>;
  }

  return (
    <>
      <button
        type="button"
        className={cn("hover:underline", className)}
        onClick={() => setOpen(true)}
        aria-label={`View who liked this post (${count})`}
      >
        {label}
      </button>
      <PostLikersModal open={open} postId={postId} onClose={() => setOpen(false)} />
    </>
  );
}

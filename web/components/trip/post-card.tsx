"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Archive, EyeOff, Trash2, Flag, X, Bookmark, FolderPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  toggleLike,
  deletePost,
  archivePost,
  hidePost,
  createReport,
  type ReportReason,
} from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { getPostDisplayLocation } from "../../lib/post-utils";
import type { Post } from "../../types/post";
import { Button } from "../ui/button";
import { cn, getLikedPostIds, setLikedPostIds, getSavedPostIds, setSavedPostIds } from "../../lib/utils";
import { toast } from "sonner";
import { useAuth } from "../../context/auth-context";
import { AddToCollectionModal } from "./AddToCollectionModal";
import { SharePostModal } from "./share-post-modal";
import { CaptionWithLinks } from "../caption-with-links";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "inappropriate_content", label: "Inappropriate Content" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
];

type FeedData = {
  pages: Array<{ posts: Post[]; pagination?: unknown }>;
  pageParams: unknown[];
};

type SavedPostsCache = { posts: Post[]; savedIds: string[] };

/** Feed uses `["feed", feedMode]`; updating only `["feed"]` never touched the real cache. */
function patchAllFeedQueries(
  qc: ReturnType<typeof useQueryClient>,
  updater: (old: FeedData | undefined) => FeedData | undefined
) {
  qc.setQueriesData<FeedData>({ queryKey: ["feed"] }, updater);
}

function patchSavedPostsForLike(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  mapPost: (p: Post) => Post
) {
  qc.setQueriesData<SavedPostsCache>({ queryKey: ["saved-posts"] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      posts: old.posts.map((p) => (p._id === postId ? mapPost(p) : p)),
    };
  });
}

export function PostCard({
  post,
  onPostRemoved,
  onOpenComments,
}: {
  post: Post;
  onPostRemoved?: () => void;
  onOpenComments?: (post: Post) => void;
}) {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  const removeFromFeed = () => {
    patchAllFeedQueries(qc, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.filter((p: Post) => p._id !== post._id),
        })),
      };
    });
    onPostRemoved?.();
  };

  const handleDelete = async () => {
    if (
      !window.confirm("Are you sure you want to delete this post? This action cannot be undone.")
    )
      return;
    setMenuLoading(true);
    setMenuOpen(false);
    try {
      await deletePost(post._id);
      toast.success("Post deleted");
      removeFromFeed();
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setMenuLoading(false);
    }
  };

  const handleArchive = async () => {
    if (
      !window.confirm(
        "Archive this post? It will be hidden from your profile but can be restored later."
      )
    )
      return;
    setMenuLoading(true);
    setMenuOpen(false);
    try {
      await archivePost(post._id);
      toast.success("Post archived");
      removeFromFeed();
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setMenuLoading(false);
    }
  };

  const handleHide = async () => {
    if (!window.confirm("Hide this post? It will be hidden from your feed.")) return;
    setMenuLoading(true);
    setMenuOpen(false);
    try {
      await hidePost(post._id);
      toast.success("Post hidden");
      removeFromFeed();
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setMenuLoading(false);
    }
  };

  const handleShare = () => {
    setMenuOpen(false);
    setShareModalOpen(true);
  };

  const handleSave = () => {
    const ids = getSavedPostIds();
    const set = new Set(ids);
    const nextSaved = !post.isSaved;
    if (nextSaved) set.add(post._id);
    else set.delete(post._id);
    setSavedPostIds(Array.from(set));
    patchAllFeedQueries(qc, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p: Post) =>
            p._id === post._id ? { ...p, isSaved: nextSaved } : p
          ),
        })),
      };
    });
    if (!nextSaved) {
      qc.invalidateQueries({ queryKey: ["saved-posts"] });
    }
    toast.success(nextSaved ? "Saved" : "Removed from saved");
  };

  const openAddToCollection = () => {
    setMenuOpen(false);
    setCollectionModalOpen(true);
  };

  const handleReportSubmit = async (reason: ReportReason) => {
    const authorId = post.user?._id;
    if (!currentUser || !authorId) {
      toast.error("You must be signed in to report.");
      return;
    }
    if (currentUser._id === authorId) {
      toast.error("You cannot report your own post.");
      return;
    }
    setMenuLoading(true);
    setReportOpen(false);
    setMenuOpen(false);
    try {
      await createReport({
        type: reason,
        reportedUserId: authorId,
        postId: post._id,
        reason,
      });
      toast.success("Report submitted. Our team will review it.");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setMenuLoading(false);
    }
  };

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(post._id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["feed"] });
      await qc.cancelQueries({ queryKey: ["saved-posts"] });
      const previousFeeds = qc.getQueriesData<FeedData>({ queryKey: ["feed"] });
      const previousSaved = qc.getQueriesData<SavedPostsCache>({ queryKey: ["saved-posts"] });

      const applyOptimisticToggle = (p: Post): Post => {
        if (p._id !== post._id) return p;
        const nextLiked = !p.isLiked;
        return {
          ...p,
          isLiked: nextLiked,
          likesCount: Math.max((p.likesCount ?? 0) + (nextLiked ? 1 : -1), 0),
        };
      };

      patchAllFeedQueries(qc, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p: Post) => applyOptimisticToggle(p)),
          })),
        };
      });
      patchSavedPostsForLike(qc, post._id, applyOptimisticToggle);

      return { previousFeeds, previousSaved };
    },
    onSuccess: (data) => {
      const nextLiked = data?.isLiked;
      const likesCount = data?.likesCount;
      if (typeof nextLiked === "boolean" && typeof likesCount === "number") {
        const sync = (p: Post): Post =>
          p._id === post._id ? { ...p, isLiked: nextLiked, likesCount } : p;
        patchAllFeedQueries(qc, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p: Post) => sync(p)),
            })),
          };
        });
        patchSavedPostsForLike(qc, post._id, sync);
      }

      const liked = data?.isLiked ?? !post.isLiked;
      const ids = getLikedPostIds();
      const next = new Set(ids);
      if (liked) next.add(post._id);
      else next.delete(post._id);
      setLikedPostIds(Array.from(next));
    },
    onError: (e: unknown, _v, ctx) => {
      ctx?.previousFeeds?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      ctx?.previousSaved?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      toast.error(getFriendlyErrorMessage(e));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["saved-posts"] });
    },
  });

  const media = post.imageUrl || post.thumbnailUrl || post.mediaUrl || "";
  const isOwnPost = !!currentUser && post.user?._id === currentUser._id;
  const displayName = post.user?.fullName || post.user?.username || "Traveler";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase();

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-premium transition-shadow duration-200 hover:shadow-premium-hover border-premium">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link href={`/profile/${post.user?._id}`} className="group flex items-center gap-4">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80">
            {post.user?.profilePic ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={post.user.profilePic}
                alt={post.user?.fullName || "User"}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-violet-500/10">
                <span className="text-sm font-semibold text-primary/70">{avatarInitial}</span>
              </div>
            )}
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-slate-900 group-hover:underline">
              {displayName}
            </div>
            <div className="line-clamp-1 text-xs font-medium leading-snug text-slate-500">
              {getPostDisplayLocation(post)}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href={`/trip/${post._id}`}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            View
          </Link>
          {currentUser && (
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl hover:bg-slate-100"
                aria-label="More options"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen((o) => !o);
                }}
                disabled={menuLoading}
              >
                <MoreHorizontal className="h-5 w-5 text-slate-600" />
              </Button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOwnPost ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={handleArchive}
                      >
                        <Archive className="h-4 w-4 text-slate-500" />
                        Archive
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={handleHide}
                      >
                        <EyeOff className="h-4 w-4 text-slate-500" />
                        Hide
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={openAddToCollection}
                      >
                        <FolderPlus className="h-4 w-4 text-slate-500" />
                        Add to Collection
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={handleShare}
                      >
                        <Share2 className="h-4 w-4 text-slate-500" />
                        Share
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={handleDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setReportOpen(true)}
                      >
                        <Flag className="h-4 w-4 text-slate-500" />
                        Report
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={openAddToCollection}
                      >
                        <FolderPlus className="h-4 w-4 text-slate-500" />
                        Add to Collection
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={handleShare}
                      >
                        <Share2 className="h-4 w-4 text-slate-500" />
                        Share
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media */}
      <Link href={`/trip/${post._id}`} className="block bg-slate-100/50">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media}
            alt={post.caption || "Trip"}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      </Link>

      {/* Caption & actions */}
      <div className="space-y-4 border-t border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-h-[72px]">
          <p
            className={cn(
              "line-clamp-3 text-[15px] leading-6 text-slate-700",
              post.caption ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="font-semibold">
              {post.user?.username ? `@${post.user.username}` : ""}
            </span>{" "}
            <CaptionWithLinks
              text={post.caption || ""}
              as="span"
              className="text-slate-600"
              linkClassName="text-primary"
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-slate-100"
            onClick={() => likeMutation.mutate()}
            aria-label={post.isLiked ? "Unlike" : "Like"}
          >
            <motion.span whileTap={{ scale: 0.9 }}>
              <Heart
                className={cn(
                  "h-5 w-5",
                  post.isLiked ? "fill-red-500 text-red-500" : "text-slate-600"
                )}
              />
            </motion.span>
          </Button>
          <span className="min-w-[1.25rem] text-sm font-semibold text-slate-700">
            {post.likesCount ?? 0}
          </span>

          {onOpenComments ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-slate-100"
              aria-label="Comments"
              onClick={() => onOpenComments(post)}
            >
              <MessageCircle className="h-5 w-5 text-slate-600" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-slate-100"
              aria-label="Comments"
              asChild
            >
              <Link href={`/trip/${post._id}#comments`}>
                <MessageCircle className="h-5 w-5 text-slate-600" />
              </Link>
            </Button>
          )}
          <span className="min-w-[1.25rem] text-sm font-semibold text-slate-700">
            {post.commentsCount ?? 0}
          </span>

          {currentUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-slate-100"
              aria-label={post.isSaved ? "Remove from saved" : "Save post"}
              onClick={handleSave}
            >
              <Bookmark
                className={cn(
                  "h-5 w-5",
                  post.isSaved ? "fill-sky-500 text-sky-500" : "text-slate-600"
                )}
              />
            </Button>
          )}

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-slate-100"
            aria-label="Share"
            onClick={() => setShareModalOpen(true)}
          >
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </div>

      <AddToCollectionModal
        visible={collectionModalOpen}
        postId={post._id}
        onClose={() => setCollectionModalOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["feed"] })}
      />

      <SharePostModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        post={post}
        currentUserId={currentUser?._id}
      />

      {/* Report reason modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setReportOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Report post"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Report post</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setReportOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="mb-4 text-sm text-slate-500">Choose a reason for your report</p>
            <ul className="space-y-1">
              {REPORT_REASONS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => handleReportSubmit(r.id)}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}

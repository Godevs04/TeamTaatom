"use client";

import * as React from "react";
import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toggleLike } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { getLikedPostIds, setLikedPostIds, getSavedPostIds, setSavedPostIds, cn } from "../../lib/utils";
import type { Post } from "../../types/post";
import { SharePostModal } from "./share-post-modal";
import { AddToCollectionModal } from "./AddToCollectionModal";
import { PostLikesCount } from "./post-likers-modal";

export function PostDetailActionBar({ post }: { post: Post }) {
  const qc = useQueryClient();
  const [liked, setLiked] = React.useState<boolean>(() => {
    const local = new Set(getLikedPostIds());
    return local.has(post._id) || (post.isLiked ?? false);
  });
  const [likesCount, setLikesCount] = React.useState(post.likesCount ?? 0);
  const [saved, setSaved] = React.useState<boolean>(() => {
    const local = new Set(getSavedPostIds());
    return local.has(post._id) || (post.isSaved ?? false);
  });

  const [shareOpen, setShareOpen] = React.useState(false);
  const [collectionOpen, setCollectionOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof post.likesCount === "number") {
      setLikesCount(post.likesCount);
    }
    if (typeof post.isLiked === "boolean") {
      setLiked(post.isLiked);
    }
    if (typeof post.isSaved === "boolean") {
      setSaved(post.isSaved);
    }
  }, [post.likesCount, post.isLiked, post.isSaved]);

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(post._id),
    onMutate: async () => {
      const prevLiked = liked;
      const prevCount = likesCount;
      const nextLiked = !prevLiked;
      setLiked(nextLiked);
      setLikesCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));

      const nextSet = new Set(getLikedPostIds());
      if (nextLiked) nextSet.add(post._id);
      else nextSet.delete(post._id);
      setLikedPostIds(Array.from(nextSet));

      return { prevLiked, prevCount };
    },
    onError: (e, _, ctx) => {
      if (ctx) {
        setLiked(ctx.prevLiked);
        setLikesCount(ctx.prevCount);
      }
      toast.error(getFriendlyErrorMessage(e));
    },
    onSuccess: (data) => {
      if (data?.likesCount !== undefined) setLikesCount(data.likesCount);
      if (data?.isLiked !== undefined) setLiked(data.isLiked);
      qc.invalidateQueries({ queryKey: ["post-likers", post._id] });
    },
  });

  const handleSaveToggle = () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    const nextSet = new Set(getSavedPostIds());
    if (nextSaved) {
      nextSet.add(post._id);
      setCollectionOpen(true);
    } else {
      nextSet.delete(post._id);
      toast.success("Removed from saved");
    }
    setSavedPostIds(Array.from(nextSet));
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between border-y border-slate-200/80 py-3 dark:border-zinc-800/80">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Like Button */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => likeMutation.mutate()}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
              liked
                ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                : "text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
            aria-label={liked ? "Unlike post" : "Like post"}
          >
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            <PostLikesCount postId={post._id} likesCount={likesCount} live />
          </motion.button>

          {/* Comment Button */}
          <a
            href="#comments"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Jump to comments"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.commentsCount ?? 0}</span>
          </a>
        </div>

        <div className="flex items-center gap-1">
          {/* Share Button */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Share post"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Save / Bookmark Button */}
          <button
            type="button"
            onClick={handleSaveToggle}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
              saved
                ? "bg-primary/10 text-primary"
                : "text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            )}
            aria-label={saved ? "Unsave post" : "Save post"}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </button>
        </div>
      </div>

      {shareOpen && (
        <SharePostModal
          post={post}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}

      {collectionOpen && (
        <AddToCollectionModal
          postId={post._id}
          visible={collectionOpen}
          onClose={() => setCollectionOpen(false)}
        />
      )}
    </>
  );
}

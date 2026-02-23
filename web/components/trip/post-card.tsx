"use client";

import Link from "next/link";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleLike } from "../../lib/api";
import type { Post } from "../../types/post";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

type FeedData = {
  pages: Array<{ posts: Post[]; pagination?: unknown }>;
  pageParams: unknown[];
};

export function PostCard({ post }: { post: Post }) {
  const qc = useQueryClient();
  const likeMutation = useMutation({
    mutationFn: () => toggleLike(post._id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["feed"] });
      const prev = qc.getQueryData<FeedData>(["feed"]);
      qc.setQueryData<FeedData>(["feed"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p: Post) => {
              if (p._id !== post._id) return p;
              const nextLiked = !p.isLiked;
              return {
                ...p,
                isLiked: nextLiked,
                likesCount: Math.max((p.likesCount ?? 0) + (nextLiked ? 1 : -1), 0),
              };
            }),
          })),
        };
      });
      return { prev };
    },
    onError: (e: unknown, _v, ctx) => {
      qc.setQueryData(["feed"], ctx?.prev);
      toast.error(e instanceof Error ? e.message : "Failed to update like");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const media = post.imageUrl || post.thumbnailUrl || post.mediaUrl || "";

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-premium transition-shadow duration-200 hover:shadow-premium-hover border-premium">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link href={`/profile/${post.user?._id}`} className="group flex items-center gap-4">
          <div className="h-12 w-12 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.user?.profilePic || ""}
              alt={post.user?.fullName || "User"}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-slate-900 group-hover:underline">
              {post.user?.fullName || post.user?.username || "Traveler"}
            </div>
            <div className="text-xs font-medium text-slate-500">{post.address || "Unknown location"}</div>
          </div>
        </Link>
        <Link
          href={`/trip/${post._id}`}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          View
        </Link>
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
      <div className="space-y-4 border-t border-slate-100 px-6 py-4">
        {post.caption ? (
          <p className="text-[15px] leading-6 text-slate-700">
            <span className="font-semibold">{post.user?.username ? `@${post.user.username}` : ""}</span>{" "}
            <span className="text-slate-600">{post.caption}</span>
          </p>
        ) : null}

        <div className="flex items-center gap-2">
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
          <span className="min-w-[1.25rem] text-sm font-semibold text-slate-700">
            {post.commentsCount ?? 0}
          </span>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl hover:bg-slate-100"
            aria-label="Share"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/trip/${post._id}`);
                toast.success("Link copied");
              } catch {
                toast.message("Copy link manually");
              }
            }}
          >
            <Share2 className="h-5 w-5 text-slate-600" />
          </Button>
        </div>
      </div>
    </article>
  );
}

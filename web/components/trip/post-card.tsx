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
    <article className="overflow-hidden rounded-3xl border bg-card shadow-card">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href={`/profile/${post.user?._id}`} className="group flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.user?.profilePic || ""} alt={post.user?.fullName || "User"} className="h-full w-full object-cover" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold group-hover:underline">
              {post.user?.fullName || post.user?.username || "Traveler"}
            </div>
            <div className="text-xs text-muted-foreground">{post.address || "Unknown location"}</div>
          </div>
        </Link>
        <Link href={`/trip/${post._id}`} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          View
        </Link>
      </div>

      <Link href={`/trip/${post._id}`} className="block bg-muted">
        <div className="relative aspect-[4/3] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media} alt={post.caption || "Trip"} className="h-full w-full object-cover" loading="lazy" />
        </div>
      </Link>

      <div className="space-y-3 px-5 py-4">
        {post.caption ? (
          <p className="text-sm leading-6">
            <span className="font-semibold">{post.user?.username ? `@${post.user.username}` : ""}</span>{" "}
            <span className="text-foreground/90">{post.caption}</span>
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => likeMutation.mutate()}
            aria-label={post.isLiked ? "Unlike" : "Like"}
          >
            <motion.span whileTap={{ scale: 0.9 }}>
              <Heart className={cn("h-5 w-5", post.isLiked ? "fill-red-500 text-red-500" : "text-foreground")} />
            </motion.span>
          </Button>
          <span className="text-sm font-semibold">{post.likesCount ?? 0}</span>

          <Button variant="ghost" size="icon" aria-label="Comments" asChild>
            <Link href={`/trip/${post._id}#comments`}>
              <MessageCircle className="h-5 w-5" />
            </Link>
          </Button>
          <span className="text-sm font-semibold">{post.commentsCount ?? 0}</span>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
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
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </article>
  );
}


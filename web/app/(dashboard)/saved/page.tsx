"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPostById } from "../../../lib/api";
import { getSavedPostIds } from "../../../lib/utils";
import { PostCard } from "../../../components/trip/post-card";
import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, Compass, Search } from "lucide-react";
import { useMounted } from "../../../hooks/use-mounted";
import type { Post } from "../../../types/post";

export default function SavedPostsPage() {
  const mounted = useMounted();
  const queryClient = useQueryClient();

  const postsQ = useQuery({
    queryKey: ["saved-posts"],
    queryFn: async () => {
      const savedIds = getSavedPostIds();
      if (savedIds.length === 0) return { posts: [] as Post[], savedIds: [] as string[] };
      const results = await Promise.allSettled(
        savedIds.map((id) => getPostById(id))
      );
      const posts: Post[] = [];
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) posts.push(r.value as Post);
      });
      return { posts, savedIds };
    },
    enabled: mounted,
  });

  const savedIds = postsQ.data?.savedIds ?? [];
  const posts = (postsQ.data?.posts ?? []) as Post[];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 md:text-3xl">
          Saved
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Posts you saved to view later.
        </p>
      </div>

      {!mounted ? (
        <div className="grid gap-8 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      ) : savedIds.length === 0 ? (
        <Card className="rounded-[1.75rem] border border-slate-200/80 p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-14">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-sky-500/10 ring-1 ring-slate-200/80 dark:ring-zinc-700/80"
          >
            <Bookmark className="h-8 w-8 text-primary/80" />
          </motion.div>
          <h2 className="mt-5 font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">No saved posts yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
            Save moments from the feed to build your personal shortlist and revisit them anytime.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/feed"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95"
            >
              <Compass className="h-4 w-4" />
              Explore feed
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <Search className="h-4 w-4" />
              Find travelers
            </Link>
          </div>
        </Card>
      ) : postsQ.isLoading ? (
        <div className="grid gap-8 xl:grid-cols-2">
          {Array.from({ length: Math.min(savedIds.length, 6) }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      ) : savedIds.length > 0 && posts.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/80 p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-sm text-slate-500 dark:text-zinc-400">Saved posts could not be loaded.</p>
        </Card>
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          {posts.map((p) => (
            <div key={p._id} data-post-id={p._id}>
              <PostCard
                post={{ ...p, isSaved: true }}
                onPostRemoved={() => queryClient.invalidateQueries({ queryKey: ["saved-posts"] })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

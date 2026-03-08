"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPostById } from "../../../lib/api";
import { getSavedPostIds } from "../../../lib/utils";
import { PostCard } from "../../../components/trip/post-card";
import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Bookmark } from "lucide-react";
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Saved
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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
        <Card className="rounded-2xl border border-slate-200/80 p-12 text-center shadow-premium">
          <Bookmark className="mx-auto h-14 w-14 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No saved posts</h2>
          <p className="mt-2 text-sm text-slate-500">
            Save posts from the feed to find them here later.
          </p>
        </Card>
      ) : postsQ.isLoading ? (
        <div className="grid gap-8 xl:grid-cols-2">
          {Array.from({ length: Math.min(savedIds.length, 6) }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      ) : savedIds.length > 0 && posts.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/80 p-12 text-center shadow-premium">
          <p className="text-sm text-slate-500">Saved posts could not be loaded.</p>
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

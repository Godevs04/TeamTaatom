"use client";

import * as React from "react";
import { useFeed } from "../../../hooks/useFeed";
import { PostCard } from "../../../components/trip/post-card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";

export default function FeedPage() {
  const q = useFeed();
  const posts = q.data?.pages.flatMap((p) => p.posts) ?? [];

  // auto-fetch on scroll near bottom
  React.useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 900;
      if (nearBottom && q.hasNextPage && !q.isFetchingNextPage) {
        q.fetchNextPage();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [q]);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Feed</h2>
          <p className="text-sm text-muted-foreground">Fresh trips from the community.</p>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl border bg-card shadow-card">
              <div className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="grid gap-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="space-y-3 px-5 py-4">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-destructive">Failed to load feed.</p>
          <Button className="mt-3" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No posts yet.</p>
        </div>
      ) : (
        <>
          {posts.map((p) => (
            <PostCard key={p._id} post={p} />
          ))}

          {q.isFetchingNextPage ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading more…</div>
          ) : q.hasNextPage ? (
            <div className="py-6 text-center">
              <Button variant="outline" onClick={() => q.fetchNextPage()}>
                Load more
              </Button>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">You’re all caught up.</div>
          )}
        </>
      )}
    </div>
  );
}


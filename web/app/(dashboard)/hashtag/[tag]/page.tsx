"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Hash, X } from "lucide-react";
import { getHashtagPosts } from "../../../../lib/api";
import { PostCard } from "../../../../components/trip/post-card";
import { TripComments } from "../../../../components/trip/comments";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import type { Post } from "../../../../types/post";
import { getLikedPostIds, getSavedPostIds, mergeLikedIntoPosts, mergeSavedIntoPosts } from "../../../../lib/utils";
import { useMounted } from "../../../../hooks/use-mounted";

export default function HashtagPage() {
  const params = useParams();
  const raw = typeof params?.tag === "string" ? params.tag : "";
  const tagSlug = React.useMemo(() => decodeURIComponent(raw).replace(/^#/, "").toLowerCase(), [raw]);
  const mounted = useMounted();
  const [commentsPost, setCommentsPost] = React.useState<Post | null>(null);

  const q = useInfiniteQuery({
    queryKey: ["hashtag-posts", tagSlug],
    queryFn: async ({ pageParam = 1 }) => getHashtagPosts(tagSlug, pageParam, 15),
    getNextPageParam: (last) => (last.pagination.hasNextPage ? last.pagination.currentPage + 1 : undefined),
    initialPageParam: 1,
    enabled: tagSlug.length > 0,
  });

  const meta = q.data?.pages[0]?.hashtag;
  const rawPosts = React.useMemo(() => q.data?.pages.flatMap((p) => p.posts) ?? [], [q.data?.pages]);
  const likedIds = React.useMemo(() => (mounted ? getLikedPostIds() : []), [mounted]);
  const savedIds = React.useMemo(() => (mounted ? getSavedPostIds() : []), [mounted]);
  const posts: Post[] = React.useMemo(
    () => mergeSavedIntoPosts(mergeLikedIntoPosts(rawPosts, likedIds), savedIds),
    [rawPosts, likedIds, savedIds]
  );

  React.useEffect(() => {
    const onScroll = () => {
      if (!q.hasNextPage || q.isFetchingNextPage) return;
      const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 900;
      if (nearBottom) void q.fetchNextPage();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [q]);

  if (!tagSlug) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Invalid hashtag.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 md:max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl shrink-0" asChild>
          <Link href="/search" aria-label="Back to search">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Hash className="h-6 w-6 shrink-0 text-primary" aria-hidden />
            <h1 className="truncate text-xl font-bold tracking-tight dark:text-zinc-50 sm:text-2xl">#{tagSlug}</h1>
          </div>
          {meta ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {meta.postCount.toLocaleString()} {meta.postCount === 1 ? "post" : "posts"}
            </p>
          ) : q.isLoading ? (
            <Skeleton className="mt-2 h-4 w-32" />
          ) : null}
        </div>
      </div>

      {q.isError ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-zinc-50">Hashtag not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no posts with this tag yet, or it has not been registered.
          </p>
          <Button className="mt-4 rounded-xl" asChild>
            <Link href="/search">Back to search</Link>
          </Button>
        </Card>
      ) : null}

      {!q.isError && q.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!q.isError && !q.isLoading && posts.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">No posts for this hashtag yet.</Card>
      ) : null}

      <div className="flex flex-col gap-4 sm:gap-5">
        {posts.map((post) => (
          <PostCard key={post._id} post={post} onOpenComments={setCommentsPost} />
        ))}
      </div>

      {q.isFetchingNextPage ? (
        <div className="flex justify-center py-6">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      ) : null}

      {commentsPost ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm"
          role="presentation"
          onClick={() => setCommentsPost(null)}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Comments"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-zinc-800 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">
                    {commentsPost.caption || "Trip comments"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {commentsPost.user?.fullName || commentsPost.user?.username || "Traveler"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  aria-label="Close comments"
                  onClick={() => setCommentsPost(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <TripComments postId={commentsPost._id} />
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </div>
  );
}

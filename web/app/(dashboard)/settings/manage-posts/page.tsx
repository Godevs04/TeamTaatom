"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Archive,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  getArchivedPosts,
  getHiddenPosts,
  unarchivePost,
  unhidePost,
} from "../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../lib/auth-errors";
import { getPostDisplayLocation } from "../../../../lib/post-utils";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../lib/utils";
import type { Post } from "../../../../types/post";

type TabType = "archived" | "hidden";

function postThumb(post: Post): string {
  return (
    post.thumbnailUrl ||
    post.imageUrl ||
    post.images?.[0] ||
    post.mediaUrl ||
    ""
  );
}

function PostRow({
  post,
  onRestore,
  restoring,
}: {
  post: Post;
  onRestore: (postId: string) => void;
  restoring: boolean;
}) {
  const thumb = postThumb(post);
  const date = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/70 sm:p-4">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-zinc-100">
          {post.caption?.trim() || "Untitled post"}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-zinc-400">
          {getPostDisplayLocation(post)}
        </p>
        {date && (
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">{date}</p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 rounded-xl"
        disabled={restoring}
        onClick={() => onRestore(post._id)}
      >
        {restoring ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Restore
      </Button>
    </div>
  );
}

export default function ManagePostsSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<TabType>("archived");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const archivedQ = useQuery({
    queryKey: ["manage-posts", "archived", page],
    queryFn: () => getArchivedPosts(page, 20),
  });

  const hiddenQ = useQuery({
    queryKey: ["manage-posts", "hidden", page],
    queryFn: () => getHiddenPosts(page, 20),
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ postId, tab }: { postId: string; tab: TabType }) => {
      if (tab === "archived") return unarchivePost(postId);
      return unhidePost(postId);
    },
    onMutate: ({ postId }) => setProcessingId(postId),
    onSuccess: (_data, { tab }) => {
      toast.success("Post restored successfully");
      queryClient.invalidateQueries({ queryKey: ["manage-posts", tab] });
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
    onSettled: () => setProcessingId(null),
  });

  const archivedPosts = archivedQ.data?.posts ?? [];
  const hiddenPosts = hiddenQ.data?.posts ?? [];
  const isLoading = archivedQ.isLoading || hiddenQ.isLoading;

  const filterPosts = React.useCallback(
    (posts: Post[]) => {
      if (!searchQuery.trim()) return posts;
      const q = searchQuery.toLowerCase();
      return posts.filter(
        (post) =>
          post.caption?.toLowerCase().includes(q) ||
          getPostDisplayLocation(post).toLowerCase().includes(q)
      );
    },
    [searchQuery]
  );

  const currentPosts = filterPosts(activeTab === "archived" ? archivedPosts : hiddenPosts);
  const activeQuery = activeTab === "archived" ? archivedQ : hiddenQ;
  const hasMore = (activeQuery.data?.posts?.length ?? 0) >= 20;

  const handleRefresh = () => {
    archivedQ.refetch();
    hiddenQ.refetch();
  };

  return (
    <div className="space-y-8">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70">
        <div className="border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-6 md:px-8 md:py-7 dark:border-zinc-800/70 dark:from-zinc-800/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
                Manage Posts
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                View and restore archived or hidden posts.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-6 md:px-8 md:py-7">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by caption, location, or tag…"
              className="rounded-xl pl-10"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("archived")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "archived"
                  ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
            >
              <Archive className="h-4 w-4" />
              Archived ({archivedPosts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("hidden")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "hidden"
                  ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              )}
            >
              <EyeOff className="h-4 w-4" />
              Hidden ({hiddenPosts.length})
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : currentPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center dark:border-zinc-700">
              {activeTab === "archived" ? (
                <Archive className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" />
              ) : (
                <EyeOff className="mx-auto h-10 w-10 text-slate-300 dark:text-zinc-600" />
              )}
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">
                {searchQuery.trim()
                  ? "No posts match your search"
                  : `No ${activeTab === "archived" ? "archived" : "hidden"} posts`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                {searchQuery.trim()
                  ? "Try a different search term"
                  : activeTab === "archived"
                    ? "Posts you archive will appear here"
                    : "Posts you hide from your feed will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentPosts.map((post) => (
                <PostRow
                  key={post._id}
                  post={post}
                  restoring={processingId === post._id}
                  onRestore={(postId) => restoreMutation.mutate({ postId, tab: activeTab })}
                />
              ))}
            </div>
          )}

          {hasMore && !searchQuery.trim() && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={activeQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                {activeQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

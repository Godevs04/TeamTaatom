"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFeed } from "../../../hooks/useFeed";
import { PostCard } from "../../../components/trip/post-card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { PenLine, ImagePlus, MapPin, Send, Compass, RefreshCw } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { useMounted } from "../../../hooks/use-mounted";
import { getLikedPostIds, getSavedPostIds, mergeLikedIntoPosts, mergeSavedIntoPosts } from "../../../lib/utils";
import { getFriendlyErrorMessage } from "../../../lib/auth-errors";
import type { Post } from "../../../types/post";

type FeedTabId = "recents" | "friends" | "popular";

const feedTabs: { id: FeedTabId; label: string }[] = [
  { id: "recents", label: "Recents" },
  { id: "friends", label: "Friends" },
  { id: "popular", label: "Popular" },
];

function FeedContent() {
  const [activeTab, setActiveTab] = React.useState<FeedTabId>("recents");
  const searchParams = useSearchParams();
  const deepLinkPostId = searchParams.get("postId");
  const mounted = useMounted();
  const q = useFeed(activeTab);
  const { user } = useAuth();
  const rawPosts = React.useMemo(
    () => q.data?.pages.flatMap((p) => p.posts) ?? [],
    [q.data?.pages]
  );
  const likedIds = React.useMemo(() => (mounted ? getLikedPostIds() : []), [mounted]);
  const savedIds = React.useMemo(() => (mounted ? getSavedPostIds() : []), [mounted]);
  const posts: Post[] = React.useMemo(
    () => mergeSavedIntoPosts(mergeLikedIntoPosts(rawPosts, likedIds), savedIds),
    [rawPosts, likedIds, savedIds]
  );

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

  React.useEffect(() => {
    if (!deepLinkPostId || posts.length === 0) return;
    const el = document.querySelector(`[data-post-id="${deepLinkPostId}"]`);
    if (el) {
      let attempts = 0;
      const tryScroll = () => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        attempts += 1;
        if (attempts < 5) setTimeout(tryScroll, 100 * attempts);
      };
      tryScroll();
    }
  }, [deepLinkPostId, posts.length]);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Premium header with tabs */}
      <header className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-premium border-premium sm:p-6 md:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Feeds
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Stories and trips from people you follow
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl bg-slate-100/90 p-1.5">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200/80"
              onClick={() => q.refetch()}
              disabled={q.isRefetching}
              aria-label="Refresh feed"
            >
              <RefreshCw className={`h-4 w-4 ${q.isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      {/* Share composer — premium CTA card */}
      <Link
        href="/create"
        className="flex items-center gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-4 shadow-premium transition-all duration-200 hover:shadow-premium-hover hover:border-slate-300/80 border-premium sm:gap-4 sm:px-6 sm:py-5 md:px-8"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 ring-1 ring-slate-200/80">
          {mounted && user?.profilePic ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.profilePic}
              alt="Your profile"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary">
              <PenLine className="h-6 w-6" />
            </div>
          )}
        </div>
        <span className="flex-1 text-left text-[15px] text-slate-500">
          Share a trip or experience…
        </span>
        <div className="flex items-center gap-1">
          <span className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <MapPin className="h-5 w-5" />
          </span>
        </div>
        <span
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:opacity-95"
          aria-hidden
        >
          <Send className="h-4 w-4" />
          Post
        </span>
      </Link>

      {/* Feed posts */}
      <div className="grid gap-4 sm:gap-6 lg:gap-8">
        {q.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-premium border-premium"
            >
              <div className="flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-5">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="grid gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))
        ) : q.isError ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-premium border-premium">
            <p className="text-[15px] text-slate-600">{getFriendlyErrorMessage(q.error)}</p>
            <Button
              className="mt-5 rounded-xl shadow-premium"
              onClick={() => q.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-premium border-premium">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Compass className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-6 text-lg font-semibold text-slate-900">
              {activeTab === "friends" ? "No posts from people you follow" : activeTab === "popular" ? "No posts yet" : "No posts yet"}
            </h3>
            <p className="mt-2 text-[15px] text-slate-500">
              {activeTab === "friends"
                ? "Follow travelers to see their trips here, or switch to Recents to see all posts."
                : "Be the first to share a trip or follow travelers to see their stories."}
            </p>
            <Button className="mt-6 rounded-xl shadow-premium" asChild>
              <Link href={activeTab === "friends" ? "/search" : "/create"}>
                {activeTab === "friends" ? "Find travelers" : "Create post"}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop web: two-column grid on xl to use horizontal space */}
            <div className="grid gap-8 xl:grid-cols-2">
              {posts.map((p) => (
                <div key={p._id} data-post-id={p._id}>
                  <PostCard post={p} />
                </div>
              ))}
            </div>

            {q.isFetchingNextPage ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading more…</div>
            ) : q.hasNextPage ? (
              <div className="py-8 text-center">
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200/80 shadow-sm"
                  onClick={() => q.fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">You&apos;re all caught up.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FeedPageFallback() {
  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      <header className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-premium sm:p-6 md:p-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-4 flex gap-3">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </header>
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6">
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <React.Suspense fallback={<FeedPageFallback />}>
      <FeedContent />
    </React.Suspense>
  );
}

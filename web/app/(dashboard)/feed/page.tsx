"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useFeed } from "../../../hooks/useFeed";
import { PostCard } from "../../../components/trip/post-card";
import { TripComments } from "../../../components/trip/comments";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { PenLine, ImagePlus, MapPin, Send, Compass, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { useMounted } from "../../../hooks/use-mounted";
import { getLikedPostIds, getSavedPostIds, mergeLikedIntoPosts, mergeSavedIntoPosts } from "../../../lib/utils";
import { getFriendlyErrorMessage, isUnauthorizedError } from "../../../lib/auth-errors";
import type { Post } from "../../../types/post";

type FeedTabId = "recents" | "friends" | "popular";

const feedTabs: { id: FeedTabId; label: string }[] = [
  { id: "recents", label: "Recents" },
  { id: "friends", label: "Friends" },
  { id: "popular", label: "Popular" },
];

const easeOut = [0.22, 1, 0.36, 1] as const;

const feedListVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
};

const postItemVariants = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: easeOut },
  },
};

function FeedContent() {
  const [activeTab, setActiveTab] = React.useState<FeedTabId>("recents");
  const [loadMoreError, setLoadMoreError] = React.useState(false);
  const [commentsPost, setCommentsPost] = React.useState<Post | null>(null);
  const searchParams = useSearchParams();
  const deepLinkPostId = searchParams.get("postId");
  const mounted = useMounted();
  const q = useFeed(activeTab);
  const { user } = useAuth();

  React.useEffect(() => {
    setLoadMoreError(false);
  }, [activeTab]);

  const fetchNextPageSafe = React.useCallback(() => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    q.fetchNextPage()
      .then(() => setLoadMoreError(false))
      .catch(() => setLoadMoreError(true));
  }, [q]);
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
      if (nearBottom) fetchNextPageSafe();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPageSafe]);

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
    <div className="relative space-y-5 sm:space-y-6 lg:space-y-8">
      {/* Ambient wash — matches marketing pages */}
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-[420px] overflow-hidden opacity-90" aria-hidden>
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-3xl" />
        <div className="absolute left-1/3 top-48 h-56 w-56 rounded-full bg-sky-400/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10 space-y-5 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: easeOut }}
          className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-premium backdrop-blur-sm border-premium sm:p-6 md:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">News feed</p>
              <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl lg:text-[2rem]">
                Stories that move with you
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                Trips and moments from travelers you follow — calm, visual, and easy to browse.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative inline-flex rounded-2xl bg-slate-100/90 p-1.5 ring-1 ring-slate-200/60">
                {feedTabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className="relative z-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200"
                    >
                      {active && (
                        <motion.span
                          layoutId="feed-tab-pill"
                          className="absolute inset-0 -z-10 rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className={active ? "text-slate-900" : "text-slate-600"}>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200/80 bg-white/80 shadow-sm"
                  onClick={() => {
                    setLoadMoreError(false);
                    void q.refetch();
                  }}
                  disabled={q.isRefetching}
                  aria-label="Refresh feed"
                >
                  <RefreshCw className={`h-4 w-4 ${q.isRefetching ? "animate-spin" : ""}`} />
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.header>

        {/* Composer */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeOut, delay: 0.08 }}
        >
          <Link href="/create" className="group block">
            <motion.div
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.995 }}
              transition={{ duration: 0.22, ease: easeOut }}
              className="flex items-center gap-3 rounded-[1.75rem] border border-slate-200/80 bg-white/95 px-4 py-4 shadow-premium transition-shadow duration-300 group-hover:border-slate-300/80 group-hover:shadow-premium-hover border-premium sm:gap-4 sm:px-6 sm:py-5 md:px-8"
            >
              <motion.div
                className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 ring-1 ring-slate-200/80"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
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
              </motion.div>
              <span className="flex-1 text-left text-[15px] text-slate-500 transition-colors group-hover:text-slate-700">
                Share a trip or experience…
              </span>
              <div className="hidden items-center gap-1 sm:flex">
                <span className="rounded-xl p-2.5 text-slate-400 transition-colors group-hover:bg-slate-100 group-hover:text-slate-600">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span className="rounded-xl p-2.5 text-slate-400 transition-colors group-hover:bg-slate-100 group-hover:text-slate-600">
                  <MapPin className="h-5 w-5" />
                </span>
              </div>
              <span
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all group-hover:opacity-95"
                aria-hidden
              >
                <Send className="h-4 w-4" />
                Post
              </span>
            </motion.div>
          </Link>
        </motion.div>

        {/* Feed posts */}
        <div className="grid gap-4 sm:gap-6 lg:gap-8">
          {q.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: easeOut }}
                className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm border-premium"
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
              </motion.div>
            ))
          ) : q.isError ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: easeOut }}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-12 text-center shadow-premium backdrop-blur-sm border-premium"
            >
              <p className="text-[15px] text-slate-600">{getFriendlyErrorMessage(q.error)}</p>
              <motion.div className="mt-5 flex flex-wrap items-center justify-center gap-3" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className="rounded-xl shadow-premium"
                  onClick={() => {
                    setLoadMoreError(false);
                    void q.refetch();
                  }}
                >
                  Try again
                </Button>
                {isUnauthorizedError(q.error) && (
                  <Button variant="outline" className="rounded-xl border-slate-200/80" asChild>
                    <Link href="/auth/login?next=/feed">Sign in</Link>
                  </Button>
                )}
              </motion.div>
            </motion.div>
          ) : posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-14 text-center shadow-premium backdrop-blur-sm border-premium sm:p-16"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 ring-1 ring-slate-200/80"
              >
                <Compass className="h-8 w-8 text-primary/70" />
              </motion.div>
              {activeTab === "friends" && !user ? (
                <>
                  <h3 className="mt-6 font-display text-lg font-semibold text-slate-900">
                    Sign in to see posts from people you follow
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
                    The Friends feed shows trips from travelers you follow. Create an account or sign in to start
                    building your circle.
                  </p>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="mt-6 flex justify-center gap-3"
                  >
                    <Button variant="outline" className="rounded-xl border-slate-200/80" asChild>
                      <Link href="/auth/login">Sign in</Link>
                    </Button>
                    <Button className="rounded-xl shadow-premium" asChild>
                      <Link href="/auth/register">Create account</Link>
                    </Button>
                  </motion.div>
                </>
              ) : (
                <>
                  <h3 className="mt-6 font-display text-lg font-semibold text-slate-900">
                    {activeTab === "friends"
                      ? "No posts from people you follow"
                      : activeTab === "popular"
                        ? "No posts yet"
                        : "No posts yet"}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
                    {activeTab === "friends"
                      ? "Follow travelers to see their trips here, or switch to Recents to see all posts."
                      : "Be the first to share a trip or follow travelers to see their stories."}
                  </p>
                  <motion.div
                    className="mt-6 inline-block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button className="rounded-xl shadow-premium" asChild>
                      <Link href={activeTab === "friends" ? "/search" : "/create"}>
                        {activeTab === "friends" ? "Find travelers" : "Create post"}
                      </Link>
                    </Button>
                  </motion.div>
                </>
              )}
            </motion.div>
          ) : (
            <>
              {loadMoreError && posts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3 rounded-[1.25rem] border border-amber-200/90 bg-amber-50/90 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  role="status"
                >
                  <p className="text-sm font-medium text-amber-950">
                    Couldn&apos;t load more posts. Check your connection and try again.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-xl border-amber-300 bg-white/90 text-amber-950 hover:bg-white"
                    onClick={() => {
                      setLoadMoreError(false);
                      fetchNextPageSafe();
                    }}
                    disabled={q.isFetchingNextPage || !q.hasNextPage}
                  >
                    Retry
                  </Button>
                </motion.div>
              )}
              <motion.div
                key={activeTab}
                variants={feedListVariants}
                initial="hidden"
                animate="show"
                className="grid gap-8 xl:grid-cols-2"
              >
                {posts.map((p) => (
                  <motion.div key={p._id} variants={postItemVariants} data-post-id={p._id}>
                    <PostCard post={p} onOpenComments={(post) => setCommentsPost(post)} />
                  </motion.div>
                ))}
              </motion.div>

              {q.isFetchingNextPage ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center py-8"
                >
                  <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/40 [animation-delay:300ms]" />
                    <span className="ml-1">Loading more…</span>
                  </span>
                </motion.div>
              ) : q.hasNextPage ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 text-center"
                >
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-200/80 bg-white/80 shadow-sm"
                      onClick={() => {
                        setLoadMoreError(false);
                        fetchNextPageSafe();
                      }}
                    >
                      Load more
                    </Button>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="py-10 text-center text-sm text-slate-500"
                >
                  You&apos;re all caught up.
                </motion.p>
              )}
            </>
          )}
        </div>
      </div>

      {commentsPost && (
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
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {commentsPost.caption || "Trip comments"}
                  </p>
                  <p className="text-xs text-slate-500">{commentsPost.user?.fullName || commentsPost.user?.username || "Traveler"}</p>
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
      )}
    </div>
  );
}

function FeedPageFallback() {
  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <header className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-5 shadow-premium backdrop-blur-sm sm:p-6 md:p-8">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
        <div className="mt-5 flex flex-wrap gap-3">
          <Skeleton className="h-11 w-[220px] max-w-full rounded-2xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </header>
      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-4 shadow-premium backdrop-blur-sm sm:p-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
      <div className="grid gap-4 sm:gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-[1.75rem]" />
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

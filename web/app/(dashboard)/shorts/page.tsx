"use client";

import * as React from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getShorts, toggleLike, getPostById } from "../../../lib/api";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { TripComments } from "../../../components/trip/comments";
import { SharePostModal } from "../../../components/trip/share-post-modal";
import { useAuth } from "../../../context/auth-context";
import { useMounted } from "../../../hooks/use-mounted";
import {
  cn,
  getLikedPostIds,
  setLikedPostIds,
  getSavedPostIds,
  setSavedPostIds,
  mergeLikedIntoPosts,
  mergeSavedIntoPosts,
} from "../../../lib/utils";
import { getFriendlyErrorMessage } from "../../../lib/auth-errors";
import type { Post } from "../../../types/post";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Share2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

function getThumbnailUrl(short: Post): string {
  const raw =
    short.imageUrl ||
    short.thumbnailUrl ||
    (Array.isArray(short.images) && short.images[0]) ||
    "";
  if (!raw || typeof raw !== "string") return "";
  if (typeof window !== "undefined" && raw.startsWith("/")) {
    return window.location.origin + raw;
  }
  return raw;
}

function getVideoUrl(short: Post): string {
  const raw = short.mediaUrl || short.videoUrl || "";
  if (!raw || typeof raw !== "string") return "";
  if (typeof window !== "undefined" && raw.startsWith("/")) {
    return window.location.origin + raw;
  }
  return raw;
}

type ShortsPage = { shorts: Post[]; pagination?: unknown };
type ShortsData = { pages: ShortsPage[]; pageParams: unknown[] };

/** Patches every loaded page of the shorts infinite query in place -- mirrors
 * post-card.tsx's patchAllFeedQueries pattern for ["feed"]. */
function patchShortsQueries(
  qc: ReturnType<typeof useQueryClient>,
  updater: (old: ShortsData | undefined) => ShortsData | undefined
) {
  qc.setQueriesData<ShortsData>({ queryKey: ["shorts"] }, updater);
}

export default function ShortsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mounted = useMounted();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [muted, setMuted] = React.useState(true);
  const [manuallyPaused, setManuallyPaused] = React.useState<Set<string>>(() => new Set());
  const [failedVideoIds, setFailedVideoIds] = React.useState<Set<string>>(() => new Set());
  const [tapFeedbackId, setTapFeedbackId] = React.useState<string | null>(null);
  const [commentsShort, setCommentsShort] = React.useState<Post | null>(null);
  const [shareShort, setShareShort] = React.useState<Post | null>(null);
  const feedRef = React.useRef<HTMLDivElement | null>(null);
  const videoRefs = React.useRef<Map<string, HTMLVideoElement>>(new Map());

  const q = useInfiniteQuery({
    queryKey: ["shorts"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await getShorts({ page: pageParam, limit: 10 });
      return res;
    },
    getNextPageParam: (lastPage) => {
      const p = lastPage?.pagination as { page?: number; totalPages?: number } | undefined;
      if (!p) return undefined;
      const page = p.page ?? 1;
      const totalPages = p.totalPages ?? 1;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const rawShorts = React.useMemo<Post[]>(
    () => q.data?.pages.flatMap((p) => (p as { shorts?: Post[] }).shorts ?? []) ?? [],
    [q.data]
  );
  // getShorts never sets isLiked, and isSaved is never server-side on either
  // platform (mobile's save is also purely local AsyncStorage) -- so both
  // are merged in from localStorage here, same as feed/page.tsx does.
  const likedIds = React.useMemo(() => (mounted ? getLikedPostIds() : []), [mounted]);
  const savedIds = React.useMemo(() => (mounted ? getSavedPostIds() : []), [mounted]);
  const shorts = React.useMemo<Post[]>(
    () => mergeSavedIntoPosts(mergeLikedIntoPosts(rawShorts, likedIds), savedIds),
    [rawShorts, likedIds, savedIds]
  );

  React.useEffect(() => {
    if (shorts.length === 0) return;
    const root = feedRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!(entry.target instanceof HTMLElement)) continue;
          const idxAttr = entry.target.dataset.idx;
          if (!idxAttr) continue;
          const idx = Number(idxAttr);
          if (Number.isNaN(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio >= 0.6) {
          setActiveIndex(best.idx);
        }
      },
      { root, threshold: [0.25, 0.5, 0.6, 0.8] }
    );

    const sections = root.querySelectorAll<HTMLElement>("[data-short-slide]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [shorts.length]);

  React.useEffect(() => {
    shorts.forEach((short, idx) => {
      const video = videoRefs.current.get(short._id);
      if (!video) return;
      const shouldPlay = idx === activeIndex && !manuallyPaused.has(short._id) && !failedVideoIds.has(short._id);
      if (shouldPlay) {
        void video.play().catch(() => {
          setFailedVideoIds((prev) => new Set(prev).add(short._id));
        });
      } else {
        video.pause();
      }
    });
  }, [activeIndex, failedVideoIds, manuallyPaused, shorts]);

  React.useEffect(() => {
    shorts.forEach((short) => {
      const video = videoRefs.current.get(short._id);
      if (!video) return;
      video.muted = muted;
    });
  }, [muted, shorts]);

  React.useEffect(() => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    if (shorts.length - activeIndex <= 3) {
      void q.fetchNextPage();
    }
  }, [activeIndex, q, shorts.length]);

  const goToIndex = React.useCallback((targetIdx: number) => {
    const root = feedRef.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("[data-short-slide]");
    const target = sections.item(targetIdx);
    if (!target) return;
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const togglePause = React.useCallback((shortId: string) => {
    setManuallyPaused((prev) => {
      const next = new Set(prev);
      if (next.has(shortId)) next.delete(shortId);
      else next.add(shortId);
      return next;
    });
  }, []);

  const handleCenterTap = React.useCallback((shortId: string) => {
    togglePause(shortId);
    setTapFeedbackId(shortId);
    window.setTimeout(() => {
      setTapFeedbackId((prev) => (prev === shortId ? null : prev));
    }, 220);
  }, [togglePause]);

  const likeMutation = useMutation({
    mutationFn: (postId: string) => toggleLike(postId),
    onMutate: async (postId: string) => {
      await qc.cancelQueries({ queryKey: ["shorts"] });
      const previous = qc.getQueriesData<ShortsData>({ queryKey: ["shorts"] });
      patchShortsQueries(qc, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            shorts: page.shorts.map((s) => {
              if (s._id !== postId) return s;
              const nextLiked = !s.isLiked;
              return {
                ...s,
                isLiked: nextLiked,
                likesCount: Math.max((s.likesCount ?? 0) + (nextLiked ? 1 : -1), 0),
              };
            }),
          })),
        };
      });
      return { previous };
    },
    onSuccess: (data, postId) => {
      const nextLiked = data?.isLiked;
      const likesCount = data?.likesCount;
      if (typeof nextLiked === "boolean" && typeof likesCount === "number") {
        patchShortsQueries(qc, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              shorts: page.shorts.map((s) => (s._id === postId ? { ...s, isLiked: nextLiked, likesCount } : s)),
            })),
          };
        });
      }
      const liked = nextLiked ?? false;
      const ids = getLikedPostIds();
      const idSet = new Set(ids);
      if (liked) idSet.add(postId);
      else idSet.delete(postId);
      setLikedPostIds(Array.from(idSet));
    },
    onError: (e: unknown, _postId, ctx) => {
      ctx?.previous?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  const handleSave = React.useCallback(
    (short: Post) => {
      const ids = getSavedPostIds();
      const idSet = new Set(ids);
      const nextSaved = !short.isSaved;
      if (nextSaved) idSet.add(short._id);
      else idSet.delete(short._id);
      setSavedPostIds(Array.from(idSet));
      patchShortsQueries(qc, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            shorts: page.shorts.map((s) => (s._id === short._id ? { ...s, isSaved: nextSaved } : s)),
          })),
        };
      });
      toast.success(nextSaved ? "Saved" : "Removed from saved");
    },
    [qc]
  );

  // TripComments manages its own ["post", id] query and doesn't notify the
  // parent when a comment is posted, so the commentsCount badge on this page
  // would otherwise go stale until the next full ["shorts"] refetch (the
  // same is true of feed/page.tsx's comment sheet). Refetching the whole
  // ["shorts"] infinite query on close isn't safe here -- getShorts is a
  // personalized, session-deduped ranking, not a stable page list, so a
  // refetch could reorder or drop already-visible shorts. Fetching just this
  // one post and patching its count in-place avoids that.
  const handleCloseComments = React.useCallback(async () => {
    const short = commentsShort;
    setCommentsShort(null);
    if (!short) return;
    try {
      const fresh = await getPostById(short._id);
      patchShortsQueries(qc, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            shorts: page.shorts.map((s) =>
              s._id === short._id ? { ...s, commentsCount: fresh.commentsCount } : s
            ),
          })),
        };
      });
    } catch {
      // best-effort refresh only
    }
  }, [commentsShort, qc]);

  return (
    <div className="h-full bg-transparent">
      {q.isLoading ? (
        <div className="grid h-full place-items-center p-6">
          <div className="w-full max-w-[440px] space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] rounded-3xl bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      ) : q.isError ? (
        <div className="grid h-full place-items-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-soft dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <p className="text-sm text-red-600 dark:text-red-300">Failed to load shorts.</p>
            <Button className="mt-3" onClick={() => q.refetch()}>
              Try again
            </Button>
          </div>
        </div>
      ) : shorts.length === 0 ? (
        <div className="grid h-full place-items-center p-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-12 text-center shadow-soft dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <Play className="mx-auto h-12 w-12 text-slate-400 dark:text-zinc-400" />
            <p className="mt-3 text-slate-500 dark:text-zinc-300">No shorts yet.</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 px-2 py-3 sm:px-5 sm:py-5">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white/95 to-slate-50/90 px-4 py-3 shadow-soft dark:border-zinc-800/80 dark:from-zinc-900/95 dark:to-zinc-900/80">
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">Shorts</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Swipe or scroll to watch more</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              onClick={() => setMuted((prev) => !prev)}
              aria-label={muted ? "Unmute shorts" : "Mute shorts"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-3xl border border-zinc-900/15 bg-gradient-to-br from-slate-100/90 via-slate-100/70 to-slate-200/60 shadow-soft dark:border-white/15 dark:from-slate-950 dark:via-slate-950 dark:to-zinc-950">
            <div
              ref={feedRef}
              className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {shorts.map((short, idx) => {
                const videoUrl = getVideoUrl(short);
                const thumbUrl = getThumbnailUrl(short);
                const isPaused = manuallyPaused.has(short._id);
                const isVideoFailed = failedVideoIds.has(short._id);

                return (
                  <section
                    key={short._id}
                    data-short-slide
                    data-idx={idx}
                    className="flex h-full min-h-[calc(100vh-10rem)] snap-start items-center justify-center p-2 sm:p-4"
                  >
                    <div className="flex h-full w-full max-w-[700px] items-center justify-center gap-3 sm:gap-5">
                      <div className="relative aspect-[9/16] h-[90%] max-h-[760px] w-full max-w-[440px] overflow-hidden rounded-3xl border border-zinc-900/20 bg-slate-900 shadow-[0_0_0_1px_rgba(2,6,23,0.12),0_20px_65px_rgba(0,0,0,0.35)] dark:border-white/20 dark:bg-zinc-900 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_20px_65px_rgba(0,0,0,0.6)]">
                        {videoUrl && !isVideoFailed ? (
                          <button
                            type="button"
                            className="relative block h-full w-full cursor-pointer"
                            onClick={() => handleCenterTap(short._id)}
                            aria-label={isPaused ? "Play short" : "Pause short"}
                          >
                            <video
                              ref={(node) => {
                                if (!node) {
                                  videoRefs.current.delete(short._id);
                                  return;
                                }
                                videoRefs.current.set(short._id, node);
                              }}
                              src={videoUrl}
                              poster={thumbUrl || undefined}
                              loop
                              muted={muted}
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-contain"
                              onError={() => setFailedVideoIds((prev) => new Set(prev).add(short._id))}
                            />
                            <span
                              className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                                tapFeedbackId === short._id ? "opacity-100" : "opacity-0"
                              }`}
                            >
                              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/35 bg-black/40 text-white backdrop-blur">
                                {isPaused ? <Play className="h-7 w-7" /> : <Pause className="h-7 w-7" />}
                              </span>
                            </span>
                          </button>
                        ) : thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={short.caption || "Short"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                            <Play className="h-14 w-14 text-zinc-500" />
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {short.user?.fullName ? `@${short.user.fullName}` : "Traveler"}
                            </p>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
                              onClick={() => togglePause(short._id)}
                              aria-label={isPaused ? "Play short" : "Pause short"}
                            >
                              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                            </Button>
                          </div>
                          <p className="line-clamp-3 text-sm leading-relaxed text-zinc-200">
                            {short.caption || "Short-form video from the community."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-2 self-end pb-5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="relative h-12 w-12 overflow-hidden rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                          aria-label={`View ${short.user?.username || "user"} profile`}
                        >
                          {short.user?.profilePic ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={short.user.profilePic}
                              alt={short.user?.fullName || "Profile"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-semibold">
                              {(short.user?.fullName || short.user?.username || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-primary text-on-primary dark:border-zinc-900">
                            {short.user?.isFollowing ? <Check className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                          onClick={() => likeMutation.mutate(short._id)}
                          aria-label={short.isLiked ? "Unlike" : "Like"}
                        >
                          <motion.span whileTap={{ scale: 0.9 }}>
                            <Heart
                              className={cn(
                                "h-5 w-5",
                                short.isLiked ? "fill-red-500 text-red-500" : undefined
                              )}
                            />
                          </motion.span>
                        </Button>
                        <p className="text-xs text-slate-700 dark:text-zinc-300">{short.likesCount ?? 0}</p>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                          onClick={() => setCommentsShort(short)}
                          aria-label="Comments"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </Button>
                        <p className="text-xs text-slate-700 dark:text-zinc-300">{short.commentsCount ?? 0}</p>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                          onClick={() => setShareShort(short)}
                          aria-label="Share short"
                        >
                          <Share2 className="h-5 w-5" />
                        </Button>
                        <p className="text-xs text-slate-700 dark:text-zinc-300">{short.viewsCount ?? 0}</p>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-11 w-11 rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                          onClick={() => handleSave(short)}
                          aria-label={short.isSaved ? "Remove from saved" : "Save short"}
                        >
                          <Bookmark
                            className={cn(
                              "h-5 w-5",
                              short.isSaved ? "fill-sky-500 text-sky-500" : undefined
                            )}
                          />
                        </Button>
                        <div className="mt-1 flex flex-col gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 disabled:opacity-40 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                            onClick={() => goToIndex(idx - 1)}
                            disabled={idx === 0}
                            aria-label="Previous short"
                          >
                            <ChevronUp className="h-5 w-5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-full border border-zinc-900/20 bg-white/75 text-slate-700 backdrop-blur hover:bg-primary/20 disabled:opacity-40 dark:border-white/15 dark:bg-black/35 dark:text-white dark:hover:bg-primary/30"
                            onClick={() => goToIndex(idx + 1)}
                            disabled={idx >= shorts.length - 1}
                            aria-label="Next short"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
            {q.isFetchingNextPage && (
              <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/20 bg-black/55 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-zinc-100">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading more
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {commentsShort && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          role="presentation"
          onClick={handleCloseComments}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Comments"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-50">
                  {commentsShort.caption || "Comments"}
                </p>
                <p className="text-xs text-zinc-400">
                  {commentsShort.user?.fullName || commentsShort.user?.username || "Traveler"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-xl text-zinc-200 hover:bg-zinc-800 hover:text-white"
                aria-label="Close comments"
                onClick={handleCloseComments}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <TripComments postId={commentsShort._id} />
            </div>
          </motion.div>
        </div>
      )}

      <SharePostModal
        open={!!shareShort}
        onClose={() => setShareShort(null)}
        post={shareShort ?? ({} as Post)}
        currentUserId={user?._id}
      />
    </div>
  );
}

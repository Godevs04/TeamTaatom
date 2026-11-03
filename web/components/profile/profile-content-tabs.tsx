"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Bookmark, Copy, Eye, Images, Loader2, Lock, Play, Video } from "lucide-react";
import { getPostById, getUserPosts, getUserShorts } from "../../lib/api";
import { getSavedPostIds } from "../../lib/utils";
import { formatViewCount } from "../../lib/number-format";
import { cn } from "../../lib/utils";
import { useMounted } from "../../hooks/use-mounted";
import { Skeleton } from "../ui/skeleton";
import type { Post } from "../../types/post";

export type ProfileTab = "posts" | "shorts" | "saved";
type SavedSubTab = "posts" | "shorts";

const PAGE_SIZE = 24;

function thumbFor(post: Post): string {
  return (
    post.imageUrl ||
    post.thumbnailUrl ||
    (Array.isArray(post.images) && post.images[0]) ||
    (Array.isArray(post.imageUrls) && post.imageUrls[0]) ||
    ""
  );
}

function isShortPost(post: Post): boolean {
  return post.type === "short";
}

/** Square grid tile (mobile profile.tsx renderProfileItem): multi-image badge + views pill. */
function GridTile({
  post,
  href,
  showMultiBadge,
  isShort,
}: {
  post: Post;
  href: string;
  showMultiBadge: boolean;
  isShort?: boolean;
}) {
  const thumb = thumbFor(post);
  const imageCount = Array.isArray(post.images) ? post.images.length : Array.isArray(post.imageUrls) ? post.imageUrls.length : 0;
  return (
    <Link
      href={href}
      className="group relative block aspect-square overflow-hidden rounded-2xl bg-slate-200 dark:bg-zinc-800"
      aria-label={post.caption || (isShort ? "Open short" : "Open post")}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-slate-400">
          {isShort ? <Play className="h-8 w-8" /> : <Images className="h-8 w-8" />}
        </span>
      )}
      {showMultiBadge && imageCount > 1 ? (
        <span className="absolute right-2 top-2 rounded-md bg-black/45 p-1 text-white" aria-label="Multiple photos">
          <Copy className="h-3.5 w-3.5" />
        </span>
      ) : null}
      {isShort ? (
        <span className="absolute right-2 top-2 rounded-md bg-black/45 p-1 text-white" aria-hidden>
          <Play className="h-3.5 w-3.5 fill-white" />
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
        <Eye className="h-3 w-3" />
        {formatViewCount(post.viewsCount)}
      </span>
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-2xl" />
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-slate-500 dark:text-zinc-400">
      <Images className="mb-3 h-12 w-12 opacity-50" />
      <p className="text-[15px] font-medium">{label}</p>
    </div>
  );
}

/** Calls `onVisible` when the sentinel scrolls into view (infinite pagination). */
function LoadMoreSentinel({ onVisible, loading }: { onVisible: () => void; loading: boolean }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const cbRef = React.useRef(onVisible);
  cbRef.current = onVisible;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) cbRef.current();
    }, { rootMargin: "600px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="flex justify-center py-4">
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
    </div>
  );
}

function PillTabs<T extends string>({
  tabs,
  active,
  onChange,
  small,
}: {
  tabs: Array<{ id: T; label: string; icon: React.ComponentType<{ className?: string }> }>;
  active: T;
  onChange: (id: T) => void;
  small?: boolean;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex rounded-[26px] border border-[rgba(28,115,180,0.12)] bg-white/70 p-1 dark:border-white/10 dark:bg-white/5",
        small && "mx-auto max-w-xs"
      )}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[22px] font-semibold transition-colors",
              small ? "py-1.5 text-xs" : "py-2.5 text-sm",
              selected
                ? "bg-gradient-to-r from-taatom-ocean to-taatom-emerald text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            )}
          >
            <Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileContentTabs({
  userId,
  isOwnProfile,
  canViewPosts,
  followRequestSent,
  initialTab = "posts",
}: {
  userId: string;
  isOwnProfile: boolean;
  canViewPosts: boolean;
  followRequestSent?: boolean;
  initialTab?: ProfileTab;
}) {
  const mounted = useMounted();
  const [tab, setTab] = React.useState<ProfileTab>(
    initialTab === "saved" && !isOwnProfile ? "posts" : initialTab
  );
  const [savedSub, setSavedSub] = React.useState<SavedSubTab>("posts");

  const postsQ = useInfiniteQuery({
    queryKey: ["profile-posts", userId],
    queryFn: ({ pageParam }) => getUserPosts(userId, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.pagination?.hasNextPage ? all.length + 1 : undefined),
    enabled: canViewPosts && tab === "posts",
  });

  const shortsQ = useInfiniteQuery({
    queryKey: ["user-shorts", userId],
    queryFn: ({ pageParam }) => getUserShorts(userId, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.shorts.length, 0);
      return loaded < last.totalShorts && last.shorts.length > 0 ? all.length + 1 : undefined;
    },
    enabled: canViewPosts && tab === "shorts",
  });

  const savedQ = useQuery({
    queryKey: ["profile-saved", userId],
    queryFn: async () => {
      const ids = getSavedPostIds();
      const results = await Promise.allSettled(ids.map((id) => getPostById(id)));
      return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value as Post] : []));
    },
    enabled: mounted && isOwnProfile && tab === "saved",
  });

  const tabs = [
    { id: "posts" as const, label: "Posts", icon: Images },
    { id: "shorts" as const, label: "Shorts", icon: Video },
    ...(isOwnProfile ? [{ id: "saved" as const, label: "Saved", icon: Bookmark }] : []),
  ];

  const posts = React.useMemo(
    () => (postsQ.data?.pages.flatMap((p) => p.posts ?? []) ?? []).filter((p) => !isShortPost(p)),
    [postsQ.data]
  );
  const shorts = React.useMemo(() => shortsQ.data?.pages.flatMap((p) => p.shorts) ?? [], [shortsQ.data]);
  const saved = React.useMemo(() => {
    const list = savedQ.data ?? [];
    return list.filter((p) => (savedSub === "shorts" ? isShortPost(p) : !isShortPost(p)));
  }, [savedQ.data, savedSub]);

  const shortHref = (short: Post, ownerId: string) =>
    `/shorts?userId=${encodeURIComponent(ownerId)}&postId=${encodeURIComponent(short._id)}`;

  let body: React.ReactNode;
  if (!canViewPosts && tab !== "saved") {
    body = (
      <div className="flex flex-col items-center py-10 text-center text-slate-500 dark:text-zinc-400">
        <Lock className="mb-3 h-12 w-12 opacity-60" />
        <p className="text-[15px] font-semibold text-slate-700 dark:text-zinc-200">
          {followRequestSent ? "Follow request pending…" : "Follow to view posts"}
        </p>
        <p className="mt-1 text-sm">
          {followRequestSent
            ? "You'll see their posts once they approve your request."
            : "This account's posts are visible to followers only."}
        </p>
      </div>
    );
  } else if (tab === "posts") {
    body = postsQ.isPending ? (
      <GridSkeleton />
    ) : posts.length === 0 ? (
      <EmptyState label="No posts yet" />
    ) : (
      <>
        <div className="grid grid-cols-3 gap-0.5">
          {posts.map((post) => (
            <GridTile key={post._id} post={post} href={`/trip/${post._id}`} showMultiBadge={isOwnProfile} />
          ))}
        </div>
        {postsQ.hasNextPage ? (
          <LoadMoreSentinel onVisible={() => void postsQ.fetchNextPage()} loading={postsQ.isFetchingNextPage} />
        ) : null}
      </>
    );
  } else if (tab === "shorts") {
    body = shortsQ.isPending ? (
      <GridSkeleton />
    ) : shorts.length === 0 ? (
      <EmptyState label="No shorts yet" />
    ) : (
      <>
        <div className="grid grid-cols-3 gap-0.5">
          {shorts.map((short) => (
            <GridTile key={short._id} post={short} href={shortHref(short, userId)} showMultiBadge={false} isShort />
          ))}
        </div>
        {shortsQ.hasNextPage ? (
          <LoadMoreSentinel onVisible={() => void shortsQ.fetchNextPage()} loading={shortsQ.isFetchingNextPage} />
        ) : null}
      </>
    );
  } else {
    body = (
      <div className="space-y-3">
        <PillTabs
          small
          tabs={[
            { id: "posts" as const, label: "Posts", icon: Images },
            { id: "shorts" as const, label: "Shorts", icon: Video },
          ]}
          active={savedSub}
          onChange={setSavedSub}
        />
        {!mounted || savedQ.isPending ? (
          <GridSkeleton />
        ) : saved.length === 0 ? (
          <EmptyState label="No saved items" />
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {saved.map((post) => (
              <GridTile
                key={post._id}
                post={post}
                href={isShortPost(post) ? shortHref(post, post.user?._id || userId) : `/trip/${post._id}`}
                showMultiBadge
                isShort={isShortPost(post)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <PillTabs tabs={tabs} active={tab} onChange={setTab} />
      {body}
    </section>
  );
}

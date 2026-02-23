"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getShorts } from "../../../lib/api";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";
import { Play } from "lucide-react";

type ShortItem = {
  _id: string;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  videoUrl?: string | null;
  images?: string[];
  caption?: string;
  user?: { fullName?: string };
};

function getThumbnailUrl(short: ShortItem): string {
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

function ShortCard({ short, loadFailed, onLoadFail }: { short: ShortItem; loadFailed: boolean; onLoadFail: () => void }) {
  const thumbUrl = getThumbnailUrl(short);
  const showPlaceholder = !thumbUrl || loadFailed;

  return (
    <Link
      href={`/trip/${short._id}`}
      className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-soft transition-shadow hover:shadow-card dark:border-zinc-800 dark:bg-zinc-800"
    >
      {showPlaceholder ? (
        <div className="flex h-full w-full items-center justify-center bg-slate-200 dark:bg-zinc-700">
          <Play className="h-12 w-12 text-slate-400" />
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbUrl}
          alt={short.caption || "Short"}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={onLoadFail}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <p className="line-clamp-2 text-sm font-medium text-white">{short.caption || "Short"}</p>
        {short.user?.fullName && <p className="mt-0.5 text-xs text-white/80">{short.user.fullName}</p>}
      </div>
    </Link>
  );
}

export default function ShortsPage() {
  const [failedImageIds, setFailedImageIds] = React.useState<Set<string>>(() => new Set());

  const q = useInfiniteQuery({
    queryKey: ["shorts"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await getShorts({ page: pageParam, limit: 12 });
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

  const shorts = q.data?.pages.flatMap((p) => (p as { shorts?: unknown[] }).shorts ?? []) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900/95">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Shorts</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Short-form videos from the community.
        </p>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load shorts.</p>
          <Button className="mt-3" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      ) : shorts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <Play className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-3 text-slate-500 dark:text-slate-400">No shorts yet.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(shorts as ShortItem[]).map((short) => (
              <ShortCard
                key={short._id}
                short={short}
                loadFailed={failedImageIds.has(short._id)}
                onLoadFail={() => setFailedImageIds((prev) => new Set(prev).add(short._id))}
              />
            ))}
          </div>
          {q.hasNextPage && (
            <div className="flex justify-center py-6">
              <Button variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

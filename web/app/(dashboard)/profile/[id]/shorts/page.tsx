"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Play } from "lucide-react";
import { getUserShorts } from "../../../../../lib/api";
import { Button } from "../../../../../components/ui/button";
import { Card } from "../../../../../components/ui/card";
import { Skeleton } from "../../../../../components/ui/skeleton";
import type { Post } from "../../../../../types/post";

function thumbForShort(s: Post): string {
  return (
    s.thumbnailUrl ||
    s.imageUrl ||
    (Array.isArray(s.images) && s.images[0]) ||
    ""
  );
}

export default function ProfileShortsPage() {
  const params = useParams();
  const userId = typeof params?.id === "string" ? params.id : "";

  const q = useInfiniteQuery({
    queryKey: ["user-shorts", userId],
    queryFn: async ({ pageParam = 1 }) => getUserShorts(userId, pageParam, 18),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.shorts.length, 0);
      if (loaded >= (lastPage.totalShorts ?? 0)) return undefined;
      if (lastPage.shorts.length === 0) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });

  const shorts = React.useMemo(() => q.data?.pages.flatMap((p) => p.shorts) ?? [], [q.data?.pages]);
  const totalShorts = q.data?.pages[0]?.totalShorts ?? 0;

  React.useEffect(() => {
    const onScroll = () => {
      if (!q.hasNextPage || q.isFetchingNextPage) return;
      const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 700;
      if (nearBottom) void q.fetchNextPage();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [q]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl shrink-0" asChild>
          <Link href={`/profile/${userId}`} aria-label="Back to profile">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Shorts</h1>
          <p className="text-sm text-muted-foreground">
            {totalShorts > 0 ? `${totalShorts} short${totalShorts === 1 ? "" : "s"}` : "Short videos"}
          </p>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
          ))}
        </div>
      ) : null}

      {!q.isLoading && shorts.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">No shorts yet for this profile.</p>
          <Button className="mt-4 rounded-xl" variant="outline" asChild>
            <Link href={`/profile/${userId}`}>Back to profile</Link>
          </Button>
        </Card>
      ) : null}

      {shorts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shorts.map((s) => {
            const thumb = thumbForShort(s);
            return (
              <Link
                key={s._id}
                href={`/trip/${s._id}`}
                className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-soft transition-shadow hover:shadow-card"
              >
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumb}
                    alt={s.caption || "Short"}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-200">
                    <Play className="h-10 w-10 text-slate-400" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="line-clamp-2 text-xs font-medium text-white">{s.caption || "Short"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}

      {q.isFetchingNextPage ? (
        <div className="flex justify-center py-6">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      ) : null}
    </div>
  );
}

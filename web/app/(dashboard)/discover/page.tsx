"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Compass, Hash, Search } from "lucide-react";
import { getTrendingHashtags } from "../../../lib/api";
import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/ui/button";

export default function DiscoverPage() {
  const trendingQ = useQuery({
    queryKey: ["trending-hashtags", "discover"],
    queryFn: () => getTrendingHashtags(28, "24h"),
    staleTime: 60_000,
  });

  const tags = trendingQ.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 sm:space-y-8">
      <div>
        <div className="flex items-center gap-2 text-primary">
          <Compass className="h-8 w-8" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Discover</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Trending hashtags and quick ways to explore — same ideas as the app search experience.
        </p>
        <Button className="mt-4 rounded-xl gap-2" asChild>
          <Link href="/search">
            <Search className="h-4 w-4" />
            Search travelers &amp; trips
          </Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Hash className="h-5 w-5 text-primary" aria-hidden />
          Trending hashtags
        </h2>
        {trendingQ.isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No trending hashtags right now. Try search to find trips and people.
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((h) => (
              <Link
                key={h.name}
                href={`/hashtag/${encodeURIComponent(h.name)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="text-primary">#</span>
                {h.name}
                <span className="text-xs font-medium text-muted-foreground">({h.postCount})</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

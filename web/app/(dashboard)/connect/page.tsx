"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, PlusCircle, Bookmark, Archive, CreditCard, Loader2 } from "lucide-react";
import { connectGetCommunities } from "@/lib/connect-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ConnectPage } from "@/types/connect";

export default function ConnectHubPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["connect-communities", page],
    queryFn: () => connectGetCommunities(page, 12),
  });

  const pages = data?.pages ?? [];
  const pagination = data?.pagination;
  const hasNext = pagination && page < pagination.totalPages;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24 lg:pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Connect
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Discover creator pages, subscribe, and manage your communities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/connect/search">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/connect/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create page
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/connect/following"
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <Bookmark className="h-8 w-8 text-primary" />
          <span className="font-medium text-slate-900 dark:text-white">Following</span>
        </Link>
        <Link
          href="/connect/archived"
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <Archive className="h-8 w-8 text-primary" />
          <span className="font-medium text-slate-900 dark:text-white">Archived</span>
        </Link>
        <Link
          href="/connect/my-subscriptions"
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <CreditCard className="h-8 w-8 text-primary" />
          <span className="font-medium text-slate-900 dark:text-white">Subscriptions</span>
        </Link>
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Users className="h-5 w-5 text-primary" />
          Communities
        </h2>
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <p className="text-center text-sm text-destructive">Could not load communities.</p>
        )}
        {!isLoading && !isError && pages.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-zinc-400">No communities yet.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {pages.map((p: ConnectPage) => (
            <Link key={p._id} href={`/connect/page/${p._id}`}>
              <Card className="h-full overflow-hidden transition hover:shadow-lg hover:ring-2 hover:ring-primary/20">
                <div className="relative h-28 bg-gradient-to-br from-primary/20 to-violet-500/10">
                  {p.bannerImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.bannerImage} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <CardContent className="relative pt-10">
                  <div className="absolute -top-8 left-4 h-16 w-16 overflow-hidden rounded-2xl border-2 border-white bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                    {p.profileImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                        {p.name?.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-zinc-400">{p.bio}</p>
                  <div className="mt-3 flex gap-3 text-xs text-slate-500">
                    <span>{p.followerCount ?? 0} followers</span>
                    {p.isFollowing && (
                      <span className="font-medium text-primary">Following</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((x) => Math.max(1, x - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setPage((x) => x + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

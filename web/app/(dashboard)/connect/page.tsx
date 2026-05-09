"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Link2, Search, PlusCircle, Bookmark, Archive, CreditCard, Loader2 } from "lucide-react";
import { connectGetCommunities, connectGetConnectPages } from "@/lib/connect-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ConnectPage } from "@/types/connect";

type TabType = "connect" | "community";

function PageCard({ p }: { p: ConnectPage }) {
  return (
    <Link href={`/connect/page/${p._id}`}>
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
  );
}

function PageGrid({
  pages,
  isLoading,
  isError,
  emptyLabel,
  pagination,
  page,
  setPage,
}: {
  pages: ConnectPage[];
  isLoading: boolean;
  isError: boolean;
  emptyLabel: string;
  pagination?: { totalPages: number } | null;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  const hasNext = pagination && page < pagination.totalPages;
  return (
    <>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {isError && (
        <p className="text-center text-sm text-destructive">Could not load pages.</p>
      )}
      {!isLoading && !isError && pages.length === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-zinc-400">{emptyLabel}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {pages.map((p: ConnectPage) => (
          <PageCard key={p._id} p={p} />
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
    </>
  );
}

export default function ConnectHubPage() {
  const [activeTab, setActiveTab] = React.useState<TabType>("connect");
  const [connectPage, setConnectPage] = React.useState(1);
  const [communityPage, setCommunityPage] = React.useState(1);

  const connectQuery = useQuery({
    queryKey: ["connect-pages", connectPage],
    queryFn: () => connectGetConnectPages(connectPage, 12),
    enabled: activeTab === "connect",
  });

  const communityQuery = useQuery({
    queryKey: ["connect-communities", communityPage],
    queryFn: () => connectGetCommunities(communityPage, 12),
    enabled: activeTab === "community",
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "connect", label: "Connect", icon: <Link2 className="h-4 w-4" /> },
    { key: "community", label: "Community", icon: <Users className="h-4 w-4" /> },
  ];

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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "connect" && (
          <PageGrid
            pages={connectQuery.data?.pages ?? []}
            isLoading={connectQuery.isLoading}
            isError={connectQuery.isError}
            emptyLabel="No connect pages yet."
            pagination={connectQuery.data?.pagination}
            page={connectPage}
            setPage={setConnectPage}
          />
        )}
        {activeTab === "community" && (
          <PageGrid
            pages={communityQuery.data?.pages ?? []}
            isLoading={communityQuery.isLoading}
            isError={communityQuery.isError}
            emptyLabel="No communities yet."
            pagination={communityQuery.data?.pagination}
            page={communityPage}
            setPage={setCommunityPage}
          />
        )}
      </div>
    </div>
  );
}

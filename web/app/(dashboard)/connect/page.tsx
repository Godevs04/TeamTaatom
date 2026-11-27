"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  PlusCircle,
  Bookmark,
  Archive,
  CreditCard,
  Loader2,
  Wallet,
  Compass,
  CalendarDays,
  Trophy,
  MapPin,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { connectGetCommunities, connectGetConnectPages } from "@/lib/connect-api";
import { listEventsFeed, type CommunityEvent } from "@/lib/community-api";
import { FindUsersPanel } from "@/components/connect/find-users-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ConnectPage } from "@/types/connect";
import { cn } from "@/lib/utils";

type TabType = "community" | "event" | "find";
type CommunitySubTab = "pages" | "communities";

function memberCount(p: ConnectPage) {
  const normal = Math.max(0, Math.floor((p.followerCount ?? 0) + 1));
  const isCommunity = p.category === "community";
  return isCommunity ? Math.max(0, normal - 1) : normal;
}

function formatCountdown(startsAt: string): string | null {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return null;
  const diff = start - Date.now();
  if (diff <= 0) return "Started";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Starts in ${hours}h`;
  return `Starts in ${Math.round(hours / 24)}d`;
}

function formatWhen(startsAt: string) {
  try {
    return new Date(startsAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

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
            <span>
              {memberCount(p)} {memberCount(p) === 1 ? "member" : "members"}
            </span>
            {p.isFollowing && (
              <span className="font-medium text-primary">Following</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EventCard({ event }: { event: CommunityEvent }) {
  const pageId = String(event.connectPageId || event.page?._id || "");
  const starts = new Date(event.startsAt);
  const day = Number.isFinite(starts.getTime()) ? String(starts.getDate()) : "—";
  const mon = Number.isFinite(starts.getTime())
    ? starts.toLocaleString(undefined, { month: "short" }).toUpperCase()
    : "";
  const countdown = formatCountdown(event.startsAt);

  return (
    <Link
      href={pageId ? `/connect/page/${pageId}` : "/connect"}
      className="block rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 shadow-sm transition hover:border-primary/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
    >
      <div className="flex items-start gap-3">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-amber-100 px-2 py-2.5 dark:bg-amber-500/15">
          <span className="text-lg font-extrabold leading-none text-amber-800 dark:text-amber-300">
            {day}
          </span>
          <span className="mt-0.5 text-[10px] font-bold tracking-wide text-amber-700 dark:text-amber-400">
            {mon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-white">{event.title}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">
            {formatWhen(event.startsAt)}
            {event.location?.address ? ` · ${event.location.address}` : ""}
          </p>
          {event.page?.name ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
              {event.page.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.page.profileImage}
                  alt=""
                  className="h-4 w-4 rounded object-cover"
                />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              <span className="truncate">{event.page.name}</span>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.isRegistered ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                You&apos;re in
              </span>
            ) : null}
            {event.isWaitlisted ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                Waitlist
              </span>
            ) : null}
            {event.competition?.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                <Trophy className="h-3 w-3" />
                Competition
              </span>
            ) : null}
            {countdown ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                {countdown}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" />
      </div>
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
  const [activeTab, setActiveTab] = React.useState<TabType>("community");
  const [communitySubTab, setCommunitySubTab] = React.useState<CommunitySubTab>("communities");
  const [pagesPage, setPagesPage] = React.useState(1);
  const [communitiesPage, setCommunitiesPage] = React.useState(1);
  const [eventPage, setEventPage] = React.useState(1);

  const pagesQuery = useQuery({
    queryKey: ["connect-pages", pagesPage],
    queryFn: () => connectGetConnectPages(pagesPage, 12),
    enabled: activeTab === "community" && communitySubTab === "pages",
  });

  const communitiesQuery = useQuery({
    queryKey: ["connect-communities", communitiesPage],
    queryFn: () => connectGetCommunities(communitiesPage, 12),
    enabled: activeTab === "community" && communitySubTab === "communities",
  });

  const eventsQuery = useQuery({
    queryKey: ["connect-events-feed", eventPage],
    queryFn: () => listEventsFeed(eventPage, 12),
    enabled: activeTab === "event",
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: "community", label: "Community", icon: <Users className="h-4 w-4" /> },
    { key: "event", label: "Event", icon: <CalendarDays className="h-4 w-4" /> },
    { key: "find", label: "Find", icon: <Compass className="h-4 w-4" /> },
  ];

  const feedEvents = eventsQuery.data?.events ?? [];
  const eventsPagination = eventsQuery.data?.pagination;
  const hasNextEvents = eventsPagination && eventPage < eventsPagination.totalPages;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24 lg:pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Connect
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Browse communities and pages, public events, and people to meet.
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          href="/connect/payouts"
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
        >
          <Wallet className="h-8 w-8 text-primary" />
          <span className="font-medium text-slate-900 dark:text-white">Payouts</span>
        </Link>
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

      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "community" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: "communities" as const, label: "Communities", icon: <Users className="h-3.5 w-3.5" /> },
                  { key: "pages" as const, label: "Pages", icon: <Sparkles className="h-3.5 w-3.5" /> },
                ] as const
              ).map((chip) => {
                const active = communitySubTab === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setCommunitySubTab(chip.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    )}
                  >
                    {chip.icon}
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {communitySubTab === "pages" ? (
              <PageGrid
                pages={pagesQuery.data?.pages ?? []}
                isLoading={pagesQuery.isLoading}
                isError={pagesQuery.isError}
                emptyLabel="No pages yet. Create one to get started."
                pagination={pagesQuery.data?.pagination}
                page={pagesPage}
                setPage={setPagesPage}
              />
            ) : (
              <PageGrid
                pages={communitiesQuery.data?.pages ?? []}
                isLoading={communitiesQuery.isLoading}
                isError={communitiesQuery.isError}
                emptyLabel="No communities yet."
                pagination={communitiesQuery.data?.pagination}
                page={communitiesPage}
                setPage={setCommunitiesPage}
              />
            )}
          </div>
        )}

        {activeTab === "event" && (
          <>
            {eventsQuery.isLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {eventsQuery.isError && (
              <p className="text-center text-sm text-destructive">Could not load events.</p>
            )}
            {!eventsQuery.isLoading && !eventsQuery.isError && feedEvents.length === 0 && (
              <p className="text-center text-sm text-slate-500 dark:text-zinc-400">
                No public or joined events yet.
              </p>
            )}
            <div className="space-y-3">
              {feedEvents.map((ev) => (
                <EventCard key={ev._id} event={ev} />
              ))}
            </div>
            {eventsPagination && eventsPagination.totalPages > 1 && (
              <div className="mt-6 flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={eventPage <= 1}
                  onClick={() => setEventPage((x) => Math.max(1, x - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNextEvents}
                  onClick={() => setEventPage((x) => x + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
        {activeTab === "find" && <FindUsersPanel />}
      </div>
    </div>
  );
}

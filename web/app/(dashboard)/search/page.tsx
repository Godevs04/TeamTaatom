"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, X } from "lucide-react";
import { searchPosts, searchUsers, searchHashtags, searchByLocation } from "../../../lib/api";
import { Input } from "../../../components/ui/input";
import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { getPostDisplayLocation } from "../../../lib/post-utils";
import { addRecentSearch, getRecentSearches, setRecentSearches } from "../../../lib/utils";
import { useMounted } from "../../../hooks/use-mounted";
import type { User } from "../../../types/user";
import type { Post } from "../../../types/post";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const [q, setQ] = React.useState(qFromUrl);

  // Sync state from URL when navigating to /search?q=...
  React.useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  const debounced = useDebounce(q, 250);

  // localStorage is unavailable during SSR, so recent searches start empty
  // and are populated post-mount — avoids a hydration mismatch between the
  // server's empty render and whatever a real browser has stored locally.
  const mounted = useMounted();
  const [recentSearches, setRecentSearchesState] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (mounted) setRecentSearchesState(getRecentSearches());
  }, [mounted]);
  const recordSearch = React.useCallback(() => {
    setRecentSearchesState(addRecentSearch(debounced));
  }, [debounced]);
  const removeRecentSearch = (query: string) => {
    const updated = getRecentSearches().filter((q2) => q2 !== query);
    setRecentSearches(updated);
    setRecentSearchesState(updated);
  };
  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    setRecentSearchesState([]);
  };

  const usersQ = useQuery({
    queryKey: ["search", "users", debounced],
    queryFn: () => searchUsers(debounced, 20),
    enabled: debounced.trim().length >= 2,
  });

  const postsQ = useQuery({
    queryKey: ["search", "posts", debounced],
    queryFn: () => searchPosts(debounced, 1, 20),
    enabled: debounced.trim().length >= 2,
  });

  const placesQ = useQuery({
    queryKey: ["search", "location", debounced],
    queryFn: () => searchByLocation(debounced, 1, 20),
    enabled: debounced.trim().length >= 2,
  });

  const hashtagTerm = debounced.trim().replace(/^#/, "");

  const hashtagsQ = useQuery({
    queryKey: ["search", "hashtags", hashtagTerm],
    queryFn: () => searchHashtags(hashtagTerm, 24),
    enabled: debounced.trim().length >= 2,
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight dark:text-zinc-50 sm:text-3xl">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find travelers, trips and places.</p>
      </div>

      <div className="rounded-3xl border bg-card p-4 shadow-card">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users, trips, hashtags, places…" />
        <p className="mt-2 text-xs text-muted-foreground">Type at least 2 characters.</p>
      </div>

      {q.trim().length === 0 ? (
        recentSearches.length === 0 ? null : (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-zinc-50">Recent Searches</h2>
              <button
                type="button"
                onClick={clearAllRecentSearches}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {recentSearches.map((query) => (
                <div
                  key={query}
                  className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-3 shadow-card"
                >
                  <button
                    type="button"
                    onClick={() => setQ(query)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate text-sm">{query}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecentSearch(query)}
                    aria-label={`Remove "${query}" from recent searches`}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )
      ) : debounced.trim().length < 2 ? null : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold dark:text-zinc-50">Travelers</h2>
            {usersQ.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (usersQ.data?.users?.length || 0) === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No matching users.</Card>
            ) : (
              <div className="space-y-3">
                {(usersQ.data?.users || []).map((u: User) => (
                  <Link key={u._id} href={`/profile/${u._id}`} onClick={recordSearch} className="flex items-center justify-between rounded-2xl border bg-card p-3 shadow-card hover:bg-accent">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.profilePic || ""} alt={u.fullName || "User"} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{u.fullName || u.username || "Traveler"}</div>
                        <div className="text-xs text-muted-foreground">@{u.username || "user"}</div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">View</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold dark:text-zinc-50">Hashtags</h2>
            {hashtagsQ.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-2xl" />
                ))}
              </div>
            ) : (hashtagsQ.data?.length || 0) === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No matching hashtags.</Card>
            ) : (
              <div className="flex flex-col gap-2">
                {(hashtagsQ.data || []).map((h) => (
                  <Link
                    key={h.name}
                    href={`/hashtag/${encodeURIComponent(h.name)}`}
                    onClick={recordSearch}
                    className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-card hover:bg-accent"
                  >
                    <span className="font-semibold text-primary">#{h.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.postCount} {h.postCount === 1 ? "post" : "posts"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold dark:text-zinc-50">Trips</h2>
            {postsQ.isLoading ? (
              <TripResultSkeletons />
            ) : (postsQ.data?.posts?.length || 0) === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No matching trips.</Card>
            ) : (
              <div className="space-y-3">
                {(postsQ.data?.posts || []).map((p: Post) => (
                  <TripResultCard key={p._id} post={p} onClick={recordSearch} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold dark:text-zinc-50">Places</h2>
            {placesQ.isLoading ? (
              <TripResultSkeletons />
            ) : (placesQ.data?.posts?.length || 0) === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No trips at a matching location.</Card>
            ) : (
              <div className="space-y-3">
                {(placesQ.data?.posts || []).map((p: Post) => (
                  <TripResultCard key={p._id} post={p} onClick={recordSearch} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** Shared by the Trips and Places sections — both render post results identically. */
function TripResultCard({ post, onClick }: { post: Post; onClick?: () => void }) {
  const imageSrc =
    post.imageUrl ||
    post.thumbnailUrl ||
    post.mediaUrl ||
    (Array.isArray(post.images) && post.images[0]) ||
    "";
  return (
    <Link href={`/trip/${post._id}`} onClick={onClick} className="group block overflow-hidden rounded-2xl border bg-card shadow-card hover:bg-accent">
      <div className="aspect-[16/9] bg-muted">
        {imageSrc ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageSrc} alt={post.caption || "Trip"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <span className="text-4xl" aria-hidden>🖼</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="line-clamp-1 text-sm font-semibold">{post.caption || "Trip"}</div>
        <div className="line-clamp-1 text-xs text-muted-foreground">{getPostDisplayLocation(post)}</div>
      </div>
    </Link>
  );
}

function TripResultSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-card p-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function useDebounce<T>(value: T, delayMs: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

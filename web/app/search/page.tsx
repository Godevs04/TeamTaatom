"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { searchPosts, searchUsers } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import type { User } from "../../types/user";
import type { Post } from "../../types/post";

export default function SearchPage() {
  const [q, setQ] = React.useState("");
  const debounced = useDebounce(q, 250);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find travelers and trips.</p>
      </div>

      <div className="rounded-3xl border bg-card p-4 shadow-card">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users, trips, hashtags…" />
        <p className="mt-2 text-xs text-muted-foreground">Type at least 2 characters.</p>
      </div>

      {debounced.trim().length < 2 ? null : (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Travelers</h2>
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
                  <Link key={u._id} href={`/profile/${u._id}`} className="flex items-center justify-between rounded-2xl border bg-card p-3 shadow-card hover:bg-accent">
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
            <h2 className="text-lg font-semibold">Trips</h2>
            {postsQ.isLoading ? (
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
            ) : (postsQ.data?.posts?.length || 0) === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">No matching trips.</Card>
            ) : (
              <div className="space-y-3">
                {(postsQ.data?.posts || []).map((p: Post) => (
                  <Link key={p._id} href={`/trip/${p._id}`} className="group block overflow-hidden rounded-2xl border bg-card shadow-card hover:bg-accent">
                    <div className="aspect-[16/9] bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl || p.thumbnailUrl || p.mediaUrl || ""} alt={p.caption || "Trip"} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-1 text-sm font-semibold">{p.caption || "Trip"}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{p.address || "Unknown location"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
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


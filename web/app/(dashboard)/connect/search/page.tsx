"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { connectSearchByName } from "@/lib/connect-api";
import type { ConnectPage } from "@/types/connect";

export default function ConnectSearchPage() {
  const [q, setQ] = React.useState("");
  const [activeQuery, setActiveQuery] = React.useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["connect-search", activeQuery],
    queryFn: () => connectSearchByName(activeQuery.trim(), 1, 24),
    enabled: activeQuery.trim().length >= 2,
  });

  const pages = data?.pages ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
        Find Connect pages
      </h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setActiveQuery(q);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name..."
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={q.trim().length < 2}>
          Search
        </Button>
      </form>

      {activeQuery.trim().length >= 2 && isFetching && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {activeQuery.trim().length >= 2 && !isFetching && pages.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">No pages found.</p>
      )}

      <ul className="space-y-2">
        {pages.map((p: ConnectPage) => (
          <li key={p._id}>
            <Link
              href={`/connect/page/${p._id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 transition hover:border-primary/30 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-800">
                {p.profileImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-semibold text-primary">
                    {p.name?.slice(0, 1)}
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                <p className="text-xs text-slate-500 line-clamp-1">{p.bio}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

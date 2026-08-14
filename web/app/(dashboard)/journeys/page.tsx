"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Footprints, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { journeyListForUser, journeyDelete } from "@/lib/journey-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { Journey } from "@/types/journey";

const PAGE_SIZE = 20;

export default function JourneysListPage() {
  const { user } = useAuth();
  const userId = user?._id ?? "";
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["journeys-user", userId],
    queryFn: ({ pageParam = 1 }) => journeyListForUser(userId, pageParam, PAGE_SIZE),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      if (!p || typeof p.page !== "number" || typeof p.limit !== "number" || typeof p.total !== "number") {
        return undefined;
      }
      const totalPages = Math.ceil(p.total / p.limit);
      return p.page < totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (journeyId: string) => journeyDelete(journeyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys-user", userId] });
      toast.success("Journey deleted");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const journeys = data?.pages.flatMap((p) => p.journeys) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          Journeys
        </h1>
        <Link
          href="/navigate"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-lg shadow-primary/25 hover:opacity-95"
        >
          Live navigate
        </Link>
      </div>
      {!userId && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">Sign in to see your journeys.</p>
      )}
      {userId && isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
        </div>
      )}
      {userId && !isLoading && journeys.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No journeys yet. Start one from Navigate while exploring.
        </p>
      )}
      <ul className="space-y-2">
        {(journeys as Journey[]).map((j) => (
          <li
            key={j._id}
            className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white pr-2 transition hover:border-primary/25 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <Link href={`/journeys/${j._id}`} className="flex min-w-0 flex-1 items-center gap-3 p-4">
              <Footprints className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-white">
                  {j.title || "Untitled journey"}
                </p>
                <p className="text-xs text-slate-500">
                  {j.status ?? "—"}
                  {typeof j.distanceTraveled === "number"
                    ? ` · ${(j.distanceTraveled / 1000).toFixed(2)} km`
                    : ""}
                </p>
              </div>
              <span className="text-xs text-primary">View →</span>
            </Link>
            <button
              type="button"
              aria-label="Delete journey"
              title="Delete journey"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete "${j.title || "this journey"}"? This cannot be undone.`)) {
                  deleteMutation.mutate(j._id);
                }
              }}
              className="shrink-0 rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
          >
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

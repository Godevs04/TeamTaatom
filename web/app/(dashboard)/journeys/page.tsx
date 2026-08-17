"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Footprints, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useConfirm } from "@/context/confirm-context";
import { journeyListForUser, journeyDelete } from "@/lib/journey-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { Journey } from "@/types/journey";

const PAGE_SIZE = 30;

export default function JourneysListPage() {
  const { user } = useAuth();
  const myId = user?._id ?? "";
  const searchParams = useSearchParams();
  const paramUserId = searchParams.get("userId");
  const paramUserName = searchParams.get("userName");
  const viewingUserId = paramUserId || myId;
  const isOwnList = !paramUserId || paramUserId === myId;
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["journeys-user", viewingUserId],
    queryFn: ({ pageParam = 1 }) => journeyListForUser(viewingUserId, pageParam, PAGE_SIZE),
    getNextPageParam: (lastPage) => {
      const p = lastPage.pagination;
      if (!p || typeof p.page !== "number" || typeof p.limit !== "number" || typeof p.total !== "number") {
        return undefined;
      }
      const totalPages = Math.ceil(p.total / p.limit);
      return p.page < totalPages ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!viewingUserId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => journeyDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys-user"] });
      toast.success("Journey deleted");
    },
    onError: (e) => toast.error(getFriendlyErrorMessage(e)),
  });

  const items: Journey[] =
    data?.pages.flatMap((page) => (page.journeys as Journey[]) || []) ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24 lg:pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
            {isOwnList ? "My journeys" : `${paramUserName || "Traveler"}'s journeys`}
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {isOwnList ? "Routes and trips you created" : "Completed journeys you have access to"}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-zinc-800">
          <Footprints className="h-10 w-10 text-slate-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-300">No journeys yet</p>
          {isOwnList ? (
            <>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Create one from the Navigate tab</p>
              <Link
                href="/navigate"
                className="mt-4 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Start a journey
              </Link>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Nothing to show yet</p>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {items.map((j) => (
          <li
            key={j._id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Link href={`/journeys/${j._id}`} className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900 dark:text-zinc-100">{j.title || "Untitled journey"}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                {j.startedAt
                  ? new Date(j.startedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Recent"}
                {j.polyline && ` · ${j.polyline.length} points`}
              </p>
            </Link>
            {isOwnList ? (
            <button
              type="button"
              aria-label="Delete journey"
              title="Delete journey"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: "Delete Journey",
                  description: `Are you sure you want to delete "${j.title || "this journey"}"? This action cannot be undone.`,
                  confirmText: "Delete",
                  variant: "destructive",
                });
                if (ok) {
                  deleteMutation.mutate(j._id);
                }
              }}
              className="shrink-0 rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            ) : null}
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

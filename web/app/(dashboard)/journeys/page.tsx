"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Footprints } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { journeyListForUser } from "@/lib/journey-api";
import type { Journey } from "@/types/journey";

export default function JourneysListPage() {
  const { user } = useAuth();
  const userId = user?._id ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["journeys-user", userId],
    queryFn: () => journeyListForUser(userId, 1, 30),
    enabled: !!userId,
  });

  const journeys = data?.journeys ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          Journeys
        </h1>
        <Link
          href="/navigate"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-95"
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
          <li key={j._id}>
            <Link
              href={`/journeys/${j._id}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-primary/25 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
            >
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
          </li>
        ))}
      </ul>
    </div>
  );
}

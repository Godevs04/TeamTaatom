"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getLocales } from "../../../lib/api";
import { Skeleton } from "../../../components/ui/skeleton";
import { MapPin } from "lucide-react";

export default function LocalePage() {
  const [countryCode, setCountryCode] = React.useState("");
  const [stateCode, setStateCode] = React.useState("");
  const [search, setSearch] = React.useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["locales", search, countryCode, stateCode],
    queryFn: () =>
      getLocales({
        search: search || undefined,
        countryCode: countryCode || undefined,
        stateCode: stateCode || undefined,
        page: 1,
        limit: 50,
      }),
  });

  const locales = data?.locales ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900/95">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Locales</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Discover places and destinations.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search places…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
          />
          <input
            type="text"
            placeholder="Country code (e.g. IN)"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            className="w-28 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
          />
          <input
            type="text"
            placeholder="State (e.g. Karnataka)"
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="w-36 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <p className="text-sm text-red-600 dark:text-red-400">Failed to load locales.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : locales.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900/95">
          <MapPin className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-3 text-slate-500 dark:text-slate-400">No locales found.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locales.map((locale) => (
            <div
              key={locale._id}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft transition-shadow hover:shadow-card dark:border-zinc-800 dark:bg-zinc-900/95"
            >
              <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800">
                {locale.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={locale.imageUrl}
                    alt={locale.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <MapPin className="h-12 w-12 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">{locale.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[locale.stateProvince, locale.stateCode, locale.countryCode].filter(Boolean).join(" · ") || locale.countryCode}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCollections, type Collection } from "../../../lib/api";
import { useAuth } from "../../../context/auth-context";
import { Button } from "../../../components/ui/button";
import { Library, Plus, ImageIcon } from "lucide-react";
import { Skeleton } from "../../../components/ui/skeleton";

export default function CollectionsPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["collections", user?._id],
    queryFn: () => getCollections(user?._id),
    enabled: !!user?._id,
  });

  const collections = data?.collections ?? [];

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <p className="text-slate-600 dark:text-zinc-400">Sign in to view your collections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 md:text-3xl">Collections</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Organise your trips and posts.</p>
        </div>
        <Button asChild className="rounded-xl gap-2">
          <Link href="/collections/create">
            <Plus className="h-4 w-4" />
            New collection
          </Link>
        </Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-slate-600 dark:text-zinc-400">Failed to load collections.</p>
          <Button className="mt-4 rounded-xl" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
            <Library className="h-8 w-8 text-slate-400 dark:text-zinc-500" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-zinc-50">No collections yet</h3>
          <p className="mt-2 text-[15px] text-slate-500 dark:text-zinc-400">Create a collection to group your favourite trips and posts.</p>
          <Button asChild className="mt-6 rounded-xl gap-2">
            <Link href="/collections/create">
              <Plus className="h-4 w-4" />
              Create collection
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((col: Collection) => (
            <Link
              key={col._id}
              href={`/collections/${col._id}`}
              className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium transition-shadow hover:shadow-premium-hover dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:shadow-premium-hover"
            >
              <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800">
                {col.coverImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={col.coverImage} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                ) : (col.posts?.length ?? 0) > 0 && col.posts?.[0]?.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={col.posts[0].imageUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-500">
                    <ImageIcon className="h-12 w-12" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 dark:text-zinc-50">{col.name}</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{col.posts?.length ?? 0} items</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

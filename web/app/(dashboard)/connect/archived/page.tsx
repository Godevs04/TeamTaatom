"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { connectGetArchived } from "@/lib/connect-api";
import type { ConnectPage } from "@/types/connect";

export default function ConnectArchivedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["connect-archived"],
    queryFn: () => connectGetArchived(1, 40),
  });

  const pages = data?.pages ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
        Archived pages
      </h1>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && pages.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">No archived pages.</p>
      )}
      <ul className="space-y-2">
        {pages.map((p: ConnectPage) => (
          <li key={p._id}>
            <Link
              href={`/connect/page/${p._id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 opacity-90 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

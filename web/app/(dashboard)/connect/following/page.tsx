"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { connectGetFollowing } from "@/lib/connect-api";
import type { ConnectPage } from "@/types/connect";

export default function ConnectFollowingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["connect-following"],
    queryFn: () => connectGetFollowing(1, 40),
  });

  const pages = data?.pages ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
        Following
      </h1>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && pages.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          You are not following any Connect pages yet.
        </p>
      )}
      <ul className="space-y-2">
        {pages.map((p: ConnectPage) => (
          <li key={p._id}>
            <Link
              href={`/connect/page/${p._id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800">
                {p.profileImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary">
                    {p.name?.slice(0, 1)}
                  </div>
                )}
              </div>
              <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

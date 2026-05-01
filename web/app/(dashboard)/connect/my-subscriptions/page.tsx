"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { connectGetMySubscriptions } from "@/lib/connect-api";

type SubRow = {
  _id: string;
  status?: string;
  amount?: number;
  connectPageId?: { _id?: string; name?: string; profileImage?: string };
};

export default function MySubscriptionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["connect-my-subscriptions"],
    queryFn: connectGetMySubscriptions,
  });

  const rows = (data?.subscriptions ?? []) as SubRow[];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <Link href="/connect" className="text-sm font-medium text-primary hover:underline">
        ← Connect
      </Link>
      <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
        My subscriptions
      </h1>
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-zinc-400">No subscriptions yet.</p>
      )}
      <ul className="space-y-2">
        {rows.map((s) => {
          const pageId = typeof s.connectPageId === "object" ? s.connectPageId?._id : undefined;
          const pageName =
            typeof s.connectPageId === "object" ? s.connectPageId?.name : "Connect page";
          const inner = (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800">
                {typeof s.connectPageId === "object" && s.connectPageId?.profileImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.connectPageId.profileImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-primary">
                    {pageName?.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-white">{pageName}</p>
                <p className="text-xs text-slate-500">
                  Status: {s.status ?? "—"}
                  {typeof s.amount === "number" ? ` · ${s.amount}` : ""}
                </p>
              </div>
            </div>
          );
          return (
            <li key={s._id}>
              {pageId ? <Link href={`/connect/page/${pageId}`}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

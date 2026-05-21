"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, Eye } from "lucide-react";
import { connectGetPageAnalytics, connectGetPageSubscribers } from "@/lib/connect-api";

export default function ConnectDashboardPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const analyticsQ = useQuery({
    queryKey: ["connect-analytics", id],
    queryFn: () => connectGetPageAnalytics(id),
    enabled: !!id,
  });

  const subsQ = useQuery({
    queryKey: ["connect-page-subscribers", id],
    queryFn: () => connectGetPageSubscribers(id),
    enabled: !!id,
  });

  if (!id) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24 lg:pb-10">
      <Link href={`/connect/page/${id}`} className="text-sm font-medium text-primary hover:underline">
        ← Page
      </Link>
      <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
        Creator dashboard
      </h1>

      {analyticsQ.isLoading || subsQ.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : analyticsQ.isError ? (
        <p className="text-destructive">You may not have access to this dashboard.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Followers</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {analyticsQ.data?.totalFollowers ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                <Eye className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Views</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {analyticsQ.data?.totalViews ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Active subscribers</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {subsQ.data?.totalActiveSubscribers ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Monthly revenue (reported):{' '}
                {typeof subsQ.data?.monthlyRevenue === 'number' &&
                Number.isFinite(subsQ.data.monthlyRevenue)
                  ? subsQ.data.monthlyRevenue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '0.00'}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
              <h2 className="font-semibold text-slate-900 dark:text-white">Follower growth (30d)</h2>
              <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
                {(analyticsQ.data?.followerGrowth ?? []).map((row) => (
                  <li key={row.date} className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>{row.date}</span>
                    <span>{row.count}</span>
                  </li>
                ))}
                {(analyticsQ.data?.followerGrowth ?? []).length === 0 && (
                  <li className="text-slate-400">No data yet.</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
              <h2 className="font-semibold text-slate-900 dark:text-white">Views (30d)</h2>
              <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
                {(analyticsQ.data?.viewGrowth ?? []).map((row) => (
                  <li key={row.date} className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>{row.date}</span>
                    <span>{row.count}</span>
                  </li>
                ))}
                {(analyticsQ.data?.viewGrowth ?? []).length === 0 && (
                  <li className="text-slate-400">No data yet.</li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

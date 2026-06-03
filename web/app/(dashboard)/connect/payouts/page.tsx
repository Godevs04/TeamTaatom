"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { connectGetMyPayouts, type MyPayout } from "@/lib/connect-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABEL: Record<MyPayout["status"], string> = {
  calculated: "Awaiting payout",
  pending: "Pending",
  processing: "Processing",
  completed: "Paid",
  failed: "Failed",
};

function formatMoney(amount: number, currency: string) {
  const sym =
    currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  const n = Number.isFinite(amount) ? amount : 0;
  return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PayoutRow({ payout }: { payout: MyPayout }) {
  const month = new Date(payout.periodYear, payout.periodMonth - 1, 1).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" }
  );
  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{payout.pageName}</p>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{month}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatMoney(payout.creatorPayout, payout.currency)}
          </p>
          <span className="text-xs font-medium text-slate-500">
            {STATUS_LABEL[payout.status] ?? payout.status}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConnectPayoutsPage() {
  const q = useQuery({
    queryKey: ["connect-my-payouts"],
    queryFn: () => connectGetMyPayouts({ page: 1, limit: 20 }),
  });

  const summary = q.data?.summary;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24 lg:pb-10">
      <div>
        <Link href="/connect" className="text-sm font-medium text-primary hover:underline">
          ← Connect
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          Creator payouts
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Payout history for your Connect and Community pages (mirrors the mobile payouts screen).
        </p>
      </div>

      {q.isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}

      {q.isError && (
        <p className="text-sm text-destructive">Could not load payouts. You may need to be a creator.</p>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Wallet className="h-4 w-4 text-primary" />
                Total earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(summary.totalEarned, "INR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatMoney(summary.totalPending, "INR")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.payoutCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        {(q.data?.payouts ?? []).map((p) => (
          <PayoutRow key={p._id} payout={p} />
        ))}
        {!q.isLoading && (q.data?.payouts?.length ?? 0) === 0 && (
          <p className="text-center text-sm text-slate-500">No payouts yet.</p>
        )}
      </div>
    </div>
  );
}

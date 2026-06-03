"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { connectGetArchived, connectUnarchivePage } from "@/lib/connect-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import type { ConnectPage } from "@/types/connect";

export default function ConnectArchivedPage() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["connect-archived"],
    queryFn: () => connectGetArchived(1, 40),
  });

  const pages = data?.pages ?? [];

  const handleUnarchive = async (pageId: string) => {
    setBusyId(pageId);
    try {
      await connectUnarchivePage(pageId);
      toast.success("Page restored.");
      await qc.invalidateQueries({ queryKey: ["connect-archived"] });
      await qc.invalidateQueries({ queryKey: ["connect-pages"] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 lg:pb-10">
      <Link href="/connect" className="text-sm font-medium text-primary hover:underline">
        ← Connect
      </Link>
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
          <li
            key={p._id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <Link href={`/connect/page/${p._id}`} className="font-medium text-slate-900 dark:text-white">
              {p.name}
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busyId === p._id}
              onClick={() => void handleUnarchive(p._id)}
            >
              {busyId === p._id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Restore
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

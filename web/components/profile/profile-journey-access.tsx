"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Map, GitPullRequest } from "lucide-react";
import { toast } from "sonner";
import { requestRouteAccess } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/context/auth-context";
import type { User } from "@/types/user";
import { Button } from "@/components/ui/button";

type Props = {
  profile: User;
};

export function ProfileJourneyAccess({ profile }: Props) {
  const router = useRouter();
  const { user: me } = useAuth();
  const [status, setStatus] = React.useState(profile.routeAccessStatus ?? "none");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setStatus(profile.routeAccessStatus ?? "none");
  }, [profile._id, profile.routeAccessStatus]);

  if (!me || me._id === profile._id) return null;

  const visibility = profile.routeVisibility ?? "everyone";
  if (visibility === "private") return null;

  const journeysHref = `/journeys?userId=${profile._id}&userName=${encodeURIComponent(
    profile.fullName || profile.username || ""
  )}`;

  if (visibility === "everyone") {
    return (
      <Link
        href={journeysHref}
        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-primary/30 dark:border-zinc-800 dark:bg-zinc-900/70"
      >
        <div className="flex items-center gap-3">
          <Map className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Journeys</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              View completed journeys and history
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-primary">Open →</span>
      </Link>
    );
  }

  if (status === "approved") {
    return (
      <Link
        href={journeysHref}
        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-primary/30 dark:border-zinc-800 dark:bg-zinc-900/70"
      >
        <div className="flex items-center gap-3">
          <Map className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Journeys</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400">Access granted</p>
          </div>
        </div>
        <span className="text-sm font-medium text-primary">Open →</span>
      </Link>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
        <GitPullRequest className="h-5 w-5 text-amber-600" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Journey access pending</p>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Your request to view journey routes is awaiting approval.
          </p>
        </div>
      </div>
    );
  }

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await requestRouteAccess(profile._id);
      const next = res.status ?? "pending";
      setStatus(next);
      if (next === "approved") {
        toast.success("Access granted — you can view their journeys.");
        router.push(journeysHref);
      } else {
        toast.success("Request sent to view journey routes.");
      }
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Lock className="h-5 w-5 text-primary" />
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Request journey access</p>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Ask permission to view this traveler&apos;s journey routes
          </p>
        </div>
      </div>
      <Button type="button" size="sm" disabled={loading} onClick={() => void handleRequest()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request access"}
      </Button>
    </div>
  );
}

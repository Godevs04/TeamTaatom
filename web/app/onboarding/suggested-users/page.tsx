"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { followProfile, getSuggestedUsers } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { User } from "@/types/user";

export default function OnboardingSuggestedUsersPage() {
  const router = useRouter();
  const [following, setFollowing] = React.useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-suggested-users"],
    queryFn: () => getSuggestedUsers(8),
  });

  const users = data?.users ?? [];

  const toggleFollow = async (userId: string) => {
    setBusyId(userId);
    try {
      await followProfile(userId);
      setFollowing((prev) => ({ ...prev, [userId]: !prev[userId] }));
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.onboardingCompletedWeb, "true");
    } catch {
      /* ignore */
    }
    router.replace("/feed");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/onboarding/interests" className="text-sm font-medium text-primary hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 dark:text-white">
          People to follow
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Follow a few travelers to seed your feed.</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <ul className="space-y-2">
        {(users as User[]).map((u) => (
          <li
            key={u._id}
            className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
              {u.profilePic ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={u.profilePic} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                  {(u.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{u.fullName ?? u.username}</p>
              <p className="truncate text-xs text-slate-500">@{u.username}</p>
            </div>
            <Button
              size="sm"
              variant={following[u._id] ? "outline" : "default"}
              disabled={busyId === u._id}
              className="shrink-0 rounded-xl"
              onClick={() => void toggleFollow(u._id)}
            >
              {following[u._id] ? "Following" : "Follow"}
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1 rounded-xl" onClick={finish}>
          Continue to feed
        </Button>
        <Button variant="ghost" className="flex-1 rounded-xl" onClick={finish}>
          Skip
        </Button>
      </div>
    </div>
  );
}

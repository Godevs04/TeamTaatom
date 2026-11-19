"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { completeProfileOnboarding, followProfile, getSuggestedUsers } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { useAuth } from "@/context/auth-context";
import type { User } from "@/types/user";
import { UserRound } from "lucide-react";

export default function OnboardingSuggestedUsersPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  type FollowUi = "FOLLOWING" | "REQUESTED" | "NOT_FOLLOWING";
  const [users, setUsers] = React.useState<User[]>([]);
  const [followStates, setFollowStates] = React.useState<Record<string, FollowUi>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSuggestedUsers(8);
        const list = res.users || [];
        if (!cancelled) {
          setUsers(list);
          const initial: Record<string, FollowUi> = {};
          for (const u of list) {
            initial[u._id] = u.isFollowing
              ? "FOLLOWING"
              : u.followRequestSent
                ? "REQUESTED"
                : "NOT_FOLLOWING";
          }
          setFollowStates(initial);
        }
      } catch {
        if (!cancelled) {
          toast.error("Could not load suggestions");
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (user: User) => {
    const id = user._id;
    const previous = followStates[id] || "NOT_FOLLOWING";
    const visibility = user.profileVisibility || "public";
    const restricted = visibility === "private" || visibility === "followers";
    const optimistic: FollowUi =
      previous === "FOLLOWING" || previous === "REQUESTED"
        ? "NOT_FOLLOWING"
        : restricted
          ? "REQUESTED"
          : "FOLLOWING";
    setFollowStates((prev) => ({ ...prev, [id]: optimistic }));
    try {
      const res = await followProfile(id);
      const next: FollowUi = res.isFollowing
        ? "FOLLOWING"
        : res.followRequestSent
          ? "REQUESTED"
          : "NOT_FOLLOWING";
      setFollowStates((prev) => ({ ...prev, [id]: next }));
      if (res.followRequestSent) toast.success("Follow request sent");
    } catch {
      setFollowStates((prev) => ({ ...prev, [id]: previous }));
      toast.error("Could not update follow");
    }
  };

  const finish = async () => {
    let completed = false;
    try {
      await completeProfileOnboarding();
      await refresh();
      completed = true;
    } catch {
      toast.error("Could not complete onboarding. Please try again.");
      return;
    }

    if (completed) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEYS.onboardingCompletedWeb, "true");
        }
      } catch {
        /* ignore */
      }
      router.replace("/feed");
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-8 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">Step 6 of 6</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">Follow people you know</h1>
      <p className="mt-2 text-sm text-slate-600">Optional — discover travelers who share your interests.</p>

      <div className="mt-8 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No suggestions right now. You can follow people anytime from search.</p>
        ) : (
          users.map((u) => {
            const pic = u.profilePic;
            const state = followStates[u._id] || "NOT_FOLLOWING";
            const label =
              state === "FOLLOWING" ? "Following" : state === "REQUESTED" ? "Requested" : "Follow";
            return (
              <div
                key={u._id}
                className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
                  {pic ? (
                    <Image src={pic} alt="" fill className="object-cover" sizes="48px" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <UserRound className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{u.username || "Traveler"}</p>
                  {u.fullName ? <p className="truncate text-sm text-slate-600">{u.fullName}</p> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={state === "NOT_FOLLOWING" ? "default" : "secondary"}
                  className="shrink-0 rounded-lg font-semibold"
                  onClick={() => void toggle(u)}
                >
                  {label}
                </Button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="rounded-xl font-semibold text-slate-600" onClick={() => void finish()}>
          Skip
        </Button>
        <Button type="button" className="h-12 rounded-xl font-semibold" onClick={() => void finish()}>
          Continue to feed
        </Button>
      </div>
    </div>
  );
}

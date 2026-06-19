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
  const [users, setUsers] = React.useState<User[]>([]);
  const [following, setFollowing] = React.useState<Set<string>>(() => new Set());
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getSuggestedUsers(8);
        if (!cancelled) setUsers(res.users || []);
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

  const toggle = async (id: string) => {
    const was = following.has(id);
    setFollowing((prev) => {
      const next = new Set(prev);
      if (was) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await followProfile(id);
    } catch {
      setFollowing((prev) => {
        const next = new Set(prev);
        if (was) next.add(id);
        else next.delete(id);
        return next;
      });
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
            const isFollowing = following.has(u._id);
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
                  variant={isFollowing ? "secondary" : "default"}
                  className="shrink-0 rounded-lg font-semibold"
                  onClick={() => toggle(u._id)}
                >
                  {isFollowing ? "Following" : "Follow"}
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

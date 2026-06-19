"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PROFILE_ONBOARDING_VERSION } from "@/lib/profile-onboarding-version";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(`/?next=${encodeURIComponent(pathname || "/onboarding/welcome")}`);
      return;
    }
    if ((user.profileOnboardingVersion ?? 0) >= PROFILE_ONBOARDING_VERSION) {
      router.replace("/feed");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if ((user.profileOnboardingVersion ?? 0) >= PROFILE_ONBOARDING_VERSION) {
    return null;
  }

  return <>{children}</>;
}

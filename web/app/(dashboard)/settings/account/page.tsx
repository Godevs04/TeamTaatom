"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useSettings } from "@/hooks/useSettings";
import { EditProfileForm } from "@/components/profile/edit-profile-form";
import { AccountSecuritySection } from "@/components/settings/account-security-section";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { SettingsPageSkeleton } from "@/components/settings/settings-page-skeleton";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { isLoading } = useSettings();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#security") {
      document.getElementById("security")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isLoading]);

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="space-y-8 pb-4">
      <SettingsPageHeader
        title="Profile & Identity"
        description="Your public presence on Taatom — how other travelers see you."
      />

      {user ? (
        <SettingsSection title="Profile" description="Photo, display name, username, and bio.">
          <SettingsCard>
            <EditProfileForm user={user} />
          </SettingsCard>
        </SettingsSection>
      ) : null}

      {user ? <AccountSecuritySection user={user} /> : null}
    </div>
  );
}

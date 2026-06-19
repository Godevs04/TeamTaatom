"use client";

import * as React from "react";
import { SocialConnect } from "@/components/layout/social-connect";
import { SettingsCard } from "./settings-card";

export function SettingsSocialCard() {
  return (
    <SettingsCard
      title="Taatom community"
      description="Follow along between trips — updates, reels, and travel highlights."
    >
      <SocialConnect variant="inline" className="mt-1" />
    </SettingsCard>
  );
}

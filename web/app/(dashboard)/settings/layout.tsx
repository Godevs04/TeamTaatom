"use client";

import { SettingsLayout } from "@/components/settings/settings-layout";

export default function SettingsRouteLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}

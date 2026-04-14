"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * Forces light theme on the marketing landing (/) and `/auth/*` only so those pages stay readable.
 * Dashboard and settings respect the user's theme (light / dark / system) from next-themes.
 */
export function ForceLightTheme() {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const isPublicOrAuth = pathname === "/" || pathname?.startsWith("/auth");

  useEffect(() => {
    if (isPublicOrAuth) {
      setTheme("light");
    }
    // Do not set "system" on other routes — keep default light so feed/home stay white
  }, [isPublicOrAuth, setTheme]);

  return null;
}

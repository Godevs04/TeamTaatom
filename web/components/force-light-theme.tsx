"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * Forces light theme on landing (/) and auth routes. Other pages use the app default (light);
 * we do not switch to system theme so feed, settings, etc. stay light unless the user chooses dark in settings.
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

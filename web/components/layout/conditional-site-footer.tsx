"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";

/**
 * Root layout footer. Hidden on the marketing landing page, which already
 * ships its own footer inside LandingFinalCta — otherwise guests see two bars.
 */
export function ConditionalSiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <SiteFooter />;
}

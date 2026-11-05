"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getAdSenseClientId, isAdSenseEnabled } from "../../lib/adsense";

/**
 * Pages allowed to load AdSense. Google's policy forbids ads on screens without
 * publisher content (login, legal, settings, empty/utility pages), so the loader
 * is limited to the home page (AdSense looks for its code there during review)
 * and pages that show real content. Manual ad units (feed / shorts / watch) live
 * only on these routes too.
 */
const AD_ELIGIBLE_PATTERNS = [
  /^\/$/,
  /^\/feed\/?$/,
  /^\/shorts\/?$/,
  /^\/watch(\/[^/]+)?\/?$/,
  /^\/discover\/?$/,
  /^\/locale\/?$/,
  /^\/locale\/[^/]+\/?$/,
  /^\/trip\/[^/]+\/?$/,
  /^\/profile\/[^/]+\/?$/,
  /^\/journeys\/[^/]+\/?$/,
  /^\/hashtag\/[^/]+\/?$/,
];

export function isAdEligiblePath(pathname: string | null | undefined): boolean {
  return !!pathname && AD_ELIGIBLE_PATTERNS.some((re) => re.test(pathname));
}

const LOADER_ID = "adsense-loader";

/**
 * Loads the AdSense bootstrap once, the first time the visitor reaches an
 * ad-eligible page. Injected as a plain <script> (not next/script): next/script
 * adds a `data-nscript` attribute, which AdSense rejects with
 * "AdSense head tag doesn't support data-nscript attribute".
 */
export function AdSenseScript() {
  const pathname = usePathname();
  const client = isAdSenseEnabled() ? getAdSenseClientId() : null;
  const eligible = !!client && isAdEligiblePath(pathname);

  useEffect(() => {
    if (!eligible || !client || document.getElementById(LOADER_ID)) return;
    const script = document.createElement("script");
    script.id = LOADER_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.appendChild(script);
  }, [eligible, client]);

  return null;
}

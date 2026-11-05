"use client";

import Script from "next/script";
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

/**
 * Loads the AdSense bootstrap once, the first time the visitor reaches an
 * ad-eligible page. Uses afterInteractive — beforeInteractive is only valid in
 * pages/_document (Pages Router).
 */
export function AdSenseScript() {
  const pathname = usePathname();
  if (!isAdSenseEnabled()) return null;
  const client = getAdSenseClientId();
  if (!client || !isAdEligiblePath(pathname)) return null;

  return (
    <Script
      id="adsense-loader"
      async
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
      crossOrigin="anonymous"
    />
  );
}

"use client";

import Script from "next/script";
import { getAdSenseClientId, isAdSenseEnabled } from "../../lib/adsense";

/**
 * Loads the AdSense bootstrap once for the app shell.
 * Placed in <head> (beforeInteractive) so AdSense site verification can find it.
 */
export function AdSenseScript() {
  if (!isAdSenseEnabled()) return null;
  const client = getAdSenseClientId();
  if (!client) return null;

  return (
    <Script
      id="adsense-loader"
      async
      strategy="beforeInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
      crossOrigin="anonymous"
    />
  );
}

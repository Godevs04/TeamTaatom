"use client";

import * as React from "react";
import {
  getAdSenseClientId,
  isAdSenseEnabled,
  isAdSenseTestMode,
} from "../../lib/adsense";
import { cn } from "../../lib/utils";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type AdSenseUnitProps = {
  slot: string;
  className?: string;
  /** AdSense format attribute; default auto. */
  format?: string;
  fullWidthResponsive?: boolean;
};

/**
 * Renders one AdSense display unit and pushes it to adsbygoogle once mounted.
 */
export function AdSenseUnit({
  slot,
  className,
  format = "auto",
  fullWidthResponsive = true,
}: AdSenseUnitProps) {
  const pushedRef = React.useRef(false);
  const client = getAdSenseClientId();
  const adTest = isAdSenseTestMode();

  React.useEffect(() => {
    if (!isAdSenseEnabled() || !slot || !client || pushedRef.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      /* ignore fill errors in dev / blockers */
    }
  }, [slot, client]);

  if (!isAdSenseEnabled() || !slot || !client) return null;

  return (
    <div className={cn("adsense-wrap min-h-[120px] overflow-hidden", className)}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", minHeight: 120 }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
        {...(adTest ? { "data-adtest": "on" } : {})}
      />
    </div>
  );
}

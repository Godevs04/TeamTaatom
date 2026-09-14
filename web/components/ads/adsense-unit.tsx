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
  /** AdSense format; use "fluid" for in-feed / in-article. */
  format?: string;
  /** e.g. "in-article" → data-ad-layout */
  layout?: string;
  /** In-feed only — data-ad-layout-key */
  layoutKey?: string;
  fullWidthResponsive?: boolean;
};

/**
 * Renders one AdSense unit and pushes it to adsbygoogle once mounted.
 */
export function AdSenseUnit({
  slot,
  className,
  format = "auto",
  layout,
  layoutKey,
  fullWidthResponsive = true,
}: AdSenseUnitProps) {
  const pushedRef = React.useRef(false);
  const client = getAdSenseClientId();
  const adTest = isAdSenseTestMode();
  const isFluid = format === "fluid";
  const isInArticle = layout === "in-article";

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
    <div
      className={cn(
        "adsense-wrap w-full overflow-hidden",
        !isFluid && "min-h-[120px]",
        className
      )}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: "block",
          ...(isInArticle ? { textAlign: "center" as const } : {}),
          ...(isFluid ? {} : { minHeight: 120 }),
        }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        {...(layout ? { "data-ad-layout": layout } : {})}
        {...(layoutKey ? { "data-ad-layout-key": layoutKey } : {})}
        {...(!isFluid
          ? {
              "data-full-width-responsive": fullWidthResponsive ? "true" : "false",
            }
          : {})}
        {...(adTest ? { "data-adtest": "on" } : {})}
      />
    </div>
  );
}

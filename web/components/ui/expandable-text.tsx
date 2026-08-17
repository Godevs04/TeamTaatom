"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { CaptionWithLinks } from "../caption-with-links";

interface ExpandableTextProps {
  text?: string | null;
  maxLines?: number;
  charLimit?: number;
  className?: string;
  linkClassName?: string;
}

export function ExpandableText({
  text,
  maxLines = 3,
  charLimit = 160,
  className,
  linkClassName = "text-primary hover:underline",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [canExpand, setCanExpand] = React.useState(false);
  const clampRef = React.useRef<HTMLDivElement>(null);

  // Clamp and the "… more" control are applied only after mount so the
  // server HTML matches the first client render. Applying -webkit-line-clamp
  // during SSR rewrites nested spans and causes a hydration mismatch.
  React.useEffect(() => {
    if (!text) return;
    const el = clampRef.current;
    const charLong = text.length > charLimit || text.split("\n").length > maxLines;
    const visuallyLong = !!el && el.scrollHeight > el.clientHeight + 2;
    setCanExpand(charLong || visuallyLong);
  }, [text, maxLines, charLimit, expanded]);

  if (!text || text.trim() === "") {
    return null;
  }

  const clamped = canExpand && !expanded;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <div className={cn("relative min-w-0 max-w-full break-words [overflow-wrap:anywhere]", className)}>
      <div
        ref={clampRef}
        className={cn("whitespace-pre-wrap text-inherit leading-relaxed", clamped && "overflow-hidden")}
        style={
          clamped
            ? {
                display: "-webkit-box",
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: "vertical",
              }
            : undefined
        }
      >
        <CaptionWithLinks text={text} linkClassName={linkClassName} />
      </div>

      {canExpand ? (
        <button
          type="button"
          onClick={toggle}
          className="mt-1 inline-flex items-center text-xs font-semibold text-primary hover:underline focus:outline-none"
        >
          {expanded ? "Show less" : "… more"}
        </button>
      ) : null}
    </div>
  );
}

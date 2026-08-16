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
  as?: React.ElementType;
}

export function ExpandableText({
  text,
  maxLines = 3,
  charLimit = 160,
  className,
  linkClassName = "text-primary hover:underline",
  as: Component = "div",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (!text || text.trim() === "") {
    return null;
  }

  const isLong = text.length > charLimit || text.split("\n").length > maxLines;

  return (
    <div className={cn("relative min-w-0 max-w-full break-words [overflow-wrap:anywhere]", className)}>
      {expanded || !isLong ? (
        <Component className="whitespace-pre-wrap text-inherit leading-relaxed">
          <CaptionWithLinks text={text} linkClassName={linkClassName} />
        </Component>
      ) : (
        <Component
          className="whitespace-pre-wrap text-inherit leading-relaxed"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <CaptionWithLinks text={text} linkClassName={linkClassName} />
        </Component>
      )}

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 inline-flex items-center text-xs font-semibold text-primary hover:underline focus:outline-none"
        >
          {expanded ? "Show less" : "… more"}
        </button>
      )}
    </div>
  );
}

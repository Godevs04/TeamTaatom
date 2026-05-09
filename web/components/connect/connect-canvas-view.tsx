"use client";

import * as React from "react";
import type { CanvasElement } from "@/types/connect";
import { cn } from "@/lib/utils";

function sortedElements(elements: CanvasElement[] | undefined): CanvasElement[] {
  if (!elements?.length) return [];
  return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

/**
 * Canvas coordinate system (matching mobile CanvasElementView):
 * - x, y = normalized CENTER of the element (0..1 of frame)
 * - Text: auto-sizes to content, centered at (x, y)
 * - Image/Video: explicit w, h; positioned so center is at (x, y)
 */
function CanvasElementView({
  element,
  frameWidth,
  frameHeight,
}: {
  element: CanvasElement;
  frameWidth: number;
  frameHeight: number;
}) {
  const isText = element.type === "text";
  const rotation = element.rotation ?? 0;

  if (isText) {
    // Text: auto-sized, centered at (x, y) using transform translate(-50%, -50%)
    const centerX = element.x * frameWidth;
    const centerY = element.y * frameHeight;
    return (
      <div
        style={{
          position: "absolute",
          left: centerX,
          top: centerY,
          transform: `translate(-50%, -50%)${rotation ? ` rotate(${rotation}deg)` : ""}`,
          zIndex: element.zIndex ?? 0,
          fontSize: element.fontSize ?? 24,
          color: element.color ?? "#FFFFFF",
          fontWeight: (element.fontWeight as React.CSSProperties["fontWeight"]) ?? "600",
          backgroundColor: element.backgroundColor ?? "transparent",
          textAlign: "center",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.2,
          paddingLeft: 6,
          paddingRight: 6,
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
        {element.content}
      </div>
    );
  }

  // Image / Video: center at (x, y), explicit width & height
  const width = element.w * frameWidth;
  const height = element.h * frameHeight;
  const left = (element.x - element.w / 2) * frameWidth;
  const top = (element.y - element.h / 2) * frameHeight;

  const style: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    zIndex: element.zIndex ?? 0,
    objectFit: "cover",
    borderRadius: 4,
  };

  if (element.type === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={element.content} alt="" style={style} />
    );
  }

  // video
  return (
    <video src={element.content} muted playsInline autoPlay loop style={style} />
  );
}

export function ConnectCanvasView({
  elements,
  background,
  className,
  maxWidth = 320,
}: {
  elements: CanvasElement[] | undefined;
  background?: string;
  className?: string;
  maxWidth?: number;
}) {
  const sorted = sortedElements(elements);

  if (!sorted.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-zinc-400">No content added yet.</p>
    );
  }

  // 9:16 aspect ratio
  const frameWidth = maxWidth;
  const frameHeight = (frameWidth * 16) / 9;

  return (
    <div className={cn("flex justify-center", className)}>
      <div
        style={{
          position: "relative",
          width: frameWidth,
          height: frameHeight,
          backgroundColor: background || "#000000",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {sorted.map((el, idx) => (
          <CanvasElementView
            key={el._id ?? `c_${idx}`}
            element={el}
            frameWidth={frameWidth}
            frameHeight={frameHeight}
          />
        ))}
      </div>
    </div>
  );
}

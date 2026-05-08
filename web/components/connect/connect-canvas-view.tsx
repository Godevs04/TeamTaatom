"use client";

import * as React from "react";
import type { CanvasElement } from "@/types/connect";
import { cn } from "@/lib/utils";

function sortedElements(elements: CanvasElement[] | undefined): CanvasElement[] {
  if (!elements?.length) return [];
  return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}

function CanvasElementView({
  element,
  frameWidth,
  frameHeight,
}: {
  element: CanvasElement;
  frameWidth: number;
  frameHeight: number;
}) {
  const left = element.x * frameWidth;
  const top = element.y * frameHeight;
  const width = element.w * frameWidth;
  const height = element.h * frameHeight;
  const rotation = element.rotation ?? 0;

  const style: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    zIndex: element.zIndex ?? 0,
  };

  switch (element.type) {
    case "text":
      return (
        <div
          style={{
            ...style,
            fontSize: element.fontSize ?? 24,
            color: element.color ?? "#FFFFFF",
            fontWeight: (element.fontWeight as React.CSSProperties["fontWeight"]) ?? "600",
            backgroundColor: element.backgroundColor ?? "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
            wordBreak: "break-word",
            lineHeight: 1.2,
            padding: 4,
          }}
        >
          {element.content}
        </div>
      );
    case "image":
      return (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={element.content}
          alt=""
          style={{
            ...style,
            objectFit: "cover",
            borderRadius: 4,
          }}
        />
      );
    case "video":
      return (
        <video
          src={element.content}
          muted
          playsInline
          style={{
            ...style,
            objectFit: "cover",
            borderRadius: 4,
          }}
        />
      );
    default:
      return null;
  }
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

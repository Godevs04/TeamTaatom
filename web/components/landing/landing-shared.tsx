"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("landing-glass rounded-2xl", className)}>{children}</div>;
}

export function WaveformBars({
  bars = 18,
  className,
  animate = true,
}: {
  bars?: number;
  className?: string;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;

  return (
    <div className={cn("flex h-8 items-end justify-center gap-[3px]", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-[var(--landing-accent)]"
          animate={
            shouldAnimate
              ? { height: [6, 10 + (i % 5) * 4, 8, 18 + (i % 3) * 5, 6] }
              : undefined
          }
          transition={{ duration: 1.1 + (i % 4) * 0.12, repeat: Infinity, ease: "easeInOut" }}
          style={{ height: 10 }}
        />
      ))}
    </div>
  );
}

export function PlaneDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5",
        className
      )}
      aria-hidden
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M8.5 1.5L5.5 5l3 3.5M5.5 5L1.5 3.5 5.5 5 1.5 6.5"
          stroke="var(--landing-accent)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

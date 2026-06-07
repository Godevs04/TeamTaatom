"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hoverLift, imageHoverScale, landingEase } from "./landing-motion";

export function HoverLiftCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div whileHover={hoverLift} className={cn("transition-shadow duration-300 hover:shadow-[var(--landing-shadow-hover)]", className)}>
      {children}
    </motion.div>
  );
}

export function MotionImageWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div whileHover={imageHoverScale} className={cn("overflow-hidden", className)}>
      {children}
    </motion.div>
  );
}

type AnimatedRoutePathProps = {
  d: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  delay?: number;
};

export function AnimatedRoutePath({ d, strokeWidth = 1.5, strokeOpacity = 0.45, delay = 0 }: AnimatedRoutePathProps) {
  const reduced = useReducedMotion();
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="var(--landing-accent)"
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      strokeDasharray="4 7"
      initial={{ pathLength: 0, strokeDashoffset: 0 }}
      animate={
        reduced
          ? { pathLength: 1 }
          : { pathLength: 1, strokeDashoffset: [0, -22] }
      }
      transition={
        reduced
          ? { duration: 2.2, delay, ease: landingEase }
          : {
              pathLength: { duration: 2.4, delay, ease: landingEase },
              strokeDashoffset: { duration: 14, repeat: Infinity, ease: "linear", delay: delay + 2.4 },
            }
      }
    />
  );
}

export function FloatingMotion({
  children,
  duration = 5.5,
  y = 8,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  duration?: number;
  y?: number;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduced ? undefined : { y: [0, -y, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export function FloatingAvatarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex", className)}>{children}</div>;
}

export function FloatingAvatarItem({
  children,
  index,
  className,
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduced ? undefined : { y: [0, index % 2 === 0 ? -4 : 4, 0] }}
      transition={{ duration: 4.5 + index * 0.35, repeat: Infinity, ease: "easeInOut", delay: index * 0.12 }}
    >
      {children}
    </motion.div>
  );
}

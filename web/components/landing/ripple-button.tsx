"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "ghost";
};

export function RippleButton({ href, onClick, children, className, variant = "primary" }: Props) {
  const [ripples, setRipples] = React.useState<{ x: number; y: number; id: number }[]>([]);

  const spawn = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [...r, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 520);
  };

  const base =
    variant === "primary"
      ? "bg-[var(--landing-ink)] text-white shadow-[0_12px_40px_rgba(20,20,20,0.18)]"
      : "border border-[var(--landing-border)] bg-[var(--landing-surface)] text-[var(--landing-ink)]";

  const classes = cn(
    "relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full px-8 text-[15px] font-semibold transition-colors",
    base,
    className
  );

  const content = (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute h-2 w-2 animate-ping rounded-full bg-white/40"
          style={{ left: r.x, top: r.y, transform: "translate(-50%, -50%)" }}
        />
      ))}
      <span className="relative z-10">{children}</span>
    </>
  );

  if (href) {
    return (
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
        <Link href={href} className={classes} onClick={spawn}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={(e) => {
        spawn(e);
        onClick?.();
      }}
      className={classes}
    >
      {content}
    </motion.button>
  );
}

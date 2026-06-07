"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function AnimatedLink({ href, children, className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]",
        className
      )}
    >
      {children}
      <span
        className="absolute -bottom-0.5 left-0 h-px w-0 bg-[var(--landing-ink)] transition-all duration-300 ease-out group-hover:w-full"
        aria-hidden
      />
    </Link>
  );
}

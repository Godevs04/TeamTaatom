"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { getSocialLinks, type SocialId } from "../../lib/social";

function SocialGlyph({ id, className }: { id: SocialId; className?: string }) {
  switch (id) {
    case "instagram":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      );
    case "x":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "youtube":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case "facebook":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
  }
}

type Variant = "sidebar" | "inline" | "toolbar";

export function SocialConnect({
  variant = "sidebar",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const links = React.useMemo(() => getSocialLinks(), []);

  if (variant === "toolbar") {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {links.map((s) => (
          <a
            key={s.id}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors",
              "hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            )}
            aria-label={s.label}
          >
            <SocialGlyph id={s.id} className="h-[18px] w-[18px]" />
          </a>
        ))}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3", className)}>
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">Connect</span>
        <div className="flex items-center gap-1.5">
          {links.map((s) => (
            <a
              key={s.id}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-500 shadow-sm",
                "transition-all hover:border-primary/25 hover:text-primary hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-primary"
              )}
              aria-label={s.label}
            >
              <SocialGlyph id={s.id} className="h-[17px] w-[17px]" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/40 to-white p-6 shadow-premium border-premium dark:border-zinc-800/80 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-950",
        className
      )}
    >
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Taatom social</h3>
      <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
        Updates, reels, and community highlights — follow along between trips.
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map((s) => (
          <a
            key={s.id}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700",
              "shadow-sm transition-all hover:border-primary/30 hover:text-primary hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-primary"
            )}
          >
            <SocialGlyph id={s.id} className="h-4 w-4 shrink-0" />
            {s.label}
            <span className="sr-only">(opens in new tab)</span>
          </a>
        ))}
      </div>
    </section>
  );
}

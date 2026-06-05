"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "explore", label: "Explore" },
  { id: "features", label: "Stories" },
  { id: "product", label: "Product" },
  { id: "community", label: "Community" },
  { id: "creators", label: "Creators" },
] as const;

export function LandingNav() {
  const [active, setActive] = React.useState<string>("explore");
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    const ids = SECTIONS.map((s) => s.id);
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:pt-5">
      <motion.header
        layout
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "pointer-events-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-500 sm:px-4",
          scrolled
            ? "border-[var(--landing-border)] bg-white/75 shadow-[0_16px_48px_rgba(20,20,20,0.08)] backdrop-blur-xl"
            : "border-white/40 bg-white/55 shadow-[0_8px_32px_rgba(20,20,20,0.05)] backdrop-blur-md"
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2 pl-1">
          <Image src="/icon.png" alt="Taatom" width={28} height={28} className="rounded-lg object-contain" priority />
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">Taatom</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="relative px-3 py-2 text-[13px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
              >
                {s.label}
                {isActive ? (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-[var(--landing-ink)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 pr-1">
          <Link
            href="/auth/login"
            className="hidden text-[13px] font-medium text-[var(--landing-muted)] hover:text-[var(--landing-ink)] sm:inline"
          >
            Log in
          </Link>
          <Link
            href="/auth/register"
            className="rounded-full bg-[var(--landing-ink)] px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Sign up
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--landing-border)] md:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
              <path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </motion.header>

      {open ? (
        <div className="pointer-events-auto absolute left-4 right-4 top-[4.5rem] rounded-2xl border border-[var(--landing-border)] bg-white/95 p-4 shadow-lg backdrop-blur-xl md:hidden">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block py-2.5 text-sm font-medium"
              onClick={() => setOpen(false)}
            >
              {s.label}
            </a>
          ))}
          <Link href="/auth/login" className="mt-2 block py-2 text-sm font-medium" onClick={() => setOpen(false)}>
            Log in
          </Link>
        </div>
      ) : null}
    </div>
  );
}

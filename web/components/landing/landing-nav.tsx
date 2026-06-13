"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "explore", label: "Explore" },
  { id: "stories", label: "Stories" },
  { id: "journeys", label: "Journeys" },
  { id: "product", label: "Product" },
  { id: "community", label: "Community" },
] as const;

const spring = { type: "spring" as const, stiffness: 420, damping: 36 };

export function LandingNav() {
  const [active, setActive] = React.useState<string>("explore");
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 20);
  });

  React.useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-42% 0px -48% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 transition-[padding] duration-500 ease-out",
        scrolled ? "pt-3" : "pt-4 sm:pt-5"
      )}
    >
      <motion.header
        layout
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0, scale: scrolled ? 0.97 : 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], scale: spring }}
        className={cn(
          "pointer-events-auto relative flex w-full max-w-5xl items-center justify-between gap-3 rounded-2xl border px-3 sm:px-5",
          "border-white/30 bg-white/50 shadow-[0_12px_40px_rgba(15,23,42,0.06)]",
          "backdrop-blur-[20px] supports-[backdrop-filter]:bg-white/55",
          scrolled && "border-white/45 shadow-[0_16px_48px_rgba(15,23,42,0.09)] supports-[backdrop-filter]:bg-white/72",
          scrolled ? "py-2" : "py-2.5 sm:py-3"
        )}
        style={{ WebkitBackdropFilter: "blur(20px)" }}
      >
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/50" aria-hidden />

        <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2 pl-0.5">
          <motion.div animate={{ scale: scrolled ? 0.92 : 1 }} transition={spring}>
            <Image src="/icon.png" alt="Taatom" width={28} height={28} className="rounded-lg object-contain" priority />
          </motion.div>
          <span className="font-display hidden text-[0.9375rem] font-medium tracking-tight text-[var(--landing-ink)] sm:inline">
            Taatom
          </span>
        </Link>

        <nav
          className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 md:flex"
          aria-label="Sections"
        >
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200",
                  isActive ? "text-[var(--landing-ink)]" : "text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
                )}
              >
                {s.label}
                {isActive ? (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-[var(--landing-ink)]"
                    transition={spring}
                  />
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="relative z-10 flex items-center gap-2 pr-0.5">
          <Link
            href="/auth/login"
            className="hidden text-[13px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)] sm:inline"
          >
            Log in
          </Link>
          <Link
            href="/auth/register"
            className={cn(
              "rounded-full bg-[var(--landing-ink)] font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,20,20,0.18)]",
              scrolled ? "px-3.5 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"
            )}
          >
            Join Taatom
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
        <div className="pointer-events-auto absolute left-4 right-4 top-[4.5rem] rounded-2xl border border-[var(--landing-border)] bg-white/95 p-4 shadow-lg backdrop-blur-[20px] md:hidden">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block py-2.5 text-sm font-medium" onClick={() => setOpen(false)}>
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

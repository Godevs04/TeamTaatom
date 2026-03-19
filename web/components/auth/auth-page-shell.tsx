"use client";

import * as React from "react";
import { motion } from "framer-motion";

export const AUTH_LOTTIE_EMBED_URL =
  "https://lottie.host/embed/de6e7dfe-658a-422c-9dbd-06d959550e52/Oh0ZqzklZE.lottie";

const easeOut = [0.22, 1, 0.36, 1] as const;

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

const itemFadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: easeOut },
  },
};

const headlineVariant = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: easeOut },
  },
};

export type AuthPageShellProps = {
  /** Small caps label above the card (e.g. "Welcome back") */
  cardEyebrow?: string;
  cardTitle: string;
  cardSubtitle: string;
  children: React.ReactNode;
};

/**
 * Shared layout for auth routes: matches landing (landing-bg, Fraunces headline column, Lottie, motion).
 */
export function AuthPageShell({ cardEyebrow, cardTitle, cardSubtitle, children }: AuthPageShellProps) {
  return (
    <div className="landing-bg relative min-h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/30" />

      <div className="relative mx-auto grid max-w-6xl items-start gap-10 px-4 py-10 sm:gap-12 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-14">
        {/* Brand column */}
        <motion.div
          className="flex flex-col space-y-6 lg:sticky lg:top-24 lg:max-w-xl"
          variants={containerStagger}
          initial="hidden"
          animate="show"
        >
          <motion.p variants={itemFadeUp} className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Taatom
          </motion.p>
          <motion.h1
            variants={headlineVariant}
            className="font-display text-[1.85rem] font-semibold leading-[1.12] tracking-tight text-slate-950 sm:text-3xl md:text-[2.35rem]"
          >
            Where your journeys become something people feel.
          </motion.h1>
          <motion.p variants={itemFadeUp} className="text-base leading-relaxed text-slate-600 sm:text-lg">
            Discover trips, places, and creators. Share posts with photos, locations, and music — a calmer space for
            travelers who care about craft, not clutter.
          </motion.p>

          <motion.div
            variants={itemFadeUp}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-sm backdrop-blur-sm"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-violet-500/[0.05]" />
            <iframe
              title="Taatom animation"
              src={AUTH_LOTTIE_EMBED_URL}
              className="relative block h-[180px] w-full border-0 sm:h-[220px] md:h-[240px]"
              allowFullScreen
            />
          </motion.div>
        </motion.div>

        {/* Form card */}
        <div className="flex justify-center lg:justify-end">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: easeOut, delay: 0.12 }}
            className="w-full max-w-md rounded-[1.75rem] border border-slate-200/90 bg-white/95 p-6 shadow-premium backdrop-blur-sm sm:p-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.45, ease: easeOut }}
            >
              {cardEyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{cardEyebrow}</p>
              ) : null}
              <h2
                className={`font-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.65rem] ${cardEyebrow ? "mt-2" : ""}`}
              >
                {cardTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{cardSubtitle}</p>
            </motion.div>

            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

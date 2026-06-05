"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { SectionReveal, RevealItem } from "./section-reveal";

const AVATARS = LANDING_IMAGES.avatars;

const ACTIVITY = [
  { name: "Maya", action: "pinned a memory in Kyoto", time: "2m" },
  { name: "Jon", action: "shared a reel from Iceland", time: "14m" },
  { name: "Priya", action: "added a song to her Lisbon story", time: "1h" },
];

export function LandingSocialProof() {
  return (
    <SectionReveal id="community" className="border-y border-[var(--landing-border)] bg-[var(--landing-surface)] py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:justify-between">
          <RevealItem className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex -space-x-3">
              {AVATARS.map((src, i) => (
                <motion.div
                  key={src}
                  className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-md sm:h-14 sm:w-14"
                  initial={{ opacity: 0, scale: 0.9, y: 0 }}
                  whileInView={{
                    opacity: 1,
                    scale: 1,
                    y: [0, i % 2 === 0 ? -4 : 4, 0],
                  }}
                  viewport={{ once: true }}
                  transition={{
                    opacity: { delay: i * 0.05, duration: 0.4 },
                    scale: { delay: i * 0.05, duration: 0.4 },
                    y: { duration: 4 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                  }}
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="56px" />
                </motion.div>
              ))}
            </div>
            <p className="mt-6 font-display text-2xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-3xl">
              12,000+ travelers documenting real journeys
            </p>
            <p className="mt-2 max-w-md text-[15px] text-[var(--landing-muted)]">
              A growing community sharing places, music, and moments — with care, not algorithms.
            </p>
          </RevealItem>

          <RevealItem className="w-full max-w-md space-y-3">
            {ACTIVITY.map((a, i) => (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center justify-between rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-bg)] px-4 py-3"
              >
                <p className="text-sm text-[var(--landing-ink)]">
                  <span className="font-semibold">{a.name}</span>{" "}
                  <span className="text-[var(--landing-muted)]">{a.action}</span>
                </p>
                <span className="shrink-0 text-xs text-[var(--landing-subtle)]">{a.time}</span>
              </motion.div>
            ))}
          </RevealItem>
        </div>
      </div>
    </SectionReveal>
  );
}

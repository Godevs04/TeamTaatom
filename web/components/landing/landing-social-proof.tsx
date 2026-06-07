"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { cn } from "@/lib/utils";
import { FloatingAvatarGroup, FloatingAvatarItem } from "./motion-primitives";
import { SectionReveal, RevealItem } from "./section-reveal";

const ACTIVITY = [
  {
    id: "maya",
    name: "Maya",
    avatar: LANDING_IMAGES.avatars[0],
    action: "pinned a memory in Kyoto",
    location: "Kyoto, Japan",
    time: "2m ago",
  },
  {
    id: "alex",
    name: "Alex",
    avatar: LANDING_IMAGES.avatars[2],
    action: "shared a story in Iceland",
    location: "Reykjavík, Iceland",
    time: "8m ago",
  },
  {
    id: "priya",
    name: "Priya",
    avatar: LANDING_IMAGES.avatars[1],
    action: "added music to her journey",
    location: "Lisbon, Portugal",
    time: "15m ago",
  },
] as const;

export function LandingSocialProof() {
  const reduced = useReducedMotion();

  return (
    <SectionReveal id="community" className="landing-section-glow border-y border-[var(--landing-border)] bg-[var(--landing-surface)]">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-14 lg:flex-row lg:justify-between lg:gap-20">
          <RevealItem className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <FloatingAvatarGroup className="-space-x-3">
              {LANDING_IMAGES.avatars.slice(0, 6).map((src, i) => (
                <FloatingAvatarItem
                  key={src}
                  index={i}
                  className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-md sm:h-14 sm:w-14"
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="56px" />
                </FloatingAvatarItem>
              ))}
            </FloatingAvatarGroup>
            <p className="landing-h3 font-display mt-8 text-[var(--landing-ink)]">Travel is happening right now</p>
            <p className="landing-body mt-4 max-w-md">
              Real people saving trips they mean to return to — one city, one song, one afternoon at a time.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              {["Kyoto", "Iceland", "Lisbon", "Kerala"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--landing-border)] bg-[var(--landing-bg)] px-3 py-1 text-[12px] font-medium text-[var(--landing-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </RevealItem>

          <RevealItem className="w-full max-w-md">
            <div className="mb-4 flex items-center gap-2">
              <motion.span
                className="relative flex h-2 w-2"
                animate={reduced ? undefined : { opacity: [1, 0.45, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/80" />
                {!reduced ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/35" /> : null}
              </motion.span>
              <p className="landing-eyebrow text-[var(--landing-muted)]">Live activity</p>
            </div>
            <ul className="space-y-2.5" role="list">
              {ACTIVITY.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-24px" }}
                  transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "flex gap-3 rounded-2xl border px-3.5 py-3 sm:px-4",
                    i === 0
                      ? "landing-activity-row--live border-[var(--landing-accent)]/15 bg-white/90 shadow-[0_4px_20px_rgba(20,20,20,0.05)]"
                      : "border-[var(--landing-border)] bg-[var(--landing-bg)]/90"
                  )}
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
                    <Image src={item.avatar} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.9375rem] leading-[1.55] text-[var(--landing-ink)]">
                      <span className="font-semibold">{item.name}</span>{" "}
                      <span className="text-[var(--landing-muted)]">{item.action}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--landing-subtle)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[var(--landing-accent)]" aria-hidden />
                        {item.location}
                      </span>
                      <span aria-hidden>·</span>
                      <time>{item.time}</time>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          </RevealItem>
        </div>
      </div>
    </SectionReveal>
  );
}

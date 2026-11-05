"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Play } from "lucide-react";
import { LANDING_IMAGES, placeImage } from "@/lib/landing-images";
import { cn } from "@/lib/utils";
import { SectionReveal, RevealItem } from "./section-reveal";
import { WaveformBars } from "./landing-shared";

const ACTIVITY = [
  {
    id: "maya",
    name: "Maya",
    avatar: LANDING_IMAGES.avatars[0],
    action: "pinned a memory in Venice",
    location: "Venice, Italy",
    time: "Day 3 of 5",
    preview: "photo" as const,
    previewSrc: LANDING_IMAGES.stories.venice,
  },
  {
    id: "alex",
    name: "Alex",
    avatar: LANDING_IMAGES.avatars[2],
    action: "shared a boat-day reel",
    location: "Ha Long Bay, Vietnam",
    time: "Day 2 of 6",
    preview: "video" as const,
    previewSrc: placeImage("halong", 200),
  },
  {
    id: "priya",
    name: "Priya",
    avatar: LANDING_IMAGES.avatars[1],
    action: "added a song to her beach day",
    location: "Algarve, Portugal",
    time: "Day 1 of 4",
    preview: "music" as const,
    previewSrc: LANDING_IMAGES.stories.coast,
  },
] as const;

export function LandingSocialProof() {
  const reduced = useReducedMotion();

  return (
    <SectionReveal
      id="community"
      className="landing-section-glow scroll-mt-24 border-b border-[var(--landing-border)] bg-[var(--landing-surface)] py-16 sm:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem className="mb-10 max-w-xl sm:mb-12">
          <p className="landing-eyebrow text-[var(--landing-accent)]">From the community</p>
          <h2 className="landing-h2 font-display mt-3 text-[var(--landing-ink)]">Small moments, saved for good.</h2>
          <p className="landing-body mt-3">
            The kind of things people keep on Taatom — a view, a song, an afternoon they don&apos;t want to forget.
          </p>
        </RevealItem>

        <div className="mb-4 flex items-center gap-2">
          <motion.span
            className="relative flex h-2 w-2"
            animate={reduced ? undefined : { opacity: [1, 0.45, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/80" />
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/35 motion-reduce:hidden" />
          </motion.span>
          <p className="landing-eyebrow text-[var(--landing-muted)]">Inside a journal</p>
        </div>

        <ul className="space-y-3" role="list">
          {ACTIVITY.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-24px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "flex items-center gap-4 rounded-[20px] border px-4 py-3.5 sm:px-5",
                i === 0
                  ? "landing-activity-row--live border-[var(--landing-accent)]/15 bg-white shadow-[var(--landing-card-shadow)]"
                  : "border-[var(--landing-border)] bg-[var(--landing-bg)]/80"
              )}
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
                <Image src={item.avatar} alt="" fill className="object-cover" sizes="44px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] leading-[1.55] text-[var(--landing-ink)]">
                  <span className="font-semibold">{item.name}</span>{" "}
                  <span className="text-[var(--landing-muted)]">{item.action}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--landing-subtle)]">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[var(--landing-accent)]" aria-hidden />
                    {item.location}
                  </span>
                  <span aria-hidden>·</span>
                  <time>{item.time}</time>
                </div>
              </div>
              <ActivityPreview item={item} />
            </motion.li>
          ))}
        </ul>
      </div>
    </SectionReveal>
  );
}

function ActivityPreview({ item }: { item: (typeof ACTIVITY)[number] }) {
  if (item.preview === "photo") {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-200 shadow-sm">
        <Image src={item.previewSrc} alt="" fill className="object-cover" sizes="56px" />
      </div>
    );
  }

  if (item.preview === "video") {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-200 shadow-sm">
        <Image src={item.previewSrc} alt="" fill className="object-cover" sizes="56px" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Play className="h-4 w-4 fill-white text-white" aria-hidden />
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-14 w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--landing-border)] bg-white px-2 shadow-sm">
      <WaveformBars bars={10} className="h-5" />
      <span className="mt-1 text-[8px] font-medium text-[var(--landing-subtle)]">Playing</span>
    </div>
  );
}

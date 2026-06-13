"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Play } from "lucide-react";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { cn } from "@/lib/utils";
import { SectionReveal, RevealItem } from "./section-reveal";
import { WaveformBars } from "./landing-shared";

const ACTIVITY = [
  {
    id: "maya",
    name: "Maya",
    avatar: LANDING_IMAGES.avatars[0],
    action: "pinned a memory in Kyoto",
    location: "Kyoto, Japan",
    time: "2m ago",
    preview: "photo" as const,
    previewSrc: LANDING_IMAGES.stories.japan,
  },
  {
    id: "alex",
    name: "Alex",
    avatar: LANDING_IMAGES.avatars[2],
    action: "shared a reel from Iceland",
    location: "Reykjavík, Iceland",
    time: "8m ago",
    preview: "video" as const,
    previewSrc: LANDING_IMAGES.stories.iceland,
  },
  {
    id: "priya",
    name: "Priya",
    avatar: LANDING_IMAGES.avatars[1],
    action: "added music to her Lisbon story",
    location: "Lisbon, Portugal",
    time: "15m ago",
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
          <p className="landing-eyebrow text-[var(--landing-accent)]">Live community</p>
          <h2 className="landing-h2 font-display mt-3 text-[var(--landing-ink)]">Travel is happening right now.</h2>
          <p className="landing-body mt-3">
            Real people saving trips they mean to return to — one city, one song, one afternoon at a time.
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
            {!reduced ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/35" /> : null}
          </motion.span>
          <p className="landing-eyebrow text-[var(--landing-muted)]">Live activity</p>
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

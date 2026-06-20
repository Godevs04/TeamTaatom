"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Play, UserRound } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { HoverLiftCard, MotionImageWrap } from "./motion-primitives";
import { TiltCard } from "./tilt-card";
import { FeatureRouteMap } from "@/components/maps/feature-route-map";

function AnimatedMap() {
  return (
    <HoverLiftCard className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#e8ebe8]">
      <FeatureRouteMap className="absolute inset-0" />
    </HoverLiftCard>
  );
}

function ReelsPreview() {
  return (
    <div className="flex justify-center gap-3 overflow-x-auto pb-2 sm:gap-4">
      {LANDING_IMAGES.reels.map((src) => (
        <TiltCard key={src} className="w-[140px] shrink-0 sm:w-[160px]">
          <HoverLiftCard>
          <MotionImageWrap className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-stone-300 shadow-[var(--landing-shadow)]">
            <Image src={src} alt="Travel reel preview" fill className="object-cover" sizes="160px" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-3 text-[10px] font-medium text-white">0:24</span>
            <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
              <Play className="h-4 w-4 fill-white text-white" aria-hidden />
            </span>
          </MotionImageWrap>
          </HoverLiftCard>
        </TiltCard>
      ))}
    </div>
  );
}

function MusicPlayer() {
  const bars = 24;
  return (
    <HoverLiftCard className="rounded-[1.5rem] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-6 shadow-[var(--landing-shadow)]">
      <p className="text-sm font-semibold text-[var(--landing-ink)]">Coastal Highway — Day 4</p>
      <p className="text-xs text-[var(--landing-subtle)]">Lisbon · Memory soundtrack</p>
      <div className="mt-6 flex h-16 items-end justify-center gap-1">
        {Array.from({ length: bars }).map((_, i) => (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-[var(--landing-accent)]"
            animate={{ height: [8, 12 + (i % 5) * 6, 10, 20 + (i % 3) * 8, 8] }}
            transition={{ duration: 1.2 + (i % 4) * 0.15, repeat: Infinity, ease: "easeInOut" }}
            style={{ height: 12 }}
          />
        ))}
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-stone-200">
        <motion.div
          className="h-full rounded-full bg-[var(--landing-accent)]"
          animate={{ width: ["0%", "62%", "62%"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </HoverLiftCard>
  );
}

const CREATORS = [
  { name: "Elena Park", style: "Slow travel", cities: "24 cities", img: LANDING_IMAGES.creators[0].img },
  { name: "Marcus Reid", style: "Food maps", cities: "18 cities", img: LANDING_IMAGES.creators[1].img },
  { name: "Sofia Reyes", style: "Street light", cities: "31 cities", img: LANDING_IMAGES.creators[2].img },
];

function CreatorCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {CREATORS.map((c) => (
        <TiltCard key={c.name}>
          <motion.article
            whileHover={{ y: -6 }}
            className="overflow-hidden rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] shadow-sm transition-shadow hover:shadow-[var(--landing-shadow)]"
          >
            <MotionImageWrap className="relative aspect-[4/3] bg-stone-200">
              <Image src={c.img} alt={c.name} fill className="object-cover" sizes="200px" />
            </MotionImageWrap>
            <div className="p-4">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-[var(--landing-accent)]" aria-hidden />
                <p className="font-semibold text-[var(--landing-ink)]">{c.name}</p>
              </div>
              <p className="mt-1 text-xs text-[var(--landing-accent)]">{c.style}</p>
              <p className="mt-0.5 text-xs text-[var(--landing-subtle)]">{c.cities}</p>
            </div>
          </motion.article>
        </TiltCard>
      ))}
    </div>
  );
}

type FeatureBlockProps = {
  title: string;
  body: string;
  visual: React.ReactNode;
  reversed?: boolean;
};

function FeatureBlock({ title, body, visual, reversed }: FeatureBlockProps) {
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reversed ? "lg:[&>div:first-child]:order-2" : ""}`}>
      <RevealItem>{visual}</RevealItem>
      <RevealItem>
        <h3 className="font-display text-2xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-3xl">{title}</h3>
        <p className="mt-4 text-[17px] leading-relaxed text-[var(--landing-muted)]">{body}</p>
      </RevealItem>
    </div>
  );
}

export function LandingFeatures() {
  return (
    <div id="features" className="scroll-mt-24">
      <SectionReveal className="landing-section landing-section-glow">
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <RevealItem className="mx-auto max-w-2xl text-center">
            <p className="landing-eyebrow text-[var(--landing-accent)]">Stories</p>
            <h2 className="landing-h2 font-display mt-6 text-[var(--landing-ink)]">
              Journeys you can return to
            </h2>
          </RevealItem>

          <div className="mt-20 space-y-28 sm:space-y-36">
            <FeatureBlock
              title="Map memories"
              body="Every photo, note, and song can live on the map where it happened. Revisit a city and feel the day again — not just scroll past it."
              visual={<AnimatedMap />}
            />
            <FeatureBlock
              reversed
              title="Travel reels"
              body="Vertical stories with pace and place. Share the rhythm of a trip the way you experienced it — short, visual, intentional."
              visual={<ReelsPreview />}
            />
            <FeatureBlock
              title="Music memories"
              body="Attach the track that was playing when the moment mattered. Sound becomes part of the memory, not background noise."
              visual={<MusicPlayer />}
            />
            <div id="creators">
              <FeatureBlock
                reversed
                title="Creator discovery"
                body="Follow travelers by city, style, and taste — not trends. Find people whose journeys you would actually take."
                visual={<CreatorCards />}
              />
            </div>
          </div>
        </div>
      </SectionReveal>
    </div>
  );
}

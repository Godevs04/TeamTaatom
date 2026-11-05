"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { placeImage } from "@/lib/landing-images";
import { HoverLiftCard } from "./motion-primitives";
import { cn } from "@/lib/utils";

const STORIES = [
  {
    title: "Five slow days in Cappadocia",
    meta: "Türkiye · 5 days · 38 photos · 6 songs",
    image: placeImage("cappadocia", 900),
    href: "/auth/register",
  },
  {
    title: "A long weekend in Venice",
    meta: "Italy · 3 days · 24 memories",
    image: placeImage("venice", 900),
    href: "/auth/register",
  },
  {
    title: "Walking the Inca Trail",
    meta: "Peru · 4 days · 41 photos",
    image: placeImage("machuPicchu", 900),
    href: "/auth/register",
  },
] as const;

export function LandingStoryFeed() {
  const reduced = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const count = STORIES.length;

  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const next = () => setIndex((i) => (i + 1) % count);

  return (
    <SectionReveal
      id="stories"
      className="landing-section scroll-mt-24 border-b border-[var(--landing-border)] bg-[var(--landing-surface)] py-16 sm:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="landing-eyebrow text-[var(--landing-accent)]">Trip journals</p>
            <h2 className="landing-h2 font-display mt-3 text-[var(--landing-ink)]">Open a trip. Stay awhile.</h2>
            <p className="landing-body mt-3 max-w-md">
              Each trip reads like a little book — day by day, place by place, with the songs that played along the way.
            </p>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous journey"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--landing-border)] bg-white text-[var(--landing-ink)] transition-all hover:border-[var(--landing-accent)]/30 hover:shadow-[var(--landing-card-shadow)]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next journey"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--landing-border)] bg-white text-[var(--landing-ink)] transition-all hover:border-[var(--landing-accent)]/30 hover:shadow-[var(--landing-card-shadow)]"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </RevealItem>

        <div className="relative overflow-hidden">
          <div className="hidden gap-5 md:grid md:grid-cols-3 md:gap-6">
            {STORIES.map((story) => (
              <JourneyCard key={story.title} story={story} />
            ))}
          </div>

          <div className="md:hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={STORIES[index].title}
                initial={reduced ? false : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -40 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <JourneyCard story={STORIES[index]} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2 md:hidden">
          {STORIES.map((story, i) => (
            <button
              key={story.title}
              type="button"
              aria-label={`Go to ${story.title}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-6 bg-[var(--landing-ink)]" : "w-1.5 bg-[var(--landing-border)]"
              )}
            />
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}

function JourneyCard({ story }: { story: (typeof STORIES)[number] }) {
  return (
    <RevealItem>
      <HoverLiftCard className="h-full">
        <Link href={story.href} className="group relative block overflow-hidden rounded-[24px] bg-stone-200 shadow-[var(--landing-card-shadow)]">
          <div className="relative aspect-[3/4]">
            <Image
              src={story.image}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
            <div className="absolute inset-x-0 bottom-0 p-6">
              <h3 className="font-display text-xl font-medium leading-snug text-white sm:text-2xl">{story.title}</h3>
              <p className="mt-2 text-[13px] font-medium text-white/80">{story.meta}</p>
            </div>
          </div>
        </Link>
      </HoverLiftCard>
    </RevealItem>
  );
}

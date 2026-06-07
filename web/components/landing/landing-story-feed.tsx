"use client";

import Image from "next/image";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { HoverLiftCard, MotionImageWrap } from "./motion-primitives";

const STORIES = [
  {
    title: "Iceland Ring Road",
    destination: "Reykjavík → Vik",
    duration: "7 days",
    stories: "23 photos",
    music: "4 songs attached",
    image: LANDING_IMAGES.stories.iceland,
    href: "/auth/register",
  },
  {
    title: "Japan Cherry Blossom Route",
    destination: "Kyoto · Osaka",
    duration: "10 days",
    stories: "52 memories",
    music: "Sakura Walk — ambient",
    image: LANDING_IMAGES.stories.japan,
    href: "/auth/register",
  },
  {
    title: "Kerala Monsoon Trails",
    destination: "Munnar · Kochi",
    duration: "5 days",
    stories: "Story collection",
    music: "Rain on tin roofs",
    image: LANDING_IMAGES.stories.kerala,
    href: "/auth/register",
  },
] as const;

export function LandingStoryFeed() {
  return (
    <SectionReveal id="stories" className="landing-section-glow border-b border-[var(--landing-border)] bg-[var(--landing-surface)]/60 py-16 sm:py-20">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem className="mb-12 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="landing-eyebrow text-[var(--landing-accent)]">Featured journeys</p>
            <h2 className="landing-h2 font-display mt-4 text-[var(--landing-ink)]">Open a trip. Stay awhile.</h2>
          </div>
          <p className="landing-body max-w-sm">Real routes with photos, music, and days you can wander through.</p>
        </RevealItem>

        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {STORIES.map((story) => (
            <RevealItem key={story.title}>
              <HoverLiftCard className="h-full">
                <Link href={story.href} className="group block h-full">
                  <MotionImageWrap className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-stone-200">
                    <Image
                      src={story.image}
                      alt={story.title}
                      fill
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/75">{story.destination}</p>
                      <h3 className="font-display mt-2 text-xl font-medium leading-snug text-white sm:text-2xl">{story.title}</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                          {story.duration}
                        </span>
                        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                          {story.stories}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                          <Music2 className="h-3 w-3" aria-hidden />
                          {story.music}
                        </span>
                      </div>
                    </div>
                  </MotionImageWrap>
                </Link>
              </HoverLiftCard>
            </RevealItem>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}

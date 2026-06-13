"use client";

import Image from "next/image";
import { ArrowRight, Play } from "lucide-react";
import { motion } from "framer-motion";
import { LandingHeroScene } from "./landing-hero-scene";
import { MagneticButton } from "./magnetic-button";
import { FloatingAvatarGroup, FloatingAvatarItem } from "./motion-primitives";
import { fadeSlideItem, fadeSlideRightItem, fadeUpItem, staggerContainer } from "./landing-motion";
import { LANDING_IMAGES } from "@/lib/landing-images";

export function LandingHero() {
  const scrollStories = () => {
    document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="explore" className="relative scroll-mt-24 overflow-hidden pt-28 sm:pt-32 lg:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 sm:px-6 sm:pb-24 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-28">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-[34rem]">
          <motion.h1 variants={fadeSlideItem} className="landing-hero-title font-display text-[var(--landing-ink)]">
            Travel stories worth keeping.
          </motion.h1>
          <motion.p variants={fadeSlideItem} className="landing-body mt-6 max-w-[30rem]">
            Capture places, music, and moments in a beautiful travel journal — the way you actually remember them.
          </motion.p>
          <motion.div variants={fadeUpItem} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MagneticButton href="/auth/register" className="gap-2">
              <span className="inline-flex items-center gap-2">
                Start your journey
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </MagneticButton>
            <MagneticButton variant="secondary" onClick={scrollStories} className="gap-2">
              <span className="inline-flex items-center gap-2">
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
                Watch stories
              </span>
            </MagneticButton>
          </motion.div>
          <motion.div variants={fadeUpItem} className="mt-12">
            <FloatingAvatarGroup className="-space-x-2.5">
              {LANDING_IMAGES.avatars.slice(0, 5).map((src, i) => (
                <FloatingAvatarItem
                  key={src}
                  index={i}
                  className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-[var(--landing-bg)] shadow-sm"
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="36px" />
                </FloatingAvatarItem>
              ))}
            </FloatingAvatarGroup>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-[var(--landing-muted)]">
              <span className="font-semibold text-[var(--landing-ink)]">12,000+</span> travelers documenting real journeys
            </p>
          </motion.div>
        </motion.div>

        <motion.div variants={fadeSlideRightItem} initial="hidden" animate="show" className="flex justify-center lg:justify-end">
          <LandingHeroScene />
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LandingHeroScene } from "./landing-hero-scene";
import { MagneticButton } from "./magnetic-button";
import { FloatingAvatarGroup, FloatingAvatarItem } from "./motion-primitives";
import { fadeSlideItem, fadeSlideRightItem, fadeUpItem, staggerContainer } from "./landing-motion";
import { LANDING_IMAGES } from "@/lib/landing-images";

const DESTINATIONS = ["Kyoto", "Reykjavík", "Lisbon", "Munnar"];

export function LandingHero() {
  const scrollStories = () => {
    document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="explore" className="relative overflow-hidden pt-32 sm:pt-36 lg:pt-44">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 pb-24 sm:px-6 sm:pb-32 lg:grid-cols-2 lg:gap-20 lg:px-8 lg:pb-40">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-[34rem]">
          <motion.p variants={fadeSlideItem} className="landing-eyebrow text-[var(--landing-accent)]">
            Travel journal
          </motion.p>
          <motion.h1 variants={fadeSlideItem} className="landing-hero-title font-display mt-8 text-[var(--landing-ink)]">
            Travel stories worth keeping.
          </motion.h1>
          <motion.p variants={fadeSlideItem} className="landing-body mt-8 max-w-[32rem]">
            Wander through real journeys — places, music, and afternoons saved the way travelers actually remember them.
          </motion.p>
          <motion.div variants={fadeUpItem} className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
            <MagneticButton href="/auth/register">Start exploring</MagneticButton>
            <MagneticButton variant="secondary" onClick={scrollStories}>
              Read a story
            </MagneticButton>
          </motion.div>
          <motion.div variants={fadeUpItem} className="mt-14">
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
              Travelers documenting trips across{" "}
              {DESTINATIONS.map((d, i) => (
                <span key={d}>
                  {i > 0 ? (i === DESTINATIONS.length - 1 ? " and " : ", ") : null}
                  <span className="font-medium text-[var(--landing-ink)]">{d}</span>
                </span>
              ))}
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

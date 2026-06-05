"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { LandingHeroScene } from "./landing-hero-scene";
import { RippleButton } from "./ripple-button";
import { fadeUpItem, staggerContainer } from "./section-reveal";

const TRUST = ["Real journeys", "Verified places", "Stories with context"];

export function LandingHero() {
  const scrollStories = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="explore" className="relative overflow-hidden pt-28 sm:pt-32 lg:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8 lg:pb-28">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-xl">
          <motion.p variants={fadeUpItem} className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--landing-accent)]">
            Travel journal
          </motion.p>
          <motion.h1
            variants={fadeUpItem}
            className="mt-5 font-display text-[clamp(2.35rem,5.5vw,4.25rem)] font-semibold leading-[1.08] tracking-tight text-[var(--landing-ink)]"
          >
            Travel stories worth keeping.
          </motion.h1>
          <motion.p variants={fadeUpItem} className="mt-6 text-lg leading-relaxed text-[var(--landing-muted)]">
            Capture places, memories, music and moments in one beautiful travel journal — not another feed built for
            engagement.
          </motion.p>
          <motion.div variants={fadeUpItem} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <RippleButton href="/auth/register">Start Your Journey</RippleButton>
            <RippleButton variant="ghost" onClick={scrollStories}>
              Watch Stories
            </RippleButton>
          </motion.div>
          <motion.ul variants={fadeUpItem} className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm font-medium text-[var(--landing-muted)]">
                <ShieldCheck className="h-4 w-4 text-[var(--landing-accent)]" aria-hidden />
                {t}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <LandingHeroScene />
        </motion.div>
      </div>
    </section>
  );
}

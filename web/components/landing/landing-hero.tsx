"use client";

import Image from "next/image";
import { ArrowRight, ArrowDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LandingHeroScene } from "./landing-hero-scene";
import { MagneticButton } from "./magnetic-button";
import { fadeUpItem, staggerContainer } from "./landing-motion";
import { LANDING_IMAGES } from "@/lib/landing-images";

const ease = [0.22, 1, 0.36, 1] as const;
const HEADLINE = ["Every", "trip,", "kept", "as"];

export function LandingHero() {
  const reduced = useReducedMotion();
  const scrollToHow = () => {
    document.getElementById("how")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section id="explore" className="relative scroll-mt-24 overflow-hidden pt-28 sm:pt-32 lg:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 sm:px-6 sm:pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:pb-24">
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="max-w-[36rem]">
          <motion.p
            variants={fadeUpItem}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-white/70 px-3.5 py-1.5 text-[12px] font-medium text-[var(--landing-muted)]"
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Your travel journal — on iPhone, Android &amp; web
          </motion.p>

          <h1 className="landing-hero-title font-display mt-6 text-[var(--landing-ink)]">
            {HEADLINE.map((word, i) => (
              <motion.span
                key={word}
                className="mr-[0.22em] inline-block"
                initial={{ opacity: 0, y: "0.4em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease }}
              >
                {word}
              </motion.span>
            ))}
            <motion.span
              className="landing-hero-accent inline-block italic"
              initial={{ opacity: 0, y: "0.4em" }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 + HEADLINE.length * 0.08, ease }}
            >
              a story.
            </motion.span>
          </h1>

          <motion.p variants={fadeUpItem} className="landing-body mt-6 max-w-[32rem]">
            Pin the places you went, add the song that was playing, and write down the little moments photos never
            catch. Taatom turns each trip into a journal you&apos;ll actually reopen — and share with the people who
            were there.
          </motion.p>

          <motion.div variants={fadeUpItem} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MagneticButton href="/auth/register">
              <span className="inline-flex items-center gap-2">
                Start your first journal
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </MagneticButton>
            <MagneticButton variant="secondary" onClick={scrollToHow}>
              <span className="inline-flex items-center gap-2">
                See how it works
                <ArrowDown className="h-4 w-4" aria-hidden />
              </span>
            </MagneticButton>
          </motion.div>

          <motion.div variants={fadeUpItem} className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {LANDING_IMAGES.avatars.slice(0, 5).map((src) => (
                <span
                  key={src}
                  className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-[var(--landing-bg)] shadow-sm"
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="36px" />
                </span>
              ))}
            </div>
            <p className="text-[14px] leading-snug text-[var(--landing-muted)]">
              <span className="font-semibold text-[var(--landing-ink)]">50+ travelers</span> already journaling
              <br className="hidden sm:block" /> their trips with Taatom
            </p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease }}
        >
          <LandingHeroScene />
        </motion.div>
      </div>
    </section>
  );
}

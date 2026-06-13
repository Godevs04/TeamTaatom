"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Play, Plus } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { HoverLiftCard } from "./motion-primitives";

const REELS = [
  { title: "Coastal Highway", location: "Portugal", duration: "0:24", image: LANDING_IMAGES.reels[0] },
  { title: "Midnight Train", location: "Japan", duration: "0:18", image: LANDING_IMAGES.reels[1] },
  { title: "Monsoon Trails", location: "India", duration: "0:31", image: LANDING_IMAGES.reels[2] },
] as const;

export function LandingReels() {
  return (
    <SectionReveal
      id="product"
      className="landing-section-glow scroll-mt-24 border-b border-[var(--landing-border)] bg-[var(--landing-bg)] py-16 sm:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem className="mb-10 sm:mb-12">
          <p className="landing-eyebrow text-[var(--landing-accent)]">Travel reels</p>
          <h2 className="landing-h2 font-display mt-3 text-[var(--landing-ink)]">Moments in motion.</h2>
          <p className="landing-body mt-3 max-w-lg">
            Short vertical stories with pace and place — the rhythm of a trip, one reel at a time.
          </p>
        </RevealItem>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
          {REELS.map((reel, i) => (
            <RevealItem key={reel.title}>
              <HoverLiftCard>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href="/auth/register" className="group block">
                    <div className="relative aspect-[9/16] overflow-hidden rounded-[20px] bg-stone-200 shadow-[var(--landing-card-shadow)]">
                      <Image
                        src={reel.image}
                        alt={reel.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 45vw, 200px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                      <span className="absolute left-3 top-3 rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                        {reel.duration}
                      </span>
                      <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 opacity-90 backdrop-blur-sm transition-transform group-hover:scale-110">
                        <Play className="h-4 w-4 fill-white text-white" aria-hidden />
                      </span>
                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="text-[12px] font-semibold text-white">{reel.title}</p>
                        <p className="text-[10px] text-white/70">{reel.location}</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </HoverLiftCard>
            </RevealItem>
          ))}

          <RevealItem>
            <Link
              href="/auth/register"
              className="group flex aspect-[9/16] flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-[var(--landing-border)] bg-white/50 transition-all hover:border-[var(--landing-accent)]/35 hover:bg-white hover:shadow-[var(--landing-card-shadow)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--landing-bg)] text-[var(--landing-muted)] transition-colors group-hover:bg-[var(--landing-accent)]/10 group-hover:text-[var(--landing-accent)]">
                <Plus className="h-5 w-5" aria-hidden />
              </span>
              <p className="mt-3 text-center text-[13px] font-semibold text-[var(--landing-ink)]">Share your story</p>
            </Link>
          </RevealItem>
        </div>
      </div>
    </SectionReveal>
  );
}

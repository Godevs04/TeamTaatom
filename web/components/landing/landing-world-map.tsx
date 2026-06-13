"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { AnimatedRoutePath } from "./motion-primitives";
import { GlassCard } from "./landing-shared";

const TAGS = ["Japan", "Iceland", "Portugal", "Vietnam", "India"] as const;

const PINS = [
  { id: "tokyo", label: "Tokyo", top: "38%", left: "78%", avatar: LANDING_IMAGES.avatars[0] },
  { id: "reykjavik", label: "Reykjavík", top: "28%", left: "42%", avatar: LANDING_IMAGES.avatars[2] },
  { id: "lisbon", label: "Lisbon", top: "44%", left: "46%", avatar: LANDING_IMAGES.avatars[1] },
  { id: "kerala", label: "Kerala", top: "52%", left: "68%", avatar: LANDING_IMAGES.avatars[3] },
] as const;

const ARCS = [
  "M 120 140 Q 180 80 240 120",
  "M 160 180 Q 220 120 280 150",
  "M 200 100 Q 260 140 300 180",
] as const;

export function LandingWorldMap() {
  const reduced = useReducedMotion();

  return (
    <SectionReveal
      id="journeys"
      className="landing-section scroll-mt-24 overflow-hidden bg-[var(--landing-map-bg)] py-16 sm:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <RevealItem>
            <p className="landing-eyebrow text-white/50">Explore the world</p>
            <h2 className="landing-h2 font-display mt-4 text-white">Every place has a story behind it.</h2>
            <p className="mt-4 max-w-md text-[1rem] leading-relaxed text-white/65">
              Follow glowing routes across the map — see where travelers are saving memories right now.
            </p>
            <Link
              href="/auth/register"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-[14px] font-semibold text-[var(--landing-ink)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(255,255,255,0.15)]"
            >
              Explore map
            </Link>
            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Popular right now</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/12 bg-white/8 px-3.5 py-1.5 text-[12px] font-medium text-white/75 backdrop-blur-sm transition-colors hover:bg-white/14"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </RevealItem>

          <RevealItem className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1a2e] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 50%, rgba(99,149,255,0.15) 0%, transparent 55%), radial-gradient(circle at 20% 30%, rgba(99,102,241,0.12) 0%, transparent 40%)",
                }}
                aria-hidden
              />

              <svg className="absolute inset-0 h-full w-full opacity-[0.18]" viewBox="0 0 800 520" aria-hidden>
                <defs>
                  <pattern id="map-dots" width="12" height="12" patternUnits="userSpaceOnUse">
                    <circle cx="1.5" cy="1.5" r="0.8" fill="#6b8cff" />
                  </pattern>
                </defs>
                <rect width="800" height="520" fill="url(#map-dots)" />
              </svg>

              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 280" aria-hidden>
                <ellipse cx="200" cy="140" rx="165" ry="95" fill="none" stroke="rgba(99,149,255,0.12)" strokeWidth="1" />
                <ellipse cx="200" cy="140" rx="120" ry="68" fill="none" stroke="rgba(99,149,255,0.08)" strokeWidth="0.8" />
                {ARCS.map((d, i) => (
                  <AnimatedRoutePath
                    key={d}
                    d={d}
                    strokeWidth={1.2}
                    strokeOpacity={0.65}
                    delay={0.2 + i * 0.15}
                  />
                ))}
              </svg>

              {PINS.map((pin, i) => (
                <motion.div
                  key={pin.id}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ top: pin.top, left: pin.left }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                >
                  <div className="relative">
                    <span
                      className={`absolute -inset-2 rounded-full bg-[var(--landing-map-glow)] blur-md ${reduced ? "" : "landing-pin-pulse"}`}
                      aria-hidden
                    />
                    <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/80 shadow-lg">
                      <Image src={pin.avatar} alt="" fill className="object-cover" sizes="36px" />
                    </div>
                  </div>
                </motion.div>
              ))}

              <motion.div
                className="absolute bottom-[10%] right-[4%] z-20 w-[min(72%,220px)]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <GlassCard className="p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--landing-accent)]">
                    Someone just shared a memory
                  </p>
                  <div className="mt-2 flex gap-2.5">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-200">
                      <Image src={LANDING_IMAGES.stories.coast} alt="Lisbon memory" fill className="object-cover" sizes="56px" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--landing-ink)]">Sunset in Alfama</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--landing-subtle)]">
                        <MapPin className="h-2.5 w-2.5 text-[var(--landing-accent)]" aria-hidden />
                        Lisbon, Portugal
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </RevealItem>
        </div>
      </div>
    </SectionReveal>
  );
}

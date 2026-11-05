"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Camera, MapPinned, Music2, Share2 } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { placeImage } from "@/lib/landing-images";
import { WaveformBars } from "./landing-shared";

const ease = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    n: "01",
    title: "Capture it as it happens",
    body: "Snap photos and short videos, jot a line or two, and add the song that was playing. It takes seconds — no editing, no captions to perfect.",
    icon: Camera,
  },
  {
    n: "02",
    title: "Watch your route draw itself",
    body: "Every memory is pinned where it happened, so your trip becomes a map you can follow — cafés, viewpoints, the wrong turn that turned out right.",
    icon: MapPinned,
  },
  {
    n: "03",
    title: "Relive it, or share it",
    body: "Open a trip months later and it plays back like a story. Keep it private, share it with your travel crew, or post it for friends to explore.",
    icon: Share2,
  },
] as const;

export function LandingHowItWorks() {
  return (
    <SectionReveal id="how" className="landing-section scroll-mt-24 bg-[var(--landing-bg)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem className="max-w-2xl">
          <p className="landing-eyebrow text-[var(--landing-accent)]">How it works</p>
          <h2 className="landing-h2 font-display mt-3 text-[var(--landing-ink)]">
            Less time on your phone. More of the trip kept.
          </h2>
          <p className="landing-body mt-4">
            Taatom does the organizing for you — by day, by place and by song — so the journal builds itself while
            you&apos;re out exploring.
          </p>
        </RevealItem>

        <div className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <RevealItem key={step.n}>
                <motion.article
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-[var(--landing-border)] bg-white shadow-[var(--landing-card-shadow)]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[var(--landing-sand)]">
                    <StepVisual index={i} />
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--landing-accent)]/10 text-[var(--landing-accent)]">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="font-display text-[15px] italic text-[var(--landing-subtle)]">Step {step.n}</span>
                    </div>
                    <h3 className="font-display mt-4 text-[1.375rem] font-medium leading-snug text-[var(--landing-ink)]">
                      {step.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--landing-muted)]">{step.body}</p>
                  </div>
                </motion.article>
              </RevealItem>
            );
          })}
        </div>
      </div>
    </SectionReveal>
  );
}

/** Small illustrative scene per step, built from real photos + UI chips. */
function StepVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <>
        <Image
          src={placeImage("machuPicchu", 720)}
          alt="Machu Picchu in the clouds"
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          sizes="(max-width: 1024px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        <motion.div
          className="landing-chip absolute bottom-4 left-4 right-4 rounded-2xl p-3"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease }}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-accent)] text-white">
              <Music2 className="h-3.5 w-3.5" aria-hidden />
            </span>
            <p className="min-w-0 truncate text-[12px] font-medium text-[var(--landing-ink)]">
              &ldquo;Made it to the Sun Gate at 6am.&rdquo;
            </p>
          </div>
          <WaveformBars bars={22} className="mt-2 h-4" />
        </motion.div>
      </>
    );
  }

  if (index === 1) {
    const pins = [
      { left: "18%", top: "64%", label: "Hanoi" },
      { left: "46%", top: "38%", label: "Ha Long Bay" },
      { left: "76%", top: "58%", label: "Cat Ba" },
    ];
    return (
      <div className="absolute inset-0 bg-[#e9efe9]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden>
          <path d="M0 70 C 30 60, 40 80, 70 66 S 120 40, 160 52" fill="none" stroke="#cfd9cf" strokeWidth="10" />
          <path d="M0 30 C 40 20, 60 40, 100 24 S 140 18, 160 10" fill="none" stroke="#dfe7df" strokeWidth="8" />
          <motion.path
            d="M 28.8 64 C 44 52, 58 38, 73.6 38 S 108 50, 121.6 58"
            fill="none"
            stroke="var(--landing-accent)"
            strokeWidth="1.4"
            strokeDasharray="3 3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.8, ease }}
          />
        </svg>
        {pins.map((pin, i) => (
          <motion.div
            key={pin.label}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: pin.left, top: pin.top }}
            initial={{ opacity: 0, y: -8, scale: 0.8 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: 0.4 + i * 0.45, ease }}
          >
            <div className="flex flex-col items-center">
              <span className="landing-chip whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--landing-ink)]">
                {pin.label}
              </span>
              <span className="mt-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--landing-accent)] shadow" />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <>
      <Image
        src={placeImage("dolomitesFriends", 720)}
        alt="Friends hiking together in the Dolomites"
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        sizes="(max-width: 1024px) 100vw, 33vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <motion.div
        className="landing-chip absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2, ease }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
          4
        </span>
        <span className="text-[12px] font-semibold text-[var(--landing-ink)]">Shared with your trip crew</span>
      </motion.div>
    </>
  );
}

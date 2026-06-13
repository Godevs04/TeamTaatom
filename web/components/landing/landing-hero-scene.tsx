"use client";

import * as React from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { MapPin } from "lucide-react";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { AnimatedRoutePath, FloatingMotion, HoverLiftCard } from "./motion-primitives";
import { GlassCard, PlaneDot, WaveformBars } from "./landing-shared";

const ease = [0.22, 1, 0.36, 1] as const;

const POLAROIDS = [
  {
    city: "Kyoto",
    country: "Japan",
    src: LANDING_IMAGES.stories.japan,
    top: "14%",
    left: "6%",
    rotate: -8,
    z: 20,
    delay: 0.1,
  },
  {
    city: "Lisbon",
    country: "Portugal",
    src: LANDING_IMAGES.stories.coast,
    top: "38%",
    left: "52%",
    rotate: 6,
    z: 30,
    delay: 0.2,
  },
] as const;

const ROUTES = [
  "M 80 120 Q 140 80 200 100 T 280 140",
  "M 120 200 Q 180 160 240 180 T 320 120",
] as const;

export function LandingHeroScene() {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 48, damping: 22 });
  const sy = useSpring(my, { stiffness: 48, damping: 22 });
  const bgX = useSpring(useTransform(sx, (v) => v * 0.15), { stiffness: 48, damping: 22 });
  const bgY = useSpring(useTransform(sy, (v) => v * 0.15), { stiffness: 48, damping: 22 });

  const onMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 18);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 18);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative aspect-[4/5] w-full max-w-[520px] sm:aspect-[5/6] lg:max-w-none"
    >
      <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-[var(--landing-border)] shadow-[var(--landing-shadow)]">
        <motion.div className="absolute inset-0" style={{ x: bgX, y: bgY }}>
          <Image
            src={LANDING_IMAGES.hero.mountains}
            alt="Traveler on a mountain peak at golden hour"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 90vw, 520px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />
        </motion.div>

        <motion.svg
          className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
          viewBox="0 0 400 480"
          aria-hidden
        >
          {ROUTES.map((d, i) => (
            <AnimatedRoutePath key={d} d={d} strokeWidth={1.5} strokeOpacity={0.55} delay={0.3 + i * 0.2} />
          ))}
        </motion.svg>

        <motion.div
          className="absolute left-[38%] top-[28%] z-[8]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.5, ease }}
        >
          <PlaneDot />
        </motion.div>

        {POLAROIDS.map((card) => (
          <motion.div
            key={card.city}
            className="absolute z-[15]"
            style={{ top: card.top, left: card.left, zIndex: card.z, rotate: `${card.rotate}deg` }}
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: card.delay, duration: 0.75, ease }}
          >
            <FloatingMotion duration={5.5 + card.delay * 10} y={7} delay={card.delay}>
              <HoverLiftCard>
                <GlassCard className="w-[min(42vw,148px)] overflow-hidden p-2 sm:w-[148px]">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-stone-200">
                    <Image src={card.src} alt={`${card.city}, ${card.country}`} fill className="object-cover" sizes="148px" />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 px-0.5 pb-0.5">
                    <MapPin className="h-3 w-3 shrink-0 text-[var(--landing-accent)]" aria-hidden />
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-[11px] font-semibold text-[var(--landing-ink)]">{card.city}</p>
                      <p className="truncate text-[9px] text-[var(--landing-subtle)]">{card.country}</p>
                    </div>
                  </div>
                </GlassCard>
              </HoverLiftCard>
            </FloatingMotion>
          </motion.div>
        ))}

        <motion.div
          className="absolute bottom-[8%] right-[6%] z-[25] w-[min(52vw,200px)]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.65, ease }}
        >
          <FloatingMotion duration={6.2} y={5} delay={0.3}>
            <GlassCard className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--landing-accent)]/10">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2 7h10M7 2v10" stroke="var(--landing-accent)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[var(--landing-ink)]">Daylight</p>
                  <p className="truncate text-[10px] text-[var(--landing-subtle)]">Odesza</p>
                </div>
              </div>
              <WaveformBars bars={16} className="mt-3 h-6" />
            </GlassCard>
          </FloatingMotion>
        </motion.div>
      </div>
    </div>
  );
}

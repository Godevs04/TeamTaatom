"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { MapPin } from "lucide-react";
import { LANDING_IMAGES } from "@/lib/landing-images";

const PHOTOS = [
  {
    src: LANDING_IMAGES.hero.mountains,
    alt: "Road trip through mountains",
    x: "6%",
    y: "10%",
    z: 30,
    rotate: -6,
    delay: 0,
  },
  {
    src: LANDING_IMAGES.hero.lake,
    alt: "Lake and forest",
    x: "48%",
    y: "4%",
    z: 20,
    rotate: 4,
    delay: 0.08,
  },
  {
    src: LANDING_IMAGES.hero.city,
    alt: "Canal city at golden hour",
    x: "58%",
    y: "48%",
    z: 40,
    rotate: -2,
    delay: 0.14,
  },
];

const PINS = [
  { label: "Kyoto", top: "28%", left: "22%" },
  { label: "Lisbon", top: "52%", left: "68%" },
];

export function LandingHeroScene() {
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 22 });
  const sy = useSpring(my, { stiffness: 55, damping: 22 });
  const journalX = useTransform(sx, (v) => v * 0.6);
  const journalXSpring = useSpring(journalX, { stiffness: 55, damping: 22 });

  const [glow, setGlow] = React.useState({ x: 50, y: 50 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width - 0.5) * 28;
    const py = ((e.clientY - r.top) / r.height - 0.5) * 28;
    mx.set(px);
    my.set(py);
    setGlow({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
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
      className="relative aspect-[4/5] w-full max-w-[540px] lg:aspect-square lg:max-w-none"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-60 transition-opacity duration-300"
        style={{
          background: `radial-gradient(420px circle at ${glow.x}% ${glow.y}%, rgba(28,115,180,0.14), transparent 65%)`,
        }}
        aria-hidden
      />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" aria-hidden>
        <motion.path
          d="M 48 260 Q 120 180 200 210 T 340 120"
          fill="none"
          stroke="var(--landing-accent)"
          strokeWidth="1.25"
          strokeDasharray="4 7"
          strokeOpacity="0.45"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.8, ease: "easeInOut" }}
        />
        <motion.circle
          cx="48"
          cy="260"
          r="4"
          fill="var(--landing-accent)"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <circle cx="200" cy="210" r="3" fill="var(--landing-accent-soft)" opacity="0.8" />
        <circle cx="340" cy="120" r="4" fill="var(--landing-accent)" />
      </svg>

      {PHOTOS.map((p) => (
        <motion.div
          key={p.src}
          className="absolute w-[46%] overflow-hidden rounded-2xl shadow-[var(--landing-shadow)]"
          style={{ left: p.x, top: p.y, zIndex: p.z, rotate: `${p.rotate}deg` }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: p.delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div style={{ x: sx, y: sy }} animate={{ y: [0, -8, 0] }} transition={{ duration: 5 + p.delay, repeat: Infinity, ease: "easeInOut" }}>
            <div className="relative aspect-[3/4] bg-stone-200">
              <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="280px" priority={p.delay === 0} />
            </div>
          </motion.div>
        </motion.div>
      ))}

      {PINS.map((pin) => (
        <motion.div
          key={pin.label}
          className="absolute z-50 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur-sm"
          style={{ top: pin.top, left: pin.left }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <MapPin className="h-3 w-3 text-[var(--landing-accent)]" aria-hidden />
          {pin.label}
        </motion.div>
      ))}

      <motion.div
        style={{ x: journalXSpring, y: sy }}
        className="absolute bottom-[8%] left-[4%] z-50 max-w-[200px] rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)]/95 p-4 shadow-[var(--landing-shadow)] backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--landing-accent)]">Journal</p>
        <p className="mt-2 font-display text-[15px] leading-snug text-[var(--landing-ink)]">
          Day 12 — market sounds, espresso, and the alley where we got lost on purpose.
        </p>
        <p className="mt-2 text-xs text-[var(--landing-subtle)]">Lisbon · Added 3 places</p>
      </motion.div>

      <motion.div
        className="absolute right-[2%] top-[62%] z-50 w-[44%] rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-3 shadow-[var(--landing-shadow)]"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-full bg-stone-200">
            <Image
              src={LANDING_IMAGES.hero.creatorAvatar}
              alt="Creator profile"
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
          <div>
            <p className="text-xs font-semibold">Elena&apos;s story</p>
            <p className="text-[10px] text-[var(--landing-subtle)]">Coastal train · 2 min read</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

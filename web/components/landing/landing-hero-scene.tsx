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
import {
  AnimatedRoutePath,
  FloatingMotion,
  HoverLiftCard,
  MotionImageWrap,
} from "./motion-primitives";

const ease = [0.22, 1, 0.36, 1] as const;

const PHOTOS = [
  {
    src: LANDING_IMAGES.stories.iceland,
    alt: "Iceland ring road",
    width: "52%",
    left: "0%",
    top: "8%",
    z: 12,
    rotate: -6,
    parallax: 0.4,
    floatDuration: 5.2,
    delay: 0,
  },
  {
    src: LANDING_IMAGES.stories.japan,
    alt: "Cherry blossom route",
    width: "42%",
    left: "46%",
    top: "2%",
    z: 18,
    rotate: 5,
    parallax: 0.65,
    floatDuration: 6,
    delay: 0.06,
  },
  {
    src: LANDING_IMAGES.stories.kerala,
    alt: "Kerala monsoon trails",
    width: "34%",
    left: "26%",
    top: "44%",
    z: 28,
    rotate: -3,
    parallax: 0.85,
    floatDuration: 5.5,
    delay: 0.12,
  },
  {
    src: LANDING_IMAGES.stories.coast,
    alt: "Coastal golden hour",
    width: "46%",
    left: "52%",
    top: "42%",
    z: 32,
    rotate: 4,
    parallax: 1,
    floatDuration: 6.8,
    delay: 0.18,
  },
] as const;

const PINS = [
  { city: "Reykjavík", country: "Iceland", top: "16%", left: "70%", z: 45 },
  { city: "Kyoto", country: "Japan", top: "24%", left: "16%", z: 46 },
  { city: "Munnar", country: "India", top: "66%", left: "28%", z: 44 },
] as const;

const ROUTES = [
  "M 52 268 Q 95 200 145 215 T 235 175 T 318 108",
  "M 78 120 Q 140 155 195 140 T 290 195 T 340 248",
] as const;

const JOURNEYS = [
  { title: "Iceland Ring Road", meta: "7 Days · 23 Photos · 4 Songs" },
  { title: "Japan Cherry Blossom Route", meta: "10 Days · 52 Memories" },
  { title: "Kerala Monsoon Trails", meta: "5 Days · Story Collection" },
] as const;

const CREATORS = [
  { name: "Elena", story: "Coastal train", img: LANDING_IMAGES.hero.creatorAvatar },
  { name: "Marcus", story: "Food walk", img: LANDING_IMAGES.avatars[1] },
  { name: "Sofia", story: "Night market", img: LANDING_IMAGES.avatars[3] },
] as const;

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/55 bg-white/58 shadow-[0_12px_40px_rgba(20,20,20,0.08)] backdrop-blur-xl ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function LandingHeroScene() {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 24 });
  const sy = useSpring(my, { stiffness: 50, damping: 24 });
  const mapX = useSpring(useTransform(sx, (v) => v * 0.25), { stiffness: 50, damping: 24 });
  const mapY = useSpring(useTransform(sy, (v) => v * 0.25), { stiffness: 50, damping: 24 });
  const routeX = useSpring(useTransform(sx, (v) => v * 0.35), { stiffness: 50, damping: 24 });
  const routeY = useSpring(useTransform(sy, (v) => v * 0.35), { stiffness: 50, damping: 24 });
  const [glow, setGlow] = React.useState({ x: 50, y: 50 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 26);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 26);
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
      className="relative min-h-[480px] w-full max-w-[580px] sm:min-h-[520px] lg:max-w-none lg:min-h-[560px]"
    >
      <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-[var(--landing-border)] bg-[var(--landing-surface)]/35 shadow-[var(--landing-shadow)]">
        <div
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(460px circle at ${glow.x}% ${glow.y}%, rgba(91,108,255,0.07), transparent 68%)`,
          }}
          aria-hidden
        />

        <motion.div className="pointer-events-none absolute inset-0 z-[1]" style={{ x: mapX, y: mapY }} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(99,102,241,0.04),transparent_72%)]" />
          <svg className="h-full w-full opacity-[0.12]" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="hero-dots" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="1.2" cy="1.2" r="0.6" fill="#5b6cff" opacity="0.35" />
              </pattern>
            </defs>
            <rect width="800" height="520" fill="url(#hero-dots)" />
          </svg>
        </motion.div>

        <motion.svg
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
          viewBox="0 0 400 400"
          style={{ x: routeX, y: routeY }}
          aria-hidden
        >
          {ROUTES.map((d, i) => (
            <AnimatedRoutePath key={d} d={d} strokeWidth={i === 0 ? 1.5 : 1} strokeOpacity={i === 0 ? 0.48 : 0.3} delay={i * 0.25} />
          ))}
        </motion.svg>

        <motion.div
          className="absolute left-1/2 top-3 z-[48] -translate-x-1/2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5, ease }}
        >
          <GlassCard className="flex items-center gap-2 px-3 py-1.5">
            <motion.span
              className="h-2 w-2 rounded-full bg-[var(--landing-accent)]"
              animate={reduced ? undefined : { scale: [1, 1.15, 1], opacity: [1, 0.75, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
            <span className="text-[11px] font-medium tracking-wide text-[var(--landing-ink)]">
              Ring road · Cherry blossoms · Monsoon trails
            </span>
          </GlassCard>
        </motion.div>

        {PHOTOS.map((p) => (
          <PhotoCard key={p.src} photo={p} sx={sx} sy={sy} reduced={!!reduced} />
        ))}

        {PINS.map((pin, i) => (
          <motion.div
            key={pin.city}
            className="absolute z-[45]"
            style={{ top: pin.top, left: pin.left, zIndex: pin.z }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1, y: reduced ? 0 : [0, -4, 0] }}
            transition={{
              opacity: { delay: 0.28 + i * 0.07, duration: 0.5 },
              y: { duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <GlassCard className="flex items-center gap-2 px-2.5 py-1.5">
              <MapPin className="h-3 w-3 text-[var(--landing-accent)]" aria-hidden />
              <div className="leading-none">
                <p className="text-[11px] font-semibold text-[var(--landing-ink)]">{pin.city}</p>
                <p className="text-[9px] text-[var(--landing-subtle)]">{pin.country}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}

        <JourneyStack sx={sx} sy={sy} />
        <CreatorChips sx={sx} sy={sy} reduced={!!reduced} />
      </div>
    </div>
  );
}

function PhotoCard({
  photo: p,
  sx,
  sy,
  reduced,
}: {
  photo: (typeof PHOTOS)[number];
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  reduced: boolean;
}) {
  const px = useSpring(useTransform(sx, (v) => v * p.parallax), { stiffness: 50, damping: 24 });
  const py = useSpring(useTransform(sy, (v) => v * p.parallax), { stiffness: 50, damping: 24 });
  return (
    <motion.div
      className="absolute overflow-hidden rounded-2xl ring-1 ring-white/70"
      style={{ width: p.width, left: p.left, top: p.top, zIndex: p.z, rotate: `${p.rotate}deg` }}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: p.delay, duration: 0.75, ease }}
    >
      <motion.div style={{ x: px, y: py }} animate={reduced ? undefined : { y: [0, -9, 0] }} transition={{ duration: p.floatDuration, repeat: Infinity, ease: "easeInOut" }}>
        <HoverLiftCard className="rounded-2xl">
          <MotionImageWrap className="rounded-2xl">
            <div className="relative aspect-[3/4] bg-stone-200 shadow-[0_20px_50px_rgba(20,20,20,0.12)]">
              <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="280px" priority={p.delay === 0} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
            </div>
          </MotionImageWrap>
        </HoverLiftCard>
      </motion.div>
    </motion.div>
  );
}

function JourneyStack({ sx, sy }: { sx: ReturnType<typeof useSpring>; sy: ReturnType<typeof useSpring> }) {
  const x = useSpring(useTransform(sx, (v) => v * 0.55), { stiffness: 50, damping: 24 });
  const y = useSpring(useTransform(sy, (v) => v * 0.55), { stiffness: 50, damping: 24 });
  return (
    <motion.div
      className="absolute bottom-[6%] left-[2%] z-[52] w-[min(92%,236px)]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.6, ease }}
    >
      <motion.div style={{ x, y }}>
        <FloatingMotion duration={6} y={5} delay={0.1}>
          <HoverLiftCard>
            <GlassCard className="overflow-hidden p-0">
              <p className="border-b border-[var(--landing-border)] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--landing-accent)]">
                Open now
              </p>
              <ul className="divide-y divide-[var(--landing-border)]" role="list">
                {JOURNEYS.map((j, i) => (
                  <motion.li
                    key={j.title}
                    className="px-3.5 py-3"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.48 + i * 0.07, duration: 0.5, ease }}
                  >
                    <p className="font-display text-[13px] font-medium leading-snug text-[var(--landing-ink)]">{j.title}</p>
                    <p className="mt-1 text-[11px] text-[var(--landing-subtle)]">{j.meta}</p>
                  </motion.li>
                ))}
              </ul>
            </GlassCard>
          </HoverLiftCard>
        </FloatingMotion>
      </motion.div>
    </motion.div>
  );
}

function CreatorChips({
  sx,
  sy,
  reduced,
}: {
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  reduced: boolean;
}) {
  const x = useSpring(useTransform(sx, (v) => v * 0.45), { stiffness: 50, damping: 24 });
  const y = useSpring(useTransform(sy, (v) => v * 0.45), { stiffness: 50, damping: 24 });
  return (
    <motion.div
      className="absolute right-[2%] top-[58%] z-[53] w-[46%] max-w-[200px]"
      style={{ x, y }}
      animate={reduced ? undefined : { y: [0, 7, 0] }}
      transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <HoverLiftCard>
        <GlassCard className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--landing-accent)]">Travelers nearby</p>
          <div className="mt-2.5 space-y-2">
            {CREATORS.map((c, i) => (
              <FloatingMotion key={c.name} duration={4.5 + i * 0.3} y={3} delay={i * 0.12}>
                <div className="flex items-center gap-2">
                  <MotionImageWrap className="h-8 w-8 shrink-0 rounded-full ring-2 ring-white">
                    <div className="relative h-8 w-8 overflow-hidden rounded-full">
                      <Image src={c.img} alt={c.name} fill className="object-cover" sizes="32px" />
                    </div>
                  </MotionImageWrap>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--landing-ink)]">{c.name}</p>
                    <p className="truncate text-[10px] text-[var(--landing-subtle)]">{c.story}</p>
                  </div>
                </div>
              </FloatingMotion>
            ))}
          </div>
        </GlassCard>
      </HoverLiftCard>
    </motion.div>
  );
}

"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import * as React from "react";
import { LANDING_IMAGES, unsplash } from "@/lib/landing-images";

const PHOTOS = [
  {
    src: unsplash("1506905925346-21bda4d32df4", 600, 80),
    alt: "Alpine lake",
    className: "left-[4%] top-[8%] z-20 h-[42%] w-[38%]",
  },
  {
    src: LANDING_IMAGES.hero.city,
    alt: "Venice canals",
    className: "right-[2%] top-[14%] z-10 h-[36%] w-[34%]",
  },
  {
    src: unsplash("1501785888041-af3ef285b470", 600, 80),
    alt: "Coastal road",
    className: "bottom-[12%] left-[18%] z-30 h-[34%] w-[40%]",
  },
];

const DESTINATIONS = [
  { city: "Kyoto", country: "Japan", x: "12%", y: "22%" },
  { city: "Lisbon", country: "Portugal", x: "58%", y: "38%" },
  { city: "Reykjavík", country: "Iceland", x: "72%", y: "68%" },
];

const AVATARS = ["AK", "MS", "JL", "RP"];

function RouteLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-[var(--landing-accent)]/35"
      viewBox="0 0 400 400"
      fill="none"
      aria-hidden
    >
      <motion.path
        d="M 40 120 Q 120 80 200 140 T 360 200"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="6 8"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 2.2, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.path
        d="M 80 280 Q 160 240 240 260 T 340 120"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.5, ease: "easeInOut", delay: 0.6 }}
      />
      <circle cx="40" cy="120" r="4" fill="var(--landing-accent)" />
      <circle cx="200" cy="140" r="3" fill="var(--landing-accent-soft)" />
      <circle cx="360" cy="200" r="4" fill="var(--landing-success)" />
    </svg>
  );
}

export function HeroCollage() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -32]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 24]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 2]);

  const [mouse, setMouse] = React.useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - r.left) / r.width - 0.5) * 12,
      y: ((e.clientY - r.top) / r.height - 0.5) * 12,
    });
  };

  return (
    <div
      ref={ref}
      className="relative w-full lg:min-h-[520px]"
      onMouseMove={onMove}
    >
      {/* Desktop collage */}
      <motion.div
        style={{ y: y1, rotate }}
        className="relative hidden aspect-[4/5] max-h-[640px] w-full overflow-hidden rounded-[20px] border border-[var(--landing-border)] bg-white shadow-[var(--landing-card-shadow)] lg:block"
      >
        <RouteLines />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(91,108,255,0.08),transparent_55%)]"
          aria-hidden
        />

        {PHOTOS.map((p, i) => (
          <motion.div
            key={p.src}
            className={`absolute overflow-hidden rounded-2xl border border-white/80 shadow-lg ${p.className}`}
            style={{
              x: mouse.x * (i + 1) * 0.4,
              y: mouse.y * (i + 1) * 0.4,
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 * i, duration: 0.6 }}
          >
            <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="(max-width:1024px) 40vw, 280px" />
          </motion.div>
        ))}

        {DESTINATIONS.map((d, i) => (
          <motion.div
            key={d.city}
            className="absolute z-40 rounded-xl border border-[var(--landing-border)] bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm"
            style={{ left: d.x, top: d.y }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut" }}
          >
            <p className="text-xs font-semibold text-[var(--landing-ink)]">{d.city}</p>
            <p className="text-[11px] text-[var(--landing-subtle)]">{d.country}</p>
          </motion.div>
        ))}

        <motion.div
          style={{ y: y2 }}
          className="absolute bottom-[6%] right-[6%] z-40 max-w-[200px] rounded-2xl border border-[var(--landing-border)] bg-white p-3 shadow-[var(--landing-card-shadow)]"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--landing-accent)]">Story</p>
          <p className="mt-1 font-display text-sm leading-snug text-[var(--landing-ink)]">
            Golden hour in the old quarter — notes, photos, and the song that played.
          </p>
          <div className="mt-2 flex -space-x-2">
            {AVATARS.map((a) => (
              <span
                key={a}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--landing-bg)] text-[10px] font-semibold text-[var(--landing-muted)]"
              >
                {a}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="absolute left-[8%] top-[52%] z-40 flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-white/90 px-3 py-1.5 text-xs font-medium text-[var(--landing-muted)] shadow-sm"
          animate={{ x: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--landing-success)]" />
          Live journey · Day 4
        </motion.div>
      </motion.div>

      {/* Mobile: horizontal scroll strip */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {PHOTOS.map((p, i) => (
          <motion.div
            key={p.src}
            className="relative h-64 w-[72vw] max-w-[320px] shrink-0 snap-center overflow-hidden rounded-[20px] border border-[var(--landing-border)] shadow-[var(--landing-card-shadow)]"
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="80vw" priority={i === 0} />
            {i === 0 ? (
              <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/92 p-3 backdrop-blur-sm">
                <p className="text-xs text-[var(--landing-muted)]">Kyoto · Japan</p>
                <p className="font-display text-sm text-[var(--landing-ink)]">Temple walk at dawn</p>
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

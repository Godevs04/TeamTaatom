"use client";

import * as React from "react";
import { motion, AnimatePresence, useMotionValue, PanInfo } from "framer-motion";
import { FadeIn } from "./fade-in";

const TESTIMONIALS = [
  {
    name: "Amara Okafor",
    city: "Lagos → Lisbon",
    style: "Slow travel & food",
    review:
      "Taatom feels like a travel journal my friends actually want to read—not another performative feed.",
    avatar: "AO",
  },
  {
    name: "Henrik Dahl",
    city: "Oslo",
    style: "Solo hiking",
    review:
      "Mapping stories to real places changed how I plan trips. I revisit routes and memories together.",
    avatar: "HD",
  },
  {
    name: "Priya Menon",
    city: "Chennai",
    style: "Family journeys",
    review:
      "Our family trips finally have a home. Photos, songs, and notes in one calm place.",
    avatar: "PM",
  },
  {
    name: "Sofia Reyes",
    city: "Mexico City",
    style: "Street photography",
    review:
      "Creator discovery by city and style is subtle and useful—I found travelers I genuinely relate to.",
    avatar: "SR",
  },
];

export function Testimonials() {
  const [index, setIndex] = React.useState(0);
  const dragX = useMotionValue(0);

  const paginate = (dir: number) => {
    setIndex((i) => (i + dir + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80) paginate(1);
    else if (info.offset.x > 80) paginate(-1);
  };

  const t = TESTIMONIALS[index];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">Travelers</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-4xl">
            Stories from people on the road
          </h2>
        </FadeIn>

        <FadeIn className="relative mx-auto mt-12 max-w-2xl">
          <div className="overflow-hidden rounded-[20px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                key={index}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                style={{ x: dragX }}
                onDragEnd={onDragEnd}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="cursor-grab rounded-[20px] border border-[var(--landing-border)] bg-white p-8 shadow-[var(--landing-card-shadow)] active:cursor-grabbing sm:p-10"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--landing-bg)] text-sm font-semibold text-[var(--landing-ink)]">
                    {t.avatar}
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--landing-ink)]">{t.name}</p>
                    <p className="text-sm text-[var(--landing-subtle)]">{t.city}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--landing-accent)]">
                      {t.style}
                    </p>
                  </div>
                </div>
                <p className="mt-6 font-display text-xl leading-relaxed text-[var(--landing-ink)] sm:text-2xl">
                  &ldquo;{t.review}&rdquo;
                </p>
              </motion.article>
            </AnimatePresence>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => paginate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-white text-[var(--landing-ink)] transition hover:-translate-y-0.5"
            >
              ←
            </button>
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-6 bg-[var(--landing-ink)]" : "w-2 bg-[var(--landing-border)]"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next"
              onClick={() => paginate(1)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-white text-[var(--landing-ink)] transition hover:-translate-y-0.5"
            >
              →
            </button>
          </div>
        </FadeIn>

        {/* Desktop: peek cards */}
        <div className="mt-10 hidden gap-4 lg:grid lg:grid-cols-3">
          {TESTIMONIALS.filter((_, i) => i !== index)
            .slice(0, 3)
            .map((card) => (
              <div
                key={card.name}
                className="rounded-[20px] border border-[var(--landing-border)] bg-white/80 p-6 opacity-80"
              >
                <p className="text-sm text-[var(--landing-muted)] line-clamp-3">&ldquo;{card.review}&rdquo;</p>
                <p className="mt-4 text-xs font-medium text-[var(--landing-subtle)]">{card.name}</p>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}

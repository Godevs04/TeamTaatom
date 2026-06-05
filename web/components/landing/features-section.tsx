"use client";

import { motion } from "framer-motion";
import { MapPin, Film, Music2, Users } from "lucide-react";
import { FadeIn } from "./fade-in";

const FEATURES = [
  {
    id: "places",
    icon: MapPin,
    title: "Location-based storytelling",
    body: "Pin moments to real places. Your journey reads like a map of memories—not a feed of noise.",
    accent: "var(--landing-accent)",
    illustration: (
      <div className="relative h-full min-h-[220px] w-full rounded-2xl bg-[#f3f4f8] p-6">
        <div className="absolute left-6 top-6 h-3 w-3 rounded-full bg-[var(--landing-accent)]" />
        <div className="absolute left-[28%] top-[35%] h-2 w-2 rounded-full bg-[var(--landing-accent-soft)]" />
        <div className="absolute right-[22%] top-[28%] h-2.5 w-2.5 rounded-full bg-[var(--landing-success)]" />
        <svg className="absolute inset-6 h-[calc(100%-3rem)] w-[calc(100%-3rem)]" viewBox="0 0 200 160" aria-hidden>
          <path
            d="M 20 100 Q 60 40 100 80 T 180 50"
            fill="none"
            stroke="var(--landing-accent)"
            strokeWidth="1.2"
            strokeDasharray="4 6"
            opacity="0.5"
          />
        </svg>
        <motion.div
          className="absolute bottom-6 left-6 right-6 rounded-xl border border-[var(--landing-border)] bg-white p-4 shadow-sm"
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <p className="text-xs font-medium text-[var(--landing-accent)]">Shibuya Crossing</p>
          <p className="mt-1 text-sm text-[var(--landing-ink)]">Rainy evening — street food and neon reflections.</p>
        </motion.div>
      </div>
    ),
  },
  {
    id: "stories",
    icon: Film,
    title: "Travel reels and visual stories",
    body: "Short reels and photo sequences that capture rhythm and place—crafted for travelers, not algorithms.",
    accent: "var(--landing-accent-soft)",
    illustration: (
      <div className="relative flex h-full min-h-[220px] gap-3 rounded-2xl bg-[#f3f4f8] p-5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="flex-1 overflow-hidden rounded-xl border border-white bg-gradient-to-b from-slate-200 to-slate-300"
            whileHover={{ scale: 1.03, y: -6 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            style={{ marginTop: i * 12 }}
          >
            <div className="flex h-full min-h-[180px] flex-col justify-end p-3">
              <span className="text-[10px] font-medium text-white/90">0{i + 1}:24</span>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "explore",
    icon: Music2,
    title: "Music and memories",
    body: "Attach the songs that defined a trip. Hear the soundtrack of a place when you revisit a story.",
    accent: "var(--landing-success)",
    illustration: (
      <div className="relative flex h-full min-h-[220px] flex-col justify-center gap-4 rounded-2xl bg-[#f3f4f8] p-6">
        {["Coastal Highway", "Midnight Train", "Market Square"].map((t, i) => (
          <motion.div
            key={t}
            className="flex items-center gap-3 rounded-xl border border-[var(--landing-border)] bg-white px-4 py-3"
            whileHover={{ x: 6 }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--landing-ink)] text-xs font-bold text-white">
              ♪
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--landing-ink)]">{t}</p>
              <div className="mt-1.5 flex gap-0.5">
                {Array.from({ length: 12 }).map((_, j) => (
                  <span
                    key={j}
                    className="w-1 rounded-full bg-[var(--landing-accent)]"
                    style={{ height: 4 + ((j + i) % 5) * 3, opacity: j < 8 ? 1 : 0.25 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: "creators",
    icon: Users,
    title: "Creator discovery",
    body: "Follow travelers whose taste matches yours. Explore by city, style, and the stories they actually lived.",
    accent: "var(--landing-accent)",
    illustration: (
      <div className="grid h-full min-h-[220px] grid-cols-2 gap-3 rounded-2xl bg-[#f3f4f8] p-5">
        {["Slow travel", "Food maps", "Solo hikes", "Family trips"].map((tag) => (
          <motion.div
            key={tag}
            className="flex flex-col justify-end rounded-xl border border-[var(--landing-border)] bg-white p-4"
            whileHover={{ boxShadow: "var(--landing-card-shadow)" }}
          >
            <div className="mb-3 h-8 w-8 rounded-full bg-[var(--landing-bg)]" />
            <p className="text-sm font-medium text-[var(--landing-ink)]">{tag}</p>
            <p className="text-xs text-[var(--landing-subtle)]">12 creators</p>
          </motion.div>
        ))}
      </div>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">Features</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-4xl">
            Built for journeys, not engagement hacks
          </h2>
        </FadeIn>

        <div className="mt-16 space-y-24 sm:mt-20 sm:space-y-32">
          {FEATURES.map((f, index) => {
            const reversed = index % 2 === 1;
            const Icon = f.icon;
            return (
              <FadeIn key={f.id}>
                <article
                  id={f.id}
                  className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reversed ? "lg:[&>div:first-child]:order-2" : ""}`}
                >
                  <div>
                    <div
                      className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--landing-border)] bg-white"
                      style={{ color: f.accent }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="font-display text-2xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-3xl">
                      {f.title}
                    </h3>
                    <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[var(--landing-muted)]">{f.body}</p>
                  </div>
                  <motion.div
                    className="overflow-hidden rounded-[20px] border border-[var(--landing-border)] bg-white p-2 shadow-[var(--landing-card-shadow)]"
                    whileHover={{ y: -6 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                  >
                    {f.illustration}
                  </motion.div>
                </article>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

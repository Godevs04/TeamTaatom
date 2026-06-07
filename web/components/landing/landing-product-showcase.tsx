"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionReveal, RevealItem } from "./section-reveal";
import {
  ScreenFeed,
  ScreenMap,
  ScreenProfile,
  ScreenStory,
  ScreenTimeline,
} from "./landing-product-screens";

const TABS = [
  { id: "feed", label: "Feed" },
  { id: "story", label: "Travel story" },
  { id: "timeline", label: "Journey timeline" },
  { id: "map", label: "Map" },
  { id: "profile", label: "Creator profile" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SCREENS: Record<TabId, React.ReactNode> = {
  feed: <ScreenFeed />,
  story: <ScreenStory />,
  timeline: <ScreenTimeline />,
  map: <ScreenMap />,
  profile: <ScreenProfile />,
};

export function LandingProductShowcase() {
  const [tab, setTab] = React.useState<TabId>("feed");

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTab((current) => {
        const i = TABS.findIndex((t) => t.id === current);
        return TABS[(i + 1) % TABS.length].id;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SectionReveal id="product" className="landing-section landing-section-glow bg-[var(--landing-surface)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--landing-accent)]">Product</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built like a journal, not a feed
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--landing-muted)]">
            The same surfaces travelers use every day — designed for clarity and calm.
          </p>
        </RevealItem>

        <RevealItem className="mt-10 flex flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-[var(--landing-ink)] text-white"
                  : "bg-[var(--landing-bg)] text-[var(--landing-muted)] hover:text-[var(--landing-ink)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </RevealItem>

        <div className="relative mt-12 min-h-[480px] rounded-[2rem] bg-[var(--landing-bg)] px-4 py-12 sm:px-8 sm:py-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center"
            >
              {SCREENS[tab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SectionReveal>
  );
}

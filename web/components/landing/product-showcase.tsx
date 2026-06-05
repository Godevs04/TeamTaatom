"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FadeIn } from "./fade-in";

type Tab = "feed" | "stories" | "maps" | "profiles";

const TABS: { id: Tab; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "stories", label: "Travel Stories" },
  { id: "maps", label: "Maps" },
  { id: "profiles", label: "Creator Profiles" },
];

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--landing-border)] bg-white shadow-[var(--landing-card-shadow)]">
      <div className="flex items-center gap-2 border-b border-[var(--landing-border)] bg-[#f8f9fb] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <div className="mx-auto flex h-7 max-w-md flex-1 items-center justify-center rounded-lg bg-white px-3 text-xs text-[var(--landing-subtle)]">
          app.taatom.com
        </div>
      </div>
      <div className="bg-[var(--landing-bg)] p-4 sm:p-6">{children}</div>
    </div>
  );
}

function FeedMock() {
  return (
    <div className="mx-auto max-w-sm space-y-3">
      {[
        { user: "Maya S.", place: "Marrakech", preview: "Spice market at blue hour" },
        { user: "Jon L.", place: "Iceland", preview: "Ring road · Day 3" },
      ].map((post) => (
        <div key={post.user} className="rounded-2xl border border-[var(--landing-border)] bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-slate-200" />
            <div>
              <p className="text-sm font-semibold text-[var(--landing-ink)]">{post.user}</p>
              <p className="text-xs text-[var(--landing-subtle)]">{post.place}</p>
            </div>
          </div>
          <div className="mt-3 aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
          <p className="mt-2 text-sm text-[var(--landing-muted)]">{post.preview}</p>
        </div>
      ))}
    </div>
  );
}

function StoriesMock() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {["Kyoto", "Lisbon", "NYC", "Reykjavík"].map((city) => (
        <div key={city} className="w-28 shrink-0 text-center">
          <div className="mx-auto h-20 w-20 rounded-full border-2 border-[var(--landing-accent)] p-0.5">
            <div className="h-full w-full rounded-full bg-slate-200" />
          </div>
          <p className="mt-2 text-xs font-medium text-[var(--landing-ink)]">{city}</p>
        </div>
      ))}
    </div>
  );
}

function MapsMock() {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#e8edf2]">
      <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden>
        <path d="M0 80h400M0 160h400M80 0v200M160 0v200" stroke="#94a3b8" strokeWidth="0.5" />
      </svg>
      <div className="absolute left-[20%] top-[30%] h-3 w-3 rounded-full bg-[var(--landing-accent)] ring-4 ring-[var(--landing-accent)]/20" />
      <div className="absolute left-[55%] top-[45%] h-2.5 w-2.5 rounded-full bg-[var(--landing-success)]" />
      <div className="absolute right-[18%] top-[25%] h-2.5 w-2.5 rounded-full bg-[var(--landing-accent-soft)]" />
      <div className="absolute bottom-4 left-4 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-sm">
        <span className="font-medium text-[var(--landing-ink)]">Your route</span>
        <span className="text-[var(--landing-subtle)]"> · 4 stops</span>
      </div>
    </div>
  );
}

function ProfilesMock() {
  return (
    <div className="mx-auto max-w-xs rounded-2xl border border-[var(--landing-border)] bg-white p-5 text-center shadow-sm">
      <div className="mx-auto h-16 w-16 rounded-full bg-slate-200" />
      <p className="mt-3 font-display text-lg font-semibold text-[var(--landing-ink)]">Elena Park</p>
      <p className="text-sm text-[var(--landing-subtle)]">Slow travel · 24 cities</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Food", "Trains", "Photography"].map((t) => (
          <span key={t} className="rounded-full bg-[var(--landing-bg)] px-3 py-1 text-xs text-[var(--landing-muted)]">
            {t}
          </span>
        ))}
      </div>
      <button type="button" className="mt-5 w-full rounded-xl bg-[var(--landing-ink)] py-2.5 text-sm font-semibold text-white">
        Follow
      </button>
    </div>
  );
}

const PANELS: Record<Tab, React.ReactNode> = {
  feed: <FeedMock />,
  stories: <StoriesMock />,
  maps: <MapsMock />,
  profiles: <ProfilesMock />,
};

export function ProductShowcase() {
  const [tab, setTab] = React.useState<Tab>("feed");

  return (
    <section id="showcase" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">Product</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-4xl">
            One calm home for your travels
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--landing-muted)]">
            Feed, stories, maps, and creator profiles—designed to feel intentional, not overwhelming.
          </p>
        </FadeIn>

        <FadeIn className="mt-10">
          <div className="flex flex-wrap justify-center gap-2">
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
          </div>
        </FadeIn>

        <FadeIn className="mt-8">
          <BrowserChrome>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {PANELS[tab]}
              </motion.div>
            </AnimatePresence>
          </BrowserChrome>
        </FadeIn>
      </div>
    </section>
  );
}

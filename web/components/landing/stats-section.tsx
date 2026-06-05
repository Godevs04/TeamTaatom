"use client";

import { FadeIn } from "./fade-in";
import { useAnimatedCounter } from "./use-animated-counter";

function Stat({ label, value }: { label: string; value: number }) {
  const ref = useAnimatedCounter(value);
  return (
    <div className="text-center sm:text-left">
      <p className="font-display text-4xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-5xl">
        <span ref={ref}>0+</span>
      </p>
      <p className="mt-2 text-[15px] text-[var(--landing-muted)]">{label}</p>
    </div>
  );
}

export function StatsSection() {
  return (
    <section id="community" className="border-y border-[var(--landing-border)] bg-white/60 py-14 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-3 sm:gap-6 sm:px-6 lg:px-8">
        <FadeIn>
          <Stat label="Travelers sharing real journeys" value={10000} />
        </FadeIn>
        <FadeIn delay={0.08}>
          <Stat label="Cities with verified places" value={100} />
        </FadeIn>
        <FadeIn delay={0.16}>
          <Stat label="Stories shared worldwide" value={5000} />
        </FadeIn>
      </div>
    </section>
  );
}

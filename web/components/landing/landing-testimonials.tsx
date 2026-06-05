"use client";

import Image from "next/image";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { TiltCard } from "./tilt-card";

const FEATURED = {
  quote:
    "Taatom is the first place where my trips feel documented — not performed. I open a city and hear, see, and remember the day.",
  name: "Amara Okafor",
  city: "Lagos",
  country: "Nigeria",
  style: "Slow travel & food",
  photo: LANDING_IMAGES.testimonials.featured,
};

const SMALL = [
  {
    quote: "Mapping memories to real stops changed how I plan returns.",
    name: "Henrik Dahl",
    city: "Oslo",
    country: "Norway",
    style: "Solo hiking",
    photo: LANDING_IMAGES.testimonials.small[0],
  },
  {
    quote: "Our family journeys finally live in one calm home.",
    name: "Priya Menon",
    city: "Chennai",
    country: "India",
    style: "Family travel",
    photo: LANDING_IMAGES.testimonials.small[1],
  },
  {
    quote: "I discover creators by city and taste — subtle and useful.",
    name: "Sofia Reyes",
    city: "Mexico City",
    country: "Mexico",
    style: "Street photography",
    photo: LANDING_IMAGES.testimonials.small[2],
  },
];

export function LandingTestimonials() {
  return (
    <SectionReveal className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealItem>
          <TiltCard maxTilt={4}>
            <article className="grid overflow-hidden rounded-[1.75rem] border border-[var(--landing-border)] bg-[var(--landing-surface)] lg:grid-cols-[1.1fr_1fr]">
              <div className="relative min-h-[280px] bg-stone-200 lg:min-h-full">
                <Image src={FEATURED.photo} alt={FEATURED.name} fill className="object-cover" sizes="(max-width:1024px) 100vw, 50vw" />
              </div>
              <div className="flex flex-col justify-center p-8 sm:p-12">
                <p className="font-display text-2xl leading-relaxed text-[var(--landing-ink)] sm:text-3xl">
                  &ldquo;{FEATURED.quote}&rdquo;
                </p>
                <div className="mt-8">
                  <p className="font-semibold text-[var(--landing-ink)]">{FEATURED.name}</p>
                  <p className="text-sm text-[var(--landing-muted)]">
                    {FEATURED.city}, {FEATURED.country}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--landing-accent)]">
                    {FEATURED.style}
                  </p>
                </div>
              </div>
            </article>
          </TiltCard>
        </RevealItem>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {SMALL.map((t) => (
            <RevealItem key={t.name}>
              <article className="flex h-full flex-col rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5 shadow-sm">
                <div className="relative h-12 w-12 overflow-hidden rounded-full bg-stone-200">
                  <Image src={t.photo} alt={t.name} fill className="object-cover" sizes="48px" />
                </div>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--landing-muted)]">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 border-t border-[var(--landing-border)] pt-4">
                  <p className="text-sm font-semibold text-[var(--landing-ink)]">{t.name}</p>
                  <p className="text-xs text-[var(--landing-subtle)]">
                    {t.city}, {t.country} · {t.style}
                  </p>
                </div>
              </article>
            </RevealItem>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}

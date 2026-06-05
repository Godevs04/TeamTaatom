"use client";

import { FadeIn } from "./fade-in";
import { MagneticButton } from "./magnetic-button";

export function FinalCta() {
  return (
    <section className="pb-24 pt-8 sm:pb-32">
      <FadeIn>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[24px] border border-[var(--landing-border)] bg-white px-8 py-16 text-center shadow-[var(--landing-card-shadow)] sm:px-16 sm:py-20">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(91,108,255,0.06),transparent_60%)]"
              aria-hidden
            />
            <h2 className="relative font-display text-3xl font-semibold tracking-tight text-[var(--landing-ink)] sm:text-4xl md:text-5xl">
              Start sharing journeys that matter.
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-[17px] text-[var(--landing-muted)]">
              Join travelers who document places with care—stories, maps, and memories in one premium home.
            </p>
            <div className="relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <MagneticButton href="/auth/register" variant="primary">
                Create Account
              </MagneticButton>
              <MagneticButton href="#stories" variant="secondary">
                Explore Stories
              </MagneticButton>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

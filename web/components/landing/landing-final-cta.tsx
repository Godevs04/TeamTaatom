"use client";

import Image from "next/image";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { RippleButton } from "./ripple-button";

const BG = LANDING_IMAGES.ctaBackground;

export function LandingFinalCta() {
  return (
    <SectionReveal className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-0">
        <Image src={BG} alt="" fill className="object-cover" sizes="100vw" priority={false} />
        <div className="absolute inset-0 bg-[var(--landing-ink)]/72" aria-hidden />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <RevealItem>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Your next journey deserves a story.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/80">
            Start documenting places, music, and moments — and share them with people who travel the same way.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <RippleButton href="/auth/register" className="bg-white text-[var(--landing-ink)] shadow-none hover:bg-white/95">
              Create Account
            </RippleButton>
            <RippleButton href="#features" variant="ghost" className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20">
              Explore Stories
            </RippleButton>
          </div>
        </RevealItem>
      </div>
    </SectionReveal>
  );
}

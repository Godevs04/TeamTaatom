"use client";

import Image from "next/image";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { MagneticButton } from "./magnetic-button";
import { MotionImageWrap } from "./motion-primitives";

const BG = LANDING_IMAGES.stories.coast;

export function LandingFinalCta() {
  return (
    <SectionReveal className="landing-section relative overflow-hidden">
      <div className="absolute inset-0">
        <MotionImageWrap className="absolute inset-0">
          <Image src={BG} alt="" fill className="object-cover" sizes="100vw" priority={false} />
        </MotionImageWrap>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/78 via-[#141414]/45 to-[#141414]/20" aria-hidden />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <RevealItem>
          <h2 className="landing-h2 font-display text-white">Where will you go next?</h2>
          <p className="landing-body mx-auto mt-8 max-w-lg text-white/88">
            There are roads you have not driven yet — and stories waiting to be kept.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <MagneticButton href="/auth/register" className="bg-white text-[var(--landing-ink)] !shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
              Begin a journey
            </MagneticButton>
            <MagneticButton
              href="#stories"
              variant="secondary"
              className="border-white/35 !bg-white/12 text-white backdrop-blur-sm hover:!bg-white/22"
            >
              Browse stories
            </MagneticButton>
          </div>
        </RevealItem>
      </div>
    </SectionReveal>
  );
}

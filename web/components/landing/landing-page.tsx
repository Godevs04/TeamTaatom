"use client";

import "./landing-tokens.css";
import { MotionConfig } from "framer-motion";
import { playfair } from "./landing-fonts";
import { LandingChrome } from "./landing-chrome";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingDestinations } from "./landing-destinations";
import { LandingHowItWorks } from "./landing-how-it-works";
import { LandingStoryFeed } from "./landing-story-feed";
import { LandingWorldMap } from "./landing-world-map";
import { LandingReels } from "./landing-reels";
import { LandingSocialProof } from "./landing-social-proof";
import { LandingFinalCta } from "./landing-final-cta";

export function LandingPage() {
  return (
    // reducedMotion="user": Framer skips transform animations for visitors who ask for
    // reduced motion, decided on the client so server and client markup stay identical.
    <MotionConfig reducedMotion="user">
    <div className={`landing-page ${playfair.variable} min-h-screen w-full overflow-x-hidden`}>
      <div className="landing-grain" aria-hidden />
      <div className="landing-ambient" aria-hidden>
        <span className="landing-ambient__tl" />
        <span className="landing-ambient__tr" />
        <span className="landing-ambient__center" />
      </div>

      <div className="landing-page__content">
        <LandingChrome />
        <LandingNav />
        <LandingHero />
        <LandingDestinations />
        <LandingHowItWorks />
        <LandingStoryFeed />
        <LandingWorldMap />
        <LandingReels />
        <LandingSocialProof />
        <LandingFinalCta />
      </div>
    </div>
    </MotionConfig>
  );
}

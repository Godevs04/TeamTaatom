"use client";

import "./landing-tokens.css";
import { playfair } from "./landing-fonts";
import { LandingChrome } from "./landing-chrome";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingStoryFeed } from "./landing-story-feed";
import { LandingWorldMap } from "./landing-world-map";
import { LandingReels } from "./landing-reels";
import { LandingSocialProof } from "./landing-social-proof";
import { LandingFinalCta } from "./landing-final-cta";

export function LandingPage() {
  return (
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
        <LandingStoryFeed />
        <LandingWorldMap />
        <LandingReels />
        <LandingSocialProof />
        <LandingFinalCta />
      </div>
    </div>
  );
}

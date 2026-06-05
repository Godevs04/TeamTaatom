"use client";

import "./landing-tokens.css";
import { LandingChrome } from "./landing-chrome";
import { LandingNav } from "./landing-nav";
import { LandingHero } from "./landing-hero";
import { LandingSocialProof } from "./landing-social-proof";
import { LandingFeatures } from "./landing-features";
import { LandingProductShowcase } from "./landing-product-showcase";
import { LandingTestimonials } from "./landing-testimonials";
import { LandingFinalCta } from "./landing-final-cta";
import { LandingFooter } from "./landing-footer";

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen w-full overflow-x-hidden">
      <LandingChrome />
      <LandingNav />
      <LandingHero />
      <LandingSocialProof />
      <LandingFeatures />
      <LandingProductShowcase />
      <LandingTestimonials />
      <LandingFinalCta />
      <LandingFooter />
    </div>
  );
}

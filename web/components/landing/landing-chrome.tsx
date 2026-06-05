"use client";

import { useEffect } from "react";

/** Hides root layout footer and relaxes main min-height on the marketing landing. */
export function LandingChrome() {
  useEffect(() => {
    document.body.classList.add("landing-active");
    return () => document.body.classList.remove("landing-active");
  }, []);
  return null;
}

"use client";

import Image from "next/image";
import { LANDING_PLACES, placeImage, type LandingPlaceKey } from "@/lib/landing-images";

const TICKER: LandingPlaceKey[] = [
  "venice",
  "cappadocia",
  "machuPicchu",
  "halong",
  "moraine",
  "bali",
  "paris",
  "braies",
  "london",
  "roadTrip",
];

/** Slow, pausable ticker of places people journal — sets the travel mood under the hero. */
export function LandingDestinations() {
  // Rendered twice so the -50% translate loops seamlessly.
  const items = [...TICKER, ...TICKER];
  return (
    <section aria-label="Places travelers journal on Taatom" className="border-y border-[var(--landing-border)] bg-white/60 py-5">
      <div className="landing-marquee overflow-hidden">
        <ul className="landing-marquee__track gap-3">
          {items.map((key, i) => {
            const place = LANDING_PLACES[key];
            return (
              <li
                key={`${key}-${i}`}
                aria-hidden={i >= TICKER.length}
                className="flex shrink-0 items-center gap-2.5 rounded-full border border-[var(--landing-border)] bg-white py-1.5 pl-1.5 pr-4"
              >
                <span className="relative h-8 w-8 overflow-hidden rounded-full">
                  <Image src={placeImage(key, 96, 70)} alt="" fill className="object-cover" sizes="32px" />
                </span>
                <span className="whitespace-nowrap text-[13px] font-medium text-[var(--landing-ink)]">
                  {place.place}
                  <span className="text-[var(--landing-subtle)]"> · {place.country}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

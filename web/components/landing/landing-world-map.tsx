"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { getLocaleCountries } from "@/lib/api";
import { GlassCard } from "./landing-shared";
import { LandingConnectionsMap } from "@/components/maps/landing-connections-map";

export function LandingWorldMap() {
  const { data: countryTags = [] } = useQuery({
    queryKey: ["locale-countries", "landing-tags"],
    queryFn: async () => {
      const { countries } = await getLocaleCountries();
      return countries
        .slice(0, 5)
        .map((c) => c.name || c.code)
        .filter(Boolean);
    },
    staleTime: 5 * 60 * 1000,
  });
  return (
    <SectionReveal
      id="journeys"
      className="landing-section scroll-mt-24 overflow-hidden bg-[var(--landing-map-bg)] py-16 sm:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <RevealItem>
            <p className="landing-eyebrow text-white/50">Explore the world</p>
            <h2 className="landing-h2 font-display mt-4 text-white">Every place has a story behind it.</h2>
            <p className="mt-4 max-w-md text-[1rem] leading-relaxed text-white/65">
              Follow glowing routes across the map — see where travelers are saving memories right now.
            </p>
            <Link
              href="/auth/register"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-[14px] font-semibold text-[var(--landing-ink)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(255,255,255,0.15)]"
            >
              Explore map
            </Link>
            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Popular right now</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {countryTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/12 bg-white/8 px-3.5 py-1.5 text-[12px] font-medium text-white/75 backdrop-blur-sm transition-colors hover:bg-white/14"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </RevealItem>

          <RevealItem className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-white/10 bg-[#0f1a2e] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <LandingConnectionsMap className="absolute inset-0" />

              <motion.div
                className="absolute bottom-[10%] right-[4%] z-20 w-[min(72%,220px)]"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                <GlassCard className="p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--landing-accent)]">
                    Someone just shared a memory
                  </p>
                  <div className="mt-2 flex gap-2.5">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-200">
                      <Image src={LANDING_IMAGES.stories.coast} alt="Lisbon memory" fill className="object-cover" sizes="56px" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[var(--landing-ink)]">Sunset in Alfama</p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--landing-subtle)]">
                        <MapPin className="h-2.5 w-2.5 text-[var(--landing-accent)]" aria-hidden />
                        Lisbon, Portugal
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </RevealItem>
        </div>
      </div>
    </SectionReveal>
  );
}

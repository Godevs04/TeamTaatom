"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bookmark, Music2, PenLine, Share2 } from "lucide-react";
import { SectionReveal, RevealItem } from "./section-reveal";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { MagneticButton } from "./magnetic-button";
import { AnimatedRoutePath, FloatingMotion } from "./motion-primitives";

const ACTIONS = [
  { label: "Save places", icon: Bookmark, top: "18%", right: "14%" },
  { label: "Add music", icon: Music2, top: "38%", right: "6%" },
  { label: "Write moments", icon: PenLine, top: "58%", right: "10%" },
  { label: "Share stories", icon: Share2, top: "76%", right: "18%" },
] as const;

const FOOTER_LINKS = [
  { href: "/contact", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;

const SOCIAL = [
  { href: "https://instagram.com", label: "Instagram" },
  { href: "https://x.com", label: "X" },
  { href: "https://youtube.com", label: "YouTube" },
  { href: "https://tiktok.com", label: "TikTok" },
] as const;

export function LandingFinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative min-h-[520px] sm:min-h-[580px]">
        <Image
          src={LANDING_IMAGES.ctaBackground}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/85 via-[#141414]/40 to-[#141414]/15" aria-hidden />

        <SectionReveal className="relative flex min-h-[520px] flex-col justify-center py-20 sm:min-h-[580px] sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <RevealItem>
                <h2 className="landing-h2 font-display max-w-lg text-white">
                  Where will your next story take you?
                </h2>
                <p className="mt-5 max-w-md text-[1rem] leading-relaxed text-white/80">
                  Begin a journal for the trip ahead — or the one you wish you had written down.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <MagneticButton
                    href="/auth/register"
                    className="bg-white text-[var(--landing-ink)] !shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
                  >
                    <span className="inline-flex items-center gap-2">
                      Begin your journey
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </MagneticButton>
                  <MagneticButton
                    href="#stories"
                    variant="secondary"
                    className="border-white/35 !bg-white/12 text-white backdrop-blur-sm hover:!bg-white/22"
                  >
                    Explore stories
                  </MagneticButton>
                </div>
              </RevealItem>

              <RevealItem className="relative hidden min-h-[320px] lg:block">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 360" aria-hidden>
                  <AnimatedRoutePath d="M 200 180 Q 260 120 320 80" strokeWidth={1.2} strokeOpacity={0.5} delay={0.2} />
                  <AnimatedRoutePath d="M 200 180 Q 280 200 340 240" strokeWidth={1} strokeOpacity={0.35} delay={0.4} />
                  <AnimatedRoutePath d="M 200 180 Q 120 200 60 260" strokeWidth={1} strokeOpacity={0.35} delay={0.3} />
                </svg>
                {ACTIONS.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <motion.div
                      key={action.label}
                      className="absolute"
                      style={{ top: action.top, right: action.right }}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1, duration: 0.55 }}
                    >
                      <FloatingMotion duration={4.5 + i * 0.4} y={5} delay={i * 0.12}>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm">
                            {action.label}
                          </span>
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--landing-ink)] shadow-lg">
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                        </div>
                      </FloatingMotion>
                    </motion.div>
                  );
                })}
              </RevealItem>
            </div>
          </div>
        </SectionReveal>
      </div>

      <footer className="relative z-10 border-t border-white/10 bg-[#0f1419] text-white/65">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-8 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.png" alt="Taatom" width={24} height={24} className="rounded-md" />
            <span className="font-display text-[0.9375rem] font-medium text-white">Taatom</span>
          </Link>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px]">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {SOCIAL.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[11px] font-semibold transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                {s.label[0]}
              </a>
            ))}
          </div>
        </div>
        <p className="border-t border-white/8 pb-6 pt-4 text-center text-[12px] text-white/40">
          © {new Date().getFullYear()} Taatom. All rights reserved.
        </p>
      </footer>
    </section>
  );
}

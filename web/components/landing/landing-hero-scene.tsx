"use client";

import * as React from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type HTMLMotionProps,
} from "framer-motion";
import { MapPin, Music2, Route } from "lucide-react";
import { placeImage } from "@/lib/landing-images";
import { FloatingMotion } from "./motion-primitives";
import { WaveformBars } from "./landing-shared";

const ease = [0.22, 1, 0.36, 1] as const;

/** Moves a layer with the pointer; `depth` scales how far (deeper = more). */
function useDepth(source: MotionValue<number>, depth: number) {
  return useTransform(source, (v) => v * depth);
}

/**
 * Hero collage styled as an open travel-journal page: two taped photo prints,
 * a handwritten-style note, a "now playing" song chip and a route summary.
 * Layers drift at different depths with the pointer (disabled for reduced motion).
 */
export function LandingHeroScene() {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });

  const backX = useDepth(sx, 0.4);
  const backY = useDepth(sy, 0.4);
  const midX = useDepth(sx, 0.8);
  const midY = useDepth(sy, 0.8);
  const frontX = useDepth(sx, 1.3);
  const frontY = useDepth(sy, 1.3);

  const onMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(((e.clientX - r.left) / r.width - 0.5) * 16);
    my.set(((e.clientY - r.top) / r.height - 0.5) * 16);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative mx-auto aspect-[4/5] w-full max-w-[560px] sm:aspect-[6/5] lg:aspect-[5/6]"
      aria-label="A Taatom travel journal page: photos from Venice and Cappadocia, a note, a song and a route"
      role="img"
    >
      {/* Paper page */}
      <Layer
        className="absolute inset-[4%]"
        innerClassName="landing-paper relative h-full w-full rounded-[28px]"
        x={backX}
        y={backY}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease }}
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <motion.path
            d="M 28 30 C 45 34, 52 52, 70 60"
            fill="none"
            stroke="var(--landing-accent)"
            strokeWidth="0.45"
            strokeDasharray="1.4 1.8"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 1.6, delay: 0.9, ease }}
          />
        </svg>
      </Layer>

      {/* Print 1 — Venice */}
      <Layer
        className="absolute left-[5%] top-[4%] z-10 w-[56%] sm:left-[7%] sm:top-[8%] sm:w-[52%]"
        x={midX}
        y={midY}
        initial={{ opacity: 0, y: 30, rotate: -10 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ duration: 0.9, delay: 0.15, ease }}
      >
        <FloatingMotion duration={7} y={6}>
          <PhotoPrint src={placeImage("venice", 640)} alt="Gondola on the Grand Canal, Venice" caption="Venice · day 3" tape="left" />
        </FloatingMotion>
      </Layer>

      {/* Print 2 — Cappadocia */}
      <Layer
        className="absolute right-[5%] top-[30%] z-20 w-[50%] sm:bottom-[9%] sm:right-[6%] sm:top-auto sm:w-[47%]"
        x={frontX}
        y={frontY}
        initial={{ opacity: 0, y: 30, rotate: 12 }}
        animate={{ opacity: 1, y: 0, rotate: 5 }}
        transition={{ duration: 0.9, delay: 0.3, ease }}
      >
        <FloatingMotion duration={8} y={7} delay={0.4}>
          <PhotoPrint
            src={placeImage("cappadocia", 600)}
            alt="Hot-air balloons at sunrise over Cappadocia"
            caption="Cappadocia · sunrise"
            tape="right"
          />
        </FloatingMotion>
      </Layer>

      {/* Handwritten note */}
      <Layer
        className="absolute bottom-[5%] left-[5%] z-30 w-[54%] sm:bottom-auto sm:left-auto sm:right-[5%] sm:top-[10%] sm:w-[40%]"
        x={frontX}
        y={frontY}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.55, ease }}
      >
        <FloatingMotion duration={6.5} y={5} delay={0.2}>
          <div className="landing-note rounded-2xl p-3.5 sm:p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--landing-subtle)]">12 June · 6:40 pm</p>
            <p className="font-display mt-2 text-[13px] italic leading-snug text-[var(--landing-ink)] sm:text-[15px]">
              &ldquo;Got lost on purpose. Found the best gelato behind San Polo.&rdquo;
            </p>
            <p className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--landing-accent)] sm:text-[11px]">
              <MapPin className="h-3 w-3" aria-hidden />
              Venice, Italy
            </p>
          </div>
        </FloatingMotion>
      </Layer>

      {/* Now playing */}
      <Layer
        className="absolute bottom-[12%] left-[4%] z-30 hidden w-[40%] sm:block"
        x={frontX}
        y={frontY}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7, ease }}
      >
        <FloatingMotion duration={7.5} y={5} delay={0.6}>
          <div className="landing-chip rounded-2xl p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--landing-accent)] text-white">
                <Music2 className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--landing-subtle)]">Song of the day</p>
                <p className="truncate text-[12px] font-semibold text-[var(--landing-ink)]">Volare · Dean Martin</p>
              </div>
            </div>
            <WaveformBars bars={18} className="mt-2.5 h-5" />
          </div>
        </FloatingMotion>
      </Layer>

      {/* Route summary */}
      {/* Centering lives on a plain wrapper: Framer's transform would override Tailwind's translate. */}
      <div className="absolute left-1/2 top-[48%] z-40 hidden -translate-x-1/2 sm:block">
      <Layer
        x={midX}
        y={midY}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 1.1, ease }}
      >
        <div className="landing-chip inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold text-[var(--landing-ink)]">
          <Route className="h-3.5 w-3.5 text-[var(--landing-accent)]" aria-hidden />
          2 countries · 9 days · 46 memories
        </div>
      </Layer>
      </div>
    </div>
  );
}

type LayerProps = {
  className?: string;
  innerClassName?: string;
  x: MotionValue<number>;
  y: MotionValue<number>;
  initial: HTMLMotionProps<"div">["initial"];
  animate: HTMLMotionProps<"div">["animate"];
  transition: HTMLMotionProps<"div">["transition"];
  children: React.ReactNode;
};

/**
 * One collage layer. The outer element follows the pointer (style x/y motion values);
 * the inner element runs the entrance animation. Keeping them on separate elements
 * stops the two fighting over `transform` (which also caused an SSR hydration mismatch).
 */
function Layer({ className, innerClassName, x, y, initial, animate, transition, children }: LayerProps) {
  return (
    <motion.div className={className} style={{ x, y }}>
      <motion.div className={innerClassName} initial={initial} animate={animate} transition={transition}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function PhotoPrint({
  src,
  alt,
  caption,
  tape,
}: {
  src: string;
  alt: string;
  caption: string;
  tape: "left" | "right";
}) {
  return (
    <figure className="landing-print relative rounded-[6px] p-2 pb-3 sm:p-2.5 sm:pb-4">
      <span
        className={`landing-tape absolute -top-3 h-6 w-16 ${tape === "left" ? "left-6 -rotate-6" : "right-6 rotate-6"}`}
        aria-hidden
      />
      <div className="relative aspect-[4/5] overflow-hidden rounded-[3px] bg-stone-200">
        <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 1024px) 50vw, 300px" priority />
      </div>
      <figcaption className="font-display mt-2 px-1 text-[12px] italic text-[var(--landing-muted)] sm:text-[14px]">
        {caption}
      </figcaption>
    </figure>
  );
}

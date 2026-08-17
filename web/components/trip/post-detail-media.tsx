"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function PostDetailMedia({
  images,
  caption,
  isShort,
  videoUrl,
  posterUrl,
}: {
  images: string[];
  caption?: string;
  isShort?: boolean;
  videoUrl?: string;
  posterUrl?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [lightbox, setLightbox] = React.useState(false);
  const current = images[Math.min(index, Math.max(images.length - 1, 0))] || "";

  const go = React.useCallback(
    (dir: -1 | 1) => {
      if (images.length < 2) return;
      setIndex((i) => (i + dir + images.length) % images.length);
    },
    [images.length]
  );

  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, go]);

  if (isShort && videoUrl) {
    return (
      <div className="relative flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl bg-black">
        <video
          src={videoUrl}
          poster={posterUrl}
          controls
          playsInline
          preload="metadata"
          className="max-h-[min(70vh,720px)] w-full object-contain"
        />
      </div>
    );
  }

  if (!current) return null;

  return (
    <>
      <div className="relative flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-xl scale-110"
          style={{ backgroundImage: `url(${current})` }}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="relative z-10 flex max-h-[min(70vh,720px)] w-full items-center justify-center"
          aria-label="View photo full size"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={caption || "Trip"}
            className="max-h-[min(70vh,720px)] w-full object-contain"
            loading="eager"
          />
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition",
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  )}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, idx) => (
            <button
              key={`${src}-${idx}`}
              type="button"
              onClick={() => setIndex(idx)}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition",
                idx === index ? "ring-primary" : "ring-transparent opacity-80 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Trip photo ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Full size photo"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current}
            alt={caption || "Trip"}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProfileImage } from "../../types/user";

/**
 * Up to two flag-sized profile photos shown inline to the right of the full
 * name (mirrors mobile components/profile/ProfileImagesStrip.tsx). Clicking a
 * photo opens a full-screen viewer with ←/→ and Esc support.
 */
export function ProfileImagesInline({ images }: { images?: ProfileImage[] }) {
  const list = React.useMemo(() => images ?? [], [images]);
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);

  const close = React.useCallback(() => setViewerIndex(null), []);
  const step = React.useCallback(
    (dir: -1 | 1) => {
      setViewerIndex((i) => (i === null ? i : (i + dir + list.length) % list.length));
    },
    [list.length]
  );

  React.useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, step, viewerIndex]);

  if (list.length === 0) return null;
  const current = viewerIndex !== null ? list[viewerIndex] : null;

  return (
    <>
      <span className="ml-2.5 inline-flex shrink-0 items-center gap-1.5">
        {list.map((image, index) => (
          <button
            key={image._id}
            type="button"
            onClick={() => setViewerIndex(index)}
            className="h-[22px] w-[30px] overflow-hidden rounded-[4px] border-[0.5px] border-[rgba(28,115,180,0.2)] transition-opacity hover:opacity-80 dark:border-[rgba(56,189,248,0.35)]"
            aria-label={`Open profile photo ${index + 1} of ${list.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </span>

      {current ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo"
          onClick={close}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt=""
            className="max-h-[90vh] max-w-[92vw] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Close photo"
          >
            <X className="h-6 w-6" />
          </button>
          {list.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(-1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  step(1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                aria-label="Next photo"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm font-semibold text-white">
                {(viewerIndex ?? 0) + 1} / {list.length}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

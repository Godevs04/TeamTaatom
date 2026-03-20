"use client";

import * as React from "react";
import Cropper, { Area } from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { X, SlidersHorizontal, Crop as CropIcon } from "lucide-react";
import { Button } from "../ui/button";
import { blobToImageFile, getCroppedImageBlob } from "../../lib/image-crop";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

const ASPECT_PRESETS: { id: string; label: string; value: number }[] = [
  { id: "4-5", label: "4:5 · Feed", value: 4 / 5 },
  { id: "1-1", label: "1:1", value: 1 },
  { id: "3-4", label: "3:4", value: 3 / 4 },
  { id: "4-3", label: "4:3", value: 4 / 3 },
  { id: "16-9", label: "16:9", value: 16 / 9 },
];

type ImageCropModalProps = {
  open: boolean;
  imageSrc: string | null;
  baseFileName: string;
  onClose: () => void;
  onApply: (file: File) => void;
  title?: string;
};

export function ImageCropModal({
  open,
  imageSrc,
  baseFileName,
  onClose,
  onApply,
  title = "Crop photo",
}: ImageCropModalProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [aspectId, setAspectId] = React.useState<string>("4-5");
  const aspect = ASPECT_PRESETS.find((p) => p.id === aspectId)?.value ?? 4 / 5;
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const [applying, setApplying] = React.useState(false);
  const applyingRef = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspectId("4-5");
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = React.useCallback((_area: Area, areaPx: Area) => {
    setCroppedAreaPixels(areaPx);
  }, []);

  const handleApply = React.useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      const file = blobToImageFile(blob, baseFileName);
      onApply(file);
      onClose();
    } catch {
      toast.error("Could not crop this image. Try another photo.");
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }, [imageSrc, croppedAreaPixels, baseFileName, onApply, onClose]);

  /** W-03: Escape closes; Enter applies when focus isn’t on button / text-like input / zoom slider. */
  React.useEffect(() => {
    if (!open || !imageSrc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Enter" || e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("button")) return;
      if (target.closest('input[type="range"]')) return;
      if (target.closest('input:not([type="checkbox"]):not([type="radio"])')) return;
      if (target.closest("textarea")) return;
      if (target.isContentEditable) return;

      e.preventDefault();
      void handleApply();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, imageSrc, onClose, handleApply]);

  return (
    <AnimatePresence>
      {open && imageSrc ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
            aria-label="Close crop"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-modal-title"
            className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-[520px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl sm:m-4 sm:rounded-3xl sm:border-slate-700/80"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <CropIcon className="h-4 w-4" aria-hidden />
                </span>
                <h2 id="crop-modal-title" className="font-display text-base font-semibold tracking-tight text-white">
                  {title}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="relative h-[min(52vh,420px)] w-full bg-black sm:h-[380px]">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  rotation={0}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid
                  objectFit="contain"
                  classes={{
                    containerClassName: "!bg-slate-950",
                    mediaClassName: "!max-h-full",
                  }}
                />
              </div>

              <div className="space-y-4 px-4 py-4 sm:px-5">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Aspect ratio
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAspectId(p.id)}
                        className={cn(
                          "rounded-full px-3.5 py-2 text-xs font-semibold transition-all",
                          aspectId === p.id
                            ? "bg-primary text-white shadow-lg shadow-primary/30"
                            : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Zoom
                    </span>
                    <span className="tabular-nums text-slate-400">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur sm:px-5">
              <p className="text-center text-[11px] text-slate-500 sm:text-left">
                <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-slate-400">Enter</kbd>
                {" "}apply ·{" "}
                <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] text-slate-400">Esc</kbd>
                {" "}cancel
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-xl border-white/15 bg-transparent text-white hover:bg-white/10" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-xl font-semibold shadow-lg shadow-primary/25"
                  onClick={() => void handleApply()}
                  disabled={!croppedAreaPixels || applying}
                >
                  {applying ? "Working…" : "Apply crop"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

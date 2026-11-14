"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Check, Film, ImagePlus, Loader2, Lock, UploadCloud, X } from "lucide-react";
import { getVideoCreatorStatus, uploadLongVideo } from "../../../lib/api";
import { getFriendlyErrorMessage } from "../../../lib/auth-errors";
import { Button } from "../../../components/ui/button";
import { ImageCropModal, type AspectPreset } from "../../../components/create/image-crop-modal";
import { cn } from "../../../lib/utils";

/** Same ratios as mobile THUMBNAIL_RATIOS (hooks/useLongVideoUpload.ts). */
const THUMBNAIL_RATIOS: AspectPreset[] = [
  { id: "16:9", label: "16:9 · Widescreen", value: 16 / 9 },
  { id: "4:3", label: "4:3 · Classic", value: 4 / 3 },
  { id: "1:1", label: "1:1 · Square", value: 1 },
  { id: "4:5", label: "4:5 · Portrait", value: 4 / 5 },
  { id: "9:16", label: "9:16 · Vertical", value: 9 / 16 },
];

type Thumbnail = { file: File; previewUrl: string; aspect: number };

/** Grabs the frame currently shown in a <video> as an object URL (JPEG). */
function captureFrame(el: HTMLVideoElement): Promise<string | null> {
  return new Promise((resolve) => {
    if (!el.videoWidth || !el.videoHeight) {
      resolve(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/jpeg", 0.92);
  });
}

/** Same limits as mobile hooks/useLongVideoUpload.ts */
const LONG_VIDEO_MAX_DURATION_SEC = 60 * 60;
const LONG_VIDEO_MAX_SIZE_MB = 500;
const CAPTION_MAX = 1000;
const STEPS = ["Select", "Details", "Publish"] as const;

function formatDuration(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Reads a local video's duration (seconds) via a detached <video> element. */
function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    const done = (value?: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : undefined);
    el.onerror = () => done(undefined);
    el.src = url;
  });
}

type Picked = { file: File; previewUrl: string; duration?: number };

export default function UploadLongVideoPage() {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);
  const previewRef = React.useRef<HTMLVideoElement>(null);
  const [video, setVideo] = React.useState<Picked | null>(null);
  const [thumbnail, setThumbnail] = React.useState<Thumbnail | null>(null);
  const [cropSource, setCropSource] = React.useState<string | null>(null);
  const [caption, setCaption] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadedId, setUploadedId] = React.useState<string | null>(null);

  const statusQ = useQuery({ queryKey: ["video-creator-status"], queryFn: getVideoCreatorStatus });
  const canUpload = !!statusQ.data?.canUpload;

  React.useEffect(() => {
    return () => {
      if (video) URL.revokeObjectURL(video.previewUrl);
    };
  }, [video]);

  React.useEffect(() => {
    return () => {
      if (thumbnail) URL.revokeObjectURL(thumbnail.previewUrl);
    };
  }, [thumbnail]);

  React.useEffect(() => {
    return () => {
      if (cropSource) URL.revokeObjectURL(cropSource);
    };
  }, [cropSource]);

  const grabCurrentFrame = async () => {
    const el = previewRef.current;
    if (!el) return;
    el.pause();
    const url = await captureFrame(el);
    if (!url) {
      toast.error("Play the video to the frame you want, then try again.");
      return;
    }
    setCropSource(url);
  };

  const onPickThumbnail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setCropSource(URL.createObjectURL(file));
  };

  const stepIndex = uploadedId || uploading ? 2 : video ? 1 : 0;

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    if (file.size > LONG_VIDEO_MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Please choose a video under ${LONG_VIDEO_MAX_SIZE_MB} MB.`);
      return;
    }
    const duration = await readVideoDuration(file);
    if (duration != null && duration > LONG_VIDEO_MAX_DURATION_SEC) {
      toast.error("Videos cannot exceed 60 minutes.");
      return;
    }
    setVideo({ file, previewUrl: URL.createObjectURL(file), duration });
  };

  const publish = async () => {
    if (!video || uploading || !canUpload) return;
    setUploading(true);
    setProgress(0);
    try {
      const post = await uploadLongVideo(
        {
          video: video.file,
          caption: caption.trim(),
          durationSeconds: video.duration,
          thumbnail: thumbnail?.file ?? null,
          thumbnailAspectRatio: thumbnail?.aspect ?? null,
        },
        setProgress
      );
      setProgress(100);
      setUploadedId(post?._id ?? "");
      toast.success("Uploaded — your video is processing and will appear in Videos.");
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Long video</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Up to 60 min · {LONG_VIDEO_MAX_SIZE_MB} MB max · Ads by duration
        </p>
      </div>

      <ol className="flex items-center gap-2" aria-label="Upload steps">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                index <= stepIndex ? "border-primary bg-primary text-white" : "border-slate-300 text-slate-400 dark:border-zinc-700"
              )}
            >
              {index < stepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn("text-sm", index === stepIndex ? "font-bold text-slate-900 dark:text-zinc-50" : "text-slate-500")}>
              {label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className={cn("h-0.5 flex-1 rounded", index < stepIndex ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800")} />
            ) : null}
          </li>
        ))}
      </ol>

      {statusQ.isPending ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking creator access…
        </div>
      ) : !canUpload ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <Lock className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-zinc-50">Creator access required</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            {statusQ.data?.status === "pending"
              ? "Your creator request is still pending review."
              : statusQ.data?.status === "rejected" && statusQ.data.rejectionReason
                ? `Rejected: ${statusQ.data.rejectionReason}`
                : "Request creator access from the Videos section of your feed first."}
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/feed">Go to feed</Link>
          </Button>
        </div>
      ) : uploadedId !== null ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <Check className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-zinc-50">Uploaded</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">Your video is processing and will appear in Videos.</p>
          <div className="mt-4 flex justify-center gap-2">
            {uploadedId ? (
              <Button className="rounded-xl" onClick={() => router.replace(`/watch/${uploadedId}`)}>
                Open
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-xl" onClick={() => router.back()}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {video ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-black dark:border-zinc-800">
              <video
                ref={previewRef}
                src={video.previewUrl}
                controls
                playsInline
                className="aspect-video w-full object-contain"
              />
              <div className="flex items-center justify-between bg-white px-4 py-2 text-sm dark:bg-zinc-900">
                <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-zinc-200">
                  <Film className="h-4 w-4 shrink-0" />
                  <span className="truncate">{video.file.name}</span>
                </span>
                <span className="shrink-0 text-slate-500">{formatDuration(video.duration) || "Ready"}</span>
              </div>
              {!uploading ? (
                <button
                  type="button"
                  onClick={() => {
                    setVideo(null);
                    setThumbnail(null);
                  }}
                  className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  aria-label="Remove video"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/35 bg-white/60 py-16 text-slate-600 hover:bg-primary/5 dark:bg-zinc-900/60 dark:text-zinc-300"
            >
              <UploadCloud className="h-10 w-10 text-primary" />
              <span className="font-semibold">Choose a video</span>
              <span className="text-xs text-slate-500">MP4, MOV · up to 60 minutes</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={onPick} />
          <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={onPickThumbnail} />

          {video ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800/80 dark:bg-zinc-900/90">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Thumbnail</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {thumbnail ? "Custom thumbnail selected" : "Auto-generated if you skip this"}
                  </p>
                </div>
                {thumbnail ? (
                  <div className="relative h-14 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800" style={{ aspectRatio: String(thumbnail.aspect) }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbnail.previewUrl} alt="Selected thumbnail" className="h-full w-full object-cover" />
                    {!uploading ? (
                      <button
                        type="button"
                        onClick={() => setThumbnail(null)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                        aria-label="Remove thumbnail"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => void grabCurrentFrame()}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4" />
                  Use current frame
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploading}
                >
                  <ImagePlus className="h-4 w-4" />
                  Upload image
                </Button>
              </div>
            </div>
          ) : null}

          {video ? (
            <div>
              <label htmlFor="long-video-caption" className="mb-1.5 block text-sm font-medium text-foreground">
                Caption
              </label>
              <textarea
                id="long-video-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={CAPTION_MAX}
                rows={4}
                disabled={uploading}
                placeholder="Describe your video…"
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {caption.length}/{CAPTION_MAX}
              </p>
            </div>
          ) : null}

          {uploading ? (
            <div className="space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-taatom-ocean to-taatom-emerald transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">Uploading… {progress}%</p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => router.back()} disabled={uploading}>
              Cancel
            </Button>
            <Button className="gap-2 rounded-xl" onClick={() => void publish()} disabled={!video || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publish
            </Button>
          </div>
        </div>
      )}

      <ImageCropModal
        open={!!cropSource}
        imageSrc={cropSource}
        baseFileName="long-video-thumbnail"
        title="Frame your thumbnail"
        presets={THUMBNAIL_RATIOS}
        defaultAspectId="16:9"
        onClose={() => setCropSource(null)}
        onApply={(file, aspect) => {
          setThumbnail({ file, previewUrl: URL.createObjectURL(file), aspect });
        }}
      />
    </div>
  );
}

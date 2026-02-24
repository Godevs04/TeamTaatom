"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { createPost } from "../../lib/api";
import { ImagePlus, MapPin, X } from "lucide-react";

const CAPTION_MAX = 500;
const PLACE_NAME_MAX = 100;
const MAX_IMAGES = 10;

export default function CreateTripPage() {
  const router = useRouter();
  const [caption, setCaption] = React.useState("");
  const [placeName, setPlaceName] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const captionError =
    caption.length > CAPTION_MAX ? `Caption must be less than ${CAPTION_MAX} characters` : null;
  const placeNameError =
    placeName.length > PLACE_NAME_MAX ? `Place name must be less than ${PLACE_NAME_MAX} characters` : null;
  const canSubmit =
    files.length > 0 &&
    files.length <= MAX_IMAGES &&
    !captionError &&
    !placeNameError &&
    !submitting;

  const onSubmit = async () => {
    if (files.length === 0) {
      toast.error("Please add at least one image");
      return;
    }
    if (files.length > MAX_IMAGES) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    if (captionError || placeNameError) {
      toast.error("Please fix the errors above");
      return;
    }
    setSubmitting(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("caption", caption);
      if (placeName.trim()) {
        fd.append("address", placeName.trim());
      }
      fd.append("source", "manual_only");
      fd.append("fromCamera", "false");
      fd.append("hasExifGps", "false");
      files.forEach((f) => fd.append("images", f));

      const res = await createPost(fd, setProgress);
      toast.success(res?.message || "Trip created");
      const id = res?.post?._id;
      router.replace(id ? `/trip/${id}` : "/feed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create trip");
    } finally {
      setSubmitting(false);
      setTimeout(() => setProgress(null), 800);
    }
  };

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles?.length) return;
    const list = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...list].slice(0, MAX_IMAGES));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add photos, a caption, and optional location — same as the app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trip details</CardTitle>
          <CardDescription>
            At least one photo is required. Caption and location are optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photos (required) */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-primary" />
              <label className="text-sm font-semibold">Photos</label>
              <span className="text-xs text-muted-foreground">(Required, up to {MAX_IMAGES})</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            {files.length < MAX_IMAGES && (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <ImagePlus className="h-4 w-4" />
                {files.length === 0 ? "Add photos" : "Add more"}
              </Button>
            )}
            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative overflow-hidden rounded-xl border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} photo{files.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Caption (optional) - match app */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Caption</label>
              <span className="text-xs text-muted-foreground">(Optional, max {CAPTION_MAX})</span>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening? Use @ to mention someone or # for hashtags"
              className="min-h-[100px] w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              maxLength={CAPTION_MAX}
            />
            {caption.length > 0 && (
              <p className={`text-xs ${caption.length > CAPTION_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {caption.length} / {CAPTION_MAX}
              </p>
            )}
            {captionError && <p className="text-xs text-destructive">{captionError}</p>}
          </div>

          {/* Place name / Location (optional) - match app */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold">Place name / Location</label>
              </div>
              <span className="text-xs text-muted-foreground">(Optional, max {PLACE_NAME_MAX})</span>
            </div>
            <Input
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Add a place name or address"
              maxLength={PLACE_NAME_MAX}
              className={placeNameError ? "border-destructive" : ""}
            />
            {placeName.length > 0 && (
              <p className={`text-xs ${placeName.length > PLACE_NAME_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {placeName.length} / {PLACE_NAME_MAX}
              </p>
            )}
            {placeNameError && <p className="text-xs text-destructive">{placeNameError}</p>}
          </div>

          {/* Upload progress */}
          {progress !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-end justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={!canSubmit}>
              {submitting ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { createPost, createShort, searchPlaceUser, type SearchPlaceResult } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import { ImagePlus, MapPin, X, Video, Film, Search, ChevronDown, Check } from "lucide-react";

const CAPTION_MAX = 500;
const PLACE_NAME_MAX = 100;
const MAX_IMAGES = 10;

// Must match backend Post model enum: Beach, Mountain, City, Natural spots, Religious, Cultural, General
const SPOT_TYPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "Beach", label: "Beach" },
  { value: "Mountain", label: "Mountain" },
  { value: "City", label: "City" },
  { value: "Natural spots", label: "Natural spots" },
  { value: "Religious", label: "Religious" },
  { value: "Cultural", label: "Cultural" },
  { value: "General", label: "General" },
];

// Must match backend Post model enum: Drivable, Hiking, Water Transport, Flight, Train
const TRAVEL_INFO_OPTIONS = [
  { value: "", label: "None" },
  { value: "Drivable", label: "Drivable" },
  { value: "Hiking", label: "Hiking" },
  { value: "Water Transport", label: "Water Transport" },
  { value: "Flight", label: "Flight" },
  { value: "Train", label: "Train" },
];

type CreateMode = "post" | "short";

function appendDetectedPlace(fd: FormData, place: SearchPlaceResult) {
  fd.append("detectedPlaceName", place.name || "");
  fd.append("detectedPlaceCountry", place.country || "");
  fd.append("detectedPlaceCountryCode", place.countryCode || "");
  fd.append("detectedPlaceCity", place.city || "");
  fd.append("detectedPlaceStateProvince", place.stateProvince || "");
  fd.append("detectedPlaceLatitude", String(place.lat));
  fd.append("detectedPlaceLongitude", String(place.lng));
  fd.append("detectedPlacePlaceId", place.placeId || "");
  fd.append("detectedPlaceFormattedAddress", place.formattedAddress || "");
}

export default function CreateTripPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [mode, setMode] = React.useState<CreateMode>("post");
  const [caption, setCaption] = React.useState("");
  const [placeName, setPlaceName] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [videoFile, setVideoFile] = React.useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [copyrightAccepted, setCopyrightAccepted] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [spotType, setSpotType] = React.useState("");
  const [travelInfo, setTravelInfo] = React.useState("");
  const [detectedPlace, setDetectedPlace] = React.useState<SearchPlaceResult | null>(null);
  const [showDetectPlaceModal, setShowDetectPlaceModal] = React.useState(false);
  const [detectPlaceQuery, setDetectPlaceQuery] = React.useState("");
  const [isSearchingPlace, setIsSearchingPlace] = React.useState(false);
  const [searchResult, setSearchResult] = React.useState<SearchPlaceResult | null>(null);
  const [showSpotTypeDropdown, setShowSpotTypeDropdown] = React.useState(false);
  const [showTravelInfoDropdown, setShowTravelInfoDropdown] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?redirect=/create");
      return;
    }
  }, [user, authLoading, router]);

  const captionError =
    caption.length > CAPTION_MAX ? `Caption must be less than ${CAPTION_MAX} characters` : null;
  const placeNameError =
    placeName.length > PLACE_NAME_MAX ? `Place name must be less than ${PLACE_NAME_MAX} characters` : null;
  const canSubmitPost =
    files.length > 0 &&
    files.length <= MAX_IMAGES &&
    !captionError &&
    !placeNameError &&
    !submitting;
  const canSubmitShort =
    !!videoFile &&
    !captionError &&
    !placeNameError &&
    copyrightAccepted &&
    !submitting;

  const onSubmitPost = async () => {
    if (!user) {
      toast.error("You must be signed in to post.");
      return;
    }
    if (files.length === 0) {
      toast.error("Please select at least one image first.");
      return;
    }
    if (files.length > MAX_IMAGES) {
      toast.error("Maximum 10 images are allowed");
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
      const address = placeName.trim() || (detectedPlace?.formattedAddress ?? "");
      if (address) fd.append("address", address);
      if (detectedPlace) {
        appendDetectedPlace(fd, detectedPlace);
        fd.append("latitude", String(detectedPlace.lat));
        fd.append("longitude", String(detectedPlace.lng));
      }
      if (spotType) fd.append("spotType", spotType);
      if (travelInfo) fd.append("travelInfo", travelInfo);
      fd.append("source", "manual_only");
      fd.append("fromCamera", "false");
      fd.append("hasExifGps", "false");
      files.forEach((f) => fd.append("images", f));

      const res = await createPost(fd, setProgress);
      toast.success(res?.message || "Your post has been shared.");
      const id = res?.post?._id;
      router.replace(id ? `/trip/${id}` : "/feed");
    } catch (e: unknown) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setSubmitting(false);
      setTimeout(() => setProgress(null), 800);
    }
  };

  const onSubmitShort = async () => {
    if (!user) {
      toast.error("You must be signed in to post.");
      return;
    }
    if (!videoFile) {
      toast.error("Please select a video first.");
      return;
    }
    if (!copyrightAccepted) {
      toast.error("Please accept the copyright to use audio in your short.");
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
      fd.append("video", videoFile);
      if (thumbnailFile) fd.append("image", thumbnailFile);
      fd.append("caption", caption);
      fd.append("audioSource", "user_original");
      fd.append("copyrightAccepted", "true");
      fd.append("copyrightAcceptedAt", new Date().toISOString());
      const address = placeName.trim() || (detectedPlace?.formattedAddress ?? "");
      if (address) fd.append("address", address);
      if (detectedPlace) {
        appendDetectedPlace(fd, detectedPlace);
        fd.append("latitude", String(detectedPlace.lat));
        fd.append("longitude", String(detectedPlace.lng));
      }
      if (spotType) fd.append("spotType", spotType);
      if (travelInfo) fd.append("travelInfo", travelInfo);
      fd.append("source", "manual_only");
      fd.append("fromCamera", "false");
      fd.append("hasExifGps", "false");

      const res = await createShort(fd, setProgress);
      toast.success(res?.message || "Your short has been uploaded.");
      const id = res?.short?._id;
      router.replace(id ? `/trip/${id}` : "/shorts");
    } catch (e: unknown) {
      toast.error(getFriendlyErrorMessage(e));
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

  const handleSearchPlace = React.useCallback(async () => {
    const q = detectPlaceQuery.trim();
    if (!q) return;
    setIsSearchingPlace(true);
    setSearchResult(null);
    try {
      const result = await searchPlaceUser(q);
      setSearchResult(result ?? null);
      if (!result) toast.error("Place not found. Try a different name.");
    } catch (e: unknown) {
      toast.error(getFriendlyErrorMessage(e));
      setSearchResult(null);
    } finally {
      setIsSearchingPlace(false);
    }
  }, [detectPlaceQuery]);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
          <p className="text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Create</h1>
        <p className="mt-1 text-sm text-slate-500">
          Share a photo post or a short video — same as the app.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-100/90 p-1.5">
        <button
          type="button"
          onClick={() => setMode("post")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            mode === "post" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ImagePlus className="h-4 w-4" />
          Photo post
        </button>
        <button
          type="button"
          onClick={() => setMode("short")}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            mode === "short" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Film className="h-4 w-4" />
          Short
        </button>
      </div>

      <Card className="rounded-3xl border border-slate-200/80 shadow-premium overflow-visible">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mode === "post" ? <ImagePlus className="h-5 w-5 text-primary" /> : <Video className="h-5 w-5 text-primary" />}
            {mode === "post" ? "Trip details" : "Short video"}
          </CardTitle>
          <CardDescription>
            {mode === "post"
              ? "At least one photo is required. Caption and location are optional."
              : "One video is required. Caption and location are optional. You must have rights to any audio."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 overflow-visible">
          {mode === "post" ? (
            <>
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
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2 rounded-xl">
                    <ImagePlus className="h-4 w-4" />
                    {files.length === 0 ? "Add photos" : "Add more"}
                  </Button>
                )}
                {files.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="relative overflow-hidden rounded-xl border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full object-cover" />
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
                  <p className="text-xs text-muted-foreground">{files.length} photo{files.length !== 1 ? "s" : ""} selected</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <label className="text-sm font-semibold">Video (required)</label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()} className="gap-2 rounded-xl">
                  <Video className="h-4 w-4" />
                  {videoFile ? videoFile.name : "Choose video"}
                </Button>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => thumbInputRef.current?.click()} className="rounded-xl">
                    Thumbnail (optional)
                  </Button>
                  {thumbnailFile && <span className="text-xs text-muted-foreground">{thumbnailFile.name}</span>}
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                <input
                  type="checkbox"
                  id="copyright"
                  checked={copyrightAccepted}
                  onChange={(e) => setCopyrightAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="copyright" className="text-sm text-slate-700">
                  I have the rights to the audio in this short (or it is original / no music).
                </label>
              </div>
            </>
          )}

          {/* Caption */}
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

          {/* Place name / Location + Detect place */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <label className="text-sm font-semibold">Place name / Location</label>
              </div>
              <span className="text-xs text-muted-foreground">(Optional, max {PLACE_NAME_MAX})</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Input
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="Add a place name or address"
                maxLength={PLACE_NAME_MAX}
                className={`min-w-0 flex-1 ${placeNameError ? "border-destructive rounded-xl" : "rounded-xl"}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDetectPlaceModal(true)}
                className="shrink-0 rounded-xl gap-1.5"
              >
                <Search className="h-4 w-4" />
                Detect place
              </Button>
            </div>
            {detectedPlace && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="font-medium text-slate-900 dark:text-white">{detectedPlace.name}</p>
                <p className="text-slate-600 dark:text-slate-400">{detectedPlace.formattedAddress}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDetectedPlace(null);
                    setPlaceName("");
                  }}
                  className="mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Clear detected place
                </button>
              </div>
            )}
            {placeNameError && <p className="text-xs text-destructive">{placeNameError}</p>}
          </div>

          {/* Map preview when we have coordinates */}
          {detectedPlace && typeof detectedPlace.lat === "number" && typeof detectedPlace.lng === "number" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
            <div className="grid gap-2">
              <label className="text-sm font-semibold">Map</label>
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-muted">
                <iframe
                  title="Location map"
                  className="h-48 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(detectedPlace.lat + "," + detectedPlace.lng)}&zoom=14`}
                />
              </div>
            </div>
          )}

          {/* Spot type dropdown */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold">Spot type</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSpotTypeDropdown((v) => !v);
                  setShowTravelInfoDropdown(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-input bg-background px-4 py-3 text-sm"
              >
                <span className={spotType ? "text-foreground" : "text-muted-foreground"}>
                  {SPOT_TYPE_OPTIONS.find((o) => o.value === spotType)?.label ?? "Select spot type"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {showSpotTypeDropdown && (
                <>
                  <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" role="listbox">
                    {SPOT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value || "none"}
                        type="button"
                        role="option"
                        aria-selected={spotType === opt.value}
                        onClick={() => {
                          setSpotType(opt.value);
                          setShowSpotTypeDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-zinc-800"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="fixed inset-0 z-20" aria-hidden onClick={() => setShowSpotTypeDropdown(false)} />
                </>
              )}
            </div>
          </div>

          {/* Travel method dropdown */}
          <div className="grid gap-2">
            <label className="text-sm font-semibold">Travel method</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowTravelInfoDropdown((v) => !v);
                  setShowSpotTypeDropdown(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-input bg-background px-4 py-3 text-sm"
              >
                <span className={travelInfo ? "text-foreground" : "text-muted-foreground"}>
                  {TRAVEL_INFO_OPTIONS.find((o) => o.value === travelInfo)?.label ?? "Select travel method"}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {showTravelInfoDropdown && (
                <>
                  <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900" role="listbox">
                    {TRAVEL_INFO_OPTIONS.map((opt) => (
                      <button
                        key={opt.value || "none"}
                        type="button"
                        role="option"
                        aria-selected={travelInfo === opt.value}
                        onClick={() => {
                          setTravelInfo(opt.value);
                          setShowTravelInfoDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-zinc-800"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="fixed inset-0 z-20" aria-hidden onClick={() => setShowTravelInfoDropdown(false)} />
                </>
              )}
            </div>
          </div>

          {progress !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-end gap-2 pt-2 sm:gap-3">
            <Button variant="outline" onClick={() => router.back()} disabled={submitting} className="rounded-xl">
              Cancel
            </Button>
            {mode === "post" ? (
              <Button onClick={onSubmitPost} disabled={!canSubmitPost} className="rounded-xl">
                {submitting ? "Publishing…" : "Publish"}
              </Button>
            ) : (
              <Button onClick={onSubmitShort} disabled={!canSubmitShort} className="rounded-xl">
                {submitting ? "Uploading…" : "Upload short"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detect place modal (matches Admin: Place Found! section, details, map, Cancel / Use This Place) */}
      {showDetectPlaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="detect-place-title">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-700 sm:px-5 sm:py-4">
              <h2 id="detect-place-title" className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate">Detect Place</span>
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowDetectPlaceModal(false);
                  setDetectPlaceQuery("");
                  setSearchResult(null);
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 grid gap-1.5">
                  <label htmlFor="detect-place-input" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Enter Place Name
                  </label>
                  <Input
                    id="detect-place-input"
                    value={detectPlaceQuery}
                    onChange={(e) => setDetectPlaceQuery(e.target.value)}
                    placeholder="e.g. Taj Mahal"
                    className="rounded-xl"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearchPlace(); } }}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSearchPlace}
                  disabled={!detectPlaceQuery.trim() || isSearchingPlace}
                  className="shrink-0 rounded-xl gap-1.5"
                >
                  <Search className="h-4 w-4" />
                  {isSearchingPlace ? "Searching…" : "Search"}
                </Button>
              </div>
              {searchResult && (
                <>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40">
                    <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200">
                      <Check className="h-5 w-5 shrink-0" />
                      Place Found!
                    </p>
                    <dl className="mt-3 grid gap-1.5 text-sm">
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Name</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{searchResult.name}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Address</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{searchResult.formattedAddress}</dd>
                      </div>
                      {searchResult.city && (
                        <div>
                          <dt className="font-medium text-slate-700 dark:text-slate-300">City</dt>
                          <dd className="text-slate-600 dark:text-slate-400">{searchResult.city}</dd>
                        </div>
                      )}
                      {searchResult.stateProvince && (
                        <div>
                          <dt className="font-medium text-slate-700 dark:text-slate-300">State/Province</dt>
                          <dd className="text-slate-600 dark:text-slate-400">{searchResult.stateProvince}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Country</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{searchResult.country}{searchResult.countryCode ? ` (${searchResult.countryCode})` : ""}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-700 dark:text-slate-300">Coordinates</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{searchResult.lat}, {searchResult.lng}</dd>
                      </div>
                    </dl>
                  </div>
                  {typeof searchResult.lat === "number" && typeof searchResult.lng === "number" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-muted dark:border-zinc-700">
                      <iframe
                        title="Detected place on map"
                        className="h-52 w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(searchResult.lat + "," + searchResult.lng)}&zoom=15`}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDetectPlaceModal(false);
                        setDetectPlaceQuery("");
                        setSearchResult(null);
                      }}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        setDetectedPlace(searchResult);
                        setPlaceName(searchResult.name || searchResult.formattedAddress);
                        setShowDetectPlaceModal(false);
                        setDetectPlaceQuery("");
                        setSearchResult(null);
                        toast.success("Place set");
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Use This Place
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

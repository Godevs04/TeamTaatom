"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { createPost, createShort, searchPlaceUser, type SearchPlaceResult } from "../../../lib/api";
import { getFriendlyErrorMessage } from "../../../lib/auth-errors";
import { useAuth } from "../../../context/auth-context";
import { motion } from "framer-motion";
import {
  ImagePlus,
  MapPin,
  MapPinned,
  X,
  Video,
  Film,
  Search,
  ChevronDown,
  Check,
  Crop,
  Upload,
  Sparkles,
  GripVertical,
} from "lucide-react";
import { ImageCropModal } from "../../../components/create/image-crop-modal";

const CAPTION_MAX = 500;
const PLACE_NAME_MAX = 100;
const MAX_IMAGES = 10;
const CREATE_DRAFT_STORAGE_KEY = "taatom:web:create-draft:v1";

const easeOut = [0.22, 1, 0.36, 1] as const;
const springSoft = { type: "spring" as const, stiffness: 320, damping: 34, mass: 0.85 };

const createHeroVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.03 } },
};
const createHeroItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.48, ease: easeOut } },
};

type CropSession =
  | { kind: "post"; index: number; src: string; baseName: string }
  | { kind: "thumb"; src: string; baseName: string };

type CreateDraft = {
  mode: CreateMode;
  caption: string;
  placeName: string;
  spotType: string;
  travelInfo: string;
  detectPlaceQuery: string;
  copyrightAccepted: boolean;
};

type ExifHint = { lat: number; lng: number; fileName: string };

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

type PhotoSlot = { id: string; file: File };

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
  const [photoSlots, setPhotoSlots] = React.useState<PhotoSlot[]>([]);
  /** Order matches carousel / FormData upload (W-01). */
  const files = React.useMemo(() => photoSlots.map((s) => s.file), [photoSlots]);
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
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const objectUrlsRef = React.useRef<string[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);
  const thumbCropObjectUrlRef = React.useRef<string | null>(null);
  const [cropSession, setCropSession] = React.useState<CropSession | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [thumbPreviewUrl, setThumbPreviewUrl] = React.useState<string | null>(null);
  const [dragPhotoIndex, setDragPhotoIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);
  const draftHydratedRef = React.useRef(false);
  const [exifHint, setExifHint] = React.useState<ExifHint | null>(null);
  const [isReadingExif, setIsReadingExif] = React.useState(false);

  // Create and revoke object URLs for file previews to avoid memory leaks
  React.useEffect(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    if (files.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    objectUrlsRef.current = urls;
    setPreviewUrls(urls);
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, [files]);

  React.useEffect(() => {
    if (!thumbnailFile) {
      setThumbPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(thumbnailFile);
    setThumbPreviewUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [thumbnailFile]);

  // W-17: detect GPS from the first JPEG and offer "Use photo location".
  React.useEffect(() => {
    if (mode !== "post" || files.length === 0) {
      setExifHint(null);
      setIsReadingExif(false);
      return;
    }

    const first = files[0];
    const isJpeg = /image\/jpe?g/i.test(first.type) || /\.jpe?g$/i.test(first.name);
    if (!isJpeg) {
      setExifHint(null);
      setIsReadingExif(false);
      return;
    }

    let cancelled = false;
    setIsReadingExif(true);
    (async () => {
      try {
        const exifr = await import("exifr");
        const gps = (await exifr.gps(first)) as
          | { latitude?: number; longitude?: number; lat?: number; lng?: number; lon?: number }
          | undefined;
        if (cancelled) return;
        const lat = Number(gps?.latitude ?? gps?.lat);
        const lng = Number(gps?.longitude ?? gps?.lng ?? gps?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setExifHint({ lat, lng, fileName: first.name });
        } else {
          setExifHint(null);
        }
      } catch {
        if (!cancelled) setExifHint(null);
      } finally {
        if (!cancelled) setIsReadingExif(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [files, mode]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/create");
      return;
    }
  }, [user, authLoading, router]);

  // W-16: restore text-based draft fields on mount. Media files are intentionally not persisted.
  React.useEffect(() => {
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    try {
      const raw = localStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<CreateDraft>;
      if (draft.mode === "post" || draft.mode === "short") setMode(draft.mode);
      if (typeof draft.caption === "string") setCaption(draft.caption.slice(0, CAPTION_MAX));
      if (typeof draft.placeName === "string") setPlaceName(draft.placeName.slice(0, PLACE_NAME_MAX));
      if (typeof draft.spotType === "string") setSpotType(draft.spotType);
      if (typeof draft.travelInfo === "string") setTravelInfo(draft.travelInfo);
      if (typeof draft.detectPlaceQuery === "string") setDetectPlaceQuery(draft.detectPlaceQuery);
      if (typeof draft.copyrightAccepted === "boolean") setCopyrightAccepted(draft.copyrightAccepted);
    } catch {
      // Ignore corrupted local draft and continue.
    }
  }, []);

  React.useEffect(() => {
    const draft: CreateDraft = {
      mode,
      caption,
      placeName,
      spotType,
      travelInfo,
      detectPlaceQuery,
      copyrightAccepted,
    };
    try {
      localStorage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors (private mode / quota).
    }
  }, [mode, caption, placeName, spotType, travelInfo, detectPlaceQuery, copyrightAccepted]);

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
      const usingExifGps = detectedPlace?.placeId === "exif";
      const address = placeName.trim() || (detectedPlace?.formattedAddress ?? "");
      if (address) fd.append("address", address);
      if (detectedPlace) {
        appendDetectedPlace(fd, detectedPlace);
        fd.append("latitude", String(detectedPlace.lat));
        fd.append("longitude", String(detectedPlace.lng));
      }
      if (spotType) fd.append("spotType", spotType);
      if (travelInfo) fd.append("travelInfo", travelInfo);
      fd.append("source", usingExifGps ? "exif_only" : "manual_only");
      fd.append("fromCamera", "false");
      fd.append("hasExifGps", usingExifGps ? "true" : "false");
      files.forEach((f) => fd.append("images", f));

      const res = await createPost(fd, setProgress);
      toast.success(res?.message || "Your post has been shared.");
      localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
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
      const usingExifGps = detectedPlace?.placeId === "exif";
      const address = placeName.trim() || (detectedPlace?.formattedAddress ?? "");
      if (address) fd.append("address", address);
      if (detectedPlace) {
        appendDetectedPlace(fd, detectedPlace);
        fd.append("latitude", String(detectedPlace.lat));
        fd.append("longitude", String(detectedPlace.lng));
      }
      if (spotType) fd.append("spotType", spotType);
      if (travelInfo) fd.append("travelInfo", travelInfo);
      fd.append("source", usingExifGps ? "exif_only" : "manual_only");
      fd.append("fromCamera", "false");
      fd.append("hasExifGps", usingExifGps ? "true" : "false");

      const res = await createShort(fd, setProgress);
      toast.success(res?.message || "Your short has been uploaded.");
      localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
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
    setPhotoSlots((prev) =>
      [...prev, ...list.map((file) => ({ id: crypto.randomUUID(), file }))].slice(0, MAX_IMAGES)
    );
  };

  const removeFile = (index: number) => {
    setPhotoSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const reorderPhotos = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setPhotoSlots((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };

  const openPostCrop = (index: number) => {
    const f = files[index];
    const src = previewUrls[index];
    if (!f || !src) return;
    setCropSession({ kind: "post", index, src, baseName: f.name });
  };

  const openThumbCrop = () => {
    if (!thumbnailFile) {
      toast.error("Choose a thumbnail image first.");
      return;
    }
    if (thumbCropObjectUrlRef.current) {
      URL.revokeObjectURL(thumbCropObjectUrlRef.current);
      thumbCropObjectUrlRef.current = null;
    }
    const url = URL.createObjectURL(thumbnailFile);
    thumbCropObjectUrlRef.current = url;
    setCropSession({ kind: "thumb", src: url, baseName: thumbnailFile.name });
  };

  const closeCropModal = () => {
    if (cropSession?.kind === "thumb" && thumbCropObjectUrlRef.current) {
      URL.revokeObjectURL(thumbCropObjectUrlRef.current);
      thumbCropObjectUrlRef.current = null;
    }
    setCropSession(null);
  };

  const onCroppedFile = (file: File) => {
    if (!cropSession) return;
    if (cropSession.kind === "post") {
      const i = cropSession.index;
      setPhotoSlots((prev) => prev.map((slot, idx) => (idx === i ? { ...slot, file } : slot)));
      toast.success("Photo cropped");
    } else {
      setThumbnailFile(file);
      toast.success("Thumbnail cropped");
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (mode !== "post") return;
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (mode !== "post") return;
    addFiles(e.dataTransfer.files);
  };

  const handleUseExifLocation = () => {
    if (!exifHint) return;
    const pretty = `GPS ${exifHint.lat.toFixed(5)}, ${exifHint.lng.toFixed(5)}`;
    setDetectedPlace({
      lat: exifHint.lat,
      lng: exifHint.lng,
      name: "Photo location",
      formattedAddress: pretty,
      city: "",
      country: "",
      countryCode: "",
      stateProvince: "",
      placeId: "exif",
    });
    setPlaceName(pretty);
    toast.success("Using photo GPS location");
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
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
          <p className="text-slate-600 dark:text-zinc-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-80 overflow-hidden" aria-hidden>
        <div className="feed-orb absolute -left-28 top-0 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="feed-orb-delayed absolute right-0 top-16 h-72 w-72 rounded-full bg-violet-500/[0.05] blur-3xl" />
        <div className="feed-orb-late absolute left-1/4 top-36 h-52 w-52 rounded-full bg-sky-400/[0.04] blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#f8fafc]/80 dark:to-zinc-950/90" />
      </div>

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
        className="relative z-10"
      >
        <motion.div variants={createHeroVariants} initial="hidden" animate="show" className="space-y-3">
          <motion.p
            variants={createHeroItem}
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            New story
          </motion.p>
          <motion.h1
            variants={createHeroItem}
            className="font-display text-[1.85rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.125rem] dark:text-zinc-50"
          >
            <span className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 bg-clip-text text-transparent dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-400">
              Create
            </span>
          </motion.h1>
          <motion.p variants={createHeroItem} className="max-w-xl text-sm leading-[1.65] text-slate-600 dark:text-zinc-400 sm:text-[15px]">
            Compose a photo trip with framing and crop, or upload a short. Add a place and details when you&apos;re ready.
          </motion.p>
        </motion.div>
      </motion.header>

      {/* Mode tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.44, ease: easeOut, delay: 0.05 }}
        className="relative z-10 inline-flex flex-wrap gap-1 rounded-2xl bg-slate-100/85 p-1.5 shadow-inner shadow-slate-200/50 ring-1 ring-slate-200/60 dark:bg-zinc-800/90 dark:shadow-black/40 dark:ring-zinc-700/80"
      >
        <button
          type="button"
          onClick={() => setMode("post")}
          className={`relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-300 ${
            mode === "post" ? "text-slate-900 dark:text-zinc-50" : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {mode === "post" && (
            <motion.span
              layoutId="create-mode-pill"
              className="absolute inset-0 -z-10 rounded-xl bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:shadow-black/30 dark:ring-zinc-600/80"
              transition={springSoft}
            />
          )}
          <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
          Photo post
        </button>
        <button
          type="button"
          onClick={() => setMode("short")}
          className={`relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-300 ${
            mode === "short" ? "text-slate-900 dark:text-zinc-50" : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {mode === "short" && (
            <motion.span
              layoutId="create-mode-pill"
              className="absolute inset-0 -z-10 rounded-xl bg-white shadow-[0_2px_12px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:shadow-black/30 dark:ring-zinc-600/80"
              transition={springSoft}
            />
          )}
          <Film className="h-4 w-4 shrink-0" aria-hidden />
          Short
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.06 }}
        className="relative z-10 rounded-[1.75rem] border border-slate-200/70 bg-white/75 p-[1px] shadow-[0_20px_50px_-28px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-900/50 dark:shadow-[0_20px_50px_-28px_rgba(0,0,0,0.45)] sm:rounded-[1.85rem]"
      >
        <Card className="overflow-visible rounded-[1.7rem] border-0 bg-gradient-to-br from-white via-white to-slate-50/50 shadow-none dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 sm:rounded-[1.8rem]">
          <CardHeader className="space-y-1 border-b border-slate-100/90 dark:border-zinc-800/90 px-5 pb-5 pt-6 dark:border-zinc-800/90 sm:px-8 sm:pb-6 sm:pt-8">
            <CardTitle className="flex items-center gap-2.5 text-lg font-semibold text-slate-900 dark:text-zinc-50 sm:text-xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                {mode === "post" ? <ImagePlus className="h-5 w-5" aria-hidden /> : <Video className="h-5 w-5" aria-hidden />}
              </span>
              {mode === "post" ? "Trip details" : "Short video"}
            </CardTitle>
            <CardDescription className="text-[15px] leading-relaxed text-slate-600 dark:text-zinc-400">
              {mode === "post"
                ? "At least one photo is required. Caption and location are optional."
                : "One video is required. Caption and location are optional. You must have rights to any audio."}
            </CardDescription>
          </CardHeader>
        <CardContent className="space-y-0 overflow-visible px-5 pb-6 sm:px-8 sm:pb-8">
          {mode === "post" ? (
            <section className="space-y-4 border-b border-slate-100/90 dark:border-zinc-800/90 pb-8">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-primary shrink-0" aria-hidden />
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Photos</span>
                  <span className="rounded-full bg-slate-100/90 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200/60 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-700/70">
                    Up to {MAX_IMAGES} · drag to reorder · crop optional
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <motion.div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  animate={{ scale: isDragOver ? 1.01 : 1 }}
                  transition={springSoft}
                  className={`rounded-2xl border-2 border-dashed transition-colors duration-300 ${
                    isDragOver
                      ? "border-primary/60 bg-primary/[0.05] ring-2 ring-primary/15"
                      : "border-slate-200/80 bg-gradient-to-br from-slate-50/60 via-white to-slate-50/30 hover:border-slate-300/90 dark:border-zinc-700 dark:from-zinc-900/80 dark:via-zinc-900 dark:to-zinc-950 dark:hover:border-zinc-600"
                  } p-5 sm:p-6`}
                >
                  <div className="flex flex-col items-center justify-center gap-3 text-center sm:gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/12 to-violet-500/10 text-primary shadow-sm ring-1 ring-primary/10 sm:h-14 sm:w-14">
                      <Upload className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Drop images here</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400 sm:text-[13px]">or browse — JPG, PNG, WebP</p>
                    </div>
                    {files.length < MAX_IMAGES && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2 rounded-xl border-slate-200/80 bg-white/95 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800/90"
                      >
                        <ImagePlus className="h-4 w-4" aria-hidden />
                        {files.length === 0 ? "Choose photos" : "Add more"}
                      </Button>
                    )}
                  </div>
                </motion.div>
                {isReadingExif && (
                  <p className="text-xs text-slate-500">Reading GPS metadata from first photo…</p>
                )}
                {!isReadingExif && exifHint && (
                  <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        GPS found in <span className="font-semibold">{exifHint.fileName}</span>
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={handleUseExifLocation} className="rounded-xl gap-1.5">
                        <MapPinned className="h-4 w-4" />
                        Use photo location
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {exifHint.lat.toFixed(5)}, {exifHint.lng.toFixed(5)}
                    </p>
                  </div>
                )}
                {files.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photoSlots.map((slot, i) => (
                      <motion.div
                        key={slot.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25, ease: easeOut }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDropTargetIndex(i);
                        }}
                        onDragLeave={() => {
                          setDropTargetIndex((t) => (t === i ? null : t));
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const raw = e.dataTransfer.getData("text/plain");
                          const from = dragPhotoIndex ?? parseInt(raw, 10);
                          setDragPhotoIndex(null);
                          setDropTargetIndex(null);
                          if (!Number.isFinite(from)) return;
                          reorderPhotos(from, i);
                        }}
                        className={`group relative overflow-hidden rounded-2xl border bg-slate-100 shadow-sm ring-1 ring-black/[0.03] ${
                          dropTargetIndex === i ? "border-primary ring-2 ring-primary/30" : "border-slate-200/80"
                        }`}
                      >
                        <div
                          className="absolute left-2 top-2 z-20 flex cursor-grab touch-none items-center justify-center rounded-lg bg-black/55 p-1.5 text-white shadow-md backdrop-blur-sm active:cursor-grabbing"
                          draggable
                          title="Drag to reorder"
                          aria-label={`Reorder image ${i + 1}`}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragPhotoIndex(i);
                            e.dataTransfer.setData("text/plain", String(i));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragPhotoIndex(null);
                            setDropTargetIndex(null);
                          }}
                        >
                          <GripVertical className="h-4 w-4" aria-hidden />
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrls[i] ?? ""} alt="" className="aspect-square w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex gap-1.5 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 flex-1 rounded-lg text-xs font-semibold shadow-sm"
                            onClick={() => openPostCrop(i)}
                          >
                            <Crop className="mr-1 h-3.5 w-3.5" />
                            Crop
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 shrink-0 rounded-lg shadow-sm"
                            onClick={() => removeFile(i)}
                            aria-label="Remove photo"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                {files.length > 0 && (
                  <p className="text-xs leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-700">{files.length}</span> photo{files.length !== 1 ? "s" : ""}{" "}
                    · Drag the grip to reorder · Crop is optional.
                  </p>
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-5 border-b border-slate-100/90 dark:border-zinc-800/90 pb-8">
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-slate-900">Video (required)</label>
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => thumbInputRef.current?.click()} className="rounded-xl gap-1.5">
                    <ImagePlus className="h-4 w-4" />
                    Thumbnail (optional)
                  </Button>
                  {thumbnailFile && (
                    <>
                      <Button type="button" variant="secondary" size="sm" onClick={openThumbCrop} className="rounded-xl gap-1.5">
                        <Crop className="h-4 w-4" />
                        Crop cover
                      </Button>
                      <span className="text-xs text-muted-foreground">{thumbnailFile.name}</span>
                    </>
                  )}
                </div>
                {thumbnailFile && thumbPreviewUrl && (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbPreviewUrl} alt="Thumbnail preview" className="aspect-video max-h-48 w-full object-cover" />
                  </div>
                )}
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 ring-1 ring-slate-100/80 transition-colors hover:bg-slate-50/90">
                <input
                  type="checkbox"
                  id="copyright"
                  checked={copyrightAccepted}
                  onChange={(e) => setCopyrightAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="copyright" className="text-sm leading-relaxed text-slate-700">
                  I have the rights to the audio in this short (or it is original / no music).
                </label>
              </div>
            </section>
          )}

          {/* Caption */}
          <section className="space-y-3 border-b border-slate-100/90 dark:border-zinc-800/90 py-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Caption</label>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">Optional · max {CAPTION_MAX}</span>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening? Use @ to mention someone or # for hashtags"
              className="min-h-[108px] w-full resize-y rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3.5 text-sm leading-relaxed shadow-sm transition-[border-color,box-shadow,background-color] ring-offset-background placeholder:text-slate-400 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              maxLength={CAPTION_MAX}
            />
            {caption.length > 0 && (
              <p className={`text-xs ${caption.length > CAPTION_MAX ? "text-destructive" : "text-muted-foreground"}`}>
                {caption.length} / {CAPTION_MAX}
              </p>
            )}
            {captionError && <p className="text-xs text-destructive">{captionError}</p>}
          </section>

          {/* Place name / Location + Detect place */}
          <section className="space-y-3 border-b border-slate-100/90 dark:border-zinc-800/90 py-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <label className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Place name / Location</label>
              </div>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">Optional · max {PLACE_NAME_MAX}</span>
            </div>
            <div
              className={`flex overflow-hidden rounded-2xl border bg-white shadow-sm transition-[box-shadow,border-color] focus-within:border-primary/35 focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/15 dark:bg-zinc-900/70 ${
                placeNameError
                  ? "border-destructive ring-2 ring-destructive/20"
                  : "border-slate-200/85 dark:border-zinc-700 dark:bg-zinc-900/70"
              }`}
            >
              <Input
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="Add a place name or address"
                maxLength={PLACE_NAME_MAX}
                className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none px-4 py-3.5 h-11 sm:h-12"
              />
              <span className="hidden w-px shrink-0 self-stretch bg-slate-200/90 dark:bg-zinc-600/60 sm:block" aria-hidden />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDetectPlaceModal(true)}
                className="h-auto shrink-0 gap-1.5 rounded-none px-4 py-3 text-primary hover:bg-primary/[0.06] hover:text-primary sm:px-5"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap text-sm font-semibold">Detect place</span>
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

            {/* Map preview when we have coordinates */}
            {detectedPlace && typeof detectedPlace.lat === "number" && typeof detectedPlace.lng === "number" && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
              <div className="grid gap-2 pt-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Map</label>
                <div className="overflow-hidden rounded-2xl border border-slate-200/85 bg-muted shadow-sm ring-1 ring-slate-100/80 dark:border-zinc-700 dark:ring-zinc-800/80">
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
          </section>

          {/* Spot type + travel */}
          <section className="grid gap-6 py-8 md:grid-cols-2 md:gap-8">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Spot type</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSpotTypeDropdown((v) => !v);
                    setShowTravelInfoDropdown(false);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200/85 bg-white px-4 py-3.5 text-sm shadow-sm transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600"
                >
                  <span className={spotType ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {SPOT_TYPE_OPTIONS.find((o) => o.value === spotType)?.label ?? "Select spot type"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
                {showSpotTypeDropdown && (
                  <>
                    <div
                      className="absolute z-30 mt-1.5 w-full max-h-56 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                      role="listbox"
                    >
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
                          className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
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

            <div className="grid gap-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Travel method</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTravelInfoDropdown((v) => !v);
                    setShowSpotTypeDropdown(false);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200/85 bg-white px-4 py-3.5 text-sm shadow-sm transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow dark:border-zinc-700 dark:bg-zinc-900/80 dark:hover:border-zinc-600"
                >
                  <span className={travelInfo ? "font-medium text-foreground" : "text-muted-foreground"}>
                    {TRAVEL_INFO_OPTIONS.find((o) => o.value === travelInfo)?.label ?? "Select travel method"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
                {showTravelInfoDropdown && (
                  <>
                    <div
                      className="absolute z-30 mt-1.5 w-full max-h-56 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                      role="listbox"
                    >
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
                          className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800"
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
          </section>

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

          <div className="flex flex-wrap items-end justify-end gap-2 border-t border-slate-100/90 pt-6 dark:border-zinc-800/90 sm:gap-3 sm:pt-8">
            <Button variant="outline" onClick={() => router.back()} disabled={submitting} className="rounded-xl">
              Cancel
            </Button>
            {mode === "post" ? (
              <Button onClick={onSubmitPost} disabled={!canSubmitPost} className="rounded-xl shadow-md shadow-primary/20 transition-[box-shadow,transform] hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]">
                {submitting ? "Publishing…" : "Publish"}
              </Button>
            ) : (
              <Button onClick={onSubmitShort} disabled={!canSubmitShort} className="rounded-xl shadow-md shadow-primary/20 transition-[box-shadow,transform] hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]">
                {submitting ? "Uploading…" : "Upload short"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      </motion.div>

      <ImageCropModal
        open={!!cropSession}
        imageSrc={cropSession?.src ?? null}
        baseFileName={cropSession?.baseName ?? "photo"}
        title={cropSession?.kind === "thumb" ? "Crop thumbnail" : "Crop photo"}
        onClose={closeCropModal}
        onApply={onCroppedFile}
      />

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

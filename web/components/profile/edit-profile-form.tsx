"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Plus, User2, X } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ImageCropModal } from "../create/image-crop-modal";
import { LanguagePicker } from "./language-picker";
import { NationalityPicker } from "./nationality-picker";
import type { ProfileImage, User } from "../../types/user";
import { PROFILE_IMAGES_MAX } from "../../lib/profile-images";

/** Gallery entry: an already-saved photo (existingId) or a newly picked local file. */
type GalleryItem = { key: string; url: string; existingId?: string; file?: File };

const BIO_MAX_LINES = 5;

function toGallery(images?: ProfileImage[]): GalleryItem[] {
  return (images ?? []).map((image) => ({ key: image._id, url: image.url, existingId: image._id }));
}

type EditProfileFormProps = {
  user: User;
};

export function EditProfileForm({ user }: EditProfileFormProps) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [fullName, setFullName] = React.useState(user.fullName ?? "");
  const [bio, setBio] = React.useState(user.bio ?? "");
  const [nationality, setNationality] = React.useState(user.nationality ?? "");
  const [currentLocation, setCurrentLocation] = React.useState(user.currentLocation ?? "");
  const [languagesKnown, setLanguagesKnown] = React.useState<string[]>(user.languagesKnown ?? []);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [cropOpen, setCropOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = React.useState<GalleryItem[]>(() => toGallery(user.profileImages));
  const [galleryChanged, setGalleryChanged] = React.useState(false);
  const galleryRef = React.useRef(gallery);
  galleryRef.current = gallery;
  const profileImagesKey = (user.profileImages ?? []).map((image) => image._id).join(",");

  React.useEffect(() => {
    setFullName(user.fullName ?? "");
    setBio(user.bio ?? "");
    setNationality(user.nationality ?? "");
    setCurrentLocation(user.currentLocation ?? "");
    setLanguagesKnown(user.languagesKnown ?? []);
  }, [user._id, user.fullName, user.bio, user.nationality, user.currentLocation, user.languagesKnown]);

  React.useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Sync saved photos from the server (e.g. after save + refresh) while there are no local edits.
  React.useEffect(() => {
    if (galleryChanged) return;
    setGallery(toGallery(user.profileImages));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the image ids
  }, [profileImagesKey, galleryChanged]);

  // Revoke object URLs for picked files on unmount.
  React.useEffect(() => {
    return () => {
      galleryRef.current.forEach((item) => {
        if (item.file) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  const handleGalleryPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    e.target.value = "";
    if (files.length === 0) return;
    const remaining = PROFILE_IMAGES_MAX - gallery.length;
    if (remaining <= 0) {
      toast.error(`You can add up to ${PROFILE_IMAGES_MAX} photos`);
      return;
    }
    if (files.length > remaining) toast.error(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added`);
    const picked = files.slice(0, remaining).map((file, index) => ({
      key: `new_${Date.now()}_${index}`,
      url: URL.createObjectURL(file),
      file,
    }));
    setGallery((current) => [...current, ...picked]);
    setGalleryChanged(true);
  };

  const removeGalleryItem = (key: string) => {
    setGallery((current) => {
      const target = current.find((item) => item.key === key);
      if (target?.file) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.key !== key);
    });
    setGalleryChanged(true);
  };

  const handleBioChange = (text: string) => {
    const lines = text.split("\n");
    if (lines.length <= BIO_MAX_LINES) {
      setBio(text);
    } else {
      setBio(lines.slice(0, BIO_MAX_LINES).join("\n"));
      toast.error(`Bio can only have ${BIO_MAX_LINES} lines maximum`);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
    e.target.value = "";
  };

  const handleCropApply = (file: File) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCropOpen(false);
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    if (bio.length > 300) {
      toast.error("Bio cannot exceed 300 characters");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName.trim());
      fd.append("bio", bio.trim());
      fd.append("nationality", nationality.trim());
      fd.append("currentLocation", currentLocation.trim());
      fd.append("languagesKnown", JSON.stringify(languagesKnown));
      if (pendingFile) fd.append("profilePic", pendingFile);
      if (galleryChanged) {
        // Kept photo ids in display order, then new files appended (backend profileController.updateProfile).
        fd.append(
          "profileImagesKeep",
          JSON.stringify(gallery.flatMap((item) => (item.existingId ? [item.existingId] : [])))
        );
        gallery.forEach((item) => {
          if (item.file) fd.append("profileImages", item.file, item.file.name);
        });
      }

      const res = await updateProfile(user._id, fd);
      setGalleryChanged(false);
      await refresh();
      router.refresh();
      toast.success(res.message ?? "Profile updated");
    } catch (err: unknown) {
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = previewUrl || user.profilePic;

  return (
    <>
      <form id="profile" onSubmit={handleSave} className="space-y-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/10 ring-1 ring-slate-200/80 dark:ring-zinc-700"
          >
            {avatarSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User2 className="h-10 w-10 text-primary/60" />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-6 w-6 text-white" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="min-w-0 flex-1 space-y-4 w-full">
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-foreground">
                Full name
              </label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="rounded-xl"
                maxLength={80}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Photos</p>
                <p className="text-xs text-muted-foreground">
                  {gallery.length}/{PROFILE_IMAGES_MAX}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {gallery.map((item) => (
                  <div key={item.key} className="relative h-14 w-14">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full rounded-xl border border-input object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(item.key)}
                      disabled={saving}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-background text-muted-foreground shadow hover:text-foreground"
                      aria-label="Remove photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {gallery.length < PROFILE_IMAGES_MAX ? (
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={saving}
                    className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-input text-muted-foreground hover:bg-muted"
                    aria-label="Add photos"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                ) : null}
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryPick}
              />
              <p className="mt-1 text-xs text-muted-foreground">Shown next to your name on your profile.</p>
            </div>
            <div>
              <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-foreground">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => handleBioChange(e.target.value)}
                placeholder="Tell travelers about yourself…"
                rows={BIO_MAX_LINES}
                maxLength={300}
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">{bio.length}/300 · max {BIO_MAX_LINES} lines</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-zinc-800">
          <div>
            <label htmlFor="currentLocation" className="mb-1.5 block text-sm font-medium text-foreground">
              Current location
            </label>
            <Input
              id="currentLocation"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g. New York, London, Tokyo"
              className="rounded-xl"
              maxLength={200}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Nationality / country</p>
            <NationalityPicker key={user._id} value={nationality} onChange={setNationality} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Languages you speak</p>
            <LanguagePicker key={user._id} value={languagesKnown} onChange={setLanguagesKnown} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="rounded-xl gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save profile
          </Button>
        </div>
      </form>

      <ImageCropModal
        open={cropOpen}
        imageSrc={cropSrc}
        baseFileName="profile.jpg"
        title="Crop profile photo"
        onClose={() => {
          setCropOpen(false);
          if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
          setCropSrc(null);
        }}
        onApply={handleCropApply}
      />
    </>
  );
}

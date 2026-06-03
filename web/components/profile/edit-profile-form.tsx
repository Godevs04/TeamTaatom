"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, User2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ImageCropModal } from "../create/image-crop-modal";
import type { User } from "../../types/user";

type EditProfileFormProps = {
  user: User;
};

export function EditProfileForm({ user }: EditProfileFormProps) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [fullName, setFullName] = React.useState(user.fullName ?? "");
  const [bio, setBio] = React.useState(user.bio ?? "");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [cropOpen, setCropOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setFullName(user.fullName ?? "");
    setBio(user.bio ?? "");
  }, [user._id, user.fullName, user.bio]);

  React.useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleBioChange = (text: string) => {
    const lines = text.split("\n");
    if (lines.length <= 3) {
      setBio(text);
    } else {
      setBio(lines.slice(0, 3).join("\n"));
      toast.error("Bio can only have 3 lines maximum");
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
      if (pendingFile) fd.append("profilePic", pendingFile);

      const res = await updateProfile(user._id, fd);
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
              <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-foreground">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => handleBioChange(e.target.value)}
                placeholder="Tell travelers about yourself…"
                rows={3}
                maxLength={300}
                className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">{bio.length}/300 · max 3 lines</p>
            </div>
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

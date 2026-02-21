"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { createPost } from "../../lib/api";

export default function CreateTripPage() {
  const router = useRouter();
  const [caption, setCaption] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const onSubmit = async () => {
    if (files.length === 0) {
      toast.error("Please add at least one image");
      return;
    }
    setSubmitting(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("caption", caption);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create Trip</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload photos, add a caption, and publish.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trip details</CardTitle>
          <CardDescription>Matches mobile validation at the API layer. UI here is premium web.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-semibold">Caption</label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share your story…" />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-semibold">Photos (up to 10)</label>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 10))}
            />
            {files.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {files.map((f) => (
                  <div key={f.name} className="overflow-hidden rounded-xl border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {progress !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Uploading</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


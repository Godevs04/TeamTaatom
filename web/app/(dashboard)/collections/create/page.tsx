"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { createCollection } from "../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../lib/auth-errors";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function CreateCollectionPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);

  const create = useMutation({
    mutationFn: () => createCollection({ name: name.trim(), description: description.trim() || undefined, isPublic }),
    onSuccess: (data) => {
      toast.success("Collection created");
      router.replace(data?.collection?._id ? `/collections/${data.collection._id}` : "/collections");
    },
    onError: (e: unknown) => {
      toast.error(getFriendlyErrorMessage(e));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    create.mutate();
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/collections">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New collection</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer 2024"
            className="rounded-xl"
            maxLength={100}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this collection about?"
            className="min-h-[80px] w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm"
            maxLength={500}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="isPublic" className="text-sm text-slate-700">Public (others can see this collection)</label>
        </div>
        <div className="flex gap-3">
          <Button type="submit" className="rounded-xl" disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" asChild>
            <Link href="/collections">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

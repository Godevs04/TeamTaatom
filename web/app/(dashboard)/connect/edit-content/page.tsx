"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  connectGetSubscriptionContent,
  connectGetWebsiteContent,
  connectUpdateSubscriptionContent,
  connectUpdateWebsiteContent,
} from "@/lib/connect-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { ContentBlock } from "@/types/connect";
import { ContentBlockBuilder } from "@/components/connect/content-block-builder";
import { ConnectContentBlocks } from "@/components/connect/connect-content-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConnectEditContentPage() {
  const searchParams = useSearchParams();
  const pageId = searchParams.get("pageId") ?? "";
  const section = (searchParams.get("section") ?? "website") as "website" | "subscription";
  const category = searchParams.get("category") ?? "connect";
  const isCommunity = category === "community";

  const [blocks, setBlocks] = React.useState<ContentBlock[]>([]);
  const [pageBackground, setPageBackground] = React.useState("");
  const [pageTextColor, setPageTextColor] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const sectionTitle =
    section === "website" ? "Website" : isCommunity ? "Buy" : "Subscription";

  const contentQ = useQuery({
    queryKey: ["connect-edit-content", pageId, section],
    queryFn: async () => {
      if (section === "website") return connectGetWebsiteContent(pageId);
      return connectGetSubscriptionContent(pageId);
    },
    enabled: !!pageId,
  });

  React.useEffect(() => {
    if (!contentQ.data) return;
    if (section === "website") {
      const d = contentQ.data as Awaited<ReturnType<typeof connectGetWebsiteContent>>;
      setBlocks(d.websiteContent ?? []);
      setPageBackground(d.websiteBackground ?? "");
      setPageTextColor(d.websiteTextColor ?? "");
    } else {
      const d = contentQ.data as Awaited<ReturnType<typeof connectGetSubscriptionContent>>;
      setBlocks(d.subscriptionContent ?? []);
      setPageBackground(d.subscriptionBackground ?? "");
      setPageTextColor(d.subscriptionTextColor ?? "");
    }
    setDirty(false);
  }, [contentQ.data, section]);

  const handleBlocksChange = (next: ContentBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const options = {
        background: pageBackground || undefined,
        textColor: pageTextColor || undefined,
      };
      if (section === "website") {
        return connectUpdateWebsiteContent(pageId, blocks, options);
      }
      return connectUpdateSubscriptionContent(pageId, blocks, options);
    },
    onSuccess: () => {
      toast.success("Content saved");
      setDirty(false);
      contentQ.refetch();
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (!pageId) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-sm text-slate-500">
        Missing page ID.{" "}
        <Link href="/connect" className="text-primary hover:underline">
          Back to Connect
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 lg:pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/connect/page/${pageId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          onClick={(e) => {
            if (dirty && !window.confirm("You have unsaved changes. Leave anyway?")) {
              e.preventDefault();
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to page
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            onClick={() => setPreviewOpen((o) => !o)}
          >
            <Eye className="h-4 w-4" />
            {previewOpen ? "Hide preview" : "Preview"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-xl gap-2"
            disabled={saveMutation.isPending || !dirty}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">
          Edit {sectionTitle} content
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Build your page layout with text, images, buttons, and embeds.
        </p>
      </div>

      {contentQ.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : contentQ.isError ? (
        <p className="text-destructive">{getFriendlyErrorMessage(contentQ.error)}</p>
      ) : (
        <>
          <div className="grid gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Page background</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={pageBackground || "#ffffff"}
                  onChange={(e) => {
                    setPageBackground(e.target.value);
                    setDirty(true);
                  }}
                  className="h-10 w-14 cursor-pointer rounded-lg p-1"
                />
                <Input
                  value={pageBackground}
                  onChange={(e) => {
                    setPageBackground(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="#ffffff or empty for default"
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Text color</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={pageTextColor || "#111827"}
                  onChange={(e) => {
                    setPageTextColor(e.target.value);
                    setDirty(true);
                  }}
                  className="h-10 w-14 cursor-pointer rounded-lg p-1"
                />
                <Input
                  value={pageTextColor}
                  onChange={(e) => {
                    setPageTextColor(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="#111827 or empty for default"
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          <ContentBlockBuilder
            blocks={blocks}
            onChange={handleBlocksChange}
            pageId={pageId}
          />

          {previewOpen && (
            <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-zinc-300">Preview</h2>
              <ConnectContentBlocks
                blocks={blocks}
                pageBackground={pageBackground || undefined}
                pageTextColor={pageTextColor || undefined}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

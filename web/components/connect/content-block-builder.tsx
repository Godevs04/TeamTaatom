"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Link2,
  Minus,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import type { ContentBlock, ContentBlockType } from "@/types/connect";
import { connectUploadContentImage } from "@/lib/connect-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

const BLOCK_TYPES: { type: ContentBlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "embed", label: "Embed" },
];

const COL_OPTIONS = [
  { value: 12, label: "Full width" },
  { value: 6, label: "Half" },
  { value: 4, label: "Third" },
  { value: 3, label: "Quarter" },
];

type ContentBlockBuilderProps = {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  pageId?: string;
  maxBlocks?: number;
};

function defaultBlock(type: ContentBlockType, order: number): ContentBlock {
  const base: ContentBlock = { type, content: "", order };
  if (type === "text") return { ...base, align: "left", fontSize: "normal" };
  if (type === "button") return { ...base, url: "" };
  if (type === "divider") return { ...base, content: "---" };
  if (type === "embed") return { ...base, embedType: "youtube", content: "" };
  if (type === "heading") return { ...base, align: "center", bold: true };
  return base;
}

export function ContentBlockBuilder({
  blocks,
  onChange,
  pageId,
  maxBlocks = 20,
}: ContentBlockBuilderProps) {
  const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(null);
  const fileRefs = React.useRef<Record<number, HTMLInputElement | null>>({});

  const updateBlock = (index: number, patch: Partial<ContentBlock>) => {
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const removeBlock = (index: number) => {
    if (!window.confirm("Remove this block?")) return;
    onChange(blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i })));
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= blocks.length) return;
    const copy = [...blocks];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    onChange(copy.map((b, i) => ({ ...b, order: i })));
  };

  const addBlock = (type: ContentBlockType) => {
    if (blocks.length >= maxBlocks) {
      toast.error(`Maximum ${maxBlocks} blocks`);
      return;
    }
    if (type === "image") {
      const idx = blocks.length;
      onChange([...blocks, defaultBlock("image", idx)]);
      setTimeout(() => fileRefs.current[idx]?.click(), 0);
      return;
    }
    onChange([...blocks, defaultBlock(type, blocks.length)]);
  };

  const handleImageFile = async (index: number, file: File) => {
    if (!pageId) {
      updateBlock(index, { type: "image", content: URL.createObjectURL(file) });
      return;
    }
    setUploadingIndex(index);
    try {
      const up = await connectUploadContentImage(pageId, file);
      if (up.signedUrl) {
        updateBlock(index, { type: "image", content: up.signedUrl });
      }
    } catch (e: unknown) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map(({ type, label }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={() => addBlock(type)}
          >
            <Plus className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
          No content blocks yet. Add a block above to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {blocks.map((block, index) => (
            <li
              key={block._id ?? `block-${index}`}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  {block.type} · block {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBlock(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Width</span>
                  <select
                    value={block.col ?? 12}
                    onChange={(e) => updateBlock(index, { col: Number(e.target.value) })}
                    className="rounded-lg border border-input bg-background px-2 py-1 text-sm"
                  >
                    {COL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!block.stacked}
                    onChange={(e) => updateBlock(index, { stacked: e.target.checked })}
                  />
                  Stack in previous column
                </label>
                {(block.type === "text" || block.type === "heading") && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!block.bold}
                      onChange={(e) => updateBlock(index, { bold: e.target.checked })}
                    />
                    Bold
                  </label>
                )}
              </div>

              {(block.type === "text" || block.type === "heading") && (
                <textarea
                  value={block.content}
                  onChange={(e) => updateBlock(index, { content: e.target.value })}
                  rows={block.type === "heading" ? 2 : 4}
                  placeholder={block.type === "heading" ? "Heading text…" : "Body text…"}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
              )}

              {block.type === "button" && (
                <div className="space-y-2">
                  <Input
                    value={block.content}
                    onChange={(e) => updateBlock(index, { content: e.target.value })}
                    placeholder="Button label"
                    className="rounded-xl"
                  />
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={block.url ?? ""}
                      onChange={(e) => updateBlock(index, { url: e.target.value })}
                      placeholder="https://…"
                      className="rounded-xl pl-10"
                    />
                  </div>
                </div>
              )}

              {block.type === "embed" && (
                <div className="space-y-2">
                  <select
                    value={block.embedType ?? "youtube"}
                    onChange={(e) => updateBlock(index, { embedType: e.target.value as ContentBlock["embedType"] })}
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="map">Map</option>
                    <option value="custom">Custom URL</option>
                  </select>
                  <Input
                    value={block.content}
                    onChange={(e) => updateBlock(index, { content: e.target.value })}
                    placeholder="Embed URL or video ID"
                    className="rounded-xl"
                  />
                </div>
              )}

              {block.type === "image" && (
                <div className="space-y-2">
                  {block.content ? (
                    <div className="relative max-h-48 overflow-hidden rounded-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={block.content} alt="" className="max-h-48 w-full object-cover" />
                    </div>
                  ) : null}
                  <input
                    ref={(el) => { fileRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageFile(index, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-2"
                    disabled={uploadingIndex === index}
                    onClick={() => fileRefs.current[index]?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    {uploadingIndex === index ? "Uploading…" : block.content ? "Replace image" : "Upload image"}
                  </Button>
                </div>
              )}

              {block.type === "divider" && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Minus className="h-4 w-4" />
                  Horizontal divider
                </div>
              )}

              {(block.type === "text" || block.type === "heading") && (
                <div className="mt-2 flex gap-2">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs capitalize",
                        block.align === align
                          ? "bg-primary/10 text-primary"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                      )}
                      onClick={() => updateBlock(index, { align })}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {blocks.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          <Type className="mr-1 inline h-3.5 w-3.5" />
          {blocks.length}/{maxBlocks} blocks
        </p>
      )}
    </div>
  );
}

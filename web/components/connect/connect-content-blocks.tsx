"use client";

import * as React from "react";
import type { ContentBlock } from "@/types/connect";
import { cn } from "@/lib/utils";

function sortedBlocks(blocks: ContentBlock[] | undefined): ContentBlock[] {
  if (!blocks?.length) return [];
  return [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function ConnectContentBlocks({
  blocks,
  className,
}: {
  blocks: ContentBlock[] | undefined;
  className?: string;
}) {
  const list = sortedBlocks(blocks);
  if (!list.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-zinc-400">No content added yet.</p>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {list.map((block, i) => (
        <ConnectBlock key={block._id ?? `b-${i}`} block={block} />
      ))}
    </div>
  );
}

function ConnectBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          {block.content}
        </h3>
      );
    case "text":
      return (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-zinc-300">
          {block.content}
        </p>
      );
    case "divider":
      return <hr className="border-slate-200 dark:border-zinc-700" />;
    case "image":
      return block.content ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={block.content}
          alt=""
          className="max-h-[480px] w-full rounded-xl object-contain ring-1 ring-black/5 dark:ring-white/10"
        />
      ) : null;
    case "video":
      return block.url ? (
        <video
          src={block.url}
          controls
          className="w-full max-w-full rounded-xl ring-1 ring-black/5 dark:ring-white/10"
        />
      ) : null;
    case "button":
      return block.url ? (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-95"
        >
          {block.content || "Open link"}
        </a>
      ) : (
        <span className="text-sm text-slate-600">{block.content}</span>
      );
    case "embed":
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/80">
          <p className="font-medium text-slate-800 dark:text-zinc-200">Embed</p>
          {block.url && (
            <a
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 break-all text-primary underline"
            >
              {block.url}
            </a>
          )}
        </div>
      );
    default:
      return (
        <p className="text-sm text-slate-500 dark:text-zinc-400">{block.content}</p>
      );
  }
}

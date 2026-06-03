"use client";

import * as React from "react";
import type { ContentBlock } from "@/types/connect";
import { cn } from "@/lib/utils";

function sortedBlocks(blocks: ContentBlock[] | undefined): ContentBlock[] {
  if (!blocks?.length) return [];
  return [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// A cell may contain multiple stacked blocks (mosaic layout).
type RowCell = { col: number; blocks: ContentBlock[] };

// Pack blocks into rows of cells. stacked=true blocks join the last cell of
// the last closed row (enables tall-left + two-stacked-right mosaic).
function packIntoRows(blocks: ContentBlock[]): RowCell[][] {
  const rows: RowCell[][] = [];
  let current: RowCell[] = [];
  let used = 0;
  for (const block of blocks) {
    if (block.stacked && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      lastRow[lastRow.length - 1].blocks.push(block);
      continue;
    }
    const w = Math.max(1, Math.min(12, Number(block.col) || 12));
    if (used + w > 12 && current.length > 0) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push({ col: w, blocks: [block] });
    used += w;
    if (used >= 12) {
      rows.push(current);
      current = [];
      used = 0;
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

export function ConnectContentBlocks({
  blocks,
  className,
  pageBackground,
  pageTextColor,
}: {
  blocks: ContentBlock[] | undefined;
  className?: string;
  pageBackground?: string;
  pageTextColor?: string;
}) {
  const list = sortedBlocks(blocks);
  if (!list.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-zinc-400">No content added yet.</p>
    );
  }

  const rows = packIntoRows(list);
  const containerStyle: React.CSSProperties = {};
  if (pageBackground) containerStyle.backgroundColor = pageBackground;
  if (pageTextColor) containerStyle.color = pageTextColor;
  const hasPageStyle = !!(pageBackground || pageTextColor);

  return (
    <div
      className={cn("space-y-6", hasPageStyle && "rounded-2xl p-6", className)}
      style={containerStyle}
    >
      {rows.map((row, ri) => {
        const isSingle = row.length === 1 && row[0].blocks.length === 1;
        return isSingle ? (
          <ConnectBlock key={`row-${ri}`} block={row[0].blocks[0]} pageTextColor={pageTextColor} />
        ) : (
          <div key={`row-${ri}`} className="grid grid-cols-12 gap-3">
            {row.map((cell, ci) => {
              const spanClass = COL_SPAN[Math.max(1, Math.min(12, cell.col))] ?? "col-span-12";
              const isStackedCell = cell.blocks.length > 1;
              return (
                <div key={`c-${ri}-${ci}`} className={cn(spanClass, isStackedCell && "flex flex-col gap-3")}>
                  {cell.blocks.map((block, bi) =>
                    isStackedCell ? (
                      <div key={block._id ?? `s-${ri}-${ci}-${bi}`} className="flex-1 min-h-0">
                        <ConnectBlock block={block} pageTextColor={pageTextColor} inStack />
                      </div>
                    ) : (
                      <ConnectBlock key={block._id ?? `s-${ri}-${ci}-${bi}`} block={block} pageTextColor={pageTextColor} inRow />
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Tailwind needs the full class name in source for the JIT to pick it up.
const COL_SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
  5: "col-span-5",
  6: "col-span-6",
  7: "col-span-7",
  8: "col-span-8",
  9: "col-span-9",
  10: "col-span-10",
  11: "col-span-11",
  12: "col-span-12",
};

function ConnectBlock({
  block,
  pageTextColor,
  inRow,
  inStack,
}: {
  block: ContentBlock;
  pageTextColor?: string;
  inRow?: boolean;
  inStack?: boolean;
}) {
  const textColor = block.color || pageTextColor || undefined;
  const bg = block.backgroundColor || undefined;
  const wrapStyle: React.CSSProperties = {};
  if (bg) wrapStyle.backgroundColor = bg;
  if (textColor) wrapStyle.color = textColor;
  const hasWrap = !!(bg || textColor);

  const wrap = (node: React.ReactNode) =>
    hasWrap ? (
      <div className="rounded-xl p-3" style={wrapStyle}>
        {node}
      </div>
    ) : (
      <>{node}</>
    );

  switch (block.type) {
    case "heading": {
      const hAlign = block.align || "center";
      const hSizeClass = block.fontSize === "small" ? "text-base" : block.fontSize === "large" ? "text-2xl" : "text-xl";
      const hStyle: React.CSSProperties = {};
      if (textColor) hStyle.color = textColor;
      hStyle.textAlign = hAlign as React.CSSProperties["textAlign"];
      return wrap(
        <h3
          className={cn(
            `font-display ${hSizeClass} font-bold`,
            block.bold && "font-extrabold",
            !textColor && "text-slate-900 dark:text-white"
          )}
          style={hStyle}
        >
          {block.content}
        </h3>
      );
    }
    case "text": {
      const tAlign = block.align || "left";
      const tSizeClass = block.fontSize === "small" ? "text-xs" : block.fontSize === "large" ? "text-lg" : "text-[15px]";
      const tStyle: React.CSSProperties = {};
      if (textColor) tStyle.color = textColor;
      tStyle.textAlign = tAlign as React.CSSProperties["textAlign"];
      return wrap(
        <p
          className={cn(
            `whitespace-pre-wrap ${tSizeClass} leading-relaxed`,
            block.bold && "font-bold",
            !textColor && "text-slate-700 dark:text-zinc-300"
          )}
          style={tStyle}
        >
          {block.content}
        </p>
      );
    }
    case "divider":
      return <hr className="border-slate-200 dark:border-zinc-700" />;
    case "image":
      return block.content ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={block.content}
          alt=""
          className={cn(
            "w-full rounded-xl ring-1 ring-black/5 dark:ring-white/10",
            inStack ? "h-full object-cover" : inRow ? "aspect-[4/3] object-cover" : "max-h-[480px] object-contain"
          )}
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
    case "button": {
      const rawUrl = block.url?.trim();
      const buttonHref = rawUrl && /^[a-z][a-z0-9+.-]*:/i.test(rawUrl)
        ? rawUrl
        : (rawUrl ? `https://${rawUrl}` : "");
      const btnStyle: React.CSSProperties = {};
      if (bg) btnStyle.backgroundColor = bg;
      if (textColor) btnStyle.color = textColor;
      const useCustom = !!(bg || textColor);
      return buttonHref ? (
        <a
          href={buttonHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg transition hover:opacity-95",
            !useCustom && "bg-primary text-on-primary shadow-primary/20"
          )}
          style={useCustom ? btnStyle : undefined}
        >
          {block.content || "Open link"}
        </a>
      ) : (
        <span className="text-sm text-slate-600">{block.content}</span>
      );
    }
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

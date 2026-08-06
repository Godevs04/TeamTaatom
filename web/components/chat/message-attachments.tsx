"use client";

import * as React from "react";
import { FileText, Download } from "lucide-react";
import type { ChatAttachment } from "../../types/chat";
import { formatFileSize } from "../../lib/chat-attachments";

/**
 * Renders the attachments on a chat message bubble.
 *
 * `url` is a short-lived signed link that the backend refreshes on every read,
 * so it is used as-is and never cached.
 *
 * Note: `type: "post"` attachments come from the share-a-post flow, which web
 * sends as a [POST_SHARE] text payload instead; they fall through to the file
 * chip here only as a defensive fallback.
 */
export function MessageAttachments({
  attachments,
  isMe,
}: {
  attachments?: ChatAttachment[];
  isMe: boolean;
}) {
  const items = (attachments ?? []).filter((a) => a.url || a.fileName);
  if (items.length === 0) return null;

  const chipClass = isMe
    ? "bg-white/15 text-on-primary hover:bg-white/25"
    : "bg-white text-slate-900 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <div className="space-y-2">
      {items.map((att, i) => {
        const key = att.storageKey || att.url || `${att.fileName ?? "attachment"}-${i}`;
        const label = att.fileName || "Attachment";

        if (att.type === "image" && att.url) {
          return (
            <a
              key={key}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl"
              aria-label={`Open image ${label} full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.thumbnailUrl || att.url}
                alt={label}
                className="max-h-64 w-full object-cover transition-opacity hover:opacity-90"
                loading="lazy"
              />
            </a>
          );
        }

        if (att.type === "video" && att.url) {
          return (
            <video
              key={key}
              src={att.url}
              poster={att.thumbnailUrl}
              controls
              preload="metadata"
              className="max-h-64 w-full rounded-xl bg-black"
            />
          );
        }

        return (
          <a
            key={key}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            download={label}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${chipClass}`}
          >
            <FileText className="h-5 w-5 shrink-0 opacity-70" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              {att.fileSize ? (
                <span className="block text-xs opacity-70">{formatFileSize(att.fileSize)}</span>
              ) : null}
            </span>
            <Download className="h-4 w-4 shrink-0 opacity-70" />
          </a>
        );
      })}
    </div>
  );
}

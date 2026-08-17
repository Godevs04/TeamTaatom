"use client";

import * as React from "react";
import { FileText, Download, X } from "lucide-react";
import type { ChatAttachment } from "../../types/chat";
import { formatFileSize } from "../../lib/chat-attachments";

async function saveAttachment(url: string, fileName: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Renders the attachments on a chat message bubble.
 *
 * Images open in an in-app lightbox so the signed storage URL never appears
 * in the browser address bar. Files download via a blob with the original
 * filename for the same reason.
 */
export function MessageAttachments({
  attachments,
  isMe,
}: {
  attachments?: ChatAttachment[];
  isMe: boolean;
}) {
  const items = (attachments ?? []).filter((a) => a.url || a.fileName);
  const [preview, setPreview] = React.useState<{ url: string; label: string } | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

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
            <button
              key={key}
              type="button"
              onClick={() => setPreview({ url: att.url!, label })}
              className="block w-full overflow-hidden rounded-xl text-left"
              aria-label={`View ${label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={att.thumbnailUrl || att.url}
                alt={label}
                className="max-h-64 w-full object-cover transition-opacity hover:opacity-90"
                loading="lazy"
              />
            </button>
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
          <button
            key={key}
            type="button"
            disabled={!att.url || savingKey === key}
            onClick={async () => {
              if (!att.url) return;
              setSavingKey(key);
              try {
                await saveAttachment(att.url, label);
              } catch {
                // Keep the user on this page even if the blob download is blocked.
              } finally {
                setSavingKey(null);
              }
            }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${chipClass}`}
          >
            <FileText className="h-5 w-5 shrink-0 opacity-70" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              {att.fileSize ? (
                <span className="block text-xs opacity-70">{formatFileSize(att.fileSize)}</span>
              ) : null}
            </span>
            <Download className="h-4 w-4 shrink-0 opacity-70" />
          </button>
        );
      })}

      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={preview.label}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={preview.label}
            className="max-h-[90vh] max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

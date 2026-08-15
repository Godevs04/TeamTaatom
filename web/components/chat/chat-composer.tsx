"use client";

import * as React from "react";
import { Paperclip, Send, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_MAX_FILES,
  formatFileSize,
  validateChatFiles,
} from "../../lib/chat-attachments";

/**
 * Message composer shared by the 1:1 and room chat pages, which are otherwise
 * near-identical here. Owns the draft text and staged files; `onSend` is awaited
 * and the draft is cleared only when it resolves, so a failed send keeps the
 * user's work. Errors are surfaced by the caller's mutation.
 */
export function ChatComposer({
  onSend,
  isSending,
  placeholder = "Type a message…",
  onTyping,
  disabled = false,
}: {
  onSend: (text: string, files: File[]) => Promise<unknown>;
  isSending: boolean;
  placeholder?: string;
  /** Called on every draft-text change, mirroring mobile's unthrottled per-keystroke emit. */
  onTyping?: () => void;
  /** Disables the whole composer (e.g. the other party is blocked). Defaults to false. */
  disabled?: boolean;
}) {
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const previews = React.useMemo(
    () =>
      files.map((file) => ({
        file,
        objectUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [files]
  );

  // Release the object URLs from the previous render pass.
  React.useEffect(() => {
    return () => {
      for (const p of previews) {
        if (p.objectUrl) URL.revokeObjectURL(p.objectUrl);
      }
    };
  }, [previews]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    // Let the same file be picked again after being removed.
    e.target.value = "";
    if (picked.length === 0) return;

    const { accepted, rejected } = validateChatFiles(picked, files.length);
    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    for (const r of rejected) {
      toast.error(`${r.file.name} was not added — ${r.reason}.`);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canSend = (input.trim().length > 0 || files.length > 0) && !isSending && !disabled;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    try {
      await onSend(input.trim(), files);
      setInput("");
      setFiles([]);
    } catch {
      // Keep the draft; the caller's mutation reports the failure.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-100 p-4 dark:border-zinc-800">
      {previews.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {previews.map((p, i) => (
            <li
              key={`${p.file.name}-${i}`}
              className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pr-8 dark:border-zinc-700 dark:bg-zinc-800/60"
            >
              {p.objectUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.objectUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 dark:bg-zinc-700">
                  <FileText className="h-5 w-5 text-slate-500 dark:text-zinc-400" />
                </div>
              )}
              <div className="min-w-0 max-w-[10rem]">
                <p className="truncate text-xs font-medium text-slate-700 dark:text-zinc-200">
                  {p.file.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {formatFileSize(p.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={isSending}
                aria-label={`Remove ${p.file.name}`}
                className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={CHAT_ATTACHMENT_ACCEPT}
          onChange={handlePick}
          className="hidden"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-xl"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending || files.length >= CHAT_MAX_FILES}
          aria-label="Attach files"
          title={
            files.length >= CHAT_MAX_FILES
              ? `Up to ${CHAT_MAX_FILES} files per message`
              : "Attach files"
          }
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onTyping?.();
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 rounded-xl border-slate-200/80 bg-background dark:border-zinc-700"
          maxLength={2000}
        />
        <Button
          type="submit"
          size="icon"
          className="shrink-0 rounded-xl"
          disabled={!canSend}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { updatePost } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { invalidatePostListQueries } from "../../lib/post-list-queries";
import { Button } from "../ui/button";
import { toast } from "sonner";
import type { Post } from "../../types/post";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import { MentionSuggestions, mentionOptionId } from "../mention-suggestions";

/** Matches the limit enforced by the create-post form. */
const CAPTION_MAX = 500;

type FeedData = {
  pages: Array<{ posts: Post[]; pagination?: unknown }>;
  pageParams: unknown[];
};

/**
 * Caption editor for a published post. The backend only accepts a caption on
 * PATCH /posts/:id, so this is deliberately a single-field edit rather than a
 * reuse of the full create-post form.
 */
export function EditPostModal({
  open,
  post,
  onClose,
}: {
  open: boolean;
  post: Post;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [caption, setCaption] = React.useState(post.caption ?? "");
  const mentions = useMentionAutocomplete<HTMLTextAreaElement>();

  // Reseed from the post each time the dialog opens so a cancelled edit is discarded.
  React.useEffect(() => {
    if (open) setCaption(post.caption ?? "");
  }, [open, post.caption]);

  const m = useMutation({
    mutationFn: () => updatePost(post._id, caption.trim()),
    onSuccess: (data) => {
      const nextCaption = data.post?.caption ?? caption.trim();
      qc.setQueriesData<FeedData>({ queryKey: ["feed"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p._id === post._id ? { ...p, caption: nextCaption } : p
            ),
          })),
        };
      });
      invalidatePostListQueries(qc);
      void qc.invalidateQueries({ queryKey: ["post", post._id] });
      toast.success("Post updated");
      onClose();
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (!open) return null;

  const tooLong = caption.length > CAPTION_MAX;
  const unchanged = caption.trim() === (post.caption ?? "").trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit post"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Edit caption</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/*
         * min-h-0 + flex-1 + overflow-y-auto: the mention dropdown below is
         * position:absolute inside this region, so this container's overflow
         * clips it — it can grow into its own scroll area but can never paint
         * over the footer, which lives outside this region entirely. That's a
         * structural guarantee (CSS clipping), not a "there's probably enough
         * space" one: it holds regardless of dropdown height or result count.
         */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          <div className="relative">
            <textarea
              ref={mentions.fieldRef}
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                mentions.sync(e.currentTarget);
              }}
              onClick={(e) => mentions.sync(e.currentTarget)}
              onKeyUp={(e) => mentions.sync(e.currentTarget)}
              onKeyDown={(e) => {
                if (mentions.suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    mentions.moveHighlight(1);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    mentions.moveHighlight(-1);
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const next = mentions.selectHighlighted();
                    if (next !== null) setCaption(next);
                    return;
                  }
                }
                if (e.key === "Escape") mentions.dismiss();
              }}
              onBlur={() => mentions.dismiss()}
              placeholder="What's happening? Use @ to mention someone or # for hashtags"
              maxLength={CAPTION_MAX}
              autoFocus
              aria-activedescendant={
                mentions.highlightedIndex >= 0
                  ? mentionOptionId(mentions.listboxId, mentions.suggestions[mentions.highlightedIndex]?._id ?? "")
                  : undefined
              }
              className="min-h-[108px] w-full resize-y rounded-2xl border border-slate-200/50 bg-white/45 px-4 py-3.5 text-sm leading-relaxed shadow-sm ring-offset-background transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 dark:border-zinc-700/50 dark:bg-zinc-900/35 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <MentionSuggestions
              listboxId={mentions.listboxId}
              users={mentions.suggestions}
              highlightedIndex={mentions.highlightedIndex}
              onHighlight={mentions.highlight}
              onSelect={(u) => {
                const next = mentions.select(u);
                if (next !== null) setCaption(next);
              }}
            />
          </div>
          <p
            className={
              tooLong ? "text-xs text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {caption.length} / {CAPTION_MAX}
          </p>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4 dark:border-zinc-800">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={m.isPending}>
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-xl"
            onClick={() => m.mutate()}
            disabled={m.isPending || tooLong || unchanged}
          >
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

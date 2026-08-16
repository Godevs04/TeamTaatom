"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Trash2 } from "lucide-react";
import { addComment, deleteComment, getPostById } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { toast } from "sonner";
import type { Comment } from "../../types/post";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import { MentionSuggestions, mentionOptionId } from "../mention-suggestions";
import { subscribeSocket, unsubscribeSocket } from "../../lib/socket";

type PostCommentUpdate = { postId?: string };

export function TripComments({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const mentions = useMentionAutocomplete<HTMLInputElement>();
  const validId =
    typeof postId === "string" &&
    postId.length > 0 &&
    postId !== "undefined" &&
    /^[a-f0-9]{24}$/i.test(postId);

  const q = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPostById(postId),
    enabled: validId,
  });

  // Live comment updates (add/delete, from any user, any client). Global
  // broadcast -- filter to this post -- then refetch rather than hand-patch,
  // since comment payloads/threading are more complex to patch correctly than
  // a simple counter (mirrors chat:update's invalidate-not-patch choice).
  React.useEffect(() => {
    if (!validId) return;
    const onCommentUpdate = (payload: PostCommentUpdate) => {
      if (payload?.postId !== postId) return;
      qc.invalidateQueries({ queryKey: ["post", postId] });
    };
    subscribeSocket<PostCommentUpdate>("post:comment:update", onCommentUpdate);
    return () => unsubscribeSocket<PostCommentUpdate>("post:comment:update", onCommentUpdate);
  }, [validId, postId, qc]);

  const m = useMutation({
    mutationFn: async () => {
      if (!validId) throw new Error("Invalid post");
      return addComment(postId, text.trim());
    },
    onSuccess: async () => {
      setText("");
      toast.success("Comment added");
      await qc.invalidateQueries({ queryKey: ["post", postId] });
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: (commentId: string) => deleteComment(postId, commentId),
    onSuccess: async () => {
      toast.success("Comment deleted");
      await qc.invalidateQueries({ queryKey: ["post", postId] });
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  if (!validId) {
    return <p className="text-sm text-muted-foreground">Comments unavailable.</p>;
  }

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return <p className="text-sm text-destructive">Failed to load comments.</p>;
  }

  const comments: Comment[] = q.data.comments || [];
  const commentsDisabled = !!q.data.commentsDisabled;
  const postOwnerId = q.data.user?._id;
  /** Mirrors the backend rule: comment author or post owner. */
  const canDelete = (c: Comment) =>
    !!user && (c.user?._id === user._id || postOwnerId === user._id);

  const handleDelete = (commentId: string) => {
    setConfirmDeleteId(commentId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    del.mutate(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Comments</h3>
        <span className="text-sm text-muted-foreground">{comments.length}</span>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        {commentsDisabled ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Comments are disabled for this post
          </div>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">Sign in to comment.</p>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={mentions.fieldRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
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
                      if (next !== null) setText(next);
                      return;
                    }
                  }
                  if (e.key === "Escape") mentions.dismiss();
                }}
                onBlur={() => mentions.dismiss()}
                placeholder="Write a comment…"
                aria-activedescendant={
                  mentions.highlightedIndex >= 0
                    ? mentionOptionId(mentions.listboxId, mentions.suggestions[mentions.highlightedIndex]?._id ?? "")
                    : undefined
                }
              />
              <MentionSuggestions
                listboxId={mentions.listboxId}
                users={mentions.suggestions}
                highlightedIndex={mentions.highlightedIndex}
                onHighlight={mentions.highlight}
                onSelect={(u) => {
                  const next = mentions.select(u);
                  if (next !== null) setText(next);
                }}
              />
            </div>
            <Button disabled={m.isPending || text.trim().length === 0} onClick={() => m.mutate()}>
              {m.isPending ? "Posting…" : "Post"}
            </Button>
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c._id} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.user?.profilePic || ""} alt={c.user?.fullName || "User"} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.user?.fullName || c.user?.username || "User"}</span>
                  <span className="text-xs text-muted-foreground">@{c.user?.username || ""}</span>
                </div>
                <p className="mt-1 text-sm text-foreground/90">{c.text}</p>
              </div>
              {canDelete(c) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete comment"
                  disabled={del.isPending}
                  onClick={() => handleDelete(c._id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setConfirmDeleteId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Delete comment"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Delete this comment?</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" className="rounded-xl" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { addComment, deleteComment, getPostById } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { toast } from "sonner";
import type { Comment } from "../../types/post";

export function TripComments({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = React.useState("");
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
  const postOwnerId = q.data.user?._id;
  /** Mirrors the backend rule: comment author or post owner. */
  const canDelete = (c: Comment) =>
    !!user && (c.user?._id === user._id || postOwnerId === user._id);

  const handleDelete = (commentId: string) => {
    if (!window.confirm("Delete this comment? This action cannot be undone.")) return;
    del.mutate(commentId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Comments</h3>
        <span className="text-sm text-muted-foreground">{comments.length}</span>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        {!user ? (
          <p className="text-sm text-muted-foreground">Sign in to comment.</p>
        ) : (
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" />
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
    </div>
  );
}


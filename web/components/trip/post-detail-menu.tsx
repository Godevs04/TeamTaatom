"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Share2,
  Flag,
  Bookmark,
  Archive,
  Ban,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../../context/auth-context";
import { Button } from "../ui/button";
import {
  deletePost,
  archivePost,
  createReport,
  blockUser,
  type ReportReason,
} from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { invalidatePostListQueries } from "../../lib/post-list-queries";
import type { Post } from "../../types/post";
import { EditPostModal } from "./edit-post-modal";
import { SharePostModal } from "./share-post-modal";
import { AddToCollectionModal } from "./AddToCollectionModal";
import { cn } from "../../lib/utils";

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abuse" },
  { id: "inappropriate_content", label: "Inappropriate Content" },
  { id: "harassment", label: "Harassment" },
  { id: "other", label: "Other" },
];

export function PostDetailMenu({ post }: { post: Post }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();

  const isOwner = !!currentUser && (
    (typeof post.user === "string" ? post.user : post.user?._id) === currentUser._id
  );

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [collectionOpen, setCollectionOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/trip/${post._id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Post link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    } finally {
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post? This cannot be undone.")) return;
    setLoading(true);
    setMenuOpen(false);
    try {
      await deletePost(post._id);
      invalidatePostListQueries(qc);
      toast.success("Post deleted");
      router.push("/");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm("Archive this post? It will be hidden from your public profile.")) return;
    setLoading(true);
    setMenuOpen(false);
    try {
      await archivePost(post._id);
      invalidatePostListQueries(qc);
      toast.success("Post archived");
      router.refresh();
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const reportMutation = useMutation({
    mutationFn: (reason: ReportReason) =>
      createReport({
        type: reason,
        reportedUserId: typeof post.user === "string" ? post.user : post.user?._id,
        postId: post._id,
        reason: REPORT_REASONS.find((r) => r.id === reason)?.label ?? reason,
      }),
    onSuccess: () => {
      toast.success("Report submitted. Thank you for your feedback.");
      setReportOpen(false);
      setMenuOpen(false);
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const blockMutation = useMutation({
    mutationFn: () => {
      const authorId = typeof post.user === "string" ? post.user : post.user?._id;
      if (!authorId) throw new Error("Unknown user");
      return blockUser(authorId);
    },
    onSuccess: () => {
      toast.success("User blocked");
      setMenuOpen(false);
      router.push("/");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const handleBlockClick = () => {
    const authorName = typeof post.user === "object" && post.user ? (post.user.fullName || post.user.username) : "this user";
    if (window.confirm(`Block ${authorName}? You won't see their posts or profile.`)) {
      blockMutation.mutate();
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-full p-0"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More options"
          disabled={loading}
        >
          <MoreHorizontal className="h-4 w-4 text-slate-700 dark:text-zinc-300" />
        </Button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-2xl border border-slate-200/80 bg-white py-1.5 shadow-xl dark:border-zinc-700/80 dark:bg-zinc-900">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={handleCopyLink}
            >
              <Share2 className="h-4 w-4" />
              Copy link
            </button>

            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => {
                setCollectionOpen(true);
                setMenuOpen(false);
              }}
            >
              <Bookmark className="h-4 w-4" />
              Save to collection
            </button>

            {isOwner ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => {
                    setEditOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit post
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={handleArchive}
                >
                  <Archive className="h-4 w-4" />
                  Archive post
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete post
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => {
                    setReportOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Flag className="h-4 w-4" />
                  Report post
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={handleBlockClick}
                  disabled={blockMutation.isPending}
                >
                  <Ban className="h-4 w-4" />
                  Block user
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editOpen && (
        <EditPostModal
          post={post}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            qc.invalidateQueries({ queryKey: ["post", post._id] });
            router.refresh();
          }}
        />
      )}

      {shareOpen && (
        <SharePostModal
          post={post}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}

      {collectionOpen && (
        <AddToCollectionModal
          postId={post._id}
          visible={collectionOpen}
          onClose={() => setCollectionOpen(false)}
        />
      )}

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReportOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="report-post-title"
          >
            <h3 id="report-post-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Report post
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Why are you reporting this post?
            </p>
            <ul className="mt-4 space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={reportMutation.isPending}
                    className={cn(
                      "w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition",
                      "text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    )}
                    onClick={() => reportMutation.mutate(r.id)}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full rounded-xl"
              onClick={() => setReportOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

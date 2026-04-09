"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCollections, addPostToCollection, type Collection } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { Button } from "../ui/button";
import { X, FolderOpen } from "lucide-react";
import { toast } from "sonner";

type AddToCollectionModalProps = {
  visible: boolean;
  postId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AddToCollectionModal({
  visible,
  postId,
  onClose,
  onSuccess,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (visible) {
      setLoading(true);
      getCollections()
        .then((res) => setCollections(res.collections ?? []))
        .catch(() => toast.error("Failed to load collections"))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const handleAdd = async (collectionId: string) => {
    setAddingId(collectionId);
    try {
      await addPostToCollection(collectionId, postId);
      toast.success("Post added to collection");
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["collection", collectionId] });
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setAddingId(null);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add to collection"
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Add to Collection</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-12 text-sm text-slate-500 dark:text-zinc-400">Loading…</div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="mb-3 h-12 w-12 text-slate-300 dark:text-zinc-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">No collections</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">Create a collection first in Settings</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {collections.map((col) => (
                <li key={col._id}>
                  <button
                    type="button"
                    disabled={addingId === col._id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-zinc-800/80"
                    onClick={() => handleAdd(col._id)}
                  >
                    {col.coverImage ? (
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={col.coverImage} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800">
                        <FolderOpen className="h-6 w-6 text-slate-400 dark:text-zinc-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{col.name}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {col.posts?.length ?? 0} {(col.posts?.length ?? 0) === 1 ? "post" : "posts"}
                      </p>
                    </div>
                    {addingId === col._id && (
                      <span className="text-xs text-slate-500 dark:text-zinc-400">Adding…</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

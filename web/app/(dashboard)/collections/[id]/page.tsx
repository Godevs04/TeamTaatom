"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCollection, removePostFromCollection, deleteCollection } from "../../../../lib/api";
import { getFriendlyErrorMessage } from "../../../../lib/auth-errors";
import { Button } from "../../../../components/ui/button";
import { ArrowLeft, ImageIcon, Trash2 } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollection(id),
    enabled: !!id,
  });

  const removePost = useMutation({
    mutationFn: ({ postId }: { postId: string }) => removePostFromCollection(id, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collection", id] });
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const deleteCol = useMutation({
    mutationFn: () => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      window.location.href = "/collections";
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const collection = data?.collection;
  const posts = collection?.posts ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="aspect-[3/1] w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !collection) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
        <p className="text-slate-600">Collection not found.</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link href="/collections">Back to Collections</Link>
        </Button>
      </div>
    );
  }

  const coverUrl = collection.coverImage ?? posts[0]?.imageUrl ?? posts[0]?.thumbnailUrl;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-xl" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{collection.name}</h1>
            {collection.description && <p className="mt-1 text-sm text-slate-500">{collection.description}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => window.confirm("Delete this collection?") && deleteCol.mutate()}
          disabled={deleteCol.isPending}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium">
        <div className="aspect-[3/1] w-full bg-slate-100">
          {coverUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <ImageIcon className="h-16 w-16" />
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Posts ({posts.length})</h2>
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
            <p className="text-slate-500">No posts in this collection yet.</p>
            <Link href="/feed" className="mt-4 inline-block">
              <Button className="rounded-xl">Browse feed to add posts</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((p) => (
              <div key={p._id} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium">
                <Link href={`/trip/${p._id}`} className="block aspect-square bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl || p.thumbnailUrl || p.mediaUrl || ""}
                    alt={p.caption || "Post"}
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Remove from collection"
                  onClick={() => removePost.mutate({ postId: p._id })}
                  disabled={removePost.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

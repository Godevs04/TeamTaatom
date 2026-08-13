"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Share2, Trash2, Pencil, Check, X, Video, Images } from "lucide-react";
import { toast } from "sonner";
import { JourneyRouteMap } from "@/components/maps/journey-route-map";
import { journeyGetDetail, journeyDelete, journeyUpdateTitle } from "@/lib/journey-api";
import { createJourneyShortUrl } from "@/lib/api";
import { getDefaultJourneyShareUrl } from "@/lib/post-share-chat";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { Journey, JourneyWaypointPost } from "@/types/journey";

function getWaypointThumbnail(post: JourneyWaypointPost): string | null {
  if (post.images && post.images.length > 0) return post.images[0];
  if (post.thumbnailUrl) return post.thumbnailUrl;
  if (post.imageUrl) return post.imageUrl;
  return null;
}

export default function JourneyDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: journey, isLoading, isError } = useQuery({
    queryKey: ["journey-detail", id],
    queryFn: () => journeyGetDetail(id),
    enabled: !!id,
  });
  const [sharing, setSharing] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");

  const start = journey?.startCoords;
  const polyLen = journey?.polyline?.length ?? 0;
  const waypoints = journey?.waypoints ?? [];
  const waypointPosts = waypoints.filter(
    (w): w is typeof w & { post: JourneyWaypointPost } => !!w.post
  );

  const handleShare = async () => {
    setSharing(true);
    try {
      const shortUrl = await createJourneyShortUrl(id);
      await navigator.clipboard.writeText(shortUrl ?? getDefaultJourneyShareUrl(id));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    } finally {
      setSharing(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => journeyDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys-user"] });
      toast.success("Journey deleted");
      router.push("/journeys");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const updateTitleMutation = useMutation({
    mutationFn: (title: string) => journeyUpdateTitle(id, title),
    onSuccess: (updated) => {
      queryClient.setQueryData(["journey-detail", id], (prev: Journey | undefined) =>
        prev ? { ...prev, title: updated?.title ?? prev.title } : prev
      );
      setIsEditingTitle(false);
      toast.success("Journey renamed");
    },
    onError: (e: unknown) => toast.error(getFriendlyErrorMessage(e)),
  });

  const startEditingTitle = () => {
    setTitleDraft(journey?.title ?? "");
    setIsEditingTitle(true);
  };

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === journey?.title) {
      setIsEditingTitle(false);
      return;
    }
    updateTitleMutation.mutate(trimmed);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${journey?.title || "this journey"}"? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24 lg:pb-10">
      <Link href="/journeys" className="text-sm font-medium text-primary hover:underline">
        ← All journeys
      </Link>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-9 w-9 animate-spin text-primary" />
        </div>
      )}
      {isError && <p className="text-destructive">Unable to load this journey.</p>}
      {journey && (
        <>
          <div className="flex items-start justify-between gap-3">
            {isEditingTitle ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  onBlur={saveTitle}
                  maxLength={100}
                  disabled={updateTitleMutation.isPending}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 font-display text-xl font-semibold text-slate-900 outline-none focus:border-primary dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                />
                <button
                  type="button"
                  aria-label="Save title"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={saveTitle}
                  disabled={updateTitleMutation.isPending}
                  className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/40"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsEditingTitle(false)}
                  disabled={updateTitleMutation.isPending}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <h1 className="truncate font-display text-2xl font-semibold text-slate-900 dark:text-white">
                  {journey.title || "Journey"}
                </h1>
                <button
                  type="button"
                  aria-label="Rename journey"
                  title="Rename journey"
                  onClick={startEditingTitle}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                aria-label="Copy journey share link"
                title="Copy share link"
                className="mt-1 flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                aria-label="Delete journey"
                title="Delete journey"
                className="mt-1 flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-zinc-800 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{journey.status ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Distance</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  {typeof journey.distanceTraveled === "number"
                    ? `${(journey.distanceTraveled / 1000).toFixed(2)} km`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">GPS points</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{polyLen}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Started</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{journey.startedAt ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Completed</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{journey.completedAt ?? "—"}</dd>
              </div>
            </dl>
          </div>
          <JourneyRouteMap
            polyline={journey.polyline}
            startCoords={start ?? null}
            waypoints={waypointPosts.map((w) => ({
              lat: w.lat,
              lng: w.lng,
              postId: w.post._id,
              thumbnailUrl: getWaypointThumbnail(w.post),
              contentType: w.contentType,
            }))}
          />
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Full route replay works best in the mobile app. On web, tracking runs while this tab stays open with location permission.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Posts from this journey</h2>
            {waypointPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200/80 p-8 text-center dark:border-zinc-800">
                <Images className="h-8 w-8 text-slate-400 dark:text-zinc-600" />
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  No posts were made during this journey.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {waypointPosts.map((w, i) => {
                  const post = w.post;
                  const thumb = getWaypointThumbnail(post);
                  const isVideo = w.contentType === "video" || w.contentType === "short";
                  return (
                    <li key={post._id || i}>
                      <Link
                        href={`/trip/${post._id}`}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition hover:border-primary/25 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/70"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              {isVideo ? <Video className="h-5 w-5" /> : <Images className="h-5 w-5" />}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {post.caption || "No caption"}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-zinc-400">
                            {isVideo ? <Video className="h-3 w-3" /> : <Images className="h-3 w-3" />}
                            {w.contentType || "photo"}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

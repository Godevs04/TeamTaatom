"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2 } from "lucide-react";
import { getLongVideoById } from "../../lib/api";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import type { AdSlot } from "../../lib/long-video-ad-schedule";
import type { Post } from "../../types/post";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { TripComments } from "../trip/comments";
import { PostDetailActionBar } from "../trip/post-detail-action-bar";
import { SharePostModal } from "../trip/share-post-modal";
import { WatchPlayer } from "./watch-player";
import { ExpandableText } from "../ui/expandable-text";
import { canShowWatchAdBreak, getAdSenseWatchBreakSlot } from "../../lib/adsense";
import { AdSenseUnit } from "../ads/adsense-unit";

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return "";
  const s = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function normalizeWatchPost(raw: Post): Post {
  const videoUrl = raw.videoUrl || raw.mediaUrl || "";
  const looksLikeImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test((videoUrl || "").split("?")[0] || "");
  const playable = looksLikeImage ? raw.videoUrl || "" : videoUrl;
  return {
    ...raw,
    type: "long_video",
    caption: raw.caption || "",
    videoUrl: playable || raw.videoUrl || "",
    mediaUrl: playable || raw.mediaUrl || "",
    thumbnailUrl: raw.thumbnailUrl || raw.imageUrl,
    imageUrl: raw.imageUrl || raw.thumbnailUrl,
  };
}

export function WatchDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = React.useState(false);

  const q = useQuery({
    queryKey: ["long-video", id],
    queryFn: () => getLongVideoById(id),
    enabled: !!id && /^[a-f0-9]{24}$/i.test(id),
  });

  const post = React.useMemo(
    () => (q.data ? normalizeWatchPost(q.data) : null),
    [q.data]
  );

  const videoUrl = post?.videoUrl || post?.mediaUrl || "";
  const posterUrl = post?.thumbnailUrl || post?.imageUrl || undefined;
  const adSchedule = post?.adSchedule
    ? {
        slots: (post.adSchedule.slots ?? []).map((s) => ({
          atSeconds: s.atSeconds,
          type: (s.type === "interstitial" ? "interstitial" : "rewarded") as AdSlot["type"],
          preferRewarded: s.preferRewarded,
        })),
      }
    : undefined;
  const watchSlot = getAdSenseWatchBreakSlot();

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 pb-16">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (q.isError || !post) {
    return (
      <div className="mx-auto max-w-3xl pb-16">
        <Card className="space-y-4 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {q.isError ? getFriendlyErrorMessage(q.error) : "Video not found."}
          </p>
          <Button type="button" variant="outline" onClick={() => router.push("/feed?tab=watch")}>
            Back to Videos
          </Button>
        </Card>
      </div>
    );
  }

  const creatorName = post.user?.fullName || post.user?.username || "Creator";
  const durationLabel = formatDuration(post.durationSeconds);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 pb-16">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[10px] font-extrabold tracking-[0.16em] text-primary">VIDEOS</p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">Now playing</p>
        </div>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-label="Share video"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>

      {videoUrl ? (
        <WatchPlayer
          videoUrl={videoUrl}
          posterUrl={posterUrl}
          durationSeconds={post.durationSeconds}
          adSchedule={adSchedule}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <Card className="flex aspect-video items-center justify-center bg-black text-sm text-white/70">
          Video unavailable
        </Card>
      )}

      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6">
        {post.caption ? (
          <ExpandableText
            text={post.caption}
            maxLines={3}
            charLimit={200}
            className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-2xl"
            linkClassName="text-primary"
          />
        ) : (
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-2xl">
            Untitled journey
          </h1>
        )}

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
          <Link
            href={`/profile/${post.user?._id}`}
            className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800"
          >
            {post.user?.profilePic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.user.profilePic}
                alt={creatorName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                {creatorName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/profile/${post.user?._id}`}
              className="block truncate font-semibold text-slate-900 hover:underline dark:text-zinc-50"
            >
              {creatorName}
            </Link>
            <p className="truncate text-xs font-medium text-slate-500 dark:text-zinc-400">
              Long-form on Videos
              {durationLabel ? ` · ${durationLabel}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <PostDetailActionBar post={post} />
        </div>
      </div>

      {canShowWatchAdBreak() && watchSlot ? (
        <AdSenseUnit
          slot={watchSlot}
          format="fluid"
          layout="in-article"
          className="rounded-2xl border border-slate-200/60 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ) : null}

      <section id="comments" className="space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-zinc-50">Conversation</h2>
          <TripComments postId={id} />
        </div>
      </section>

      <SharePostModal post={post} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}

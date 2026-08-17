import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../lib/constants";
import { Card } from "../../../../components/ui/card";
import type { Post } from "../../../../types/post";
import { getPostDisplayLocation, getPostCoordinates } from "../../../../lib/post-utils";
import { TripLocationMap } from "../../../../components/maps/trip-location-map";
import { fetchWithAuth } from "../../../../lib/server-fetch";
import { TripComments } from "../../../../components/trip/comments";
import { ExpandableText } from "../../../../components/ui/expandable-text";
import { PostDetailMenu } from "../../../../components/trip/post-detail-menu";
import { PostDetailActionBar } from "../../../../components/trip/post-detail-action-bar";
import { PostDetailMedia } from "../../../../components/trip/post-detail-media";
import { createMetadata } from "../../../../lib/seo";
import { MapPin, Music } from "lucide-react";

async function fetchPost(id: string): Promise<Post | null> {
  const res = await fetchWithAuth(`${API_V1_ABS}/posts/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { post?: Post };
  return data.post ?? null;
}

export async function generateMetadata({ params }: { params: { id?: string } }): Promise<Metadata> {
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) return createMetadata({ title: "Trip", path: "/trip" });
  const post = await fetchPost(id);
  const title = post?.caption ? post.caption.slice(0, 60) : "Trip";
  const description = getPostDisplayLocation(post) !== "Unknown location" ? getPostDisplayLocation(post) : "Trip on Taatom";
  const image = post?.imageUrl || post?.thumbnailUrl;
  return createMetadata({
    title,
    description,
    image: image ?? null,
    path: `/trip/${id}`,
    openGraphType: "article",
    ogImageSize: { width: 1200, height: 630 },
    ogImageAlt: title,
  });
}

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const id = typeof params.id === "string" ? params.id : "";
  if (!id) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Invalid trip.</p>
        </Card>
      </div>
    );
  }
  const post = await fetchPost(id);
  if (!post) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Trip not found.</p>
        </Card>
      </div>
    );
  }

  const isShort = post.type === "short";
  const videoUrl = post.videoUrl || post.mediaUrl || "";
  const posterUrl = post.imageUrl || post.thumbnailUrl || undefined;
  const media = post.imageUrl || post.thumbnailUrl || post.mediaUrl || "";
  const user = post.user;
  const imagesArray = post.images ?? post.imageUrls;
  const images: string[] = (imagesArray?.length ? imagesArray : [media]).filter(
    (src): src is string => typeof src === "string" && src.length > 0
  );
  const coords = getPostCoordinates(post);
  const hasCoords = coords !== null;
  const audioUrl = post.song?.s3Url;
  const locationText = getPostDisplayLocation(post);

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${user?._id}`} className="group relative block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80">
              {user?.profilePic ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.profilePic}
                  alt={user.fullName || "User"}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-semibold text-primary">
                  {(user?.fullName || user?.username || "T").charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
            <div className="min-w-0">
              <Link href={`/profile/${user?._id}`} className="truncate block font-semibold text-slate-900 hover:underline dark:text-zinc-50">
                {user?.fullName || user?.username || "Traveler"}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <span>@{user?.username || "user"}</span>
                {locationText && locationText !== "Unknown location" && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 truncate text-primary font-medium">
                      <MapPin className="h-3 w-3" />
                      {locationText}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <PostDetailMenu post={post} />
        </div>

        <PostDetailMedia
          images={images}
          caption={post.caption}
          isShort={isShort}
          videoUrl={videoUrl}
          posterUrl={posterUrl}
        />

        <PostDetailActionBar post={post} />

        {post.caption ? (
          <ExpandableText
            text={post.caption}
            maxLines={4}
            charLimit={220}
            className="text-base text-slate-800 dark:text-zinc-200"
            linkClassName="text-primary font-medium"
          />
        ) : null}
      </div>

      {/* Audio / Location Details */}
      {(audioUrl || hasCoords) && (
        <div className="grid gap-4 md:grid-cols-2">
          {audioUrl ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <Music className="h-4 w-4" />
                Attached Soundtrack
              </div>
              <h3 className="mt-1 font-semibold text-slate-900 dark:text-zinc-50">
                {post.song?.title || "Track"}
              </h3>
              {post.song?.artist && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">{post.song.artist}</p>
              )}
              <audio className="mt-4 w-full" controls preload="none" src={audioUrl} />
            </div>
          ) : null}

          {coords ? (
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <h3 className="mt-1 font-semibold text-slate-900 dark:text-zinc-50 truncate">
                {locationText}
              </h3>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 dark:border-zinc-800">
                <TripLocationMap
                  latitude={coords.lat}
                  longitude={coords.lng}
                  label={locationText}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Comments Section */}
      <section id="comments" className="space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-zinc-50">
            Comments
          </h2>
          <TripComments postId={id} />
        </div>
      </section>
    </div>
  );
}

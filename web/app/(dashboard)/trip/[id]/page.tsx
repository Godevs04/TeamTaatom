import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../lib/constants";
import { Card } from "../../../../components/ui/card";
import type { Post } from "../../../../types/post";
import { getPostDisplayLocation, getPostCoordinates } from "../../../../lib/post-utils";
import { fetchWithAuth } from "../../../../lib/server-fetch";
import { TripComments } from "../../../../components/trip/comments";
import { createMetadata } from "../../../../lib/seo";

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
  const image = post?.imageUrl || post?.thumbnailUrl || post?.mediaUrl;
  return createMetadata({
    title,
    description,
    image: image ?? null,
    path: `/trip/${id}`,
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

  const media = post.imageUrl || post.thumbnailUrl || post.mediaUrl || "";
  const user = post.user;
  const imagesArray = post.images ?? post.imageUrls;
  const images: string[] = (imagesArray?.length ? imagesArray : [media]).filter(
    (src): src is string => typeof src === "string" && src.length > 0
  );
  const coords = getPostCoordinates(post);
  const hasCoords = coords !== null;
  const audioUrl = post.song?.s3Url;
  const primaryImageUrl = images[0] || "";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 md:gap-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{post.caption || "Trip"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{getPostDisplayLocation(post)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user?.profilePic || ""} alt={user?.fullName || "User"} className="h-full w-full object-cover" />
            </div>
            <div className="leading-tight">
              <Link href={`/profile/${user?._id}`} className="text-sm font-semibold hover:underline">
                {user?.fullName || user?.username || "Traveler"}
              </Link>
              <div className="text-xs text-muted-foreground">@{user?.username || "user"}</div>
            </div>
            <div className="flex-1" />
            <div className="text-xs font-semibold text-muted-foreground">
              {post.likesCount ?? 0} likes · {post.commentsCount ?? 0} comments
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border bg-card shadow-card">
        <div className="aspect-[16/10] w-full bg-muted">
          {primaryImageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={primaryImageUrl} alt={post.caption || "Trip"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <span className="text-sm">{post.caption || "Trip"}</span>
            </div>
          )}
        </div>
        {images.length > 1 ? (
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-4 sm:p-3">
            {images.slice(0, 8).map((src) => (
              <div key={src} className="aspect-square overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Trip media" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {(audioUrl || hasCoords) && (
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {audioUrl ? (
            <div className="rounded-3xl border bg-card p-4 shadow-card sm:p-5">
              <h2 className="text-lg font-semibold">Audio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {post.song?.title ? `${post.song.title}${post.song.artist ? ` · ${post.song.artist}` : ""}` : "Attached track"}
              </p>
              <audio className="mt-4 w-full" controls preload="none" src={audioUrl} />
            </div>
          ) : null}

          {coords ? (
            <div className="rounded-3xl border bg-card p-4 shadow-card sm:p-5">
              <h2 className="text-lg font-semibold">Location</h2>
              <p className="mt-1 text-sm text-muted-foreground">{getPostDisplayLocation(post)}</p>
              <div className="mt-4 overflow-hidden rounded-2xl border bg-muted">
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                  <iframe
                    title="Map"
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(coords.lat + "," + coords.lng)}&zoom=14`}
                  />
                ) : (
                  <iframe
                    title="Map"
                    className="h-64 w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.openstreetmap.org/export/embed.html?marker=${coords.lat},${coords.lng}&zoom=13`}
                  />
                )}
              </div>
              <div className="mt-3 text-sm">
                <Link
                  className="font-semibold text-primary hover:underline"
                  href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <section id="comments" className="space-y-3">
        <TripComments postId={id} />
      </section>
    </div>
  );
}

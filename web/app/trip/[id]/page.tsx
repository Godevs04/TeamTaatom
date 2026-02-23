import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../lib/constants";
import { Card } from "../../../components/ui/card";
import type { Post } from "../../../types/post";
import { fetchWithAuth } from "../../../lib/server-fetch";
import { TripComments } from "../../../components/trip/comments";
import { createMetadata } from "../../../lib/seo";

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
  const description = post?.address || "Trip on Taatom";
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
  const hasCoords = typeof post.latitude === "number" && typeof post.longitude === "number";
  const audioUrl = post.song?.s3Url;
  const primaryImageUrl = images[0] || "";

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-balance text-3xl font-semibold tracking-tight">{post.caption || "Trip"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{post.address || "Unknown location"}</p>
          <div className="mt-4 flex items-center gap-3">
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
          <div className="grid grid-cols-4 gap-2 p-3">
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
        <div className="grid gap-6 md:grid-cols-2">
          {audioUrl ? (
            <div className="rounded-3xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-semibold">Audio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {post.song?.title ? `${post.song.title}${post.song.artist ? ` · ${post.song.artist}` : ""}` : "Attached track"}
              </p>
              <audio className="mt-4 w-full" controls preload="none" src={audioUrl} />
            </div>
          ) : null}

          {hasCoords ? (
            <div className="rounded-3xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-semibold">Location</h2>
              <p className="mt-1 text-sm text-muted-foreground">{post.address || "Pinned location"}</p>
              <div className="mt-4 overflow-hidden rounded-2xl border bg-muted">
                <iframe
                  title="Map"
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.openstreetmap.org/export/embed.html?marker=${post.latitude},${post.longitude}&zoom=13`}
                />
              </div>
              <div className="mt-3 text-sm">
                <Link
                  className="font-semibold text-primary hover:underline"
                  href={`https://www.google.com/maps?q=${post.latitude},${post.longitude}`}
                  target="_blank"
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


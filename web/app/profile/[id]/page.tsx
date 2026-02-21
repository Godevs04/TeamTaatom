import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../lib/constants";
import { fetchWithAuth } from "../../../lib/server-fetch";
import { Card } from "../../../components/ui/card";
import type { User } from "../../../types/user";
import type { Post } from "../../../types/post";
import { createMetadata } from "../../../lib/seo";

async function getProfile(id: string) {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as { profile: User };
}

async function getPosts(id: string) {
  const res = await fetchWithAuth(`${API_V1_ABS}/posts/user/${id}?page=1&limit=24`);
  if (!res.ok) return { posts: [] as Post[] };
  return (await res.json()) as { posts: Post[] };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const profileRes = await getProfile(params.id);
  const u = profileRes?.profile;
  const title = u ? `${u.fullName || u.username || "Traveler"} · Profile` : "Profile";
  const description = u?.bio ?? "View profile on Taatom";
  const image = u?.profilePic;
  return createMetadata({ title, description, image: image ?? null, path: `/profile/${params.id}` });
}

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const profileRes = await getProfile(params.id);
  if (!profileRes?.profile) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Profile not found.</p>
        </Card>
      </div>
    );
  }

  const u = profileRes.profile;
  const postsRes = await getPosts(params.id);
  const posts: Post[] = postsRes.posts || [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col gap-6 rounded-3xl border bg-card p-8 shadow-card md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.profilePic || ""} alt={u.fullName || "User"} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{u.fullName || u.username || "Traveler"}</h1>
            <p className="truncate text-sm text-muted-foreground">@{u.username || "user"}</p>
            {u.bio ? <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/90">{u.bio}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-center md:text-left">
          <div>
            <div className="text-xl font-semibold">{u.postsCount ?? posts.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">Trips</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{u.followersCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div>
            <div className="text-xl font-semibold">{u.followingCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Trips</h2>
          <span className="text-sm text-muted-foreground">{posts.length} items</span>
        </div>

        {posts.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No trips yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((p) => (
              <Link
                key={p._id}
                href={`/trip/${p._id}`}
                className="group overflow-hidden rounded-2xl border bg-card shadow-card"
              >
                <div className="aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl || p.thumbnailUrl || p.mediaUrl || ""}
                    alt={p.caption || "Trip"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <div className="line-clamp-1 text-sm font-semibold">{p.caption || "Trip"}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{p.address || "Unknown location"}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


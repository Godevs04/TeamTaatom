import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../lib/constants";
import { fetchWithAuth } from "../../../../lib/server-fetch";
import { Card } from "../../../../components/ui/card";
import { ProfileActions } from "../../../../components/profile/profile-actions";
import { getPostDisplayLocation } from "../../../../lib/post-utils";
import type { User } from "../../../../types/user";
import type { Post } from "../../../../types/post";
import { createMetadata } from "../../../../lib/seo";
import { Compass, MapPin } from "lucide-react";

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
  const avatarName = u.fullName || u.username || "Traveler";
  const avatarInitial = avatarName.trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-6 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80">
            {u.profilePic ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={u.profilePic} alt={avatarName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-violet-500/10">
                <span className="text-xl font-semibold text-primary/70">{avatarInitial}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
              {u.fullName || u.username || "Traveler"}
            </h1>
            <p className="truncate text-sm text-slate-500 dark:text-zinc-400">@{u.username || "user"}</p>
            {u.bio ? (
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-700 dark:text-zinc-300">{u.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="grid grid-cols-3 gap-6 text-center sm:text-left">
            <div>
              <div className="text-xl font-semibold text-slate-900 dark:text-zinc-50">{u.postsCount ?? posts.length ?? 0}</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Trips</div>
            </div>
            <div>
              <Link
                href={`/profile/${params.id}/followers?type=followers`}
                className="text-xl font-semibold text-slate-900 hover:underline dark:text-zinc-50"
              >
                {u.followersCount ?? 0}
              </Link>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Followers</div>
            </div>
            <div>
              <Link
                href={`/profile/${params.id}/followers?type=following`}
                className="text-xl font-semibold text-slate-900 hover:underline dark:text-zinc-50"
              >
                {u.followingCount ?? 0}
              </Link>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Following</div>
            </div>
          </div>
          <ProfileActions profile={u} />
        </div>
      </div>

      {u.tripScore != null && (
        <Link
          href={`/profile/${params.id}/tripscore`}
          className="block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-premium transition-shadow hover:shadow-premium-hover dark:border-zinc-800/80 dark:bg-zinc-900/90"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-50 text-2xl font-bold text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
                {u.tripScore.totalScore ?? 0}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">TripScore</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {u.tripScore.countries ? Object.keys(u.tripScore.countries).length : 0} countries
                  {u.tripScore.totalScore ? ` · ${u.tripScore.totalScore} places` : ""}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium text-sky-600">View travel map →</span>
          </div>
        </Link>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-50">Trips</h2>
            <Link
              href={`/profile/${params.id}/shorts`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Shorts →
            </Link>
          </div>
          <span className="text-sm text-slate-500 dark:text-zinc-400">{posts.length} items</span>
        </div>

        {posts.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/80 p-10 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 ring-1 ring-slate-200/80 dark:ring-zinc-700/80">
              <Compass className="h-7 w-7 text-primary/75" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">No trips yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">When this traveler shares a place, it will appear here.</p>
            <Link
              href="/feed"
              className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <MapPin className="h-4 w-4" />
              Browse recent trips
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((p) => (
              <Link
                key={p._id}
                href={`/trip/${p._id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium transition-shadow hover:shadow-premium-hover dark:border-zinc-800/80 dark:bg-zinc-900/90"
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
                <div className="flex flex-1 flex-col justify-center p-3">
                  <div className="min-h-[20px] line-clamp-1 text-sm font-semibold">
                    {p.caption || "Trip"}
                  </div>
                  <div className="min-h-[18px] line-clamp-1 text-xs text-muted-foreground">
                    {getPostDisplayLocation(p)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

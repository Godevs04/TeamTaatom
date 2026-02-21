import Link from "next/link";
import { API_V1_ABS } from "../../lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import type { Post } from "../../types/post";
import type { User } from "../../types/user";

function isUser(x: unknown): x is User {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return typeof obj._id === "string";
}

async function getFeatured() {
  const res = await fetch(`${API_V1_ABS}/posts?page=1&limit=9`, {
    // public landing: cache lightly
    next: { revalidate: 60 },
  });
  if (!res.ok) return { posts: [] as Post[] };
  return (await res.json()) as { posts?: Post[] };
}

export default async function LandingPage() {
  const { posts } = await getFeatured();
  const featured = (posts || []).slice(0, 6);
  const travelers: User[] = Array.from(
    new Map(
      (posts || [])
        .map((p) => p.user)
        .filter(isUser)
        .map((u) => [u._id, u])
    ).values()
  ).slice(0, 6);

  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-[2.25rem] border bg-gradient-to-br from-slate-50 via-white to-slate-100 px-8 py-14 shadow-soft dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 md:px-12 md:py-18">
        <div className="absolute inset-0 opacity-[0.35] [background:radial-gradient(60%_60%_at_70%_0%,hsl(var(--primary))_0%,transparent_60%)]" />
        <div className="relative grid gap-10 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.1fr)] md:items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold text-primary/80 shadow-sm backdrop-blur">
              Premium travel social · Web
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-[2.9rem]">
              Travel stories that feel alive.
            </h1>
            <p className="max-w-xl text-pretty text-[0.98rem] leading-7 text-muted-foreground">
              Discover trips, locations, and creators. Share posts with photos, location, and music —
              like Instagram meets Airbnb for travelers.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/feed"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-95"
              >
                Explore feed
              </Link>
              <Link
                href="/auth/register"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-background/80 px-5 text-sm font-semibold text-foreground hover:bg-accent"
              >
                Create account
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            {featured.slice(0, 4).map((p) => (
              <Link
                key={p._id}
                href={`/trip/${p._id}`}
                className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-card shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="aspect-[4/3] w-full bg-muted">
                  {/* Using img for flexible remote domains (premium later can move to next/image allowlist) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl || p.thumbnailUrl || p.mediaUrl || ""}
                    alt={p.caption || "Trip"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="p-3.5">
                  <div className="line-clamp-1 text-sm font-semibold">{p.user?.fullName || "Traveler"}</div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{p.address || "Unknown location"}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-100 shadow-soft">
          <CardHeader>
            <CardTitle>Featured trips</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {featured.length === 0 ? (
              <p className="text-sm text-muted-foreground">No featured trips yet.</p>
            ) : (
              featured.map((p) => (
                <Link
                  key={p._id}
                  href={`/trip/${p._id}`}
                  className="group flex items-center gap-3 rounded-2xl p-2.5 hover:bg-accent/70"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-xl bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl || p.thumbnailUrl || p.mediaUrl || ""}
                      alt={p.caption || "Trip"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[0.9rem] font-semibold">{p.caption || "Untitled trip"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.address || "Unknown location"}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-soft">
          <CardHeader>
            <CardTitle>Trending travelers</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {travelers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No travelers yet.</p>
            ) : (
              travelers.map((u) => (
                <Link
                  key={u._id}
                  href={`/profile/${u._id}`}
                  className="group flex items-center justify-between rounded-2xl p-2.5 hover:bg-accent/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u.profilePic || ""} alt={u.fullName || "User"} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{u.fullName || u.username || "Traveler"}</div>
                      <div className="text-xs text-muted-foreground">@{u.username || "user"}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">View</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}


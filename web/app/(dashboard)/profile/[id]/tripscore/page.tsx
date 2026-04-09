import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../../lib/constants";
import { fetchWithAuth } from "../../../../../lib/server-fetch";
import { Card } from "../../../../../components/ui/card";
import { createMetadata } from "../../../../../lib/seo";

type ContinentScore = {
  name: string;
  score: number;
  distance: number;
};

type TripScoreContinentsResponse = {
  success: boolean;
  totalScore: number;
  continents: ContinentScore[];
};

async function getProfileName(id: string): Promise<string> {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${id}`);
  if (!res.ok) return "Traveler";
  const json = (await res.json()) as { profile?: { fullName?: string; username?: string } };
  return json.profile?.fullName ?? json.profile?.username ?? "Traveler";
}

async function getTripScoreContinents(userId: string): Promise<TripScoreContinentsResponse | null> {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${userId}/tripscore/continents`);
  if (!res.ok) return null;
  return (await res.json()) as TripScoreContinentsResponse;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const name = await getProfileName(params.id);
  return createMetadata({
    title: `TripScore · ${name}`,
    description: `Travel map and places visited by ${name}`,
    path: `/profile/${params.id}/tripscore`,
  });
}

export default async function ProfileTripScorePage({
  params,
}: {
  params: { id: string };
}) {
  const [profileName, data] = await Promise.all([
    getProfileName(params.id),
    getTripScoreContinents(params.id),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">TripScore not available.</p>
          <Link
            href={`/profile/${params.id}`}
            className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            ← Back to profile
          </Link>
        </Card>
      </div>
    );
  }

  const { totalScore, continents } = data;
  const continentsWithScore = continents.filter((c) => c.score > 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/profile/${params.id}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Profile
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">TripScore · {profileName}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          Unique places visited (by continent)
        </p>
        <div className="mt-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-50 text-2xl font-bold text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
            {totalScore}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Total places</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">{continentsWithScore.length} continents</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-zinc-50">By continent</h2>
        {continentsWithScore.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/80 p-8 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <p className="text-sm text-slate-500 dark:text-zinc-400">No continents with visits yet.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {continentsWithScore.map((c) => (
              <li key={c.name}>
                <Link
                  href={`/profile/${params.id}/tripscore/continents/${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-premium transition-shadow hover:shadow-premium-hover dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:shadow-premium-hover"
                >
                  <span className="font-medium text-slate-900 dark:text-zinc-50">{c.name.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 dark:text-zinc-400">
                      {c.score} place{c.score !== 1 ? "s" : ""}
                    </span>
                    {c.distance > 0 && (
                      <span className="text-xs text-slate-500 dark:text-zinc-500">
                        ~{c.distance} km
                      </span>
                    )}
                    <span className="text-slate-400 dark:text-zinc-500">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

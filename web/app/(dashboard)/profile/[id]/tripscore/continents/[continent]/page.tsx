import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../../../../lib/constants";
import { fetchWithAuth } from "../../../../../../../lib/server-fetch";
import { Card } from "../../../../../../../components/ui/card";
import { createMetadata } from "../../../../../../../lib/seo";

type CountryEntry = {
  name: string;
  score: number;
  visited: boolean;
};

type TripScoreCountriesResponse = {
  success: boolean;
  continent: string;
  continentScore: number;
  countries: CountryEntry[];
};

async function getProfileName(id: string): Promise<string> {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${id}`);
  if (!res.ok) return "Traveler";
  const json = (await res.json()) as { profile?: { fullName?: string; username?: string } };
  return json.profile?.fullName ?? json.profile?.username ?? "Traveler";
}

async function getTripScoreCountries(
  userId: string,
  continent: string
): Promise<TripScoreCountriesResponse | null> {
  const res = await fetchWithAuth(
    `${API_V1_ABS}/profile/${userId}/tripscore/continents/${encodeURIComponent(continent)}/countries`
  );
  if (!res.ok) return null;
  return (await res.json()) as TripScoreCountriesResponse;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string; continent: string };
}): Promise<Metadata> {
  const name = await getProfileName(params.id);
  const continentName = decodeURIComponent(params.continent).replace(/_/g, " ");
  return createMetadata({
    title: `${continentName} · TripScore · ${name}`,
    description: `Places visited in ${continentName} by ${name}`,
    path: `/profile/${params.id}/tripscore/continents/${params.continent}`,
  });
}

export default async function ProfileTripScoreContinentPage({
  params,
}: {
  params: { id: string; continent: string };
}) {
  const continentParam = decodeURIComponent(params.continent);
  const [profileName, data] = await Promise.all([
    getProfileName(params.id),
    getTripScoreCountries(params.id, continentParam),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">TripScore data not available.</p>
          <Link
            href={`/profile/${params.id}/tripscore`}
            className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            ← Back to TripScore
          </Link>
        </Card>
      </div>
    );
  }

  const continentName = data.continent.replace(/_/g, " ");
  const visitedCountries = data.countries.filter((c) => c.visited);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-4 text-sm">
        <Link
          href={`/profile/${params.id}/tripscore`}
          className="font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← TripScore
        </Link>
        <span className="text-slate-400 dark:text-zinc-500">/</span>
        <span className="font-medium text-slate-900 dark:text-zinc-50">{continentName}</span>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">{continentName}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          {profileName} · {data.continentScore} place{data.continentScore !== 1 ? "s" : ""} in{" "}
          {visitedCountries.length} countr{visitedCountries.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-zinc-50">Countries</h2>
        {visitedCountries.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/80 p-8 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <p className="text-sm text-slate-500 dark:text-zinc-400">No countries with visits in this continent.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {visitedCountries.map((c) => (
              <li key={c.name}>
                <Link
                  href={`/profile/${params.id}/tripscore/countries/${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-premium transition-shadow hover:shadow-premium-hover dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:shadow-premium-hover"
                >
                  <span className="font-medium text-slate-900 dark:text-zinc-50">{c.name}</span>
                  <span className="text-sm text-slate-600 dark:text-zinc-400">
                    {c.score} place{c.score !== 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

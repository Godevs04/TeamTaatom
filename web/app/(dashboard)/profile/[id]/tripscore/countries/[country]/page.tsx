import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../../../../lib/constants";
import { fetchWithAuth } from "../../../../../../../lib/server-fetch";
import { Card } from "../../../../../../../components/ui/card";
import { createMetadata } from "../../../../../../../lib/seo";

type LocationEntry = {
  name: string;
  score: number;
  date: string;
  caption?: string;
  imageUrl?: string;
  coordinates?: { latitude: number; longitude: number };
};

type TripScoreCountryResponse = {
  success: boolean;
  country: string;
  countryScore: number;
  countryDistance: number;
  locations: LocationEntry[];
};

async function getProfileName(id: string): Promise<string> {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${id}`);
  if (!res.ok) return "Traveler";
  const json = (await res.json()) as { profile?: { fullName?: string; username?: string } };
  return json.profile?.fullName ?? json.profile?.username ?? "Traveler";
}

async function getTripScoreCountryDetails(
  userId: string,
  country: string
): Promise<TripScoreCountryResponse | null> {
  const res = await fetchWithAuth(
    `${API_V1_ABS}/profile/${userId}/tripscore/countries/${encodeURIComponent(country)}`
  );
  if (!res.ok) return null;
  return (await res.json()) as TripScoreCountryResponse;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string; country: string };
}): Promise<Metadata> {
  const name = await getProfileName(params.id);
  const countryName = decodeURIComponent(params.country);
  return createMetadata({
    title: `${countryName} · TripScore · ${name}`,
    description: `Places visited in ${countryName} by ${name}`,
    path: `/profile/${params.id}/tripscore/countries/${params.country}`,
  });
}

export default async function ProfileTripScoreCountryPage({
  params,
}: {
  params: { id: string; country: string };
}) {
  const countryParam = decodeURIComponent(params.country);
  const [profileName, data] = await Promise.all([
    getProfileName(params.id),
    getTripScoreCountryDetails(params.id, countryParam),
  ]);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Country details not available.</p>
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
        <span className="font-medium text-slate-900 dark:text-zinc-50">{data.country}</span>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">{data.country}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          {profileName} · {data.countryScore} place{data.countryScore !== 1 ? "s" : ""}
          {data.countryDistance > 0 ? ` · ~${data.countryDistance} km traveled` : ""}
        </p>
      </div>

      {data.locations.length > 0 && (
        <Link
          href={`/profile/${params.id}/tripscore/countries/${params.country}/map`}
          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-premium transition hover:border-sky-200 hover:bg-slate-50 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:hover:border-sky-700 dark:hover:bg-zinc-800/80"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-zinc-50">Explore on Map</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400">View {data.country} locations</p>
            </div>
          </div>
          <svg className="h-5 w-5 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-zinc-50">Locations</h2>
        {data.locations.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/80 p-8 text-center shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
            <p className="text-sm text-slate-500 dark:text-zinc-400">No locations in this country.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {data.locations.map((loc, idx) => (
              <li key={`${loc.name}-${idx}`}>
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-premium dark:border-zinc-800/80 dark:bg-zinc-900/90">
                  <div className="flex gap-4">
                    {loc.imageUrl ? (
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={loc.imageUrl}
                          alt={loc.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-zinc-50">{loc.name}</p>
                      {loc.date ? (
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {new Date(loc.date).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      ) : null}
                      {loc.caption ? (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-zinc-400">{loc.caption}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

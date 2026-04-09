import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../../../../../lib/constants";
import { fetchWithAuth } from "../../../../../../../../lib/server-fetch";
import { Card } from "../../../../../../../../components/ui/card";
import { createMetadata } from "../../../../../../../../lib/seo";
import { CountryMapClient } from "../../../../../../../../components/profile/CountryMapClient";
import type { MapLocation } from "../../../../../../../../lib/country-map-utils";

type TripScoreCountryResponse = {
  success: boolean;
  country: string;
  countryScore: number;
  countryDistance: number;
  locations: MapLocation[];
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
    title: `Map · ${countryName} · TripScore · ${name}`,
    description: `Map of places in ${countryName} by ${name}`,
    path: `/profile/${params.id}/tripscore/countries/${params.country}/map`,
  });
}

export default async function ProfileTripScoreCountryMapPage({
  params,
}: {
  params: { id: string; country: string };
}) {
  const countryParam = decodeURIComponent(params.country);
  const [, data] = await Promise.all([
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

  const backHref = `/profile/${params.id}/tripscore/countries/${params.country}`;
  const backLabel = data.country;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <CountryMapClient
        countryName={data.country}
        locations={data.locations}
        backHref={backHref}
        backLabel={backLabel}
      />
    </div>
  );
}

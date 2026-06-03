import type { Metadata } from "next";
import Link from "next/link";
import { API_V1_ABS } from "../../../../../lib/constants";
import { fetchWithAuth } from "../../../../../lib/server-fetch";
import { ProfileTravelMapClient } from "../../../../../components/profile/profile-travel-map-client";
import { createMetadata } from "../../../../../lib/seo";

async function getProfileName(id: string): Promise<string> {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${id}`);
  if (!res.ok) return "Traveler";
  const json = (await res.json()) as { profile?: { fullName?: string; username?: string } };
  return json.profile?.fullName ?? json.profile?.username ?? "Traveler";
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const name = await getProfileName(params.id);
  return createMetadata({
    title: `Travel map · ${name}`,
    description: `Verified places visited by ${name}`,
    path: `/profile/${params.id}/travel-map`,
  });
}

export default async function ProfileTravelMapPage({ params }: { params: { id: string } }) {
  const name = await getProfileName(params.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-10">
      <Link
        href={`/profile/${params.id}`}
        className="text-sm font-medium text-primary hover:underline"
      >
        ← {name}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
        Travel map
      </h1>
      <p className="text-sm text-slate-500 dark:text-zinc-400">
        Verified trip locations (same data as the mobile world map).
      </p>
      <ProfileTravelMapClient
        userId={params.id}
        backHref={`/profile/${params.id}`}
        backLabel={`Back to ${name}`}
      />
    </div>
  );
}

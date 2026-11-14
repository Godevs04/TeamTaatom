import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { API_V1_ABS } from "../../../../lib/constants";
import { fetchWithAuth } from "../../../../lib/server-fetch";
import { Card } from "../../../../components/ui/card";
import { ProfileJourneyAccess } from "../../../../components/profile/profile-journey-access";
import { ProfileHeaderCard } from "../../../../components/profile/profile-header-card";
import { RotatingGlobe } from "../../../../components/profile/rotating-globe";
import { ProfileContentTabs, type ProfileTab } from "../../../../components/profile/profile-content-tabs";
import type { User } from "../../../../types/user";
import { createMetadata } from "../../../../lib/seo";

async function getProfile(id: string) {
  const res = await fetchWithAuth(`${API_V1_ABS}/profile/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as { profile: User };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const profileRes = await getProfile(params.id);
  const u = profileRes?.profile;
  const title = u ? `${u.fullName || u.username || "Traveler"} · Profile` : "Profile";
  const description = u?.bio ?? "View profile on Taatom";
  const image = u?.profilePic;
  return createMetadata({ title, description, image: image ?? null, path: `/profile/${params.id}` });
}

function parseTab(raw: string | string[] | undefined): ProfileTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "shorts" || value === "videos" || value === "saved" ? value : "posts";
}

/**
 * Profile — mirrors mobile app/(tabs)/profile.tsx (own) and app/profile/[id].tsx
 * (other users): header card, rotating globe, Connect (own only), Posts/Shorts/Saved tabs.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string | string[] };
}) {
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
  const isOwnProfile = !!u.isOwnProfile;
  const canViewPosts = isOwnProfile || u.canViewPosts !== false;
  const canViewLocations = isOwnProfile || u.canViewLocations !== false;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-8">
      <ProfileHeaderCard profile={u} isOwnProfile={isOwnProfile} />

      <ProfileJourneyAccess profile={u} />

      {canViewLocations ? (
        <div className="flex justify-center">
          <RotatingGlobe href={`/profile/${params.id}/travel-map`} size={isOwnProfile ? 160 : 140} />
        </div>
      ) : null}

      {isOwnProfile ? (
        <div className="flex justify-center">
          <Link
            href="/connect"
            className="inline-flex items-center gap-1.5 rounded-[30px] bg-gradient-to-r from-taatom-ocean to-taatom-emerald px-8 py-3.5 text-base font-bold tracking-[0.3px] text-white hover:opacity-90"
          >
            <Users className="h-[18px] w-[18px]" />
            Connect
          </Link>
        </div>
      ) : null}

      <ProfileContentTabs
        userId={params.id}
        isOwnProfile={isOwnProfile}
        canViewPosts={canViewPosts}
        followRequestSent={u.followRequestSent}
        initialTab={parseTab(searchParams?.tab)}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { SquarePen, X } from "lucide-react";
import type { User } from "../../types/user";
import { ExpandableText } from "../ui/expandable-text";
import { nationalityFlag } from "../../lib/country-flag";
import { ProfileImagesInline } from "./profile-images-inline";
import { ProfileFollowButtons, ProfileMenu } from "./profile-actions";

function StatBlock({ value, label, href }: { value: number; label: string; href?: string }) {
  const body = (
    <>
      <span className="block text-base font-extrabold text-slate-900 dark:text-zinc-50">{value}</span>
      <span className="block text-[10px] font-bold uppercase tracking-[0.5px] text-slate-500 dark:text-zinc-400">
        {label}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="flex-1 text-center hover:opacity-80">
      {body}
    </Link>
  ) : (
    <div className="flex-1 text-center">{body}</div>
  );
}

function StatSeparator() {
  return <span className="h-6 w-px bg-[rgba(28,115,180,0.12)]" aria-hidden />;
}

/**
 * Profile header card — mirrors mobile components/profile/ProfilePremiumView.tsx
 * (own profile) and the identity card in app/profile/[id].tsx (other users).
 */
export function ProfileHeaderCard({ profile, isOwnProfile }: { profile: User; isOwnProfile: boolean }) {
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const fullName = profile.fullName || profile.username || "Traveler";
  const flag = nationalityFlag(profile.nationality);
  const tripScore = profile.tripScore?.totalScore ?? 0;
  const showTripScore = isOwnProfile || (profile.tripScore != null && profile.canViewLocations !== false);

  React.useEffect(() => {
    if (!avatarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAvatarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [avatarOpen]);

  const nameRow = (colorClass: string) => (
    <div className="flex min-w-0 max-w-full items-center">
      <span className={`truncate text-[15px] font-bold tracking-[-0.2px] ${colorClass}`}>{fullName}</span>
      {flag ? (
        <span className="ml-2 shrink-0 text-lg leading-none" role="img" aria-label={profile.nationality}>
          {flag}
        </span>
      ) : null}
      <ProfileImagesInline images={profile.profileImages} />
    </div>
  );
  const handle = profile.username ? `@${profile.username}` : null;

  return (
    <section className="relative rounded-2xl border border-[rgba(28,115,180,0.15)] bg-white/85 px-[18px] py-4 backdrop-blur dark:border-white/10 dark:bg-black/75">
      <div className="absolute right-3 top-3 flex items-center gap-1">
        {isOwnProfile ? (
          <Link
            href="/settings/account#profile"
            className="rounded-full p-1.5 text-[#1C73B4] opacity-85 hover:bg-primary/10 dark:text-[#7AB3D6]"
            aria-label="Edit profile"
          >
            <SquarePen className="h-[18px] w-[18px]" />
          </Link>
        ) : null}
        <ProfileMenu profile={profile} />
      </div>

      <div className="flex w-full items-center pr-16">
        <button
          type="button"
          onClick={() => setAvatarOpen(true)}
          className="h-[74px] w-[74px] shrink-0 rounded-full bg-gradient-to-br from-taatom-ocean to-taatom-emerald p-[2px]"
          aria-label="View profile photo"
        >
          <span className="block h-full w-full overflow-hidden rounded-full bg-[#F0F5FA] dark:bg-[#080F19]">
            {profile.profilePic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profilePic}
                alt={fullName}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-primary/70">
                {fullName.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </button>

        <div className="ml-4 flex flex-1 items-center justify-between">
          <StatBlock value={profile.postsCount ?? 0} label="Posts" />
          <StatSeparator />
          <StatBlock
            value={profile.followersCount ?? 0}
            label="Followers"
            href={`/profile/${profile._id}/followers?type=followers`}
          />
          <StatSeparator />
          <StatBlock
            value={profile.followingCount ?? 0}
            label="Following"
            href={`/profile/${profile._id}/followers?type=following`}
          />
        </div>
      </div>

      <div className="mt-3 flex w-full flex-col items-start">
        {/* Light: name then @handle. Dark: @handle then name (mobile ProfilePremiumView). */}
        <div className="w-full dark:hidden">
          {nameRow("text-[#1C73B4]")}
          {handle ? <p className="mt-0.5 text-[15px] font-semibold text-slate-500 opacity-90">{handle}</p> : null}
        </div>
        <div className="hidden w-full dark:block">
          {handle ? <p className="text-[15px] font-semibold text-white opacity-90">{handle}</p> : null}
          <div className="mt-0.5">{nameRow("text-[#38BDF8]")}</div>
        </div>
        {profile.bio ? (
          <ExpandableText
            text={profile.bio}
            maxLines={3}
            charLimit={150}
            className="mt-1 whitespace-pre-line text-[15px] leading-[21px] text-slate-700 dark:text-zinc-300"
          />
        ) : null}
      </div>

      {!isOwnProfile ? <ProfileFollowButtons profile={profile} /> : null}

      {showTripScore ? (
        <Link
          href={`/profile/${profile._id}/tripscore`}
          className="mt-4 flex w-full items-center justify-between border-t border-[rgba(28,115,180,0.15)] pt-3 hover:opacity-80"
        >
          <span className="text-xs font-semibold tracking-[0.5px] text-slate-500 dark:text-zinc-400">TRIP SCORE</span>
          <span className="text-base font-extrabold text-slate-900 dark:text-zinc-50">{tripScore}</span>
        </Link>
      ) : null}

      {avatarOpen && profile.profilePic ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo"
          onClick={() => setAvatarOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.profilePic}
            alt={fullName}
            className="max-h-[80vh] max-w-[80vw] rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            onClick={() => setAvatarOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Close photo"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

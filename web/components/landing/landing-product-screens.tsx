"use client";

import Image from "next/image";
import { Heart, MapPin, MessageCircle, MoreHorizontal } from "lucide-react";
import { LANDING_IMAGES } from "@/lib/landing-images";
import { ProductRouteMap } from "@/components/maps/product-route-map";

const FEED_IMG = LANDING_IMAGES.product.feed;
const STORY_IMG = LANDING_IMAGES.product.story;
const PROFILE_IMG = LANDING_IMAGES.product.profile;

export function ScreenFeed() {
  return (
    <article className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_64px_rgba(20,20,20,0.1)]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-stone-200">
            <Image src={PROFILE_IMG} alt="" fill className="object-cover" sizes="40px" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Elena Park</p>
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" aria-hidden />
              Kyoto, Japan
            </p>
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-slate-400" aria-hidden />
      </div>
      <div className="relative aspect-[4/5] bg-stone-100">
        <Image src={FEED_IMG} alt="Trip post" fill className="object-cover" sizes="400px" priority />
      </div>
      <div className="flex gap-4 px-4 py-3 text-slate-600">
        <Heart className="h-5 w-5" aria-hidden />
        <MessageCircle className="h-5 w-5" aria-hidden />
      </div>
      <p className="px-4 pb-4 text-sm leading-relaxed text-slate-700">
        Temple walk at dawn — quiet streets, incense, and the playlist we made for this trip.
      </p>
    </article>
  );
}

export function ScreenStory() {
  return (
    <div className="mx-auto flex w-full max-w-[220px] flex-col gap-4">
      <div className="relative aspect-[9/16] overflow-hidden rounded-3xl bg-stone-900 shadow-[0_24px_64px_rgba(20,20,20,0.15)]">
        <Image src={STORY_IMG} alt="Travel story" fill className="object-cover" sizes="220px" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs font-medium text-white/80">Travel story</p>
          <p className="font-display text-lg text-white">Alfama at blue hour</p>
        </div>
      </div>
    </div>
  );
}

export function ScreenTimeline() {
  const stops = [
    { day: "Day 1", place: "Arrived Lisbon", active: true },
    { day: "Day 3", place: "Alfama walk", active: true },
    { day: "Day 5", place: "Sintra coast", active: false },
  ];
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_24px_64px_rgba(20,20,20,0.08)]">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--landing-accent)]">Journey</p>
      <p className="mt-1 font-display text-xl font-semibold">Portugal · Spring</p>
      <ul className="mt-6 space-y-0">
        {stops.map((s, i) => (
          <li key={s.day} className="relative flex gap-4 pb-8 last:pb-0">
            {i < stops.length - 1 ? (
              <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-slate-200" aria-hidden />
            ) : null}
            <span
              className={`relative z-10 mt-1 h-[22px] w-[22px] shrink-0 rounded-full border-2 ${
                s.active ? "border-[var(--landing-accent)] bg-[var(--landing-accent)]" : "border-slate-200 bg-white"
              }`}
            />
            <div>
              <p className="text-xs font-semibold text-slate-400">{s.day}</p>
              <p className="text-sm font-medium text-slate-900">{s.place}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScreenMap() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl bg-[#dfe6e2] shadow-[0_24px_64px_rgba(20,20,20,0.08)]">
      <div className="absolute inset-4 overflow-hidden rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm">
        <p className="absolute left-0 right-0 top-0 z-10 p-4 text-sm font-semibold text-slate-800">
          Your route · 5 stops
        </p>
        <ProductRouteMap
          className="absolute inset-0 pt-12"
          stopCount={5}
          roundedClassName="rounded-none"
        />
      </div>
    </div>
  );
}

export function ScreenProfile() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-3xl border border-slate-200/90 bg-white p-6 text-center shadow-[0_24px_64px_rgba(20,20,20,0.08)]">
      <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-stone-200">
        <Image src={PROFILE_IMG} alt="Creator profile" fill className="object-cover" sizes="80px" />
      </div>
      <p className="mt-4 font-display text-xl font-semibold">Elena Park</p>
      <p className="text-sm text-slate-500">Slow travel · Photography</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Food", "Trains", "Coast"].map((t) => (
          <span key={t} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-slate-600">
            {t}
          </span>
        ))}
      </div>
      <button type="button" className="mt-6 w-full rounded-xl bg-[var(--landing-ink)] py-2.5 text-sm font-semibold text-white">
        Follow
      </button>
    </div>
  );
}
